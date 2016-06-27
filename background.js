// TODO: come up with a better way to handle user clicking the button in more than one tab
// var tabId;
var recorders = {};
var s3 = new S3Upload('http://52.37.14.117');
var user = { 'id': undefined }

chrome.browserAction.onClicked.addListener(function (tab) {
  authenticatedXhr('GET', 'https://www.googleapis.com/userinfo/v2/me', function(err,status,info) {
    if (err) {
      console.error(err)
    } else {
      var thisUser = JSON.parse(info);
      user.id = thisUser.id;
    }
  });

  var tabId = tab.id
  sendToTab(tabId, { action: 'append-iframe'});
});

chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {
  var tabId = sender.tab.id;
  console.log(msg,' from tabId:', tabId)
  if (msg.action == 'startRecording') {
    startRecording(tabId, msg.timeoutSeconds*1000);
  }
  if (msg.action == 'stopRecording') {
    recorders[tabId].stopRecording();
  }
  if (msg.action == 'uploadToS3') {
    s3.uploadBlobURI(msg.blob, msg.name, 'audio/ogg');
  }
});

function sendToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message, function(response) {});
}

function startRecording(tabId, recordingTimeout) {
  if (recorders[tabId] && recorders[tabId].recording) {
    sendToTab(tabId, { action: "already-running"});
  } else {
    var timestamp = new Date().getTime();
    var filepath = user.id + '/' + timestamp;
    // capture the incoming audio from the current tab
    recordIncomingStream(tabId, recordingTimeout, filepath);
    // capture the outgoing audio from the microphone
    sendToTab(tabId, {
      action: "capture-microphone",
      timeout: recordingTimeout,
      filepath: filepath
    });
  }
}

function recordIncomingStream(tabId, recordingTimeout, filepath) {
  var callback = function(audioUrl) {
    var filename = filepath + '-incoming.ogg'
    s3.uploadBlobURI(audioUrl, filename, 'audio/ogg');
    sendToTab(tabId, { action: 'show-audio-download', blob: audioUrl, name: filename});
  };
  recorders[tabId] = new AudioRecorder('worker.js', callback);

  chrome.tabCapture.capture({audio: true, video: false}, function (stream) {
    window.audio = document.createElement("audio");
    window.audio.src = window.URL.createObjectURL(stream);
    window.audio.play();
    recorders[tabId].recordWithTimeout(stream, recordingTimeout);
  });
}
