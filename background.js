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

// disable the google hangouts extension when we open this extension
var googleHangoutsExtension = {
  id : "knipolnnllmklapflnccelgolnpehhpl",
  enabled: undefined,
  disable: function (callback) {
    chrome.management.get(googleHangoutsExtension.id, function (extension) {
      if (googleHangoutsExtension.enabled === undefined) {
        googleHangoutsExtension.enabled = extension.enabled
      }
      chrome.management.setEnabled(googleHangoutsExtension.id, false, callback);
    })
  },
  resetState: function (tabId, callback) {
    if (googleHangoutsExtension.enabled !== undefined) {
      chrome.management.setEnabled(googleHangoutsExtension.id, this.enabled, callback)
    }
  }
}

// reset the state of the google hangouts extension if we change this tab
var activeTabs = {}
chrome.tabs.onRemoved.addListener(function (tabId) {
  if (activeTabs[tabId]) {
    googleHangoutsExtension.resetState();
  }
});

chrome.tabs.onUpdated.addListener(function (tabId) {
  if (activeTabs[tabId]) {
    googleHangoutsExtension.resetState();
  }
});

chrome.browserAction.onClicked.addListener(function (tab) {
  activeTabs[tab.id] = true;
  sendToTab(tab.id, { action: 'toggle-iframe'});
});

function initializeIframe(tab, site) {
  authenticatedXhr('GET', 'https://www.googleapis.com/userinfo/v2/me', function(err,status,info) {
    if (err) {
      console.error(err)
    } else {
      user = JSON.parse(info);
      sendToTab(tab.id, { action: 'append-iframe', user: user });
      sendToTab(tab.id, { action: 'add-listener', site: site });
    }
  });
}

function matchValidSiteAndInitializeIframe(tab) {
  var hangoutsRegex = new RegExp(/.*hangouts\.google\.com.*/gi);
  var hubspotRegex = new RegExp(/.*app\.hubspot\.com.*/gi);
  if (tab.url.match(hangoutsRegex)) {
    googleHangoutsExtension.disable(function () {
      initializeIframe(tab, 'hangouts');
    });
  } else if (tab.url.match(hubspotRegex)){
    initializeIframe(tab, 'hubspot');
  }
}

chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {
  var tab = sender.tab;
  console.log(msg,' from tabId:', sender.tab.id);
  if (msg.action == 'initialize-iframe') {
    matchValidSiteAndInitializeIframe(tab);
  }
  if (msg.action == 'start-recording') {
    var timestamp = Math.round(new Date().getTime() / 1000);
    var filepath = user.id + '/' + timestamp;
    startRecording(tab.id, filepath);
  }
  if (msg.action == 'stop-recording') {
    if (recorders[tab.id]) {
      recorders[tab.id].stopRecording();
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
