/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { Skeleton } from '@openmetadata/ui-core-components';
import { FC, useEffect, useRef, useState } from 'react';
import { getTagImageSrc, ICON_MAP, isImageUrl } from '../../../utils/IconUtils';
import { IconProps } from './Icon.interface';

type IconLoadState = 'loading' | 'loaded' | 'error';

/**
 * Renders an icon from either an icon name or an image URL, showing a loading
 * skeleton while the image loads and falling back to `fallback` if it fails to
 * load. Reacts to the real browser load outcome instead of only pre-validating
 * the URL shape.
 */
export const Icon: FC<IconProps> = ({
  iconValue,
  fallback = null,
  size = 24,
  className = '',
  wrapperStyle,
  imageStyle = {},
  strokeWidth = 1.5,
  alt = 'icon',
}) => {
  const [loadState, setLoadState] = useState<IconLoadState>('loading');
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setLoadState('loading');
  }, [iconValue]);

  // For already-cached images the browser fires the load event synchronously
  // while creating the <img> element — before React has attached its onLoad
  // listener. Check img.complete after every transition into 'loading' so
  // cached icons are revealed immediately on re-mount.
  useEffect(() => {
    if (loadState !== 'loading') {
      return;
    }
    const img = imgRef.current;
    if (img?.complete) {
      setLoadState(img.naturalWidth > 0 ? 'loaded' : 'error');
    }
  }, [loadState]);

  if (!iconValue) {
    return <>{fallback}</>;
  }

  const IconComponent = ICON_MAP[iconValue];
  if (IconComponent) {
    return (
      <IconComponent
        className={className}
        size={size}
        style={{ strokeWidth, ...wrapperStyle, ...imageStyle }}
      />
    );
  }

  if (!isImageUrl(iconValue) || loadState === 'error') {
    return <>{fallback}</>;
  }

  return (
    <span className={className} style={wrapperStyle}>
      {loadState === 'loading' && (
        <Skeleton height={size} variant="circular" width={size} />
      )}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- img load lifecycle */}
      <img
        alt={alt}
        data-testid="icon-image"
        ref={imgRef}
        src={getTagImageSrc(iconValue)}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: loadState === 'loading' ? 'none' : undefined,
          ...imageStyle,
        }}
        onError={() => setLoadState('error')}
        onLoad={() => setLoadState('loaded')}
      />
    </span>
  );
};
