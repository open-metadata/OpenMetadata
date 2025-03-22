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
import { Spin } from 'antd';
import { noop } from 'lodash';
import React, { FC } from 'react';
import { bytesToSize } from '../../../../utils/StringsUtils';
import { FileType } from '../../BlockEditor.interface';
import imageClassBase from '../image/ImageClassBase';
import './file-node.less';

const FileNodeView: FC<NodeViewProps> = ({ node }) => {
  const { url, fileName, fileSize, mimeType } = node.attrs;
  const isVideo = mimeType.startsWith(FileType.VIDEO);
  const isAudio = mimeType.startsWith(FileType.AUDIO);
  const isMedia = isVideo || isAudio;

  const authenticatedImageUrl = imageClassBase.getAuthenticatedImageUrl();

  const { imageSrc: mediaSrc, isLoading: isMediaLoading } =
    authenticatedImageUrl
      ? authenticatedImageUrl(url)
      : { imageSrc: url, isLoading: false };

  const authenticatedFileUrl = imageClassBase.getAuthenticatedFileUrl();
  const { downloadFile, isLoading: isFileLoading } = authenticatedFileUrl
    ? authenticatedFileUrl(url)
    : { downloadFile: noop, isLoading: false };

  const handleFileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    downloadFile(fileName);
  };

  const renderContent = () => {
    if (isMedia) {
      return isVideo ? (
        <video controls className="video-player" src={mediaSrc} />
      ) : (
        <audio controls className="audio-player" src={mediaSrc} />
      );
    }

    return (
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
        {fileSize && <span className="file-size">{bytesToSize(fileSize)}</span>}
      </a>
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
        <Spin spinning={isMedia ? isMediaLoading : isFileLoading}>
          {renderContent()}
        </Spin>
      </div>
    </NodeViewWrapper>
  );
};

export default FileNodeView;
