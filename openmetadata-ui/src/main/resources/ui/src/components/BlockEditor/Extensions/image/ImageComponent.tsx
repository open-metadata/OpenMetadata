/*
 *  Copyright 2023 Collate.
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
import { NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper } from '@tiptap/react';
import { Popover, Spin, Tabs, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconFormatImage } from '../../../../assets/svg/ic-format-image.svg';
import Loader from '../../../common/Loader/Loader';
import imageClassBase from './ImageClassBase';
import { ImagePopoverContentProps } from './ImageComponent.interface';

const PopoverContent: FC<ImagePopoverContentProps> = (props) => {
  const tabs = useMemo(() => {
    return imageClassBase.getImageComponentPopoverTab().map((tab) => {
      const TabComponent = tab.children;

      return {
        ...tab,
        children: <TabComponent {...props} />,
      };
    });
  }, [imageClassBase]);

  return <Tabs defaultActiveKey="embed" items={tabs} />;
};

const ImageComponent: FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const { t } = useTranslation();
  const { src, alt } = node.attrs;
  const isValidSource = !isEmpty(src);
  const needsAuthentication = src?.includes('/api/v1/attachments/');

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isPopupVisible, setIsPopupVisible] = useState<boolean>(!isValidSource);
  const [imageError, setImageError] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);

  const authenticatedImageUrl = imageClassBase.getAuthenticatedImageUrl();

  const { imageSrc, isLoading } =
    authenticatedImageUrl && needsAuthentication
      ? authenticatedImageUrl(src)
      : { imageSrc: src, isLoading: false };

  // Reset states when src changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [src, imageSrc]);

  const handlePopoverVisibleChange = (visible: boolean) => {
    // Only show the popover when the editor is in editable mode
    setIsPopupVisible(visible && editor.isEditable);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const renderImage = () => {
    if (!isValidSource) {
      return (
        <div
          className="image-placeholder"
          contentEditable={false}
          data-testid="image-placeholder">
          {isUploading ? (
            <div className="upload-loading-container">
              <Loader size="small" />
              <Typography.Text>{t('label.uploading')}</Typography.Text>
            </div>
          ) : (
            <>
              <IconFormatImage style={{ verticalAlign: 'middle' }} width={40} />
              <Typography>{t('label.add-an-image')}</Typography>
            </>
          )}
        </div>
      );
    }

    const showLoadingOverlay =
      isUploading || (needsAuthentication && (!imageLoaded || isLoading));
    const displaySrc = needsAuthentication && !imageSrc ? undefined : imageSrc;

    return (
      <div className="om-image-node-uploaded">
        <Spin
          spinning={showLoadingOverlay}
          tip={isUploading ? t('label.uploading') : t('label.loading')}>
          <div
            className={classNames('image-container', {
              'loading-state': showLoadingOverlay || imageError,
            })}>
            {(showLoadingOverlay || imageError) && (
              <div className="loading-overlay">
                <IconFormatImage style={{ opacity: 0.5 }} width={40} />
              </div>
            )}
            {displaySrc && (
              <img
                alt={alt ?? ''}
                data-testid="uploaded-image-node"
                src={displaySrc}
                style={{
                  visibility: imageLoaded ? 'visible' : 'hidden',
                  display: 'block',
                }}
                onError={handleImageError}
                onLoad={handleImageLoad}
              />
            )}
          </div>
        </Spin>
      </div>
    );
  };

  return (
    <NodeViewWrapper as="div" className="om-react-node">
      <div className={classNames({ 'om-image-node-wrapper': isPopupVisible })}>
        <Popover
          align={{ targetOffset: [0, 16] }}
          content={
            <PopoverContent
              deleteNode={deleteNode}
              isUploading={isUploading}
              isValidSource={isValidSource}
              src={imageSrc}
              updateAttributes={updateAttributes}
              onPopupVisibleChange={(value) => setIsPopupVisible(value)}
              onUploadingChange={(value) => setIsUploading(value)}
            />
          }
          destroyTooltipOnHide={{ keepParent: false }}
          open={isPopupVisible}
          overlayClassName="om-image-node-popover"
          placement="bottom"
          showArrow={false}
          trigger="click"
          onOpenChange={handlePopoverVisibleChange}>
          {renderImage()}
        </Popover>
      </div>
    </NodeViewWrapper>
  );
};

ImageComponent.displayName = 'ImageComponent';

export default ImageComponent;
