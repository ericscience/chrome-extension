// TODO: come up with a better way to handle user clicking the button in more than one tab
var tabId;
var recordingTimeout;

chrome.browserAction.onClicked.addListener(function () {
  sendToCurrentTab({ action: "append-iframe"});
});

chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.action == 'startRecording') {
    console.log('msg.timeoutSeconds',msg.timeoutSeconds)
    recordingTimeout = msg.timeoutSeconds*1000;
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
    // capture the incoming audio from the current tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
      tabId = tabs[0].id
      chrome.tabCapture.capture({audio: true, video: false}, gotIncomingStream);
    });
    // capture the outgoing audio from the microphone
    sendToCurrentTab({ action: "capture-microphone", timeout: recordingTimeout});
  }
}

function gotIncomingStream(stream) {
  console.log("gotStream")
  window.audio = document.createElement("audio");
  window.audio.src = window.URL.createObjectURL(stream);
  window.audio.play();

  var config = {'stream': stream }
  AudioRecorder.recordToUrl(config, recordingTimeout, function (audioUrl) {
    sendToGlobalTab({ action: "show-audio-download", blob: audioUrl, name: "incoming"});
    tabId = undefined;
    var track = stream.getTracks()[0];
    track.stop();
  });
}


// sendToGlobalTab({ action: "show-audio-download", blob: audioUrl, name: name});
//
// function recordAudio(config, callback) {
//   var recorder = new AudioRecorder(config);
//   recorder.record();
//
//   var recordingTimeout = (config && config.recordingTimeout) || 3000;
//   setTimeout(function(){
//     recorder.stopRecording(function () {});
//     var samples = recorder.getClip().samples
//     var binary = FileHandler.speexFile(samples);
//     var array = new Uint8Array(binary.length);
//     for( var i = 0; i < binary.length; i++ ) { array[i] = binary.charCodeAt(i) };
//     var blob = new Blob([array], {type: "audio/ogg"});
//     var audioUrl = URL.createObjectURL(blob);
//
//     if (callback) callback(audioUrl);
//   }, recordingTimeout);
// }
