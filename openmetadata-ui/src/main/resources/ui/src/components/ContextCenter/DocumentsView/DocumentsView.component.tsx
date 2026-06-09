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
  Box,
  Button,
  ButtonUtility,
  Card,
  Checkbox,
  Dot,
  Dropdown,
  FileIcon,
  Skeleton,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronRight,
  Download01,
  Pin02,
  Share06,
  Trash01,
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import React, { FC, useState } from 'react';
import { SubmenuTrigger } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FolderIcon } from '../../../assets/svg/ic-folder-new.svg';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { moveFileToFolder } from '../../../rest/assetAPI';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import {
  DocFile,
  DocumentsViewProps,
  FolderOption,
} from './DocumentsView.interface';

/* ---------------------------------------------------------------
   Shared folder list — renders a popover menu of folder choices.
   Used both as a submenu inside FileActions and as a standalone
   dropdown from the bulk Move button in ListHeader.
--------------------------------------------------------------- */
interface FolderPickerMenuProps {
  folders: FolderOption[];
  onPick: (folderId: string) => void;
}

const FolderPickerMenu: FC<FolderPickerMenuProps> = ({ folders, onPick }) => {
  const { t } = useTranslation();

  if (folders.length === 0) {
    return (
      <div className="tw:px-3 tw:py-2 tw:text-sm tw:text-gray-400">
        {t('label.no-entity', { entity: t('label.folder-plural') })}
      </div>
    );
  }

  return (
    <Dropdown.Menu
      className="tw:max-h-48 tw:overflow-y-auto"
      onAction={(key) => onPick(key as string)}>
      {folders.map((folder) => (
        <Dropdown.Item
          data-testid={`move-to-folder-${folder.id}`}
          icon={FolderIcon}
          id={folder.id}
          key={folder.id}
          label={folder.name}
        />
      ))}
    </Dropdown.Menu>
  );
};

/* ---------------------------------------------------------------
   Per-row actions dropdown (Share / Move to Folder / Delete)
--------------------------------------------------------------- */
interface FileActionsProps {
  canDelete?: boolean;
  file: DocFile;
  folders?: FolderOption[];
  onShareFile?: (file: DocFile) => void;
  onDeleteFile?: (file: DocFile) => void;
  onFileMoved?: (file: DocFile, targetFolderId: string) => void;
}

