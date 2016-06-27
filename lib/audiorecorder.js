function AudioRecorder(worker_path, callback) {
  this.recording = false;
  this.cleanup = function () {};

  var createAudioUrl = function (binary) {
    var array = new Uint8Array(binary.length);
    for( var i = 0; i < binary.length; i++ ) { array[i] = binary.charCodeAt(i) };
    var blob = new Blob([array], {type: "audio/ogg"});
    return URL.createObjectURL(blob);
  };

  var checkpoint = function(binary) {
    var audioUrl = createAudioUrl(binary);
    if (callback) callback(audioUrl);
  }

  var finalize = function(binary) {
    this.recording = false;
    var audioUrl = createAudioUrl(binary);
    this.cleanup();
    if (callback) callback(audioUrl);
  }.bind(this);

  this.worker = new Worker(worker_path);
  this.worker.onmessage = function(event) {
    switch(event.data.command) {
      case 'checkpoint':
      checkpoint(event.data.data);
      break;

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

AudioRecorder.prototype.initializeRecording = function(stream)  {
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
}

AudioRecorder.prototype.recordWithTimeout = function(stream, recordingTimeout)  {
  this.initializeRecording(stream);

  // stop recording at specified time
	setTimeout(this.stopRecording.bind(this), recordingTimeout);
}

AudioRecorder.prototype.recordWithCheckpoints= function(stream, checkpointTimeout)  {
  this.initializeRecording(stream);

  // keep applying the checkpoint at the specified timeout
  var applyCheckpoint = function() {
    this.worker.postMessage({ command: 'checkpoint' });
    if (this.recording) {
      setTimeout(applyCheckpoint.bind(this), checkpointTimeout);
    }
  }
  setTimeout(applyCheckpoint.bind(this), checkpointTimeout);
}
