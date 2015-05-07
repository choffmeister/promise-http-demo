var HttpClient = require('../lib/HttpClient'),
  Bluebird = require('bluebird');

/**
 * Read error messages.
 */
module.exports = function () {
  var client = new HttpClient.JsonHttpClient('http://coreci.choffmeister.de/api');
  return client
    .get('/unknown');
};
