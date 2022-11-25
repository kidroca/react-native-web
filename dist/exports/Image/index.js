import _objectSpread from "@babel/runtime/helpers/objectSpread2";
import _extends from "@babel/runtime/helpers/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["accessibilityLabel", "blurRadius", "defaultSource", "draggable", "onError", "onLayout", "onLoad", "onLoadEnd", "onLoadStart", "pointerEvents", "source", "style"];

/**
 * Copyright (c) Nicolas Gallagher.
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
import * as React from 'react';
import createElement from '../createElement';
import { getAssetByID } from '../../modules/AssetRegistry';
import { createBoxShadowValue } from '../StyleSheet/preprocess';
import ImageLoader from '../../modules/ImageLoader';
import PixelRatio from '../PixelRatio';
import StyleSheet from '../StyleSheet';
import TextAncestorContext from '../Text/TextAncestorContext';
import View from '../View';
var ERRORED = 'ERRORED';
var LOADED = 'LOADED';
var LOADING = 'LOADING';
var IDLE = 'IDLE';
var _filterId = 0;
var svgDataUriPattern = /^(data:image\/svg\+xml;utf8,)(.*)/;

function createTintColorSVG(tintColor, id) {
  return tintColor && id != null ? /*#__PURE__*/React.createElement("svg", {
    style: {
      position: 'absolute',
      height: 0,
      visibility: 'hidden',
      width: 0
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("filter", {
    id: "tint-" + id,
    suppressHydrationWarning: true
  }, /*#__PURE__*/React.createElement("feFlood", {
    floodColor: "" + tintColor,
    key: tintColor
  }), /*#__PURE__*/React.createElement("feComposite", {
    in2: "SourceAlpha",
    operator: "atop"
  })))) : null;
}

function getFlatStyle(style, blurRadius, filterId) {
  var flatStyle = StyleSheet.flatten(style);
  var filter = flatStyle.filter,
      resizeMode = flatStyle.resizeMode,
      shadowOffset = flatStyle.shadowOffset,
      tintColor = flatStyle.tintColor; // Add CSS filters
  // React Native exposes these features as props and proprietary styles

  var filters = [];
  var _filter = null;

  if (filter) {
    filters.push(filter);
  }

  if (blurRadius) {
    filters.push("blur(" + blurRadius + "px)");
  }

  if (shadowOffset) {
    var shadowString = createBoxShadowValue(flatStyle);

    if (shadowString) {
      filters.push("drop-shadow(" + shadowString + ")");
    }
  }

  if (tintColor && filterId != null) {
    filters.push("url(#tint-" + filterId + ")");
  }

  if (filters.length > 0) {
    _filter = filters.join(' ');
  } // These styles are converted to CSS filters applied to the
  // element displaying the background image.


  delete flatStyle.blurRadius;
  delete flatStyle.shadowColor;
  delete flatStyle.shadowOpacity;
  delete flatStyle.shadowOffset;
  delete flatStyle.shadowRadius;
  delete flatStyle.tintColor; // These styles are not supported on View

  delete flatStyle.overlayColor;
  delete flatStyle.resizeMode;
  return [flatStyle, resizeMode, _filter, tintColor];
}

function resolveSource(source) {
  var resolvedSource = {
    uri: ''
  };

  if (typeof source === 'number') {
    // get the URI from the packager
    var asset = getAssetByID(source);

    if (asset == null) {
      throw new Error("Image: asset with ID \"" + source + "\" could not be found. Please check the image source or packager.");
    }

    var scale = asset.scales[0];

    if (asset.scales.length > 1) {
      var preferredScale = PixelRatio.get(); // Get the scale which is closest to the preferred scale

      scale = asset.scales.reduce((prev, curr) => Math.abs(curr - preferredScale) < Math.abs(prev - preferredScale) ? curr : prev);
    }

    var scaleSuffix = scale !== 1 ? "@" + scale + "x" : '';

    var _uri = asset.httpServerLocation + "/" + asset.name + scaleSuffix + "." + asset.type;

    resolvedSource = {
      uri: _uri,
      width: asset.width,
      height: asset.height
    };
  } else if (typeof source === 'string') {
    resolvedSource.uri = source;
  } else if (source && typeof source.uri === 'string') {
    // $FlowFixMe
    var _uri2 = source.uri,
        _width = source.width,
        _height = source.height,
        headers = source.headers;
    resolvedSource = {
      uri: _uri2,
      width: _width,
      height: _height,
      headers
    };
  }

  if (resolvedSource.uri) {
    var match = resolvedSource.uri.match(svgDataUriPattern); // inline SVG markup may contain characters (e.g., #, ") that need to be escaped

    if (match) {
      var prefix = match[1],
          svg = match[2];
      var encodedSvg = encodeURIComponent(svg);
      resolvedSource.uri = "" + prefix + encodedSvg;
    }
  }

  return resolvedSource;
}

