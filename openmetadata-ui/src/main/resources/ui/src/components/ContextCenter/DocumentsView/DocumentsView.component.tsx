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
  EmptyPlaceholder,
  FileIcon,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Check, ChevronRight } from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { FC, UIEvent, useMemo, useState } from 'react';
import { SubmenuTrigger } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CopyIcon } from '../../../assets/svg/action-icons/copy.svg';
import { ReactComponent as DotsVerticalIcon } from '../../../assets/svg/action-icons/dots-vertical.svg';
import { ReactComponent as DownloadIcon } from '../../../assets/svg/action-icons/download.svg';
import { ReactComponent as MoveFolderIcon } from '../../../assets/svg/action-icons/move-folder.svg';
import { ReactComponent as TrashIcon } from '../../../assets/svg/action-icons/trash.svg';
import { ReactComponent as UploadIcon } from '../../../assets/svg/action-icons/upload.svg';
import { ReactComponent as FolderIcon } from '../../../assets/svg/common/folder.svg';
import { ReactComponent as NoSearchResultIcon } from '../../../assets/svg/common/no-search-result.svg';
import { moveFileToFolder, moveFileToRoot } from '../../../rest/assetAPI';
import { formatBytes } from '../../../utils/ContextCenterPureUtils';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import CopyLinkButton from '../../CopyLinkButton/CopyLinkButton.component';
import DocumentStatusBadge from '../DocumentStatusBadge/DocumentStatusBadge.component';
import {
  DocumentsViewProps,
  FileActionsProps,
  FileRowProps,
  FolderPickerMenuProps,
  ListHeaderProps,
} from './DocumentsView.interface';

/* ---------------------------------------------------------------
   Shared folder list — renders a popover menu of folder choices.
   Used both as a submenu inside FileActions and as a standalone
   dropdown from the bulk Move button in ListHeader.
--------------------------------------------------------------- */

const FolderPickerMenu: FC<FolderPickerMenuProps> = ({
  folders,
  currentFolderId,
  onPick,
}) => {
  const { t } = useTranslation();

  if (folders.length === 0) {
    return (
      <Typography as="p" className="tw:px-3 tw:py-2 tw:text-utility-gray-400">
        {t('label.no-entity', { entity: t('label.folder-plural') })}
      </Typography>
    );
  }

  return (
    <Dropdown.Menu
      className="tw:max-h-48 tw:overflow-y-auto"
      onAction={(key) => onPick(key as string)}>
      {folders.map((folder) => {
        const isCurrent = folder.id === currentFolderId;

        return (
          <Dropdown.Item
            className={isCurrent ? 'tw:[&>div]:bg-utility-blue-50' : undefined}
            data-testid={`move-to-folder-${folder.id}`}
            id={folder.id}
            key={folder.id}
            textValue={folder.name}>
            {() => (
              <Box align="center" className="tw:w-full" justify="between">
                <Box align="center" gap={2}>
                  <FolderIcon
                    aria-hidden="true"
                    className="tw:size-4 tw:shrink-0"
                  />
                  <div className="tw:max-w-40">
                    <Typography ellipsis size="text-sm">
                      {folder.name}
                    </Typography>
                  </div>
                </Box>
                {isCurrent && (
                  <Check
                    aria-hidden="true"
                    className="tw:size-4 tw:shrink-0 tw:text-fg-brand-primary tw:ml-2"
                    strokeWidth={2}
                  />
                )}
              </Box>
            )}
          </Dropdown.Item>
        );
      })}
    </Dropdown.Menu>
  );
};

/* ---------------------------------------------------------------
   Per-row actions dropdown (Share / Move to Folder / Delete)
--------------------------------------------------------------- */

