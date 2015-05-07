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
    var reqOptions = extend({}, parseUrl(url), { method: method }, options);

    var req = http.request(reqOptions, function (res) {
      res.on('error', function () {
      })
      res.on('end', function () {
      });

      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve({
          body: res,
          message: res.statusMessage,
          statusCode: res.statusCode,
          headers: res.headers,
          type: 'http_ok',
        });
      } else {
        reject({
          body: res,
          message: res.statusMessage,
          statusCode: res.statusCode,
          headers: res.headers,
          type: 'http_not_ok',
        });
      }
    });

    req.on('error', function (err) {
      reject({
        message: 'Socket error',
        statusCode: 0,
        type: 'error_socket', error: err
      });
    });

    if (requestBodyStream) {
      requestBodyStream.pipe(req, { end: true });
    } else {
      req.end();
    }
  });
};

var lowerCaseKeys = function (obj) {
  var result = {};
  Object.keys(obj).forEach(function (key) {
    result[key.toLowerCase()] = obj[key];
  });
  return result;
};

/**
 * Creates a readable stream from a buffer.
 */
var bufferToStream = function (buffer) {
  var result = new stream.Transform();
  result.push(buffer);
  result.end();
  return result;
};

/**
 * Returns a promise that gets resolved with the stream content
 * as buffer, when done reading.
 */
var streamToBuffer = function (stream, maxSize) {
  return new Bluebird(function (resolve, reject) {
    var result = new Buffer(maxSize, 'raw');
    var length = 0;

    stream.on('data', function (chunk) {
      if (length + chunk.length <= maxSize) {
        chunk.copy(result, length);
        length += chunk.length;
      } else {
        reject({
          message: 'Could not read stream to buffer, since it exceeds the maximum size',
          type: 'exceed_max_buffer_size'
        });
      }
    });
    stream.on('error', function () {
      reject({
        message: 'There was an error while reading the stream',
        type: 'error_reading_stream'
      });
    })
    stream.on('end', function () {
      resolve(result.slice(0, length));
    });
  });
};

/**
 * Adds get, post, put and delete method to an object with a basic
 * request function.
 */
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

/**
 * A HTTP client that works withs streams for request/response bodies.
 */
var StreamingHttpClient = function (baseUrl) {
  return extendWithConvenienceMethods({
    request: function (method, url, requestBodyStream, options) {
      var opts = extend({}, options);
      var fullUrl = baseUrl ? baseUrl + url : url;

      return rawRequest(method, fullUrl, requestBodyStream, opts);
    }
  });
};

/**
 * A HTTP client that works withs buffers for request/response bodies.
 */
var BufferedHttpClient = function (baseUrl) {
  var streamingClient = new StreamingHttpClient(baseUrl);

  var drainResponseBody = function (response, maxResponseBodySize) {
    return streamToBuffer(response.body, maxResponseBodySize)
      .then(function (responseBodyBuffer) {
        return extend({}, response, { body: responseBodyBuffer });
      })
      .catch(function (error) {
        throw extend({}, response, { body: null }, error);
      });
  };

  return extendWithConvenienceMethods({
    request: function (method, url, requestBodyBuffer, options) {
      var opts = extend({ maxResponseBodySize: 1024 * 1024 }, options);
      var requestBodyStream = bufferToStream(requestBodyBuffer);

      return streamingClient.request(method, url, requestBodyStream, opts)
        .then(function (response) {
          return drainResponseBody(response, opts.maxResponseBodySize);
        })
        .catch(function (response) {
          return drainResponseBody(response, opts.maxResponseBodySize)
            .then(function (res) {
              throw res;
            });
        });
    }
  });
};

/**
 * A HTTP client that works withs JavaScript objects for request/response bodies.
 * In case of non-OK HTTP responses, the body gets returned as plain string.
 */
var JsonHttpClient = function (baseUrl) {
  var bufferedClient = new BufferedHttpClient(baseUrl);

  var jsonToBuffer = function (obj) {
    return obj !== undefined ? new Buffer(JSON.stringify(obj)) :  new Buffer(0);
  };

  var bufferToJson = function (buffer) {
    var str = buffer.toString('utf-8');
    return str ? JSON.parse(str) : undefined;
  };

  return extendWithConvenienceMethods({
    request: function (method, url, requestBodyObject, options) {
      var opts = extend({}, options);
      opts.headers = extend({}, lowerCaseKeys(opts.headers || {}), {
        'accept': 'application/json',
        'content-type': 'application/json'
      });
      var requestBodyBuffer = jsonToBuffer(requestBodyObject);

      return bufferedClient.request(method, url, requestBodyBuffer, opts)
        .then(function (response) {
          return extend({}, response, {
            body: bufferToJson(response.body)
          });
        })
        .catch(function (response) {
          var transformBody = function (body) {
            var str = body.toString('utf-8');
            if (response.headers['content-type'] === 'application/json') {
              return bufferToJson(body);
            } else {
              return str.toString('utf-8');
            }
          };

          throw extend({}, response, {
            body: response.body ? transformBody(response.body) : null
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
