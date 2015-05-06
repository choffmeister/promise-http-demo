var HttpClient = require('../lib/HttpClient');

/**
 * Multiple sequential requests where each requests uses information
 * from the previous request.
 */
module.exports = function () {
  var client = new HttpClient.JsonHttpClient('http://coreci.choffmeister.de/api');
  return client
    .get('/builds')
    .then(function (response) {
      return client.get('/projects/' + response.body[0].projectCanonicalName + '/builds/' + response.body[0].number);
    })
    .then(function (response) {
      return client.get('/projects/' + response.body.projectCanonicalName);
    })
    .then(function (response) {
      return response.body;
    });
};
