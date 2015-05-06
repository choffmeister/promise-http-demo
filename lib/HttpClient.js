var http = require('http'),
  parseUrl = require('url').parse,
  extend = require('extend'),
  stream = require('stream'),
  Bluebird = require('bluebird');

/**
 * Basic request funtion.
 *
 * @param {string} method The request method
 * @param {string} url The request URL
 * @param {stream.Readable|null} requestBodyStream The request body stream
 * @param {object|null} options Additional request options
 * @returns {Promise} A promise that will resolve with the response information
 */
var rawRequest = function (method, url, requestBodyStream, options) {
  console.log('%s %s', method.toUpperCase(), url);

  return new Bluebird(function (resolve, reject) {
    var reqOptions = extend({}, parseUrl(url), { method: method });
    var req = http.request(reqOptions, function (res) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        res.on('error', function (err) {
          reject({
            body: res,
            message: 'Error while reading the response body',
            status: res.statusCode,
            type: 'error_reading',
            raw: res
          });
        });
        resolve({
          body: res,
          status: res.statusCode,
          type: 'http_ok',
          raw: res
        });
      } else {
        reject({
          body: res,
          message: res.statusMessage,
          status: res.statusCode,
          type: 'http_not_ok',
          raw: res
        });
      }
    });

    req.on('error', function (err) {
      reject({ message: 'Socket error', type: 'error_socket', error: err });
    });

    if (requestBodyStream) {
      requestBodyStream.pipe(req, { end: true });
    } else {
      req.end();
    }
  });
};

var extendWithConvenienceMethods = function (httpClient) {
  return extend(httpClient, {
    get: function (url, options) {
      return httpClient.request('GET', url, null, options);
    },
    post: function (url, requestBody, options) {
      return httpClient.request('POT', url, requestBody, options);
    },
    put: function (url, requestBody, options) {
      return httpClient.request('PUT', url, requestBody, options);
    },
    delete: function (url, options) {
      return httpClient.request('DELETE', url, null, options);
    }
  });
};

var StreamingHttpClient = function (baseUrl) {
  return extendWithConvenienceMethods({
    request: function (method, url, requestBodyStream, options) {
      options = extend({}, options);
      var fullUrl = baseUrl ? baseUrl + url : url;

      return rawRequest(method, fullUrl, requestBodyStream, options);
    }
  });
};

var BufferedHttpClient = function (baseUrl) {
  var streamingClient = new StreamingHttpClient(baseUrl);

  return extendWithConvenienceMethods({
    request: function (method, url, requestBodyBuffer, options) {
      options = extend({
        maxResponseBodySize: 1024 * 1024
      }, options);

      var requestBodyStream = new stream.Transform();
      requestBodyStream.push(requestBodyBuffer);
      requestBodyStream.end();

      return streamingClient.request(method, url, requestBodyStream, options)
        .then(function (response) {
          return new Bluebird(function (resolve, reject) {
            var responseBodyBuffer = new Buffer(options.maxResponseBodySize, 'raw');
            var responseBodyBufferLength = 0;

            response.raw.on('data', function (chunk) {
              if (responseBodyBufferLength + chunk.length <= options.maxResponseBodySize) {
                chunk.copy(responseBodyBuffer, responseBodyBufferLength);
                responseBodyBufferLength += chunk.length;
              } else {
                reject({ message: 'Exceeded maximum body size', type: 'exceed_max_body_size' });
              }
            });
            response.raw.on('end', function () {
              resolve(extend({}, response, {
                body: responseBodyBuffer.slice(0, responseBodyBufferLength)
              }));
            });
          });
        });
    }
  });
};

var JsonHttpClient = function (baseUrl) {
  var bufferedClient = new BufferedHttpClient(baseUrl);

  return extendWithConvenienceMethods({
    request: function (method, url, requestBodyObject, options) {
      options = extend({}, options);

      var requestBodyBuffer = new Buffer(requestBodyObject ? JSON.stringify(requestBodyObject) : 0);

      return bufferedClient.request(method, url, requestBodyBuffer, options)
        .then(function (response) {
          return extend({}, response, {
            body: JSON.parse(response.body.toString('utf-8'))
          });
        });
    }
  });
}

module.exports = {
  StreamingHttpClient: StreamingHttpClient,
  BufferedHttpClient: BufferedHttpClient,
  JsonHttpClient: JsonHttpClient
};
