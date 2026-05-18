/*
 *  Copyright 2026 Collate.
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
  Card,
  Dropdown,
  Skeleton,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { Download01, Share06, Trash01 } from '@untitledui/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { FileTypeBadge } from 'utils/ContextCenterUtils';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { DocFile, DocumentsViewProps } from './DocumentsView.interface';

interface FileActionsProps {
  canDelete?: boolean;
  file: DocFile;
  onShareFile?: (file: DocFile) => void;
  onDeleteFile?: (file: DocFile) => void;
  onMoveFile?: (file: DocFile) => void;
}

const FileActions: FC<FileActionsProps> = ({
  canDelete,
  file,
  onDeleteFile,
  onMoveFile,
  onShareFile,
}) => {
  const { t } = useTranslation();

  return (
    <Dropdown.Root>
      <Tooltip
        title={t('label.manage-entity', { entity: t('label.document') })}>
        <TooltipTrigger>
          <Dropdown.DotsButton className="tw:flex tw:p-1 tw:rotate-z-90" />
        </TooltipTrigger>
      </Tooltip>
      <Dropdown.Popover className="tw:w-32">
        <Dropdown.Menu
          onAction={(key) => {
            if (key === 'share') {
              onShareFile?.(file);
            } else if (key === 'move') {
              onMoveFile?.(file);
            } else if (key === 'delete') {
              onDeleteFile?.(file);
            }
          }}>
          <Dropdown.Item
            data-testid="share-btn"
            icon={Share06}
            id="share"
            label={t('label.share-file')}
          />
          <Dropdown.Item
            data-testid="move-btn"
            icon={Share06}
            id="move"
            label={t('label.move-to-folder')}
          />
          {canDelete && (
            <Dropdown.Item data-testid="delete-btn" id="delete">
              <div className="tw:flex tw:items-center tw:gap-2">
                <Trash01
                  aria-hidden="true"
                  className="tw:size-4 tw:shrink-0 tw:stroke-[2.25px] tw:text-error-600"
                />
                <Typography
                  ellipsis
                  className="tw:grow tw:text-error-600"
                  size="text-sm"
                  weight="medium">
                  {t('label.delete')}
                </Typography>
              </div>
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

const FileRowSkeleton: FC = () => (
  <div className="tw:flex tw:items-center tw:gap-4 tw:px-4 tw:py-3 tw:border-b tw:border-secondary">
    <Skeleton
      className="tw:shrink-0"
      height="40px"
      variant="rounded"
      width="40px"
    />
    <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-2">
      <Skeleton height="14px" variant="rounded" width="45%" />
      <div className="tw:flex tw:items-center tw:gap-2">
        <Skeleton height="12px" variant="rounded" width="56px" />
        <Skeleton height="12px" variant="rounded" width="72px" />
        <Skeleton height="12px" variant="rounded" width="96px" />
      </div>
    </div>
    <div className="tw:flex tw:items-center tw:gap-2 tw:shrink-0">
      <Skeleton height="32px" variant="rounded" width="32px" />
      <Skeleton height="32px" variant="rounded" width="32px" />
    </div>
  </div>
);

interface FileRowProps {
  canDelete?: boolean;
  file: DocFile;
  onDownload?: (file: DocFile) => void;
  onShareFile?: (file: DocFile) => void;
  onDeleteFile?: (file: DocFile) => void;
  onMoveFile?: (file: DocFile) => void;
}

const FileRow: FC<FileRowProps> = ({
  canDelete,
  file,
  onDeleteFile,
  onDownload,
  onMoveFile,
  onShareFile,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className="tw:flex tw:items-center tw:gap-4 tw:px-4 tw:py-3 tw:border-b tw:border-secondary"
      data-testid={`document-row-${file.id}`}>
      <FileTypeBadge fileType={file.fileType} />

      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
        <Typography className="tw:truncate" size="text-sm" weight="medium">
          {file.name}
        </Typography>
        <div className="tw:flex tw:items-center tw:gap-1">
          <Typography className="tw:text-gray-500" size="text-xs">
            {file.sizeLabel}
          </Typography>
          {file.updatedBy && (
            <>
              <span className="tw:text-gray-500 tw:leading-none tw:select-none">
                &middot;
              </span>
              <Typography className="tw:text-gray-500" size="text-xs">
                {file.updatedBy}
              </Typography>
            </>
          )}
          {file.updatedAt && (
            <>
              <span className="tw:text-gray-500 tw:leading-none tw:select-none">
                &middot;
              </span>
              <Typography className="tw:text-gray-500" size="text-xs">
                {getShortRelativeTime(file.updatedAt)}
              </Typography>
            </>
          )}
        </div>
      </div>

      <div className="tw:flex tw:items-center tw:gap-2 tw:shrink-0">
        <Tooltip title={t('label.download')}>
          <TooltipTrigger>
            <ButtonUtility
              color="secondary"
              icon={
                <Download01
                  className="tw:text-gray-500"
                  height={16}
                  width={16}
                />
              }
              onClick={() => onDownload?.(file)}
            />
          </TooltipTrigger>
        </Tooltip>
        <FileActions
          canDelete={canDelete}
          file={file}
          onDeleteFile={onDeleteFile}
          onMoveFile={onMoveFile}
          onShareFile={onShareFile}
        />
      </div>
    </div>
  );
};

const DocumentViewLoading = () =>
  Array.from({ length: 8 }).map((_, idx) => <FileRowSkeleton key={idx} />);

const DocumentsView: FC<DocumentsViewProps> = ({
  canDelete,
  data,
  isLoading,
  onDeleteFile,
  onDownload,
  onMoveFile,
  onShareFile,
}) => {
  return (
    <Card
      className="tw:flex tw:overflow-hidden tw:h-full"
      data-testid="documents-view">
      {data.length > 0 || isLoading ? (
        <div className="tw:flex tw:flex-1 tw:flex-col tw:overflow-y-auto">
          {isLoading ? (
            <DocumentViewLoading />
          ) : (
            data.map((file) => (
              <FileRow
                canDelete={canDelete}
                file={file}
                key={file.id}
                onDeleteFile={onDeleteFile}
                onDownload={onDownload}
                onMoveFile={onMoveFile}
                onShareFile={onShareFile}
              />
            ))
          )}
        </div>
      ) : (
        <div className="tw:flex tw:flex-1 tw:items-center tw:justify-center tw:p-12">
          <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.NO_DATA} />
        </div>
      )}
    </Card>
  );
};

export default DocumentsView;
