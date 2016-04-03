// TODO: come up with a better way to handle user clicking the button in more than one tab
// var tabId;
var recorders = {};

chrome.browserAction.onClicked.addListener(function (tab) {
  var tabId = tab.id
  var callback = function(audioUrl) {
    sendToTab(tabId, { action: "show-audio-download", blob: audioUrl, name: "incoming"});
  };
  recorders[tabId] = new AudioRecorder('lib/worker.js', callback);
  sendToTab(tabId, { action: "append-iframe"});
});

chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {
  var tabId = sender.tab.id;
  console.log('got ',msg.action,' from tabId',tabId)
  if (msg.action == 'startRecording') {
    startRecording(tabId, msg.timeoutSeconds*1000);
  }
  if (msg.action == 'stopRecording') {
    recorders[tabId].stopRecording();
  }
});

function sendToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message, function(response) {});
}

function startRecording(tabId, recordingTimeout) {
  console.log("captureTab")
  if (recorders[tabId].recording) {
    console.log("already running!")
    sendToTab(tabId, { action: "already-running"});
  } else {
    // capture the incoming audio from the current tab
    recordIncomingStream(tabId, recordingTimeout);
    // capture the outgoing audio from the microphone
    sendToTab(tabId, { action: "capture-microphone", timeout: recordingTimeout});
  }
}

function recordIncomingStream(tabId, recordingTimeout) {
  console.log("recordIncomingStream");
  chrome.tabCapture.capture({audio: true, video: false}, function (stream) {
    window.audio = document.createElement("audio");
    window.audio.src = window.URL.createObjectURL(stream);
    window.audio.play();
    recorders[tabId].recordWithTimeout(stream,recordingTimeout);
  });
}
