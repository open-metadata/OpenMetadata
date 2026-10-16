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
  ButtonUtility,
  FileIcon,
  Typography,
} from '@openmetadata/ui-core-components';
import { NodeViewProps } from '@tiptap/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DownloadIcon } from '../../../../../assets/svg/action-icons/download.svg';
import { ReactComponent as TrashIcon } from '../../../../../assets/svg/action-icons/trash.svg';
import { UPLOADED_ASSETS_URL } from '../../../../../constants/BlockEditor.constants';
import { bytesToSize } from '../../../../../utils/StringUtils';

const UploadStatus = ({
  isUploading,
  isUploadedAsset,
  isFileLoading,
  uploadProgress,
  onDownloadClick,
}: {
  isUploading: boolean;
  isUploadedAsset: boolean;
  isFileLoading: boolean;
  uploadProgress?: number;
  onDownloadClick: (e: React.MouseEvent) => void;
}) => {
  const { t } = useTranslation();

  if (isUploading) {
    return (
      <div
        className="upload-progress"
        data-testid="upload-progress"
        style={{ width: `${uploadProgress || 0}%` }}
      />
    );
  }

  if (!isUploadedAsset) {
    return null;
  }

  return (
    <>
      <span className="separator">|</span>
      <ButtonUtility
        color="tertiary"
        data-testid="download-file-attachment"
        icon={<DownloadIcon height={18} width={18} />}
        isDisabled={isFileLoading}
        size="sm"
        tooltip={t('label.download')}
        onClick={onDownloadClick}
      />
    </>
  );
};

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
  const isUploadedAsset = url?.includes(UPLOADED_ASSETS_URL);
  const resolvedFileName = fileName || tempFile?.name;
  const resolvedFileSize = fileSize || tempFile?.size;
  const resolvedMimeType = mimeType || tempFile?.type;

  return (
    <div className="file-link-container">
      <div className="tw:flex tw:items-center tw:gap-2 tw:flex-1 tw:relative tw:w-[90%]">
        <FileIcon
          className="tw:w-8 tw:h-8 tw:shrink-0"
          type={resolvedMimeType || ''}
        />
        <div className="tw:flex tw:flex-col tw:min-w-0">
          <button
            className="file-link"
            data-filename={resolvedFileName}
            data-filesize={resolvedFileSize?.toString()}
            data-mimetype={resolvedMimeType}
            data-type="file-attachment"
            data-url={url}
            type="button"
            onClick={onFileClick}>
            <Typography ellipsis as="p" className="file-name" size="text-sm">
              {resolvedFileName || url}
            </Typography>
          </button>
          <div className="file-meta">
            {resolvedFileSize ? (
              <Typography
                as="p"
                className="file-size"
                color="secondary"
                size="text-xs">
                {bytesToSize(resolvedFileSize)}
              </Typography>
            ) : null}
            <UploadStatus
              isFileLoading={isFileLoading}
              isUploadedAsset={isUploadedAsset}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              onDownloadClick={onFileClick}
            />
          </div>
        </div>
      </div>
      {!isUploading && (
        <ButtonUtility
          color="tertiary"
          data-testid="delete-icon"
          icon={<TrashIcon height={18} width={18} />}
          size="sm"
          tooltip={t('label.delete')}
          onClick={(e: React.MouseEvent) => {
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
