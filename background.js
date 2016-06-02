// TODO: come up with a better way to handle user clicking the button in more than one tab
// var tabId;
var recorders = {};
var user = {
  email: undefined
}

chrome.browserAction.onClicked.addListener(function (tab) {
  var tabId = tab.id
  var callback = function(audioUrl) {
    // TODO: Uncomment when server is ready
    // uploadToS3(audioUrl, 'incoming')
    sendToTab(tabId, { action: 'show-audio-download', blob: audioUrl, name: 'incoming'});
  };
  recorders[tabId] = new AudioRecorder('lib/worker.js', callback);
  sendToTab(tabId, { action: 'append-iframe'});

  authenticatedXhr('GET', 'https://www.googleapis.com/userinfo/v2/me', function(err,status,info) {
    if (err) {
      console.error(err)
    }
    console.log(info);
    user.email = info.email;
  });
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
  if (msg.action == 'uploadToS3') {
    // TODO: Upload to S3. Needs server for signing request change from localhost when ready
    var s3 = new S3Upload('http://localhost:3000');
    s3.uploadBlobURI(msg.blob, msg.name+'.ogg', 'audio/ogg');
  }
});

function sendToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message, function(response) {});
}

function startRecording(tabId, recordingTimeout) {
  if (recorders[tabId].recording) {
    sendToTab(tabId, { action: "already-running"});
  } else {
    // capture the incoming audio from the current tab
    recordIncomingStream(tabId, recordingTimeout);
    // capture the outgoing audio from the microphone
    sendToTab(tabId, { action: "capture-microphone", timeout: recordingTimeout});
  }
}

function recordIncomingStream(tabId, recordingTimeout) {
  chrome.tabCapture.capture({audio: true, video: false}, function (stream) {
    window.audio = document.createElement("audio");
    window.audio.src = window.URL.createObjectURL(stream);
    window.audio.play();
    recorders[tabId].recordWithTimeout(stream,recordingTimeout);
  });
}

// From https://developer.chrome.com/apps/app_identity
function authenticatedXhr(method, url, callback) {
  var retry = true;
  function getTokenAndXhr() {
    chrome.identity.getAuthToken({ 'interactive': true }, function (access_token) {
      if (chrome.runtime.lastError) {
        callback(chrome.runtime.lastError);
        return;
      }

      var xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.setRequestHeader('Authorization','Bearer ' + access_token);

      xhr.onload = function () {
        if (this.status === 401 && retry) {
          // This status may indicate that the cached access token was invalid. Retry once with a fresh token.
          retry = false;
          chrome.identity.removeCachedAuthToken({ 'token': access_token }, getTokenAndXhr);
          return;
        }
        callback(null, this.status, this.responseText);
      }
      xhr.send();
    });
  }
  getTokenAndXhr();
}
