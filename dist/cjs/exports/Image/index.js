"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault").default;

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard").default;

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutPropertiesLoose"));

var _objectSpread2 = _interopRequireDefault(require("@babel/runtime/helpers/objectSpread2"));

var React = _interopRequireWildcard(require("react"));

var _createElement = _interopRequireDefault(require("../createElement"));

var _AssetRegistry = require("../../modules/AssetRegistry");

var _preprocess = require("../StyleSheet/preprocess");

var _ImageLoader = _interopRequireDefault(require("../../modules/ImageLoader"));

var _PixelRatio = _interopRequireDefault(require("../PixelRatio"));

var _StyleSheet = _interopRequireDefault(require("../StyleSheet"));

var _TextAncestorContext = _interopRequireDefault(require("../Text/TextAncestorContext"));

var _View = _interopRequireDefault(require("../View"));

var _excluded = ["accessibilityLabel", "blurRadius", "defaultSource", "draggable", "onError", "onLayout", "onLoad", "onLoadEnd", "onLoadStart", "pointerEvents", "source", "style"];
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
  var flatStyle = _StyleSheet.default.flatten(style);

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
    var shadowString = (0, _preprocess.createBoxShadowValue)(flatStyle);

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

function resolveAssetDimensions(source) {
  var height = source.height,
      width = source.width;
  return {
    height,
    width
  };
}

function resolveSource(source) {
  var resolvedSource = {
    uri: ''
  };

  if (typeof source === 'number') {
    resolvedSource = resolveNumericSource(source);
  } else if (typeof source === 'string') {
    resolvedSource = resolveStringSource(source);
  } else if (Array.isArray(source)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('The <Image> component does not support multiple sources passed as array, falling back to the first source in the list', {
        source
      });
    }

    return resolveSource(source[0]);
  } else if (source && typeof source.uri === 'string') {
    resolvedSource = resolveObjectSource(source);
  }

  if (resolvedSource.uri) {
    var match = resolvedSource.uri.match(svgDataUriPattern);

    if (match) {
      resolvedSource = resolveSvgDataUriSource(resolvedSource, match);
    }
  }

  return resolvedSource;
} // get the URI from the packager


function resolveNumericSource(source) {
  var asset = (0, _AssetRegistry.getAssetByID)(source);

  if (asset == null) {
    throw new Error("Image: asset with ID \"" + source + "\" could not be found. Please check the image source or packager.");
  }

  var scale = asset.scales[0];

  if (asset.scales.length > 1) {
    var preferredScale = _PixelRatio.default.get(); // Get the scale which is closest to the preferred scale


    scale = asset.scales.reduce((prev, curr) => Math.abs(curr - preferredScale) < Math.abs(prev - preferredScale) ? curr : prev);
  }

  var scaleSuffix = scale !== 1 ? "@" + scale + "x" : '';
  var uri = asset.httpServerLocation + "/" + asset.name + scaleSuffix + "." + asset.type;
  var height = asset.height,
      width = asset.width;
  return {
    uri,
    height,
    width
  };
}

function resolveStringSource(source) {
  return {
    uri: source
  };
}

function resolveObjectSource(source) {
  return source;
}

function resolveSvgDataUriSource(source, match) {
  var prefix = match[1],
      svg = match[2]; // inline SVG markup may contain characters (e.g., #, ") that need to be escaped

  var encodedSvg = encodeURIComponent(svg);
  return (0, _objectSpread2.default)((0, _objectSpread2.default)({}, source), {}, {
    uri: "" + prefix + encodedSvg
  });
} // resolve any URI that might have a local blob URL create by `createObjectURL`


function resolveBlobUri(source) {
  return _ImageLoader.default.resolveBlobUri(source.uri);
}

