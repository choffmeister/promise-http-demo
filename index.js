var Bluebird = require('bluebird'),
  example1 = require('./examples/example1'),
  example2 = require('./examples/example2');

runExamples([example1, example2]);

function runExamples (tests) {
  if (tests.length == 0) return;
  console.log('=== Starting example ========================================');
  var test = tests.shift();
  return test()
    .then(function (res) {
      console.log('=== Result\n%s', JSON.stringify(res, true, 2));
    })
    .catch(function (err) {
      console.log('=== Error\n%s', err.stack ? err.stack : err.toString());
    })
    .then(function () {
      console.log('=== Finished example ========================================');
      return runExamples(tests);
    });
};
