"use strict";

exports.__esModule = true;
exports.default = exports.ImageUriCache = void 0;

/**
 * Copyright (c) Nicolas Gallagher.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
var dataUriPattern = /^data:/;

class ImageUriCache {
  static has(uri) {
    var entries = ImageUriCache._entries;
    var isDataUri = dataUriPattern.test(uri);
    return isDataUri || Boolean(entries[uri]);
  }

  static add(uri) {
    var entries = ImageUriCache._entries;
    var lastUsedTimestamp = Date.now();

    if (entries[uri]) {
      entries[uri].lastUsedTimestamp = lastUsedTimestamp;
      entries[uri].refCount += 1;
    } else {
      entries[uri] = {
        lastUsedTimestamp,
        refCount: 1
      };
    }
  }

  static remove(uri) {
    var entries = ImageUriCache._entries;

    if (entries[uri]) {
      entries[uri].refCount -= 1;
    } // Free up entries when the cache is "full"


    ImageUriCache._cleanUpIfNeeded();
  }

  static _cleanUpIfNeeded() {
    var entries = ImageUriCache._entries;
    var imageUris = Object.keys(entries);

    if (imageUris.length + 1 > ImageUriCache._maximumEntries) {
      var leastRecentlyUsedKey;
      var leastRecentlyUsedEntry;
      imageUris.forEach(uri => {
        var entry = entries[uri];

        if ((!leastRecentlyUsedEntry || entry.lastUsedTimestamp < leastRecentlyUsedEntry.lastUsedTimestamp) && entry.refCount === 0) {
          leastRecentlyUsedKey = uri;
          leastRecentlyUsedEntry = entry;
        }
      });

      if (leastRecentlyUsedKey) {
        delete entries[leastRecentlyUsedKey];
      }
    }
  }

}

exports.ImageUriCache = ImageUriCache;
ImageUriCache._maximumEntries = 256;
ImageUriCache._entries = {};
var id = 0;
var requests = {};
var ImageLoader = {
  abort(requestId) {
    var request = requests["" + requestId];

    if (request) {
      var image = request.image,
          cleanup = request.cleanup;
      if (cleanup) cleanup();
      image.onerror = null;
      image.onload = null; // Setting image.src to empty string aborts any ongoing image loading

      image.src = '';
      delete requests["" + requestId];
    }
  },

  getSize(uri, success, failure) {
    var complete = false;
    var interval = setInterval(callback, 16);
    var requestId = ImageLoader.load({
      uri
    }, callback, errorCallback);

    function callback() {
      var request = requests["" + requestId];

      if (request) {
        var _request$image = request.image,
            naturalHeight = _request$image.naturalHeight,
            naturalWidth = _request$image.naturalWidth;

        if (naturalHeight && naturalWidth) {
          success(naturalWidth, naturalHeight);
          complete = true;
        }
      }

      if (complete) {
        ImageLoader.abort(requestId);
        clearInterval(interval);
      }
    }

    function errorCallback() {
      if (typeof failure === 'function') {
        failure();
      }

      ImageLoader.abort(requestId);
      clearInterval(interval);
    }
  },

  has(uri) {
    return ImageUriCache.has(uri);
  },

  load(source, onLoad, onError) {
    id += 1;
    var image = new window.Image();
    image.onerror = onError;

    image.onload = nativeEvent => {
      // avoid blocking the main thread
      var onDecode = () => {
        nativeEvent.source = {
          uri: image.src,
          width: image.naturalWidth,
          height: image.naturalHeight
        };
        onLoad(nativeEvent);
      };

      if (typeof image.decode === 'function') {
        // Safari currently throws exceptions when decoding svgs.
        // We want to catch that error and allow the load handler
        // to be forwarded to the onLoad handler in this case
        image.decode().then(onDecode, onDecode);
      } else {
        setTimeout(onDecode, 0);
      }
    };

    requests[id] = {
      image,
      source
    }; // To load an image one of 2 available strategies is selected based on `source`
    // When we've got a simple source that can be loaded using the builtin Image element
    // we create an Image and use `src` and the `onload` attributes
    // this covers many native cases like cross-origin requests, progressive images
    // But the built-in Image is not capable of performing requests with headers
    // That's why when the source has headers we use another strategy and make a `fetch` request
    // Then we create a (local) object URL, so we can render the downloaded file as an Image

    if (source.headers) {
      var abortCtrl = new AbortController();
      var request = new Request(source.uri, {
        headers: source.headers,
        signal: abortCtrl.signal
      });
      request.headers.append('accept', 'image/*');

      requests[id].cleanup = () => {
        abortCtrl.abort();
        URL.revokeObjectURL(image.src);
      };

      fetch(request).then(response => response.blob()).then(blob => {
        image.src = URL.createObjectURL(blob);
      }).catch(error => {
        if (error.name !== 'AbortError') onError(error);
      });
    } else {
      // For simple request we load the image through `image.src` because it has wider support
      // like better cross-origin support and progressive loading
      image.src = source.uri;
    }

    return id;
  },

  prefetch(uri) {
    return new Promise((resolve, reject) => {
      ImageLoader.load({
        uri
      }, () => {
        // Add the uri to the cache so it can be immediately displayed when used
        // but also immediately remove it to correctly reflect that it has no active references
        ImageUriCache.add(uri);
        ImageUriCache.remove(uri);
        resolve();
      }, reject);
    });
  },

  queryCache(uris) {
    var result = {};
    uris.forEach(u => {
      if (ImageUriCache.has(u)) {
        result[u] = 'disk/memory';
      }
    });
    return Promise.resolve(result);
  }

};
var _default = ImageLoader;
exports.default = _default;