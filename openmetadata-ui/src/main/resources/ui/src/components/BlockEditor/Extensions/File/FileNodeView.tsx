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
import { NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { Popover, Spin, Tabs } from 'antd';
import classNames from 'classnames';
import { isEmpty, noop } from 'lodash';
import { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UPLOADED_ASSETS_URL } from '../../../../constants/BlockEditor.constants';
import Loader from '../../../common/Loader/Loader';
import { FileType } from '../../BlockEditor.interface';
import imageClassBase from '../image/ImageClassBase';
import { ImagePopoverContentProps } from '../image/ImageComponent.interface';
import AttachmentPlaceholder from './AttachmentComponents/AttachmentPlaceholder';
import FileAttachment from './AttachmentComponents/FileAttachment';
import ImageAttachment from './AttachmentComponents/ImageAttachment';
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
  const { url, fileName, fileSize, mimeType, isUploading, tempFile, isImage } =
    node.attrs;
  const isValidSource = !isEmpty(url) || isUploading;
  const isVideo = mimeType?.startsWith(FileType.VIDEO);
  const isAudio = mimeType?.startsWith(FileType.AUDIO);
  const isMedia = isVideo || isAudio;
  const [isPopupVisible, setIsPopupVisible] = useState<boolean>(false);

  const isAssetsUrl = useMemo(() => {
    return isValidSource && url?.includes(UPLOADED_ASSETS_URL);
  }, [url, isValidSource]);

  const authenticatedImageUrl = imageClassBase.getAuthenticatedImageUrl();
  const { imageSrc: mediaSrc, isLoading: isMediaLoading } =
    authenticatedImageUrl
      ? authenticatedImageUrl(url)
      : { imageSrc: url, isLoading: false };

  const authenticatedFileUrl = imageClassBase.getAuthenticatedFileUrl();
  const { downloadFile, isLoading: isFileLoading } = authenticatedFileUrl
    ? authenticatedFileUrl(url)
    : { downloadFile: noop, isLoading: false };

  const handlePopoverVisibleChange = (visible: boolean) => {
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
      return <AttachmentPlaceholder fileType={fileType} />;
    }

    if (isMedia) {
      return (
        <div className="media-wrapper">
          {isVideo ? (
            <video controls className="video-player" src={mediaSrc} />
          ) : (
            <audio controls className="audio-player" src={mediaSrc} />
          )}
        </div>
      );
    }

    if (isImage) {
      return (
        <ImageAttachment
          isMediaLoading={isMediaLoading}
          mediaSrc={mediaSrc}
          node={node}
        />
      );
    }

    return (
      <FileAttachment
        deleteNode={deleteNode}
        isFileLoading={isFileLoading}
        node={node}
        onFileClick={handleFileClick}
      />
    );
  };

  return (
    <NodeViewWrapper
      as="div"
      className={classNames('file-attachment', {
        'file-type-video': isVideo,
        'file-type-audio': isAudio,
        uploading: isUploading,
      })}
      data-filename={fileName || tempFile?.name}
      data-filesize={(fileSize || tempFile?.size)?.toString()}
      data-mimetype={mimeType || tempFile?.type}
      data-type="file-attachment"
      data-url={url}>
      <div className={classNames(isMedia ? 'media-content' : 'file-content')}>
        <Popover
          align={{ targetOffset: [0, 16] }}
          content={
            isAssetsUrl ? null : (
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
            )
          }
          destroyTooltipOnHide={{ keepParent: false }}
          open={isPopupVisible}
          overlayClassName="om-image-node-popover"
          placement="bottom"
          showArrow={false}
          trigger="click"
          onOpenChange={handlePopoverVisibleChange}>
          <Spin
            indicator={<Loader size="small" />}
            spinning={isMediaLoading || isUploading}
            tip={isUploading ? t('label.uploading') : t('label.loading')}>
            {renderContent()}
          </Spin>
        </Popover>
      </div>
    </NodeViewWrapper>
  );
};

export default FileNodeView;
