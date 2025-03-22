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
import { isEmpty, noop } from 'lodash';
import React, { FC, useMemo, useState } from 'react';
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
  const { url, fileName, fileSize, mimeType } = node.attrs;
  const isValidSource = !isEmpty(url);
  const isVideo = mimeType.startsWith(FileType.VIDEO);
  const isAudio = mimeType.startsWith(FileType.AUDIO);
  const isMedia = isVideo || isAudio;
  const isUploading = false;
  const [isPopupVisible, setIsPopupVisible] = useState<boolean>(!isValidSource);
  const authenticatedImageUrl = imageClassBase.getAuthenticatedImageUrl();

  const { imageSrc: mediaSrc, isLoading: isMediaLoading } =
    authenticatedImageUrl
      ? authenticatedImageUrl(url)
      : { imageSrc: url, isLoading: false };

  const authenticatedFileUrl = imageClassBase.getAuthenticatedFileUrl();
  const { downloadFile, isLoading: isFileLoading } = authenticatedFileUrl
    ? authenticatedFileUrl(url)
    : { downloadFile: noop, isLoading: false };

  const fileType = useMemo(() => {
    if (isVideo) {
      return FileType.VIDEO;
    }

    if (isAudio) {
      return FileType.AUDIO;
    }

    return FileType.FILE;
  }, [isVideo, isAudio]);

  const handleFileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    downloadFile(fileName);
  };

  const handlePopoverVisibleChange = (visible: boolean) => {
    // Only show the popover when the editor is in editable mode
    setIsPopupVisible(visible && editor.isEditable);
  };

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
            </div>
          ) : (
            <>
              <IconFormatImage style={{ verticalAlign: 'middle' }} width={40} />
              <Typography>
                {t('label.add-an-file-type', { fileType })}
              </Typography>
            </>
          )}
        </div>
      );
    }

    if (isMedia) {
      return isVideo ? (
        <video controls className="video-player" src={mediaSrc} />
      ) : (
        <audio controls className="audio-player" src={mediaSrc} />
      );
    }

    return (
      <div className="file-link-container" onClick={(e) => e.preventDefault()}>
        <div className="file-content-wrapper">
          <FileOutlined className="file-icon" />
          <div className="file-details">
            <a
              className="file-link"
              data-filename={fileName}
              data-filesize={fileSize?.toString()}
              data-mimetype={mimeType}
              data-type="file-attachment"
              data-url={url}
              href="#"
              onClick={handleFileClick}>
              <span className="file-name">{fileName}</span>
            </a>
            <div className="file-meta">
              <span className="file-size">{bytesToSize(fileSize)}</span>
              <span className="separator">|</span>
              <span className="file-percentage">
                <DownloadOutlined onClick={handleFileClick} />
              </span>
            </div>
          </div>
        </div>
        <DeleteOutlined
          className="delete-icon"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteNode();
          }}
        />
      </div>
    );
  };

  return (
    <NodeViewWrapper
      as="div"
      className={`file-attachment ${
        isVideo ? 'file-type-video' : isAudio ? 'file-type-audio' : ''
      }`}
      data-filename={fileName}
      data-filesize={fileSize?.toString()}
      data-mimetype={mimeType}
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
