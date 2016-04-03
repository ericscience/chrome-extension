chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {
  console.log("got " + msg.action)
  if (msg.action == "append-iframe") {
    appendIframe();
  }
  if (msg.action == "already-running") {
  }
  if (msg.action == "capture-microphone") {
    captureMicrophone(msg.timeout)
  }
  if (msg.action == "show-audio") {
    showAudio(msg.blob)
  }
  if (msg.action == "show-audio-download") {
    showAudioDownload(msg.blob, msg.name)
  }
});

var iframe;

function appendIframe() {
  // ask for the user's permission to use the microphone on the first attempt
  navigator.webkitGetUserMedia({audio: true}, function(stream){
    stream.getTracks()[0].stop();
  }, function(err){});

  //height of top bar, or width in your case
  var height = '70px';
  var iframeId = 'callRankSidebar';
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
      Recording Time (seconds): <input id="timeout" type="text" value="10">\
      <button id="clickme">Start Recording</button> \
      <div id="incoming-audio"></div>';

    iframe.contentWindow.document.getElementById("clickme").addEventListener('click', clickme);
  }
}

function clickme() {
  iframe.contentWindow.document.getElementById("incoming-audio").innerHTML = '';
  var timeoutSeconds = iframe.contentWindow.document.getElementById("timeout").value;
  chrome.extension.sendMessage({ action: "startRecording", timeoutSeconds: timeoutSeconds });
}

var config = { 'worker_path': 'lib/worker.js' };

function captureMicrophone(recordingTimeout) {
  AudioRecorder.recordToUrl(config, recordingTimeout, function (audioUrl) {
    showAudioDownload(audioUrl, "outgoing");
    // var track = stream.getTracks()[0];
    // track.stop();
  });
}


function showAudio(localUrl) {

  // assuming that you've got a valid blob:chrome-extension-URL...
  var x = new XMLHttpRequest();
  x.open('GET', localUrl);
  x.responseType = 'blob';
  x.onload = function() {
    var url = URL.createObjectURL(x.response);
    // Example: blob:http%3A//example.com/17e9d36c-f5cd-48e6-b6b9-589890de1d23
    // Now pass url to the page, e.g. using postMessage
    var audio = new Audio();
    audio.controls = true;
    audio.src = url;
    iframe.contentWindow.document.getElementById("incoming-audio").appendChild(audio);
  };
  x.send();

}

function showAudioDownload(localUrl, name) {

  // assuming that you've got a valid blob:chrome-extension-URL...
  var x = new XMLHttpRequest();
  x.open('GET', localUrl);
  x.responseType = 'blob';
  x.onload = function() {
    console.log(name,x.response)
    var url = URL.createObjectURL(x.response);
    var filename =  name + ".ogg";
    // var KB = Math.round(file.length / 1024.0 * 100) / 100;
    var anchor =  '<div><a download="'+filename+'" href="' +
        url + '">'+filename+'</a></div>';
    iframe.contentWindow.document.getElementById("incoming-audio").innerHTML += anchor;
  };
  x.send();

}
