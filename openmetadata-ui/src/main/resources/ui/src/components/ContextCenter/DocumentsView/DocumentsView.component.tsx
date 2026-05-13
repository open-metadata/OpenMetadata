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
import { Download01, Share07, Trash01 } from '@untitledui/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import {
  DocFile,
  DocFileType,
  DocumentsViewProps,
} from './DocumentsView.interface';

// ─── File type badge ──────────────────────────────────────────────────────────

const FILE_TYPE_STYLES: Record<
  DocFileType,
  { label: string; bg: string; text: string }
> = {
  csv: { bg: 'tw:bg-green-100', label: 'CSV', text: 'tw:text-green-700' },
  doc: { bg: 'tw:bg-blue-100', label: 'DOC', text: 'tw:text-blue-700' },
  image: { bg: 'tw:bg-gray-100', label: 'IMG', text: 'tw:text-gray-600' },
  other: { bg: 'tw:bg-gray-100', label: 'FILE', text: 'tw:text-gray-600' },
  pdf: { bg: 'tw:bg-red-100', label: 'PDF', text: 'tw:text-red-700' },
  xls: { bg: 'tw:bg-green-100', label: 'XLSX', text: 'tw:text-green-700' },
};

const FileTypeBadge: FC<{ fileType: DocFileType }> = ({ fileType }) => {
  const { bg, label, text } = FILE_TYPE_STYLES[fileType || 'other'];

  return (
    <span
      className={`tw:inline-flex tw:items-center tw:justify-center tw:w-10 tw:h-10 tw:rounded-lg tw:text-xs tw:font-bold tw:shrink-0 ${bg} ${text}`}>
      {label}
    </span>
  );
};

// ─── Actions dropdown ─────────────────────────────────────────────────────────

interface FileActionsProps {
  canDelete?: boolean;
  file: DocFile;
  onShareFile?: (file: DocFile) => void;
  onDeleteFile?: (file: DocFile) => void;
}

const FileActions: FC<FileActionsProps> = ({
  canDelete,
  file,
  onDeleteFile,
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
      <Dropdown.Popover>
        <Dropdown.Menu
          onAction={(key) => {
            if (key === 'share') {
              onShareFile?.(file);
            } else if (key === 'delete') {
              onDeleteFile?.(file);
            }
          }}>
          <Dropdown.Item
            data-testid="share-btn"
            icon={Share07}
            id="share"
            label={t('label.share-file')}
          />
          {canDelete && (
            <Dropdown.Item
              data-testid="delete-btn"
              icon={Trash01}
              id="delete"
              label={t('label.delete')}
            />
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

const FileRowSkeleton: FC = () => (
  <div className="tw:flex tw:items-center tw:gap-4 tw:px-4 tw:py-3 tw:border-b tw:border-secondary">
    {/* File type badge */}
    <Skeleton
      className="tw:shrink-0"
      height="40px"
      variant="rounded"
      width="40px"
    />

    {/* File details */}
    <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-2">
      <Skeleton height="14px" variant="rounded" width="45%" />

      <div className="tw:flex tw:items-center tw:gap-2">
        <Skeleton height="12px" variant="rounded" width="56px" />
        <Skeleton height="12px" variant="rounded" width="72px" />
        <Skeleton height="12px" variant="rounded" width="96px" />
      </div>
    </div>

    {/* Actions */}
    <div className="tw:flex tw:items-center tw:gap-2 tw:shrink-0">
      <Skeleton height="32px" variant="rounded" width="32px" />
      <Skeleton height="32px" variant="rounded" width="32px" />
    </div>
  </div>
);

// ─── File row ─────────────────────────────────────────────────────────────────

interface FileRowProps {
  canDelete?: boolean;
  file: DocFile;
  onDownload?: (file: DocFile) => void;
  onShareFile?: (file: DocFile) => void;
  onDeleteFile?: (file: DocFile) => void;
}

const FileRow: FC<FileRowProps> = ({
  canDelete,
  file,
  onDeleteFile,
  onDownload,
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
          {file.uploadedBy && (
            <>
              <span className="tw:text-gray-500 tw:leading-none tw:select-none">
                &middot;
              </span>
              <Typography className="tw:text-gray-500" size="text-xs">
                {file.uploadedBy}
              </Typography>
            </>
          )}
          {file.uploadedAt && (
            <>
              <span className="tw:text-gray-500 tw:leading-none tw:select-none">
                &middot;
              </span>
              <Typography className="tw:text-gray-500" size="text-xs">
                {file.uploadedAt}
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
          onShareFile={onShareFile}
        />
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const DocumentsView: FC<DocumentsViewProps> = ({
  canDelete,
  data,
  isLoading,
  onDeleteFile,
  onDownload,
  onShareFile,
}) => {
  return (
    <Card
      className="tw:flex tw:h-auto tw:overflow-hidden tw:max-h-full"
      data-testid="documents-view">
      {/* Right: file list */}
      {data.length > 0 || isLoading ? (
        <div className="tw:flex tw:flex-1 tw:flex-col tw:overflow-y-auto">
          {isLoading
            ? Array.from({ length: 8 }).map((_, idx) => (
                <FileRowSkeleton key={idx} />
              ))
            : data.map((file) => (
                <FileRow
                  canDelete={canDelete}
                  file={file}
                  key={file.id}
                  onDeleteFile={onDeleteFile}
                  onDownload={onDownload}
                  onShareFile={onShareFile}
                />
              ))}
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
