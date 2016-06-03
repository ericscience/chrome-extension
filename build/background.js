// Built for use with https://github.com/ericgarcia/react-s3-uploader
var S3Upload = (function () {

  function S3Upload(signingHost) {
    this.signingHost = signingHost;
  }

  S3Upload.prototype.uploadBlobURI = function(dataURI, fileName, fileType) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', dataURI);
    xhr.responseType = 'blob';
    xhr.onload = function () {
      var file = new File([xhr.response], fileName, {type: fileType});
      console.log(file)
      this.uploadFile(file);
    }.bind(this)
    xhr.send();
  }

  S3Upload.prototype.uploadFile = function(file) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', this.signingHost+'/s3/sign?objectName='+file.name+'&contentType='+file.type);
    xhr.onreadystatechange = function() {
      if(xhr.readyState === 4){
        if(xhr.status === 200){
          const response = JSON.parse(xhr.responseText);
          console.log(file, response)
          uploadWithSignedUrl(file, response.signedUrl);
        }
        else{
          console.error('Could not get signed URL.');
        }
      }
    }.bind(this);
    xhr.send();
  }

  function uploadWithSignedUrl(file, signedUrl) {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.onreadystatechange = function() {
      if(xhr.readyState === 4){
        if(xhr.status === 200){
          console.log('success!');
        }
        else{
          console.error('Could not upload file.');
        }
      }
    };
    xhr.send(file);
  }

  return S3Upload;
})();

function AudioRecorder(worker_path, callback) {
  this.recording = false;
  this.cleanup = function () {};

  var finalize = function(binary) {
    this.recording = false;
    var array = new Uint8Array(binary.length);
    for( var i = 0; i < binary.length; i++ ) { array[i] = binary.charCodeAt(i) };
    var blob = new Blob([array], {type: "audio/ogg"});
    var audioUrl = URL.createObjectURL(blob);
    this.cleanup();
    if (callback) callback(audioUrl);
  }.bind(this);

  this.worker = new Worker(worker_path);
  this.worker.onmessage = function(event) {
    switch(event.data.command) {
      case 'finalized':
      finalize(event.data.data);
      break;

      case 'print':
      console.log(event.data.message);
      break;
    }
  };

  this.handleAudio = function(event) {
    this.worker.postMessage({
      command: 'put',
      buffer: event.inputBuffer.getChannelData(0)
    });
  }.bind(this);

}

AudioRecorder.prototype.stopRecording = function() {
  this.worker.postMessage({ command: 'finalize' });
}

AudioRecorder.prototype.recordWithTimeout = function(stream, recordingTimeout)  {
  this.recording = true;

  // setup the audio handler
  var audioContext = new AudioContext();
  var mediaStreamSource = audioContext.createMediaStreamSource(stream);
  var context = mediaStreamSource.context;

  var bufferLen = 4 * 4096;
  var numChannelsIn = 1;
  var numChannelsOut = 1;
  var node = context.createScriptProcessor(bufferLen, numChannelsIn, numChannelsOut);
  node.onaudioprocess = this.handleAudio

  mediaStreamSource.connect(node);
  node.connect(context.destination);

  // cleanup when finished
  this.cleanup = function () {
    mediaStreamSource.disconnect(node);
    node.disconnect(context.destination);
    stream.getTracks()[0].stop();
  }

  // start recording
  this.worker.postMessage({ command: 'start' });

  // stop recording at specified time
	console.log("recordingTimeout", recordingTimeout)
	setTimeout(this.stopRecording.bind(this), recordingTimeout);
}

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
  recorders[tabId] = new AudioRecorder('worker.js', callback);
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
  console.log(msg,' from tabId:',tabId)
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
