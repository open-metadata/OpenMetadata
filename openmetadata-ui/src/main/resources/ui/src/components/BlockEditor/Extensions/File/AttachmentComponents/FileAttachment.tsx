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
import Icon, { DownloadOutlined, FileOutlined } from '@ant-design/icons';
import { NodeViewProps } from '@tiptap/react';
import { Button } from 'antd';
import React from 'react';
import IconDelete from '../../../../../assets/svg/ic-delete.svg?react';
import { bytesToSize } from '../../../../../utils/StringsUtils';

const FileAttachment = ({
  node,
  isFileLoading,
  deleteNode,
  onFileClick,
}: {
  node: NodeViewProps['node'];
  isFileLoading: boolean;
  deleteNode: () => void;
  onFileClick: (e: React.MouseEvent) => void;
}) => {
  const {
    url,
    fileName,
    fileSize,
    mimeType,
    isUploading,
    uploadProgress,
    tempFile,
  } = node.attrs;

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
            onClick={onFileClick}>
            <span className="file-name">{fileName || tempFile?.name}</span>
          </a>
          <div className="file-meta">
            <span className="file-size">
              {bytesToSize(fileSize || tempFile?.size)}
            </span>
            {isUploading ? (
              <div
                className="upload-progress"
                data-testid="upload-progress"
                style={{ width: `${uploadProgress || 0}%` }}
              />
            ) : (
              <>
                <span className="separator">|</span>
                <Button
                  className="file-percentage"
                  icon={<DownloadOutlined />}
                  loading={isFileLoading}
                  size="small"
                  type="text"
                  onClick={onFileClick}
                />
              </>
            )}
          </div>
        </div>
      </div>
      {!isUploading && (
        <Icon
          className="delete-icon"
          component={IconDelete}
          data-testid="delete-icon"
          size={14}
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

export default FileAttachment;