const FileActions: FC<FileActionsProps> = ({
  canDelete,
  file,
  folders = [],
  onDeleteFile,
  onFileMoved,
  onShareFile,
}) => {
  const { t } = useTranslation();
  const [isMoving, setIsMoving] = useState(false);

  const availableFolders = folders.filter((f) => f.id !== file.folderId);

  const handleMoveToFolder = async (folderId: string) => {
    try {
      setIsMoving(true);
      await moveFileToFolder(file.driveFileId ?? file.id, folderId);
      onFileMoved?.(file, folderId);
      showSuccessToast(
        t('message.entity-moved-successfully', { entity: t('label.document') })
      );
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Dropdown.Root>
      <Tooltip
        title={t('label.manage-entity', { entity: t('label.document') })}>
        <TooltipTrigger>
          <Dropdown.DotsButton className="tw:flex tw:p-1 tw:rotate-z-90" />
        </TooltipTrigger>
      </Tooltip>
      <Dropdown.Popover className="tw:w-46">
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
            icon={Share06}
            id="share"
            label={t('label.share-file')}
          />

          <SubmenuTrigger>
            <Dropdown.Item
              data-testid="move-btn"
              icon={Pin02}
              isDisabled={isMoving || availableFolders.length === 0}>
              {() => (
                <Box align="center" justify="between">
                  <Typography ellipsis className="tw:grow tw:text-secondary">
                    {t('label.move-to-folder')}
                  </Typography>
                  <ChevronRight
                    aria-hidden="true"
                    className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
                    strokeWidth={2}
                  />
                </Box>
              )}
            </Dropdown.Item>
            <Dropdown.Popover
              className="tw:w-52"
              offset={-6}
              placement="right top">
              <FolderPickerMenu
                folders={availableFolders}
                onPick={handleMoveToFolder}
              />
            </Dropdown.Popover>
          </SubmenuTrigger>

          {canDelete && (
            <Dropdown.Item data-testid="delete-btn" id="delete">
              <Box align="center" gap={2}>
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
              </Box>
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

/* ---------------------------------------------------------------
   Skeleton loader for a single file row
--------------------------------------------------------------- */
const FileRowSkeleton: FC = () => (
  <Box
    align="center"
    className="tw:px-4 tw:py-3 tw:border-b tw:border-secondary"
    gap={4}>
    <Skeleton
      className="tw:shrink-0"
      height="16px"
      variant="rounded"
      width="16px"
    />
    <Skeleton
      className="tw:shrink-0"
      height="40px"
      variant="rounded"
      width="40px"
    />
    <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={2}>
      <Skeleton height="14px" variant="rounded" width="45%" />
      <Box align="center" gap={2}>
        <Skeleton height="12px" variant="rounded" width="56px" />
        <Skeleton height="12px" variant="rounded" width="72px" />
        <Skeleton height="12px" variant="rounded" width="96px" />
      </Box>
    </Box>
    <Box align="center" className="tw:shrink-0" gap={2}>
      <Skeleton height="32px" variant="rounded" width="32px" />
      <Skeleton height="32px" variant="rounded" width="32px" />
    </Box>
  </Box>
);

/* ---------------------------------------------------------------
   List header — normal count view OR bulk-action bar
--------------------------------------------------------------- */
interface ListHeaderProps {
  count: number;
  folders?: FolderOption[];
  selectedCount: number;
  onClear?: () => void;
  onBulkDelete?: () => void;
  onBulkMove?: (folderId: string) => void;
  onBulkDownload?: () => void;
}

const ListHeader: FC<ListHeaderProps> = ({
  count,
  folders = [],
  selectedCount,
  onClear,
  onBulkDelete,
  onBulkMove,
  onBulkDownload,
}) => {
  const { t } = useTranslation();

  if (selectedCount > 0) {
    return (
      <Box
        align="center"
        className={
          'tw:px-4 tw:py-2.5 tw:border-b tw:border-blue-100 tw:bg-blue-50 ' +
          'tw:sticky tw:top-0 tw:z-10'
        }
        gap={2}>
        <Typography
          className="tw:text-blue-700"
          size="text-sm"
          weight="semibold">
          {selectedCount} {t('label.selected-lowercase')}
        </Typography>

        <Button
          className="tw:py-1.5"
          color="tertiary"
          data-testid="clear-selection-btn"
          size="sm"
          onClick={onClear}>
          {t('label.clear')}
        </Button>

        <span className="tw:flex-1" />

        <Button
          className="tw:py-1.5"
          color="tertiary"
          data-testid="bulk-download-btn"
          iconLeading={<Download01 size={18} />}
          size="sm"
          onClick={onBulkDownload}>
          {t('label.download')}
        </Button>

        <Dropdown.Root>
          <Button
            className="tw:py-1.5"
            color="tertiary"
            data-testid="bulk-move-btn"
            iconLeading={<FolderIcon height={18} strokeWidth={2} width={18} />}
            size="sm">
            {t('label.move')}
          </Button>
          <Dropdown.Popover className="tw:w-52" placement="bottom end">
            <FolderPickerMenu
              folders={folders}
              onPick={(folderId) => onBulkMove?.(folderId)}
            />
          </Dropdown.Popover>
        </Dropdown.Root>

        <Button
          className="tw:py-1.5"
          color="tertiary-destructive"
          data-testid="bulk-delete-btn"
          iconLeading={<Trash01 size={16} />}
          size="sm"
          onClick={onBulkDelete}>
          {t('label.delete')}
        </Button>
      </Box>
    );
  }

  return (
    <Box
      align="center"
      className={
        'tw:px-4 tw:py-3 tw:border-b tw:border-secondary ' +
        'tw:sticky tw:top-0 tw:z-10 tw:bg-primary'
      }>
      <Typography className="tw:text-gray-500" size="text-xs" weight="semibold">
        {count} {t('label.file-plural').toLowerCase()}
      </Typography>
      <span className="tw:flex-1" />
      <Typography className="tw:text-gray-500" size="text-xs" weight="semibold">
        {t('label.sorted-by-recently-uploaded')}
      </Typography>
    </Box>
  );
};

/* ---------------------------------------------------------------
   Single file row
--------------------------------------------------------------- */
interface FileRowProps {
  canDelete?: boolean;
  file: DocFile;
  folders?: FolderOption[];
  isActive?: boolean;
  isSelected?: boolean;
  onDownload?: (file: DocFile) => void;
  onShareFile?: (file: DocFile) => void;
  onDeleteFile?: (file: DocFile) => void;
  onFileMoved?: (file: DocFile, targetFolderId: string) => void;
  onPreview?: (file: DocFile) => void;
  onSelectFile?: (fileId: string) => void;
}

const FileRow: FC<FileRowProps> = ({
  canDelete,
  file,
  folders,
  isActive,
  isSelected,
  onDeleteFile,
  onDownload,
  onFileMoved,
  onPreview,
  onSelectFile,
  onShareFile,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`tw:flex tw:items-center tw:gap-4 tw:px-4 tw:py-3 tw:border-b tw:border-secondary tw:cursor-pointer tw:transition-colors tw:duration-100 ${
        isActive ? 'tw:bg-blue-50' : 'tw:bg-primary hover:tw:bg-gray-25'
      }`}
      data-testid={`document-row-${file.id}`}
      role="button"
      tabIndex={0}
      onClick={() => onPreview?.(file)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onPreview?.(file);
        }
      }}>
      <Checkbox
        aria-label={file.name}
        isSelected={isSelected}
        onChange={() => onSelectFile?.(file.id)}
        onClick={(e) => (e as React.MouseEvent).stopPropagation()}
      />

      <FileIcon
        className="tw:size-8 tw:shrink-0"
        theme="light"
        type={file.fileExtension ?? ''}
        variant="default"
      />

      <Box className="tw:min-w-0 tw:flex-1" direction="col">
        <Typography
          className="tw:truncate"
          data-testid="document-name"
          size="text-sm"
          weight="medium">
          {file.name}
        </Typography>
        <Box align="center" gap={2}>
          <Typography
            className="tw:text-gray-500"
            data-testid="document-size"
            size="text-xs">
            {file.sizeLabel}
          </Typography>
          {file.updatedBy && (
            <>
              <Dot className="tw:text-gray-500" size="micro" />
              <Typography
                className="tw:text-gray-500"
                data-testid="document-updated-by"
                size="text-xs">
                {file.updatedBy}
              </Typography>
            </>
          )}
          {file.updatedAt && (
            <>
              <Dot className="tw:text-gray-500" size="micro" />
              <Typography
                className="tw:text-gray-500"
                data-testid="document-updated-at"
                size="text-xs">
                {getShortRelativeTime(file.updatedAt)}
              </Typography>
            </>
          )}
          {file.folderName && (
            <>
              <Dot className="tw:text-gray-500" size="micro" />
              <Typography
                className="tw:text-gray-500"
                data-testid="document-folder-name"
                size="text-xs">
                {file.folderName}
              </Typography>
            </>
          )}
        </Box>
      </Box>

      <div
        className="tw:flex tw:items-center tw:gap-2 tw:shrink-0"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}>
        <Tooltip title={t('label.download')}>
          <TooltipTrigger>
            <ButtonUtility
              color="secondary"
              data-testid="download-btn"
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
          folders={folders}
          onDeleteFile={onDeleteFile}
          onFileMoved={onFileMoved}
          onShareFile={onShareFile}
        />
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------
   Loading state — 8 skeleton rows
--------------------------------------------------------------- */
const DocumentViewLoading = () =>
  Array.from({ length: 8 }, (_, i) => <FileRowSkeleton key={i} />);

/* ---------------------------------------------------------------
   Main DocumentsView
--------------------------------------------------------------- */
const DocumentsView: FC<DocumentsViewProps> = ({
  canDelete,
  data,
  folders,
  isLoading,
  previewFileId,
  selectedIds,
  onBulkDelete,
  onBulkDownload,
  onBulkMove,
  onDeleteFile,
  onDownload,
  onFileMoved,
  onPreview,
  onSelectFile,
  onShareFile,
}) => {
  const selectedCount = selectedIds?.size ?? 0;

  const handleClear = () => {
    data.forEach((file) => {
      if (selectedIds?.has(file.id)) {
        onSelectFile?.(file.id);
      }
    });
  };

  return (
    <Card
      className={classNames(
        'tw:flex tw:overflow-hidden tw:h-full tw:flex-1 tw:min-w-0',
        { 'tw:rounded-tr-none tw:rounded-br-none': previewFileId }
      )}
      data-testid="documents-view">
      {data.length > 0 || isLoading ? (
        <Box className="tw:flex-1 tw:overflow-y-auto" direction="col">
          {!isLoading && (
            <ListHeader
              count={data.length}
              folders={folders}
              selectedCount={selectedCount}
              onBulkDelete={onBulkDelete}
              onBulkDownload={onBulkDownload}
              onBulkMove={onBulkMove}
              onClear={handleClear}
            />
          )}
          {isLoading ? (
            <DocumentViewLoading />
          ) : (
            data.map((file) => (
              <FileRow
                canDelete={canDelete}
                file={file}
                folders={folders}
                isActive={previewFileId === file.id}
                isSelected={selectedIds?.has(file.id)}
                key={file.id}
                onDeleteFile={onDeleteFile}
                onDownload={onDownload}
                onFileMoved={onFileMoved}
                onPreview={onPreview}
                onSelectFile={onSelectFile}
                onShareFile={onShareFile}
              />
            ))
          )}
        </Box>
      ) : (
        <Box align="center" className="tw:flex-1 tw:p-12" justify="center">
          <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.NO_DATA} />
        </Box>
      )}
    </Card>
  );
};

export default DocumentsView;
