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

  return (
    <div className="file-link-container" onClick={(e) => e.preventDefault()}>
      <div className="tw:flex tw:items-center tw:gap-2 tw:flex-1 tw:relative tw:w-[90%]">
        <FileIcon
          className="tw:w-8 tw:h-8 tw:shrink-0"
          type={mimeType || tempFile?.type || ''}
        />
        <div className="tw:flex tw:flex-col tw:min-w-0">
          <a
            className="file-link"
            data-filename={fileName || tempFile?.name}
            data-filesize={(fileSize || tempFile?.size)?.toString()}
            data-mimetype={mimeType || tempFile?.type}
            data-type="file-attachment"
            data-url={url}
            href="#"
            onClick={onFileClick}>
            <Typography ellipsis as="p" className="file-name" size="text-sm">
              {fileName || tempFile?.name || url}
            </Typography>
          </a>
          <div className="file-meta">
            {fileSize || tempFile?.size ? (
              <Typography
                as="p"
                className="file-size"
                color="secondary"
                size="text-xs">
                {bytesToSize(fileSize || tempFile?.size)}
              </Typography>
            ) : null}
            {isUploading ? (
              <div
                className="upload-progress"
                data-testid="upload-progress"
                style={{ width: `${uploadProgress || 0}%` }}
              />
            ) : (
              isUploadedAsset && (
                <>
                  <span className="separator">|</span>
                  <ButtonUtility
                    color="tertiary"
                    data-testid="download-file-attachment"
                    icon={<DownloadIcon height={18} width={18} />}
                    isDisabled={isFileLoading}
                    size="sm"
                    tooltip={t('label.download')}
                    onClick={onFileClick}
                  />
                </>
              )
            )}
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
