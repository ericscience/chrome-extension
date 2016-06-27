var iframe;   // This is the iframe we use to display content on the page
var recorder; // This is the recorder for capturing the microphone

// This is a roundabout way of injecting the worker script to an accessible location
var workerUrl;
var x = new XMLHttpRequest();
x.responseType = 'text';
x.open('GET', chrome.extension.getURL('worker.js'));
x.onload = function() {
  var blob = new Blob([x.response], {type: "text/javascript"});
  workerUrl = window.URL.createObjectURL(blob);
}
x.send();

// event listeners
chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {
  console.log(msg)
  if (msg.action == "append-iframe") {
    appendIframe();
  }
  if (msg.action == "already-running") {
  }
  if (msg.action == "capture-microphone") {
    captureMicrophone(msg.timeout, msg.filepath)
  }
  if (msg.action == "show-audio-download") {
    showAudioDownload(msg.blob, msg.name)
  }
});

function captureMicrophone(recordingTimeout, filepath) {
  navigator.webkitGetUserMedia({audio: true}, function (stream) {
    var callback = function (audioUrl) {
      // TODO: Uncomment when server is ready
      var filename = filepath + '-outgoing.ogg'
      console.log('filename: ', filename)
      chrome.extension.sendMessage({ action: "uploadToS3", blob: audioUrl, name: filename });
      showAudioDownload(audioUrl, filename);
    }
    recorder = new AudioRecorder(workerUrl, callback);
    recorder.recordWithTimeout(stream, recordingTimeout);
  }, function(err){});
}

function showAudioDownload(localUrl, name) {
  // assuming that you've got a valid blob:chrome-extension-URL...
  var x = new XMLHttpRequest();
  x.open('GET', localUrl);
  x.responseType = 'blob';
  x.onload = function() {
    console.log(name, x.response)
    var url = URL.createObjectURL(x.response);
    var filename =  name;
    // var KB = Math.round(file.length / 1024.0 * 100) / 100;
    var anchor =  '<div><a download="'+filename+'" href="' +
        url + '">'+filename+'</a></div>';
    iframe.contentWindow.document.getElementById("incoming-audio").innerHTML += anchor;
  };
  x.send();
}

function appendIframe() {
  // ask for the user's permission to use the microphone on the first attempt
  navigator.webkitGetUserMedia({audio: true}, function(stream){
    stream.getTracks()[0].stop();
  }, function(err){});

  //height of top bar, or width in your case
  var height = '70px';
  var iframeId = 'repupSidebar';
  if (!document.getElementById(iframeId)) {

    //resolve html tag, which is more dominant than <body>
    var html;
    if (document.documentElement) {
      html = $(document.documentElement); //just drop $ wrapper if no jQuery
    } else if (document.getElementsByTagName('html') && document.getElementsByTagName('html')[0]) {
      html = $(document.getElementsByTagName('html')[0]);
    } else if ($('html').length > -1) {//drop this branch if no jQuery
      html = $('html');
    } else {
      alert('no html tag retrieved...!');
      throw 'no html tag retrieved son.';
    }

    //position
    if (html.css('position') === 'static') { //or //or getComputedStyle(html).position
      html.css('position', 'relative');//or use .style or setAttribute
    }

    //top (or right, left, or bottom) offset
    var currentTop = html.css('top');//or getComputedStyle(html).top
    if (currentTop === 'auto') {
      currentTop = 0;
    } else {
      currentTop = parseFloat($('html').css('top')); //parseFloat removes any 'px' and returns a number type
    }
    html.css(
      'top',     //make sure we're -adding- to any existing values
      currentTop + parseFloat(height) + 'px'
    );

    html.append(
      '<iframe id="'+iframeId+'" scrolling="no" frameborder="0" allowtransparency="false" '+
        'style="position: fixed; width: 100%; border:none; z-index: 2147483647; top: 0px;'+
               'height: '+height+'; right: 0px; left: 0px; background-color: #ffffff">'+
      '</iframe>'
    );
    iframe = document.getElementById(iframeId)
    iframe.contentDocument.body.innerHTML =
      '<style type="text/css">\
        html, body {          \
          height: '+height+'; \
          width: 100%;        \
          z-index: 2147483647;\
        }                     \
      </style>                \
      Recording Time (seconds): <input id="timeout" type="text" value="1">\
      <button id="start">Start Recording</button> \
      <button id="stop">Stop Recording</button> \
      <div id="incoming-audio"></div>';

    iframe.contentWindow.document.getElementById("start").addEventListener('click', startRecording);
    iframe.contentWindow.document.getElementById("stop").addEventListener('click', stopRecording);
  }
}

// Start recording audio
function startRecording() {
  iframe.contentWindow.document.getElementById("incoming-audio").innerHTML = '';
  var timeoutSeconds = iframe.contentWindow.document.getElementById("timeout").value;
  chrome.extension.sendMessage({ action: "startRecording", timeoutSeconds: timeoutSeconds });
}

// Stop recording audio
function stopRecording() {
  chrome.extension.sendMessage({ action: "stopRecording" });
  if (recorder) {
    recorder.stopRecording();
  }
}