var Image = /*#__PURE__*/React.forwardRef((props, ref) => {
  var accessibilityLabel = props.accessibilityLabel,
      blurRadius = props.blurRadius,
      defaultSource = props.defaultSource,
      draggable = props.draggable,
      onError = props.onError,
      onLayout = props.onLayout,
      onLoad = props.onLoad,
      onLoadEnd = props.onLoadEnd,
      onLoadStart = props.onLoadStart,
      pointerEvents = props.pointerEvents,
      source = props.source,
      style = props.style,
      rest = _objectWithoutPropertiesLoose(props, _excluded);

  if (process.env.NODE_ENV !== 'production') {
    if (props.children) {
      throw new Error('The <Image> component cannot contain children. If you want to render content on top of the image, consider using the <ImageBackground> component or absolute positioning.');
    }
  } // Only the main source is supposed to trigger onLoad/start/end events
  // It would be ambiguous to trigger the same `onLoad` event when default source loads
  // That's why we don't pass `onLoad` props for the fallback source hook


  var fallbackSource = useSource({
    onError
  }, defaultSource);
  var mainSource = useSource({
    onLoad,
    onLoadStart,
    onLoadEnd,
    onError
  }, source);

  var _React$useState = React.useState({}),
      layout = _React$useState[0],
      updateLayout = _React$useState[1];

  var hasTextAncestor = React.useContext(TextAncestorContext);
  var hiddenImageRef = React.useRef(null);
  var filterRef = React.useRef(_filterId++);
  var shouldDisplaySource = mainSource.status === LOADED || mainSource.status === LOADING && defaultSource == null;

  var _getFlatStyle = getFlatStyle(style, blurRadius, filterRef.current),
      flatStyle = _getFlatStyle[0],
      _resizeMode = _getFlatStyle[1],
      filter = _getFlatStyle[2],
      tintColor = _getFlatStyle[3];

  var resizeMode = props.resizeMode || _resizeMode || 'cover';
  var selected = shouldDisplaySource ? mainSource : fallbackSource;
  var displayImageUri = selected.source.uri;
  var backgroundImage = displayImageUri ? "url(\"" + displayImageUri + "\")" : null;
  var backgroundSize = getBackgroundSize(); // Accessibility image allows users to trigger the browser's image context menu

  var hiddenImage = displayImageUri ? createElement('img', {
    alt: accessibilityLabel || '',
    style: styles.accessibilityImage$raw,
    draggable: draggable || false,
    ref: hiddenImageRef,
    src: displayImageUri
  }) : null;

  function getBackgroundSize() {
    if (hiddenImageRef.current != null && (resizeMode === 'center' || resizeMode === 'repeat')) {
      var _hiddenImageRef$curre = hiddenImageRef.current,
          naturalHeight = _hiddenImageRef$curre.naturalHeight,
          naturalWidth = _hiddenImageRef$curre.naturalWidth;
      var _height2 = layout.height,
          _width2 = layout.width;

      if (naturalHeight && naturalWidth && _height2 && _width2) {
        var scaleFactor = Math.min(1, _width2 / naturalWidth, _height2 / naturalHeight);
        var x = Math.ceil(scaleFactor * naturalWidth);
        var y = Math.ceil(scaleFactor * naturalHeight);
        return x + "px " + y + "px";
      }
    }
  }

  function handleLayout(e) {
    if (resizeMode === 'center' || resizeMode === 'repeat' || onLayout) {
      var _layout = e.nativeEvent.layout;
      onLayout && onLayout(e);
      updateLayout(_layout);
    }
  }

  return /*#__PURE__*/React.createElement(View, _extends({}, rest, {
    accessibilityLabel: accessibilityLabel,
    onLayout: handleLayout,
    pointerEvents: pointerEvents,
    ref: ref,
    style: [styles.root, hasTextAncestor && styles.inline, {
      width: selected.source.width,
      height: selected.source.height
    }, flatStyle]
  }), /*#__PURE__*/React.createElement(View, {
    style: [styles.image, resizeModeStyles[resizeMode], {
      backgroundImage,
      filter
    }, backgroundSize != null && {
      backgroundSize
    }],
    suppressHydrationWarning: true
  }), hiddenImage, createTintColorSVG(tintColor, filterRef.current));
});
Image.displayName = 'Image'; // $FlowIgnore: This is the correct type, but casting makes it unhappy since the variables aren't defined yet

