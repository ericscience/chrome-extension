// TODO: come up with a better way to handle user clicking the button in more than one tab
var tabId;
var recordingTimeout;

chrome.browserAction.onClicked.addListener(function (tab) {
  if (tabId) {
    sendToGlobalTab({ action: "already-running"});
  } else {
    tabId = tab.id
    console.log(tab)
    chrome.tabCapture.capture({audio: true, video: false}, gotIncomingStream);
    sendToGlobalTab({ action: "append-iframe"});
  }
});

chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.action == 'startRecording') {
    console.log('msg.timeoutSeconds',msg.timeoutSeconds)
    recordingTimeout = msg.timeoutSeconds*1000;
    console.log('tabId',tabId)
    startRecording();
  }
});

function sendToGlobalTab(message) {
  chrome.tabs.sendMessage(tabId, message, function(response) {});
}

function startRecording() {
  console.log("captureTab")
  if (AudioRecorder.isRecording()) {
    console.log("already running!")
    sendToGlobalTab({ action: "already-running"});
  } else {
    // capture the incoming audio from the current tab
    recordIncomingStream();
    // capture the outgoing audio from the microphone
    sendToGlobalTab({ action: "capture-microphone", timeout: recordingTimeout});
  }
}

function gotIncomingStream(stream) {
  console.log("gotIncomingStream")
  window.audio = document.createElement("audio");
  window.audio.src = window.URL.createObjectURL(stream);
  window.audio.play();
  AudioRecorder.init({stream: stream});
}

function recordIncomingStream() {
  console.log("recordIncomingStream");
  AudioRecorder.recordToUrl(recordingTimeout, function (audioUrl) {
    sendToGlobalTab({ action: "show-audio-download", blob: audioUrl, name: "incoming"});
  });
}
