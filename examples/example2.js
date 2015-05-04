var HttpClient = require('../lib/HttpClient');

/**
 * A single request with automatic retrying in case of network errors.
 */
module.exports = function () {
  var client = new HttpClient.Raw('http://invalid.domain.tld');
  return client
    .get('/unknown', { retries: 3 });
};