var ImageWithStatics = Image;

ImageWithStatics.getSize = function (uri, success, failure) {
  ImageLoader.getSize(uri, success, failure);
};

ImageWithStatics.prefetch = function (uri) {
  return ImageLoader.prefetch(uri);
};

ImageWithStatics.queryCache = function (uris) {
  return ImageLoader.queryCache(uris);
};
/**
 * Image loading/state management hook
 */


var useSource = (callbacks, source) => {
  var _React$useState2 = React.useState(() => resolveSource(source)),
      resolvedSource = _React$useState2[0],
      setResolvedSource = _React$useState2[1];

  var _React$useState3 = React.useState(() => ImageLoader.has(resolveSource.uri) ? LOADED : IDLE),
      status = _React$useState3[0],
      setStatus = _React$useState3[1];

  var _React$useState4 = React.useState(resolvedSource),
      result = _React$useState4[0],
      setResult = _React$useState4[1]; // Trigger a resolved source change when necessary


  React.useEffect(() => {
    var nextSource = resolveSource(source);
    setResolvedSource(prevSource => {
      // Prevent triggering a state change if the next is the same value as the last loaded source
      if (JSON.stringify(nextSource) === JSON.stringify(prevSource)) {
        return prevSource;
      }

      return nextSource;
    });
  }, [source]); // Always use the latest value of any callback passed
  // By keeping a ref, we avoid (re)triggering the load effect just because a callback changed
  // (E.g. we don't want to trigger a new load because the `onLoad` prop changed)

  var callbackRefs = React.useRef(callbacks);
  callbackRefs.current = callbacks; // Start loading new source on resolved source change

  React.useEffect(() => {
    if (!resolvedSource.uri) {
      setStatus(IDLE);
      setResult(resolvedSource);
      return;
    }

    function handleLoad(nativeEvent) {
      var _callbackRefs$current = callbackRefs.current,
          onLoad = _callbackRefs$current.onLoad,
          onLoadEnd = _callbackRefs$current.onLoadEnd;
      if (onLoad) onLoad({
        nativeEvent
      });
      if (onLoadEnd) onLoadEnd();
      setStatus(LOADED);
      setResult(_objectSpread(_objectSpread({}, resolvedSource), nativeEvent.source));
    }

    function handleError() {
      var _callbackRefs$current2 = callbackRefs.current,
          onLoadEnd = _callbackRefs$current2.onLoadEnd,
          onError = _callbackRefs$current2.onError;

      if (onError) {
        onError({
          nativeEvent: {
            error: "Failed to load resource " + resolvedSource.uri + " (404)"
          }
        });
      }

      if (onLoadEnd) onLoadEnd();
      setStatus(ERRORED);
    }

    var onLoadStart = callbackRefs.current.onLoadStart;
    if (onLoadStart) onLoadStart();
    setStatus(LOADING);
    var requestId = ImageLoader.load(resolvedSource, handleLoad, handleError); // Release resources on unmount or after starting a new request

    return () => ImageLoader.abort(requestId);
  }, [resolvedSource]);
  return {
    status,
    source: result
  };
};

var styles = StyleSheet.create({
  root: {
    flexBasis: 'auto',
    overflow: 'hidden',
    zIndex: 0
  },
  inline: {
    display: 'inline-flex'
  },
  image: _objectSpread(_objectSpread({}, StyleSheet.absoluteFillObject), {}, {
    backgroundColor: 'transparent',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    height: '100%',
    width: '100%',
    zIndex: -1
  }),
  accessibilityImage$raw: _objectSpread(_objectSpread({}, StyleSheet.absoluteFillObject), {}, {
    height: '100%',
    opacity: 0,
    width: '100%',
    zIndex: -1
  })
});
var resizeModeStyles = StyleSheet.create({
  center: {
    backgroundSize: 'auto'
  },
  contain: {
    backgroundSize: 'contain'
  },
  cover: {
    backgroundSize: 'cover'
  },
  none: {
    backgroundPosition: '0',
    backgroundSize: 'auto'
  },
  repeat: {
    backgroundPosition: '0',
    backgroundRepeat: 'repeat',
    backgroundSize: 'auto'
  },
  stretch: {
    backgroundSize: '100% 100%'
  }
});
export default ImageWithStatics;