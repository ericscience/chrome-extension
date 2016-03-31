// TODO: come up with a better way to handle user clicking the button in more than one tab
var tabId;

chrome.browserAction.onClicked.addListener(function () {
  sendToCurrentTab({ action: "append-iframe"});
});

chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {
   if (msg.action == 'clickme') {
      captureTab();
   }
});

function sendToCurrentTab(message) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
    chrome.tabs.sendMessage(tabs[0].id, message, function(response) {});
  });
}

function sendToGlobalTab(message) {
  chrome.tabs.sendMessage(tabId, message, function(response) {});
}

function captureTab() {
  console.log("captureTab")
  if (tabId) {
    console.log("already running!")
    sendToGlobalTab({ action: "already-running"});
  } else {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
      tabId = tabs[0].id
      chrome.tabCapture.capture({audio: true, video: false}, gotStream);
    });
  }
}

function gotStream(stream) {
  console.log("gotStream")
  window.audio = document.createElement("audio");
  window.audio.src = window.URL.createObjectURL(stream);
  window.audio.play()
  recordStream(stream)
}

function recordStream(stream) {
  console.log("recordMp3Stream")
  var duration = 10000;

  var recordAudio = RecordRTC(stream, {
    type: 'audio',
    recorderType: StereoAudioRecorder
  });

  // duration should be in milliseconds
  // RecordRTC will auto stop recording after provided duration
  recordAudio.setRecordingDuration(10000)
             .onRecordingStopped(stoppedCallback);

  recordAudio.startRecording();

  function stoppedCallback(url) {
    var audioUrl = URL.createObjectURL(recordAudio.blob);
    sendToGlobalTab({ action: "show-audio", blob: audioUrl });
    tabId = undefined;
    var track = stream.getTracks()[0];
    track.stop();
  }

}
