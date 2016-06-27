var FileHandler = {
  speexFile: function(data) {
    var sampleRate = 44100;
    var isNarrowband = sampleRate < 16000;
    var oggdata = new Ogg(null, {file: true});

    spxdata = [new Uint8Array(data[0].length),data[1]];
    spxdata[0].set(data[0]);

    var spxhdr = new SpeexHeader({
      bitrate: -1,
      extra_headers: 0,
      frame_size: isNarrowband ? 160 : 320,
      frames_per_packet: 1,
      header_size: 80,
      mode: isNarrowband ? 0 : 1,
      mode_bitstream_version: 4,
      nb_channels: 1,
      rate: sampleRate,
      reserved1: 0,
      reserved2: 0,
      speex_string: "Speex   ",
      speex_version_id: 1,
      speex_version_string: "1.2rc1\0\0\0\0\0\0\0\0\0\0\0\0\0\0",
      vbr: 0
    });

    var comment = "Encoded with speex.js";
    var spxcmt = new SpeexComment({
      vendor_string: comment,
      vendor_length: comment.length
    });

    var result = oggdata.mux([spxhdr, spxcmt, spxdata]);
    return result;
  }
};

var Codec = {
  speex: new Speex({ quality: 8, mode:  1, bits_size: 70 }),

  // TODO(Bieber): See if you need to make a copy before returning the buffer
  encode: function(buffer, callback) {
    // To preserve length, encode a multiple of 320 samples.
    var datalen = buffer.length;
    var shorts = new Int16Array(datalen);
    for(var i = 0; i < datalen; i++) {
        shorts[i] = Math.floor(Math.min(1.0, Math.max(-1.0, buffer[i])) * 32767);
    }
    var encoded = Codec.speex.encode(shorts, true);
    callback(encoded);
  },

  decode: function(buffer) {
    return Codec.speex.decode(buffer);
  }
};

// To debug from this web worker, console.log by sending the following message
// _this.postMessage({
//     'command': 'print',
//     'message': 'Your message here'
// });

var _this = this;
_this.onmessage = function(e) {
  switch(e.data.command) {
    case 'start':
    Encoder.start();
    break;

    case 'put':
    Encoder.put(e.data.buffer);
    break;

    case 'finalize':
    Encoder.finalize();
    break;

    case 'checkpoint':
    Encoder.checkpoint();
    break;

    case 'clear':
    break;
  }
};

var Encoder = {
	//TODO implement narrowband (size 160)
  FRAME_SIZE: 320,
  recording: false,
  samples: [],
  speex: [[],[]],

  start: function() {
    Encoder.recording = true;
  },

  put: function(buffer) {
    // _this.postMessage({ 'command': 'print', 'message': Encoder.samples });
    Array.prototype.push.apply(Encoder.samples, buffer);
  },

  process: function(callback) {
    if (Encoder.recording) {
      var samples = Encoder.samples.slice(0); // copy the samples
      Encoder.samples = [];
      while (samples.length % Encoder.FRAME_SIZE !== 0) {
        samples.push(0);  // pad with silence
      }

      if (samples.length > 0) {
          Codec.encode(samples, function (encoded) {
              Array.prototype.push.apply(Encoder.speex[0], encoded[0]);
              Array.prototype.push.apply(Encoder.speex[1], encoded[1]);
              if (callback) {
                callback(Encoder.speex);
                Encoder.speex = [[],[]];
              }
          });
      } else {
        if (callback) {
          callback(Encoder.speex);
          Encoder.speex = [[],[]];
        }
      }
    }
  },

  finalize: function() {
    Encoder.process(function (speexData) {
      Encoder.recording = false;
      _this.postMessage({
        'command': 'finalized',
        'data': FileHandler.speexFile(speexData)
      });
    });
  },

  checkpoint: function() {
    Encoder.process(function (speexData) {
      _this.postMessage({
        'command': 'checkpoint',
        'data': FileHandler.speexFile(speexData)
      });
    });
  }
};

setInterval(Encoder.process, 2000);
