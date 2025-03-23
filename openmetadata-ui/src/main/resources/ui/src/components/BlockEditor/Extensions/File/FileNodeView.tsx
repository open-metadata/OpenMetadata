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
import {
  DeleteOutlined,
  DownloadOutlined,
  FileOutlined,
} from '@ant-design/icons';
import { NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { Popover, Spin, Tabs, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty, noop } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconFormatImage } from '../../../../assets/svg/ic-format-image.svg';
import { bytesToSize } from '../../../../utils/StringsUtils';
import Loader from '../../../common/Loader/Loader';
import { FileType } from '../../BlockEditor.interface';
import imageClassBase from '../image/ImageClassBase';
import { ImagePopoverContentProps } from '../image/ImageComponent.interface';
import './file-node.less';

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

const FileNodeView: FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const { t } = useTranslation();
  const {
    url,
    fileName,
    fileSize,
    mimeType,
    isUploading,
    uploadProgress,
    tempFile,
    isImage,
    alt,
  } = node.attrs;
  const isValidSource = !isEmpty(url) || isUploading;
  const isVideo = mimeType?.startsWith(FileType.VIDEO);
  const isAudio = mimeType?.startsWith(FileType.AUDIO);
  const isMedia = isVideo || isAudio;
  const [isPopupVisible, setIsPopupVisible] = useState<boolean>(!isValidSource);
  const [imageError, setImageError] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const needsAuthentication = url?.includes('/api/v1/attachments/');

  const authenticatedImageUrl = imageClassBase.getAuthenticatedImageUrl();
  const { imageSrc: mediaSrc, isLoading: isMediaLoading } =
    authenticatedImageUrl
      ? authenticatedImageUrl(url)
      : { imageSrc: url, isLoading: false };

  const authenticatedFileUrl = imageClassBase.getAuthenticatedFileUrl();
  const { downloadFile, isLoading: isFileLoading } = authenticatedFileUrl
    ? authenticatedFileUrl(url)
    : { downloadFile: noop, isLoading: false };

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

  const handlePopoverVisibleChange = (visible: boolean) => {
    // Only show the popover when the editor is in editable mode
    setIsPopupVisible(visible && editor.isEditable);
  };

  const handleFileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      downloadFile(fileName);
    }
  };

  const fileType = useMemo(() => {
    if (isVideo) {
      return FileType.VIDEO;
    }

    if (isAudio) {
      return FileType.AUDIO;
    }

    if (isImage) {
      return FileType.IMAGE;
    }

    return FileType.FILE;
  }, [isVideo, isAudio, isImage]);

  const renderContent = () => {
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
              {uploadProgress !== undefined && (
                <Typography.Text>{` ${uploadProgress}%`}</Typography.Text>
              )}
            </div>
          ) : (
            <>
              <IconFormatImage style={{ verticalAlign: 'middle' }} width={40} />
              <Typography>
                {t('label.add-an-file-type', {
                  fileType: isImage ? 'image' : 'file',
                })}
              </Typography>
            </>
          )}
        </div>
      );
    }

    if (isMedia) {
      return (
        <div className="media-wrapper">
          {isVideo ? (
            <video controls className="video-player" src={mediaSrc} />
          ) : (
            <audio controls className="audio-player" src={mediaSrc} />
          )}
          {isUploading && (
            <>
              <div className="upload-overlay">
                <div className="upload-spinner">
                  <Loader size="small" />
                  <span className="upload-text">{t('label.uploading')}</span>
                </div>
              </div>
              <div
                className="upload-progress"
                style={{ width: `${uploadProgress || 0}%` }}
              />
            </>
          )}
        </div>
      );
    }

    if (isImage) {
      const showLoadingOverlay =
        isUploading ||
        (needsAuthentication && (!imageLoaded || isMediaLoading));
      const displaySrc =
        needsAuthentication && !mediaSrc ? undefined : mediaSrc;

      return (
        <div className="image-wrapper">
          <Spin
            spinning={showLoadingOverlay}
            tip={
              isUploading
                ? `${t('label.uploading')} ${
                    uploadProgress !== undefined ? `${uploadProgress}%` : ''
                  }`
                : t('label.loading')
            }>
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
    }

    return (
      <div className="file-link-container" onClick={(e) => e.preventDefault()}>
        <div className="file-content-wrapper">
          <FileOutlined className="file-icon" />
          <div className="file-details">
            <a
              className="file-link"
              data-filename={fileName || tempFile?.name}
              data-filesize={(fileSize || tempFile?.size)?.toString()}
              data-mimetype={mimeType || tempFile?.type}
              data-type="file-attachment"
              data-url={url}
              href="#"
              onClick={handleFileClick}>
              <span className="file-name">{fileName || tempFile?.name}</span>
            </a>
            <div className="file-meta">
              <span className="file-size">
                {bytesToSize(fileSize || tempFile?.size)}
              </span>
              {isUploading ? (
                <div
                  className="upload-progress"
                  style={{ width: `${uploadProgress || 0}%` }}
                />
              ) : (
                <>
                  <span className="separator">|</span>
                  <span className="file-percentage">
                    <DownloadOutlined onClick={handleFileClick} />
                  </span>
                </>
              )}
            </div>
          </div>
          {isUploading && (
            <div className="upload-overlay">
              <div className="upload-spinner">
                <Loader size="small" />
                <span className="upload-text">{t('label.uploading')}</span>
              </div>
            </div>
          )}
        </div>
        {!isUploading && (
          <DeleteOutlined
            className="delete-icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              deleteNode();
            }}
          />
        )}
      </div>
    );
  };

  return (
    <NodeViewWrapper
      as="div"
      className={`file-attachment ${
        isVideo ? 'file-type-video' : isAudio ? 'file-type-audio' : ''
      } ${isUploading ? 'uploading' : ''}`}
      data-filename={fileName || tempFile?.name}
      data-filesize={(fileSize || tempFile?.size)?.toString()}
      data-mimetype={mimeType || tempFile?.type}
      data-type="file-attachment"
      data-url={url}>
      <div className={isMedia ? 'media-content' : 'file-content'}>
        <Popover
          align={{ targetOffset: [0, 16] }}
          content={
            <PopoverContent
              deleteNode={deleteNode}
              fileType={fileType}
              isUploading={isUploading}
              isValidSource={isValidSource}
              src={isMedia ? mediaSrc : url}
              updateAttributes={({ src, ...rest }) =>
                updateAttributes({ url: src, ...rest })
              }
              onPopupVisibleChange={(value) => setIsPopupVisible(value)}
              onUploadingChange={noop}
            />
          }
          destroyTooltipOnHide={{ keepParent: false }}
          open={isPopupVisible}
          overlayClassName="om-image-node-popover"
          placement="bottom"
          showArrow={false}
          trigger="click"
          onOpenChange={handlePopoverVisibleChange}>
          <Spin spinning={isMedia ? isMediaLoading : isFileLoading}>
            {renderContent()}
          </Spin>
        </Popover>
      </div>
    </NodeViewWrapper>
  );
};

export default FileNodeView;