const FileActions: FC<FileActionsProps> = ({
  canDelete,
  canEdit,
  file,
  folders = [],
  onDeleteFile,
  onFileMoved,
}) => {
  const { t } = useTranslation();
  const [isMoving, setIsMoving] = useState(false);

  const handleMoveToFolder = async (folderId: string) => {
    try {
      setIsMoving(true);
      if (folderId === file.folder?.id) {
        await moveFileToRoot(file.id);
        onFileMoved?.(file, null);
        showSuccessToast(
          t('message.entity-removed-from-folder', {
            entity: t('label.document'),
          })
        );
      } else {
        await moveFileToFolder(file.id, folderId);
        onFileMoved?.(file, folderId);
        showSuccessToast(
          t('message.entity-moved-successfully', {
            entity: t('label.document'),
          })
        );
      }
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsMoving(false);
    }
  };

  if (!canEdit && !canDelete) {
    return null;
  }

  return (
    <Dropdown.Root>
      <ButtonUtility
        color="tertiary"
        data-testid="manage-button"
        icon={<DotsVerticalIcon height={20} width={20} />}
        size="sm"
        tooltip={t('label.manage-entity', { entity: t('label.document') })}
      />
      <Dropdown.Popover className="tw:w-46">
        <Dropdown.Menu
          onAction={(key) => {
            if (key === 'delete') {
              onDeleteFile?.(file);
            }
          }}>
          {canEdit && (
            <SubmenuTrigger>
              <Dropdown.Item
                data-testid="move-btn"
                isDisabled={isMoving || folders.length === 0}>
                {() => (
                  <Box align="center" justify="between">
                    <Box align="center" gap={2}>
                      <MoveFolderIcon
                        className="tw:text-secondary"
                        height={20}
                        width={20}
                      />
                      <Typography
                        ellipsis
                        className="tw:grow tw:text-secondary">
                        {t('label.move-to-folder')}
                      </Typography>
                    </Box>
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
                  currentFolderId={file.folder?.id}
                  folders={folders}
                  onPick={handleMoveToFolder}
                />
              </Dropdown.Popover>
            </SubmenuTrigger>
          )}

          {canDelete && (
            <Dropdown.Item data-testid="delete-btn" id="delete">
              <Box align="center" gap={2}>
                <TrashIcon
                  aria-hidden="true"
                  className="tw:shrink-0 tw:text-error-primary"
                  height={20}
                  width={20}
                />
                <Typography
                  ellipsis
                  className="tw:grow tw:text-error-primary"
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
    data-testid="document-row-skeleton"
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

const ListHeader: FC<ListHeaderProps> = ({
  canDelete,
  canEdit,
  folders = [],
  selectedCount,
  totalFileCount,
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
        className="tw:px-4 tw:h-12 tw:shrink-0 tw:border-b tw:border-utility-blue-100 tw:bg-utility-blue-50"
        gap={2}>
        <Typography
          className="tw:text-utility-blue-700"
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
          iconLeading={<DownloadIcon height={18} width={18} />}
          size="sm"
          onClick={onBulkDownload}>
          {t('label.download')}
        </Button>

        {canEdit && (
          <Dropdown.Root>
            <Button
              className="tw:py-1.5"
              color="tertiary"
              data-testid="bulk-move-btn"
              iconLeading={
                <FolderIcon height={18} strokeWidth={2} width={18} />
              }
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
        )}

        {canDelete && (
          <Button
            className="tw:py-1.5"
            color="tertiary-destructive"
            data-testid="bulk-delete-btn"
            iconLeading={<TrashIcon height={16} width={16} />}
            size="sm"
            onClick={onBulkDelete}>
            {t('label.delete')}
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box
      align="center"
      className="tw:px-4 tw:h-12 tw:shrink-0 tw:border-b tw:border-secondary tw:bg-primary">
      <Typography
        className="tw:text-quaternary"
        data-testid="documents-view-file-count"
        size="text-xs"
        weight="semibold">
        {totalFileCount} {t('label.file-plural').toLowerCase()}
      </Typography>
      <span className="tw:flex-1" />
      <Typography
        className="tw:text-quaternary"
        size="text-xs"
        weight="semibold">
        {t('label.sorted-by-recently-uploaded')}
      </Typography>
    </Box>
  );
};

/* ---------------------------------------------------------------
   Single file row
--------------------------------------------------------------- */
const FileRow: FC<FileRowProps> = ({
  canDelete,
  canEdit,
  file,
  folders,
  isActive,
  isSelected,
  onDeleteFile,
  onDownload,
  onFileMoved,
  onPreview,
  onSelectFile,
}) => {
  const { t } = useTranslation();

  const { folderName, fileName, formattedFileSize, relativeTime, rowUrl } =
    useMemo(() => {
      const params = new URLSearchParams(window.location.search);
      params.set('document', file.id);
      const url = `${window.location.origin}${
        window.location.pathname
      }?${params.toString()}`;

      return {
        folderName: getEntityName(file.folder),
        fileName: getEntityName(file),
        formattedFileSize: formatBytes(file.fileSize),
        relativeTime: getShortRelativeTime(file.updatedAt),
        rowUrl: url,
      };
    }, [file]);

  return (
    <Box
      align="center"
      className={`tw:relative tw:px-4 tw:py-3 tw:border-b tw:border-secondary tw:cursor-pointer tw:transition-colors tw:duration-100 ${
        isActive
          ? 'tw:bg-utility-blue-50'
          : 'tw:bg-primary hover:tw:bg-secondary_subtle'
      }`}
      data-testid={`document-row-${file.id}`}
      gap={4}
      role="button"
      tabIndex={0}
      onClick={() => onPreview?.(file)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onPreview?.(file);
        }
      }}>
      <Checkbox
        aria-label={fileName}
        data-testid="document-checkbox"
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
        <Box align="center" className="tw:min-w-0" gap={2}>
          <Typography
            ellipsis
            data-testid="document-name"
            size="text-sm"
            weight="medium">
            {fileName}
          </Typography>
        </Box>
        <Box align="center" gap={2} wrap="wrap">
          <Typography
            className="tw:text-quaternary"
            data-testid="document-size"
            size="text-xs">
            {formattedFileSize}
          </Typography>
          {Boolean(file.memoryCount) && (
            <>
              <Dot className="tw:text-quaternary" size="micro" />
              <Typography
                className="tw:text-quaternary"
                data-testid="document-memory-count"
                size="text-xs">
                {file.memoryCount} {t('label.memory-plural').toLowerCase()}
              </Typography>
            </>
          )}
          {file.updatedBy && (
            <>
              <Dot className="tw:text-quaternary" size="micro" />
              <Typography
                className="tw:text-quaternary"
                data-testid="document-updated-by"
                size="text-xs">
                {file.updatedBy}
              </Typography>
            </>
          )}
          {file.updatedAt && (
            <>
              <Dot className="tw:text-quaternary" size="micro" />
              <Typography
                className="tw:text-quaternary"
                data-testid="document-updated-at"
                size="text-xs">
                {relativeTime}
              </Typography>
            </>
          )}
          {folderName && (
            <>
              <Dot className="tw:text-quaternary" size="micro" />
              <Typography
                className="tw:text-quaternary"
                data-testid="document-folder-name"
                size="text-xs">
                {folderName}
              </Typography>
            </>
          )}
        </Box>
      </Box>

      <Box
        align="center"
        className="tw:shrink-0"
        gap={2}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}>
        <DocumentStatusBadge
          error={file.processingError}
          stats={file.extractionStats}
          status={file.processingStatus}
        />
        <ButtonUtility
          className="tw:ml-1.5"
          color="tertiary"
          data-testid="download-btn"
          icon={<DownloadIcon height={20} width={20} />}
          tooltip={t('label.download')}
          onClick={() => onDownload?.(file)}
        />
        <CopyLinkButton url={rowUrl}>
          <CopyIcon aria-hidden="true" height={20} width={20} />
        </CopyLinkButton>
        <FileActions
          canDelete={canDelete}
          canEdit={canEdit}
          file={file}
          folders={folders}
          onDeleteFile={onDeleteFile}
          onFileMoved={onFileMoved}
        />
      </Box>
    </Box>
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
const SCROLL_THRESHOLD = 100;

const DocumentsView: FC<DocumentsViewProps> = ({
  canDelete,
  canEdit,
  data,
  folders,
  totalFileCount,
  isLoading,
  isLoadingMore,
  previewFileId,
  selectedIds,
  selectedFolderName,
  onBulkDelete,
  onBulkDownload,
  onBulkMove,
  onDeleteFile,
  onDownload,
  onFileMoved,
  onPreview,
  onSelectFile,
  onScrollEnd,
  onUploadFile,
}) => {
  const { t } = useTranslation();
  const selectedCount = selectedIds?.size ?? 0;

  const handleClear = () => {
    data.forEach((file) => {
      if (selectedIds?.has(file.id)) {
        onSelectFile?.(file.id);
      }
    });
  };

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD) {
      onScrollEnd?.();
    }
  };

  return (
    <Card
      className={classNames(
        'tw:flex tw:overflow-hidden tw:h-full tw:flex-1 tw:min-w-0',
        { 'tw:rounded-tr-none tw:rounded-br-none': previewFileId }
      )}
      data-testid="documents-view">
      {data.length > 0 || isLoading ? (
        <Box
          className="tw:flex-1 tw:min-h-0 tw:overflow-hidden"
          direction="col">
          {!isLoading && (
            <ListHeader
              canDelete={canDelete}
              canEdit={canEdit}
              folders={folders}
              selectedCount={selectedCount}
              totalFileCount={totalFileCount}
              onBulkDelete={onBulkDelete}
              onBulkDownload={onBulkDownload}
              onBulkMove={onBulkMove}
              onClear={handleClear}
            />
          )}
          <Box
            className="tw:flex-1 tw:overflow-y-auto tw:min-h-0"
            direction="col"
            onScroll={handleScroll}>
            {isLoading ? (
              <DocumentViewLoading />
            ) : (
              <>
                {data.map((file) => (
                  <FileRow
                    canDelete={canDelete}
                    canEdit={canEdit}
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
                  />
                ))}
                {isLoadingMore && (
                  <>
                    <FileRowSkeleton />
                    <FileRowSkeleton />
                  </>
                )}
              </>
            )}
          </Box>
        </Box>
      ) : selectedFolderName ? (
        <div className="tw:relative tw:flex-1">
          <EmptyPlaceholder
            actions={
              onUploadFile
                ? [
                    {
                      color: 'primary',
                      key: 'upload-file',
                      label: t('label.upload-file'),
                      onClick: onUploadFile,
                    },
                  ]
                : []
            }
            description={t('message.context-center-folder-empty-subtitle')}
            icon={<UploadIcon className="tw:text-fg-brand-primary" />}
            title={t('label.folder-name-is-empty', {
              folderName: selectedFolderName,
            })}
            variant="blank"
          />
        </div>
      ) : (
        <div className="tw:relative tw:flex-1">
          <EmptyPlaceholder
            description={t('message.check-spelling-or-try-different-term')}
            icon={<NoSearchResultIcon className="tw:text-quaternary" />}
            title={t('label.no-matching-results')}
            variant="blank"
          />
        </div>
      )}
    </Card>
  );
};

export default DocumentsView;
