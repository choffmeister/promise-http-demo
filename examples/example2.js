var HttpClient = require('../lib/HttpClient'),
  Bluebird = require('bluebird');

/**
 * Parallel requests.
 */
module.exports = function () {
  var client = new HttpClient.JsonHttpClient('http://coreci.choffmeister.de/api');
  return client
    .get('/builds')
    .then(function (response) {
      // fetch three individual resources in parallel.
      return Bluebird.all([
        client.get('/projects/' + response.body[0].projectCanonicalName + '/builds/' + response.body[0].number),
        client.get('/projects/' + response.body[1].projectCanonicalName + '/builds/' + response.body[1].number),
        client.get('/projects/' + response.body[2].projectCanonicalName + '/builds/' + response.body[2].number)
      ]);
    })
    .then(function (responses) {
      // transform result
      return responses.map(function (response) {
        return response.body.id;
      });
    });
};
