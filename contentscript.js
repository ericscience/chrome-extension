var iframe;   // This is the iframe we use to display content on the page
var recorder; // This is the recorder for capturing the microphone
var filePartCount = 0;
function getFilename(filepath) {
  var filename = filepath + '-' + filePartCount + '-outgoing.ogg'
  filePartCount = filePartCount + 1;
  return filename;
}

// This is a roundabout way of injecting the worker script to an accessible location
var workerUrl;
loadChromeFile('worker.js', 'text/javascript', function (file) {
  workerUrl = window.URL.createObjectURL(file);
});

// background event listeners
chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {
  console.log(msg)
  if (msg.action == "add-listener") {
    addHubspotListener();
  }
  if (msg.action == "append-iframe") {
    appendIframe(msg.user);
  }
  if (msg.action == "already-running") {
  }
  if (msg.action == "capture-microphone") {
    captureMicrophone(msg.timeout, msg.filepath)
  }
  if (msg.action == "show-audio-download") {
    showAudioDownload(msg.blob, msg.name)
  }
});

function addHubspotListener() {
  // set up a small scrip to send the twilio connection status
  function pingTwilioConnectionStatus() {
    window.setInterval(function () {
      var events = (((window.hubspot || {}).twilio || {}).phoneCallEventBus || {})._events;
      var deviceReady = ((events || {})['twilio:device:ready'] || {})[0];
      var connection = (((deviceReady || {}).context || {}).twilioDeviceClient || {}).connection;
      if (connection) {
        window.postMessage({ type: "twilio-ping", status: connection._status }, "*");
      }
    }, 1000);
  }

  // inject the script into the webpage
  var script = document.createElement('script');
  script.appendChild(document.createTextNode('('+ pingTwilioConnectionStatus +')();'));
  (document.body || document.head || document.documentElement).appendChild(script);

  // start/stop recording based on twilio conncetion status
  var isRecording = false;
  window.addEventListener("message", function(event) {
    // We only accept messages from ourselves
    if (event.source === window && (event.data.type == "twilio-ping")) {
      console.log("Twilio connection status: " + event.data.status);
      if (event.data.status == "open" && isRecording === false) {
        isRecording = true;
        startRecording()
      }
      if (event.data.status == "closed" && isRecording === true)  {
        isRecording = false;
        stopRecording()
      }
    }
  }, false);
}

function captureMicrophone(recordingTimeout, filepath) {
  navigator.webkitGetUserMedia({audio: true}, function (stream) {
    var callback = function (audioUrl) {
      // TODO: Uncomment when server is ready
      var filename = getFilename(filepath);
      chrome.extension.sendMessage({ action: "upload-to-s3", blob: audioUrl, name: filename });
      showAudioDownload(audioUrl, filename);
    }
    recorder = new AudioRecorder(workerUrl, callback);
    recorder.recordWithCheckpoints(stream, recordingTimeout);
  }, function(err){});
}

function showAudioDownload(localUrl, name) {
  // assuming that you've got a valid blob:chrome-extension-URL...
  var x = new XMLHttpRequest();
  x.open('GET', localUrl);
  x.responseType = 'blob';
  x.onload = function() {
    console.log(name, x.response)
    var url = URL.createObjectURL(x.response);
    var filename =  name;
    // var KB = Math.round(file.length / 1024.0 * 100) / 100;
    var anchor =  '<div><a download="'+filename+'" href="' +
        url + '">'+filename+'</a></div>';
    iframe.contentWindow.document.getElementById("incoming-audio").innerHTML += anchor;
  };
  x.send();
}

function appendIframe(user) {
  // ask for the user's permission to use the microphone on the first attempt
  navigator.webkitGetUserMedia({audio: true}, function(stream){
    stream.getTracks()[0].stop();
  }, function(err){});

  //height of top bar, or width in your case
  var height = '50px';
  var iframeId = 'repupSidebar';
  if (!document.getElementById(iframeId)) {
    createToolbar(iframeId, height);
    loadChromeContent('toolbar.html', function (template) {
      iframe = document.getElementById(iframeId);
      iframe.contentDocument.body.innerHTML = template.supplant({
        userImage: user.picture,
        userEmail: user.email
      });

      iframe.contentWindow.document.getElementById("profile-menu").addEventListener('click', function () {
        chrome.extension.sendMessage({ action: "logout"});
      });
    });
  }
}

// Start recording audio
function startRecording() {
  iframe.contentWindow.document.getElementById("incoming-audio").innerHTML = '';
  chrome.extension.sendMessage({ action: "start-recording"});
}

// Stop recording audio
function stopRecording() {
  chrome.extension.sendMessage({ action: "stop-recording" });
  if (recorder) {
    recorder.stopRecording();
  }
}
