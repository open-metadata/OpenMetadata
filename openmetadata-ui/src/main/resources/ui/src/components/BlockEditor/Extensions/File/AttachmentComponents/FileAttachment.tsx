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
import {
  DeleteOutlined,
  DownloadOutlined,
  FileOutlined,
} from '@ant-design/icons';
import { NodeViewProps } from '@tiptap/react';
import { Spin } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { bytesToSize } from '../../../../../utils/StringsUtils';
import Loader from '../../../../common/Loader/Loader';

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
  const { t } = useTranslation();

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
    <Spin
      indicator={<Loader size="small" />}
      spinning={isFileLoading || isUploading}
      tip={isUploading ? t('label.uploading') : t('label.loading')}>
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
                  style={{ width: `${uploadProgress || 0}%` }}
                />
              ) : (
                <>
                  <span className="separator">|</span>
                  <span className="file-percentage">
                    <DownloadOutlined onClick={onFileClick} />
                  </span>
                </>
              )}
            </div>
          </div>
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
    </Spin>
  );
};

export default FileAttachment;
