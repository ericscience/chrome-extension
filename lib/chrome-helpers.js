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

// TODO: get the chrome extension logout working
// http://stackoverflow.com/questions/17337107/google-packaged-app-identity-api-removecachedauthtoken
function revokeToken() {
  // user_info_div.innerHTML="";
  chrome.identity.getAuthToken({ 'interactive': false },
    function(current_token) {
      if (!chrome.runtime.lastError) {

        // @corecode_begin removeAndRevokeAuthToken
        // @corecode_begin removeCachedAuthToken
        // Remove the local cached token
        chrome.identity.removeCachedAuthToken({ token: current_token },
          function() {});
        // @corecode_end removeCachedAuthToken

        // Make a request to revoke token in the server
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://accounts.google.com/o/oauth2/revoke?token=' +
                 current_token);
        xhr.send();
        // @corecode_end removeAndRevokeAuthToken

        // Update the user interface accordingly
        // changeState(STATE_START);
        // sampleSupport.log('Token revoked and removed from cache. '+
        //   'Check chrome://identity-internals to confirm.');
      }
  });
}

function loadChromeFile(filename, filetype, callback) {
  loadChromeContent(filename, function (response) {
    var blob = new Blob([response], {type: filetype});
    // var file = new File([blob], filename);
    if (callback) {
      callback(blob);
    }
  });
}

function loadChromeContent(filename, callback) {
  var workerUrl;
  var x = new XMLHttpRequest();
  x.responseType = 'text';
  x.open('GET', chrome.extension.getURL(filename));
  x.onload = function() {
    if (callback) {
      callback(x.response);
    }
  }
  x.send();
}

// http://stackoverflow.com/questions/6681697/how-to-make-a-toolbar-in-google-chrome
function createToolbar(iframeId, height) {
  var iframe = document.createElement('iframe');
  iframe.setAttribute('id', iframeId);
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allowtransparency', 'false');
  iframe.style.height = height;
  iframe.style.width = '100%';
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.zIndex = '938089'; // some high number
  document.documentElement.appendChild(iframe);

  var bodyStyle = document.body.style;
  var cssTransform = 'transform' in bodyStyle ? 'transform' : 'webkitTransform';
  bodyStyle[cssTransform] = 'translateY(' + height + ')';
}

function hideToolbar(iframe, height) {
  iframe.style.height = 0;
  iframe.style.width = 0;
  iframe.style.display = 'none';
  iframe.setAttribute("tabindex", -1);

  var bodyStyle = document.body.style;
  var cssTransform = 'transform' in bodyStyle ? 'transform' : 'webkitTransform';
  bodyStyle[cssTransform] = 'translateY(0px)';
}

function showToolbar(iframe, height) {
  iframe.style.height = height;
  iframe.style.width = '100%';
  iframe.style.display = 'block';
  iframe.removeAttribute("tabindex");

  var bodyStyle = document.body.style;
  var cssTransform = 'transform' in bodyStyle ? 'transform' : 'webkitTransform';
  bodyStyle[cssTransform] = 'translateY(' + height + ')';
}

String.prototype.supplant = function (o) {
    return this.replace(/{([^{}]*)}/g,
        function (a, b) {
            var r = o[b];
            return typeof r === 'string' || typeof r === 'number' ? r : a;
        }
    );
};
