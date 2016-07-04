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

// event listeners
chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {
  console.log(msg)
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
  var height = '100px';
  var iframeId = 'repupSidebar';
  if (!document.getElementById(iframeId)) {
    createToolbar(iframeId, height);
    loadChromeContent('toolbar.html', function (template) {
      console.log('user: ', user)
      iframe = document.getElementById(iframeId);
      iframe.contentDocument.body.innerHTML = template.supplant({
        userImage: user.picture
      });

      iframe.contentWindow.document.getElementById("start").addEventListener('click', startRecording);
      iframe.contentWindow.document.getElementById("stop").addEventListener('click', stopRecording);

      loadChromeFile('toolbar.css', 'text/css', function (cssFile) {
        var cssLink = document.createElement("link");
        console.log(cssFile)
        cssLink.href = URL.createObjectURL(cssFile);
        cssLink.rel = "stylesheet";
        cssLink .type = "text/css";
        iframe.contentWindow.document.body.appendChild(cssLink);
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
