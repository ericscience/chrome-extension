var s3 = new S3Upload('http://s3.repup.io');
var recordingTimeout = 5*60*1000;
var recorders = {};
var user = { 'id': undefined }

var filePartCount = 0;
function getFilename(filepath) {
  var filename = filepath + '-' + filePartCount + '-incoming.ogg'
  filePartCount = filePartCount + 1;
  return filename;
}

chrome.browserAction.onClicked.addListener(function (tab) {
  sendToTab(tab.id, { action: 'toggle-iframe' });
});

chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {
  var tabId = sender.tab.id;
  console.log(msg,' from tabId:', tabId)
  if (msg.action == 'initialize-iframe') {
    authenticatedXhr('GET', 'https://www.googleapis.com/userinfo/v2/me', function(err,status,info) {
      if (err) {
        console.error(err)
      } else {
        user = JSON.parse(info);
        sendToTab(tabId, { action: 'append-iframe', user: user});
        sendToTab(tabId, { action: 'add-listener'});
      }
    });
  }
  if (msg.action == 'start-recording') {
    var timestamp = Math.round(new Date().getTime() / 1000);
    var filepath = user.id + '/' + timestamp;
    startRecording(tabId, filepath);
  }
  if (msg.action == 'stop-recording') {
    if (recorders[tabId]) {
      recorders[tabId].stopRecording();
      var filePartCount = 0;
    }
  }
  if (msg.action == 'upload-to-s3') {
    s3.uploadBlobURI(msg.blob, msg.name, 'audio/ogg');
  }
  if (msg.action == 'logout') {
    revokeToken();
  }
});

function sendToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message, function(response) {});
}

function startRecording(tabId, filepath) {
  if (recorders[tabId] && recorders[tabId].recording) {
    sendToTab(tabId, { action: "already-running"});
  } else {
    // capture the incoming audio from the current tab
    recordIncomingStream(tabId, filepath);
    // capture the outgoing audio from the microphone
    sendToTab(tabId, {
      action: "capture-microphone",
      timeout: recordingTimeout,
      filepath: filepath
    });
  }
}

function recordIncomingStream(tabId, filepath) {
  var callback = function(audioUrl) {
    var filename = getFilename(filepath);
    s3.uploadBlobURI(audioUrl, filename, 'audio/ogg');
    sendToTab(tabId, { action: 'show-audio-download', blob: audioUrl, name: filename });
  };
  recorders[tabId] = new AudioRecorder('worker.js', callback);

  chrome.tabCapture.capture({audio: true, video: false}, function (stream) {
    window.audio = document.createElement("audio");
    window.audio.src = window.URL.createObjectURL(stream);
    window.audio.play();
    recorders[tabId].recordWithCheckpoints(stream, recordingTimeout);
  });
}
