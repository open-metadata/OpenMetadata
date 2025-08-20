/*
 *  Copyright 2025 Collate.
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
import { NodeViewProps } from '@tiptap/react';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import IconFormatImage from '../../../../../assets/svg/ic-format-image.svg?react';
import { UPLOADED_ASSETS_URL } from '../../../../../constants/BlockEditor.constants';

const ImageAttachment = ({
  node,
  mediaSrc,
  isMediaLoading,
}: {
  node: NodeViewProps['node'];
  mediaSrc: string;
  isMediaLoading: boolean;
}) => {
  const { url, alt, isUploading } = node.attrs;
  const [imageError, setImageError] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const needsAuthentication = url?.includes(UPLOADED_ASSETS_URL);

  // Reset states when url changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [url, mediaSrc]);

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const showLoadingOverlay =
    isUploading || (needsAuthentication && (!imageLoaded || isMediaLoading));
  const displaySrc = needsAuthentication && !mediaSrc ? undefined : mediaSrc;

  return (
    <div className="image-wrapper">
      <div
        className={classNames('image-container', {
          'loading-state': showLoadingOverlay || imageError,
        })}
        data-testid="image-container">
        {displaySrc ? (
          <img
            alt={alt ?? ''}
            data-testid="uploaded-image-node"
            src={displaySrc}
            onError={handleImageError}
            onLoad={handleImageLoad}
          />
        ) : (
          <div className="loading-overlay">
            <IconFormatImage width={40} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageAttachment;
