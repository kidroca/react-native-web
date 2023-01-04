/**
 * Copyright (c) Nicolas Gallagher.
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { ImageResult, ImageSource } from '../../modules/ImageLoader';
import type {
  ImageLoadingProps,
  ImageProps,
  Source,
  SourceState
} from './types';

import * as React from 'react';
import createElement from '../createElement';
import { getAssetByID } from '../../modules/AssetRegistry';
import { createBoxShadowValue } from '../StyleSheet/preprocess';
import ImageLoader from '../../modules/ImageLoader';
import PixelRatio from '../PixelRatio';
import StyleSheet from '../StyleSheet';
import TextAncestorContext from '../Text/TextAncestorContext';
import View from '../View';

export type { ImageProps };

const ERRORED = 'ERRORED';
const LOADED = 'LOADED';
const LOADING = 'LOADING';
const IDLE = 'IDLE';

let _filterId = 0;
const svgDataUriPattern = /^(data:image\/svg\+xml;utf8,)(.*)/;

function createTintColorSVG(tintColor, id) {
  return tintColor && id != null ? (
    <svg
      style={{
        position: 'absolute',
        height: 0,
        visibility: 'hidden',
        width: 0
      }}
    >
      <defs>
        <filter id={`tint-${id}`} suppressHydrationWarning={true}>
          <feFlood floodColor={`${tintColor}`} key={tintColor} />
          <feComposite in2="SourceAlpha" operator="atop" />
        </filter>
      </defs>
    </svg>
  ) : null;
}

function getFlatStyle(style, blurRadius, filterId) {
  const flatStyle = StyleSheet.flatten(style);
  const { filter, resizeMode, shadowOffset, tintColor } = flatStyle;

  // Add CSS filters
  // React Native exposes these features as props and proprietary styles
  const filters = [];
  let _filter = null;

  if (filter) {
    filters.push(filter);
  }
  if (blurRadius) {
    filters.push(`blur(${blurRadius}px)`);
  }
  if (shadowOffset) {
    const shadowString = createBoxShadowValue(flatStyle);
    if (shadowString) {
      filters.push(`drop-shadow(${shadowString})`);
    }
  }
  if (tintColor && filterId != null) {
    filters.push(`url(#tint-${filterId})`);
  }

  if (filters.length > 0) {
    _filter = filters.join(' ');
  }

  // These styles are converted to CSS filters applied to the
  // element displaying the background image.
  delete flatStyle.blurRadius;
  delete flatStyle.shadowColor;
  delete flatStyle.shadowOpacity;
  delete flatStyle.shadowOffset;
  delete flatStyle.shadowRadius;
  delete flatStyle.tintColor;
  // These styles are not supported on View
  delete flatStyle.overlayColor;
  delete flatStyle.resizeMode;

  return [flatStyle, resizeMode, _filter, tintColor];
}

function resolveAssetDimensions(source: ImageSource) {
  const { height, width } = source;
  return { height, width };
}

function resolveSource(source: ?Source): ImageSource {
  let resolvedSource = { uri: '' };

  if (typeof source === 'number') {
    // get the URI from the packager
    const asset = getAssetByID(source);
    if (asset == null) {
      throw new Error(
        `Image: asset with ID "${source}" could not be found. Please check the image source or packager.`
      );
    }
    let scale = asset.scales[0];
    if (asset.scales.length > 1) {
      const preferredScale = PixelRatio.get();
      // Get the scale which is closest to the preferred scale
      scale = asset.scales.reduce((prev, curr) =>
        Math.abs(curr - preferredScale) < Math.abs(prev - preferredScale)
          ? curr
          : prev
      );
    }

    const scaleSuffix = scale !== 1 ? `@${scale}x` : '';
    const uri = `${asset.httpServerLocation}/${asset.name}${scaleSuffix}.${asset.type}`;
    resolvedSource = { uri, width: asset.width, height: asset.height };
  } else if (typeof source === 'string') {
    resolvedSource.uri = source;
  } else if (Array.isArray(source)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'The <Image> component does not support multiple sources passed as array, falling back to the first source in the list',
        { source }
      );
    }

    return resolveSource(source[0]);
  } else if (source && typeof source.uri === 'string') {
    const { uri, width, height, headers } = source;
    resolvedSource = { uri, width, height, headers };
  }

  if (resolvedSource.uri) {
    const match = resolvedSource.uri.match(svgDataUriPattern);
    // inline SVG markup may contain characters (e.g., #, ") that need to be escaped
    if (match) {
      const [, prefix, svg] = match;
      const encodedSvg = encodeURIComponent(svg);
      resolvedSource.uri = `${prefix}${encodedSvg}`;
    }
  }

  return resolvedSource;
}

function getSourceToDisplay(main: SourceState, fallback: SourceState) {
  if (main.status === LOADED) return main.source;

  // If there's no fallback URI, it's safe to use the main source URI
  if (main.status === LOADING && !fallback.source.uri) {
    // But it should not be used when the image would be loaded with custom headers
    // Because the actual URI is only set (as a local blob url) after loading
    if (!main.source.headers) return main.source;
  }

  return fallback.source;
}

interface ImageStatics {
  getSize: (
    uri: string,
    success: (width: number, height: number) => void,
    failure: () => void
  ) => void;
  prefetch: (uri: string) => Promise<void>;
  queryCache: (
    uris: Array<string>
  ) => Promise<{| [uri: string]: 'disk/memory' |}>;
}

const Image: React.AbstractComponent<
  ImageProps,
  React.ElementRef<typeof View>
> = React.forwardRef((props, ref) => {
  const {
    accessibilityLabel,
    blurRadius,
    defaultSource,
    draggable,
    onError,
    onLayout,
    onLoad,
    onLoadEnd,
    onLoadStart,
    pointerEvents,
    source,
    style,
    ...rest
  } = props;

  if (process.env.NODE_ENV !== 'production') {
    if (props.children) {
      throw new Error(
        'The <Image> component cannot contain children. If you want to render content on top of the image, consider using the <ImageBackground> component or absolute positioning.'
      );
    }
  }

  // Don't raise load events for the fallback source
  const fallbackSource = useSource({ onError }, defaultSource);
  const mainSource = useSource(
    { onLoad, onLoadStart, onLoadEnd, onError },
    source
  );
  const [layout, updateLayout] = React.useState({});
  const hasTextAncestor = React.useContext(TextAncestorContext);
  const hiddenImageRef = React.useRef(null);
  const filterRef = React.useRef(_filterId++);
  const [flatStyle, _resizeMode, filter, tintColor] = getFlatStyle(
    style,
    blurRadius,
    filterRef.current
  );
  const resizeMode = props.resizeMode || _resizeMode || 'cover';
  const availableSource = getSourceToDisplay(mainSource, fallbackSource);
  const displayImageUri = ImageLoader.resolveUri(availableSource.uri);
  const imageSizeStyle = resolveAssetDimensions(availableSource);
  const backgroundImage = displayImageUri ? `url("${displayImageUri}")` : null;
  const backgroundSize = getBackgroundSize();

  // Accessibility image allows users to trigger the browser's image context menu
  const hiddenImage = displayImageUri
    ? createElement('img', {
        alt: accessibilityLabel || '',
        style: styles.accessibilityImage$raw,
        draggable: draggable || false,
        ref: hiddenImageRef,
        src: displayImageUri
      })
    : null;

  function getBackgroundSize(): ?string {
    if (
      hiddenImageRef.current != null &&
      (resizeMode === 'center' || resizeMode === 'repeat')
    ) {
      const { naturalHeight, naturalWidth } = hiddenImageRef.current;
      const { height, width } = layout;
      if (naturalHeight && naturalWidth && height && width) {
        const scaleFactor = Math.min(
          1,
          width / naturalWidth,
          height / naturalHeight
        );
        const x = Math.ceil(scaleFactor * naturalWidth);
        const y = Math.ceil(scaleFactor * naturalHeight);
        return `${x}px ${y}px`;
      }
    }
  }

  function handleLayout(e) {
    if (resizeMode === 'center' || resizeMode === 'repeat' || onLayout) {
      const { layout } = e.nativeEvent;
      onLayout && onLayout(e);
      updateLayout(layout);
    }
  }

  return (
    <View
      {...rest}
      accessibilityLabel={accessibilityLabel}
      onLayout={handleLayout}
      pointerEvents={pointerEvents}
      ref={ref}
      style={[
        styles.root,
        hasTextAncestor && styles.inline,
        imageSizeStyle,
        flatStyle
      ]}
    >
      <View
        style={[
          styles.image,
          resizeModeStyles[resizeMode],
          { backgroundImage, filter },
          backgroundSize != null && { backgroundSize }
        ]}
        suppressHydrationWarning={true}
      />
      {hiddenImage}
      {createTintColorSVG(tintColor, filterRef.current)}
    </View>
  );
});

Image.displayName = 'Image';

// $FlowIgnore: This is the correct type, but casting makes it unhappy since the variables aren't defined yet
const ImageWithStatics = (Image: React.AbstractComponent<
  ImageProps,
  React.ElementRef<typeof View>
> &
  ImageStatics);

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
const useSource = (
  callbacks: ImageLoadingProps,
  source: ?Source
): SourceState => {
  const [resolvedSource, setResolvedSource] = React.useState<ImageSource>(() =>
    resolveSource(source)
  );

  const [status, setStatus] = React.useState(() =>
    ImageLoader.has(resolveSource.uri) ? LOADED : IDLE
  );

  const [result, setResult] = React.useState<ImageSource>(resolvedSource);

  // Trigger a resolved source change when necessary
  React.useEffect(() => {
    const nextSource = resolveSource(source);
    setResolvedSource((prevSource) => {
      // Prevent triggering a state change if the next is virtually the same as the last loaded source
      if (JSON.stringify(nextSource) === JSON.stringify(prevSource)) {
        return prevSource;
      }

      return nextSource;
    });
  }, [source]);

  // Always use the latest value of any callback passed
  // By keeping a ref, we avoid (re)triggering the load effect just because a callback changed
  // (E.g. we don't want to trigger a new load because the `onLoad` prop changed)
  const callbackRefs = React.useRef(callbacks);
  callbackRefs.current = callbacks;

  // Start loading new source on resolved source change
  // Beware of changing the hook inputs array - this effect relies on running only when the resolved source changes
  // If you have to change the code, modify it in a way to preserve the intended behavior
  React.useEffect(() => {
    if (!resolvedSource.uri) {
      setStatus(IDLE);
      setResult(resolvedSource);
      return;
    }

    const { onLoad, onLoadStart, onLoadEnd, onError } = callbackRefs.current;
    function handleLoad(result: ImageResult) {
      if (onLoad) onLoad({ nativeEvent: result });
      if (onLoadEnd) onLoadEnd();

      setStatus(LOADED);
      setResult({ ...resolvedSource, ...result.source });
    }

    function handleError() {
      if (onError) {
        onError({
          nativeEvent: {
            error: `Failed to load resource ${resolvedSource.uri} (404)`
          }
        });
      }

      if (onLoadEnd) onLoadEnd();

      setStatus(ERRORED);
    }

    if (onLoadStart) onLoadStart();

    setStatus(LOADING);
    const requestId = ImageLoader.load(resolvedSource, handleLoad, handleError);

    // Release resources on unmount or after starting a new request
    return () => ImageLoader.release(requestId);
  }, [resolvedSource]);

  return { status, source: result };
};

const styles = StyleSheet.create({
  root: {
    flexBasis: 'auto',
    overflow: 'hidden',
    zIndex: 0
  },
  inline: {
    display: 'inline-flex'
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    height: '100%',
    width: '100%',
    zIndex: -1
  },
  accessibilityImage$raw: {
    ...StyleSheet.absoluteFillObject,
    height: '100%',
    opacity: 0,
    width: '100%',
    zIndex: -1
  }
});

const resizeModeStyles = StyleSheet.create({
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
