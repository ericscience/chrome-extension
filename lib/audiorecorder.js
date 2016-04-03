var AudioRecorder = {
  DEFAULT_WORKER_PATH: 'lib/worker.js',
  worker: undefined,
  audioContext: new AudioContext(),
  mediaStreamSource: undefined,
  ready: false,
  recording: false,
  finalizeCallback: undefined,

    init: function(config) {
      if (config && config.stream) {
        AudioRecorder._useStream(config.stream)
      } else {
        navigator.webkitGetUserMedia({audio: true}, AudioRecorder._useStream, function(err){});
      }

      var worker_path = (config && config.worker_path) || AudioRecorder.DEFAULT_WORKER_PATH;
      try {
          AudioRecorder.worker = new Worker(worker_path);
          AudioRecorder.worker.onmessage = AudioRecorder._handleMessage;

      } catch(error) {
          console.error(error);
      }
    },

    // Called by init with a MediaStream object
    _useStream: function(stream) {
      var mediaStreamSource = AudioRecorder.audioContext.createMediaStreamSource(stream);
      var context = mediaStreamSource.context;

      var bufferLen = 4 * 4096;
      var numChannelsIn = 1;
      var numChannelsOut = 1;
      var node = context.createScriptProcessor(bufferLen, numChannelsIn, numChannelsOut);
      node.onaudioprocess = AudioRecorder._handleAudio;

      mediaStreamSource.connect(node);
      node.connect(context.destination);

      AudioRecorder.ready = true;
    },

    _handleAudio: function(event) {
      // Buffer has length specified in _useStream
      var buffer = event.inputBuffer.getChannelData(0);
      if (AudioRecorder.recording) {
        AudioRecorder.worker.postMessage({
          command: 'put',
          buffer: buffer
        });
      }
    },

    _handleMessage: function(event) {
      switch(event.data.command) {
        case 'finalized':
        AudioRecorder.finalizeCallback(event.data.data)
        break;

        case 'print':
        console.log(event.data.message);
        break;
      }
    },

    record: function() {
        // Starts recording to the current clip
        if (AudioRecorder.isRecording()) return true;
        AudioRecorder.recording = true

        // If we can't record on the current clip, make a new one
        AudioRecorder.worker.postMessage({ command: 'start' });
    },

    isRecording: function() {
        return AudioRecorder.ready && AudioRecorder.recording;
    },

    stopRecording: function(callback) {
        // Stops recording and passes the newly created clip object to the
        // callback function cb
        if (!AudioRecorder.isRecording()) return true;
        AudioRecorder.finalizeCallback = callback;
        AudioRecorder.recording = false;
        AudioRecorder.worker.postMessage({
            command: 'finalize'
        });
    },

		recordToUrl: function(recordingTimeout, callback)  {
			AudioRecorder.record();
			console.log("recordingTimeout",recordingTimeout)
			var finishRecording = function() {
				console.log('finishRecording')
				AudioRecorder.stopRecording(function (binary) {
          AudioRecorder.finalizeCallback = undefined;
          var array = new Uint8Array(binary.length);
  				for( var i = 0; i < binary.length; i++ ) { array[i] = binary.charCodeAt(i) };
  				var blob = new Blob([array], {type: "audio/ogg"});
  				var audioUrl = URL.createObjectURL(blob);

  				if (callback) callback(audioUrl);
        });
			}
			setTimeout(finishRecording, recordingTimeout);
		},
};
