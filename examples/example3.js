var HttpClient = require('../lib/HttpClient'),
  Bluebird = require('bluebird');

/**
 * Parallel requests.
 */
module.exports = function () {
  var client = new HttpClient.Json('http://coreci.choffmeister.de/api');
  return client
    .get('/builds')
    .then(function (builds) {
      // fetch three individual resources in parallel.
      return Bluebird.all([
        client.get('/projects/' + builds[0].projectCanonicalName + '/builds/' + builds[0].number),
        client.get('/projects/' + builds[1].projectCanonicalName + '/builds/' + builds[1].number),
        client.get('/projects/' + builds[2].projectCanonicalName + '/builds/' + builds[2].number)
      ]);
    })
    .then(function (builds) {
      // transform result
      return builds.map(function (build) {
        return build.id;
      });
    });
};
