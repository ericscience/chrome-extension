var $             = require('gulp-load-plugins')({ lazy: true });
var gulp          = require('gulp');

var paths = {
  background: [
    'lib/s3.js',
    'lib/audiorecorder.js',
    'background.js'
  ],
  contentscript: [
    'lib/jquery-2.2.0.min.js',
    'lib/audiorecorder.js',
    'contentscript.js'
  ],
  worker: [
    'lib/ogg.js',
    'lib/codec.js'
  ]
}

gulp.task('build', function () {
  for (scope of ['background','worker','contentscript']) {
    gulp.src(paths[scope])                 // Read .js files
      .pipe($.concat(scope + '.js'))       // Concatenate .js files
      .pipe(gulp.dest('./build/'))         // Save main.js here
  }
});

gulp.task('default', function () {
  for (scope of ['background','worker','contentscript']) {
    gulp.watch(paths[scope], ['build']);
  }
});
