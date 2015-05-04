var http = require('http'),
  parseUrl = require('url').parse,
  extend = require('extend'),
  Bluebird = require('bluebird');

var HttpClient = function (baseUrl, transformRequestBody, transformResponseBody) {
  this.baseUrl = baseUrl;
  this.transformRequestBody = transformRequestBody || function (reqBody) { return reqBody; };
  this.transformResponseBody = transformResponseBody || function (resBody) { return resBody; };
};

HttpClient.prototype.request = function (method, url, payload, options) {
  var self = this;

  var fullUrl = self.baseUrl ? self.baseUrl + url : url;
  console.log('%s %s', method.toUpperCase(), fullUrl);

  return new Bluebird(function (resolve, reject) {
    payload = payload || null;
    options = extend({
      followRedirects: 10,
      maxBodySize: 1024 * 1024,
      retries: 0,
      retryDelay: 100
    }, options);

    var reqOptions = extend({}, parseUrl(fullUrl), { method: method });
    var req = http.request(reqOptions, function (res) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        var body = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          if (body.length + chunk.length <= options.maxBodySize) {
            body += chunk;
          } else {
            reject({ message: 'Exceeded maximum body size', type: 'exceed_max_body_size' });
          }
        });
        res.on('end', function () {
          resolve(self.transformResponseBody(body));
        });
      } else if ((res.statusCode == 301 || res.statusCode == 302) && res.headers.location) {
        if (options.followRedirects > 0) {
          var newOptions = extend(options, { followRedirects: options.followRedirects - 1 });
          self.request(method, res.headers.location, payload, newOptions)
            .then(resolve)
            .catch(reject);
        } else {
          reject({ message: 'Exceeded maximum redirect count', type: 'exceed_max_redirect_count' });
        }
      } else {
        reject({ message: res.statusMessage, type: 'http_not_ok', status: res.statusCode });
      }
    });

    req.on('error', function (err) {
      if (options.retries > 0) {
        var newOptions = extend(options, { retries: options.retries - 1 });
        setTimeout(function () {
          self.request(method, url, payload, newOptions)
            .then(resolve)
            .catch(reject);
        }, options.retryDelay);
      } else {
        reject({ message: 'Socket error', type: 'socket_error', error: err });
      }
    });

    if (payload) req.write(self.transformRequestBody(payload));
    req.end();
  });
};

HttpClient.prototype.get = function (url, options) {
  return this.request('GET', url, null, options);
};

HttpClient.prototype.post = function (url, payload, options) {
  return this.request('POST', url, payload, options);
};

HttpClient.prototype.put = function (url, payload, options) {
  return this.request('PUT', url, payload, options);
};

HttpClient.prototype.delete = function (url, options) {
  return this.request('DELETE', url, null, options);
};

module.exports = HttpClient;
