var iframe;   // This is the iframe we use to display content on the page
var height = '50px';
var iframeId = 'repupToolbar';
var isRecording = false;

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
    if (msg.site === "hubspot") {
      addHubspotListener();
    } else if (msg.site === "hangouts") {
      addHangoutsListener();
    }
  }
  if (msg.action == "append-iframe") {
    appendIframe(msg.user);
  }
  if (msg.action == "toggle-iframe") {
    toggleIframe();
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

function toggleIframe() {
  if (!iframe) {
    chrome.extension.sendMessage({ action: "initialize-iframe"});
  } else if (iframe.style.display === "none") {
    showToolbar(iframe, height);
  } else {
    hideToolbar(iframe, height);
  }
}

// hangouts: $('div.talk_chat_widget').
function addHangoutsListener() {
  window.setInterval(function () {
    if ($('div.talk_chat_widget').css('width') > '1px') {
      window.postMessage({ type: "connection-ping", status: "open" }, "*");
    } else {
      window.postMessage({ type: "connection-ping", status: "closed" }, "*");
    }
  }, 2000);
}

function addHubspotListener() {
  window.setInterval(function () {
    console.log("checking for call")
    if ($('button i18n-string[data-key="twilio.calling.callActionsBar.hangUp"]').length > 0) {
      console.log("call started")
      window.postMessage({ type: "connection-ping", status: "open" }, "*");
    } else {
      window.postMessage({ type: "connection-ping", status: "closed" }, "*");
    }
  }, 2000);
}

// start/stop recording based on conncetion status

window.addEventListener("message", function(event) {
  if (event.source === window && (event.data.type == "connection-ping")) {
    if (event.data.status == "open" && isRecording === false) {
      startRecording();
    }
    if (event.data.status == "closed" && isRecording === true)  {
      stopRecording();
    }
  }
}, false);

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
  isRecording = true;
  iframe.contentWindow.document.getElementById("incoming-audio").innerHTML = '';
  chrome.extension.sendMessage({ action: "start-recording"});
}

// Stop recording audio
function stopRecording() {
  isRecording = false;
  chrome.extension.sendMessage({ action: "stop-recording" });
  if (recorder) {
    recorder.stopRecording();
    filePartCount = 0;
  }
}
