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
