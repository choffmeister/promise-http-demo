var HttpClient = require('../lib/HttpClient');

/**
 * Multiple sequential requests where each requests uses information
 * from the previous request.
 */
module.exports = function () {
  var client = new HttpClient.Json('http://coreci.choffmeister.de/api');
  return client
    .get('/builds')
    .then(function (builds) {
      return client.get('/projects/' + builds[0].projectCanonicalName + '/builds/' + builds[0].number);
    })
    .then(function (build) {
      return client.get('/projects/' + build.projectCanonicalName);
    });
};
