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