function getSourceToDisplay(main, fallback) {
  if (main.status === LOADED) return main.source; // If there's no fallback URI, it's safe to use the main source URI

  if (main.status === LOADING && !fallback.source.uri) {
    // But it should not be used when the image would be loaded with custom headers
    // Because the actual URI is only set (as a local blob url) after loading
    if (!main.source.headers) return main.source;
  }

  return fallback.source;
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
      rest = (0, _objectWithoutPropertiesLoose2.default)(props, _excluded);

  if (process.env.NODE_ENV !== 'production') {
    if (props.children) {
      throw new Error('The <Image> component cannot contain children. If you want to render content on top of the image, consider using the <ImageBackground> component or absolute positioning.');
    }
  }

  var imageLoadingProps = {
    onLoad,
    onLoadStart,
    onLoadEnd,
    onError
  };
  var fallbackSource = useSource(imageLoadingProps, defaultSource);
  var mainSource = useSource(imageLoadingProps, source);
  var availableSource = getSourceToDisplay(mainSource, fallbackSource);
  var displayImageUri = resolveBlobUri(availableSource);
  var imageSizeStyle = resolveAssetDimensions(availableSource);

  var _React$useState = React.useState({}),
      layout = _React$useState[0],
      updateLayout = _React$useState[1];

  var hasTextAncestor = React.useContext(_TextAncestorContext.default);
  var hiddenImageRef = React.useRef(null);
  var filterRef = React.useRef(_filterId++);

  var _getFlatStyle = getFlatStyle(style, blurRadius, filterRef.current),
      flatStyle = _getFlatStyle[0],
      _resizeMode = _getFlatStyle[1],
      filter = _getFlatStyle[2],
      tintColor = _getFlatStyle[3];

  var resizeMode = props.resizeMode || _resizeMode || 'cover';
  var backgroundImage = displayImageUri ? "url(\"" + displayImageUri + "\")" : null;
  var backgroundSize = getBackgroundSize(); // Accessibility image allows users to trigger the browser's image context menu

  var hiddenImage = displayImageUri ? (0, _createElement.default)('img', {
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
      var _height = layout.height,
          _width = layout.width;

      if (naturalHeight && naturalWidth && _height && _width) {
        var scaleFactor = Math.min(1, _width / naturalWidth, _height / naturalHeight);
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

  return /*#__PURE__*/React.createElement(_View.default, (0, _extends2.default)({}, rest, {
    accessibilityLabel: accessibilityLabel,
    onLayout: handleLayout,
    pointerEvents: pointerEvents,
    ref: ref,
    style: [styles.root, hasTextAncestor && styles.inline, imageSizeStyle, flatStyle]
  }), /*#__PURE__*/React.createElement(_View.default, {
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
  _ImageLoader.default.getSize(uri, success, failure);
};

ImageWithStatics.prefetch = function (uri) {
  return _ImageLoader.default.prefetch(uri);
};

ImageWithStatics.queryCache = function (uris) {
  return _ImageLoader.default.queryCache(uris);
};
/**
 * Image loading/state management hook
 */


var useSource = (callbacks, source) => {
  var _React$useState2 = React.useState(() => resolveSource(source)),
      resolvedSource = _React$useState2[0],
      setResolvedSource = _React$useState2[1];

  var _React$useState3 = React.useState(() => _ImageLoader.default.has(resolveSource.uri) ? LOADED : IDLE),
      status = _React$useState3[0],
      setStatus = _React$useState3[1];

  var _React$useState4 = React.useState(resolvedSource),
      result = _React$useState4[0],
      setResult = _React$useState4[1]; // Trigger a resolved source change when necessary


  React.useEffect(() => {
    var nextSource = resolveSource(source);
    setResolvedSource(prevSource => {
      // Prevent triggering a state change if the next is virtually the same as the last loaded source
      if (JSON.stringify(nextSource) === JSON.stringify(prevSource)) {
        return prevSource;
      }

      return nextSource;
    });
  }, [source]); // Always use the latest value of any callback passed
  // Keeping a ref we avoid (re)triggering the load effect just because a callback changed
  // (E.g. we don't want to trigger a new load because the `onLoad` prop changed)

  var callbackRefs = React.useRef(callbacks);
  callbackRefs.current = callbacks; // Start loading new source on resolved source change
  // Beware of changing the hook inputs array - this effect relies on running only when the resolved source changes
  // If you have to change the code, modify it in a way to preserve the intended behavior

  React.useEffect(() => {
    if (!resolvedSource.uri) {
      setStatus(IDLE);
      setResult(resolvedSource);
      return;
    }

    var _callbackRefs$current = callbackRefs.current,
        onLoad = _callbackRefs$current.onLoad,
        onLoadStart = _callbackRefs$current.onLoadStart,
        onLoadEnd = _callbackRefs$current.onLoadEnd,
        onError = _callbackRefs$current.onError;

    function handleLoad(result) {
      if (onLoad) onLoad({
        nativeEvent: result
      });
      if (onLoadEnd) onLoadEnd();
      setStatus(LOADED);
      setResult((0, _objectSpread2.default)((0, _objectSpread2.default)({}, resolvedSource), result.source));
    }

    function handleError() {
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

    if (onLoadStart) onLoadStart();
    setStatus(LOADING);

    var requestId = _ImageLoader.default.load(resolvedSource, handleLoad, handleError); // Release resources on umount or after starting a new request


    return () => _ImageLoader.default.release(requestId);
  }, [resolvedSource]);
  return {
    status,
    source: result
  };
};

var styles = _StyleSheet.default.create({
  root: {
    flexBasis: 'auto',
    overflow: 'hidden',
    zIndex: 0
  },
  inline: {
    display: 'inline-flex'
  },
  image: (0, _objectSpread2.default)((0, _objectSpread2.default)({}, _StyleSheet.default.absoluteFillObject), {}, {
    backgroundColor: 'transparent',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    height: '100%',
    width: '100%',
    zIndex: -1
  }),
  accessibilityImage$raw: (0, _objectSpread2.default)((0, _objectSpread2.default)({}, _StyleSheet.default.absoluteFillObject), {}, {
    height: '100%',
    opacity: 0,
    width: '100%',
    zIndex: -1
  })
});

var resizeModeStyles = _StyleSheet.default.create({
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

var _default = ImageWithStatics;
exports.default = _default;
module.exports = exports.default;