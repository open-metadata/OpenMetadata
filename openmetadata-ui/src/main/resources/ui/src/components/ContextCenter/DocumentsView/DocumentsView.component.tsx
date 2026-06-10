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
import { FC, useState } from 'react';
import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  Popover as AriaPopover,
  SubmenuTrigger,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FolderIcon } from '../../../assets/svg/ic-folder-new.svg';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { moveFileToFolder } from '../../../rest/assetAPI';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import DocumentStatusBadge from '../DocumentStatusBadge/DocumentStatusBadge.component';
import {
  DocFile,
  DocumentsViewProps,
  FolderOption,
} from './DocumentsView.interface';

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
            <AriaMenuItem
              className={(state) =>
                `tw:group tw:block tw:cursor-pointer tw:px-1.5 tw:py-px tw:outline-hidden${
                  state.isDisabled ? ' tw:cursor-not-allowed tw:opacity-50' : ''
                }`
              }
              data-testid="move-btn"
              isDisabled={isMoving || availableFolders.length === 0}>
              {() => (
                <div
                  className={
                    'tw:relative tw:flex tw:items-center tw:gap-2 ' +
                    'tw:rounded-md tw:px-2.5 tw:py-2 tw:outline-focus-ring ' +
                    'tw:transition tw:duration-100 tw:ease-linear ' +
                    'tw:group-hover:bg-primary_hover'
                  }>
                  <Pin02
                    aria-hidden="true"
                    className="tw:size-4 tw:shrink-0 tw:stroke-[2.25px] tw:text-fg-quaternary"
                  />
                  <Typography
                    className="tw:text-secondary"
                    size="text-sm"
                    weight="semibold">
                    {t('label.move-to-folder')}
                  </Typography>
                  <ChevronRight
                    aria-hidden="true"
                    className="tw:ml-auto tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
                  />
                </div>
              )}
            </AriaMenuItem>
            <AriaPopover
              className="tw:z-50 tw:w-52 tw:rounded-lg tw:bg-primary tw:py-1 tw:shadow-lg tw:ring-1 tw:ring-secondary_alt"
              offset={4}
              placement="right top">
              <AriaMenu className="tw:max-h-48 tw:overflow-y-auto tw:outline-hidden tw:select-none">
                {availableFolders.map((folder) => (
                  <AriaMenuItem
                    className={(state) =>
                      `tw:group tw:block tw:cursor-pointer tw:px-1.5 tw:py-px tw:outline-hidden${
                        state.isDisabled ? ' tw:cursor-not-allowed' : ''
                      }`
                    }
                    data-testid={`move-to-folder-${folder.id}`}
                    id={folder.id}
                    key={folder.id}
                    textValue={folder.name}
                    onAction={() => handleMoveToFolder(folder.id)}>
                    {() => (
                      <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-md tw:px-2.5 tw:py-2 tw:transition tw:duration-100 tw:ease-linear tw:group-hover:bg-primary_hover">
                        <FolderIcon
                          className="tw:text-gray-500 tw:shrink-0"
                          height={18}
                          width={18}
                        />
                        <Typography ellipsis size="text-sm" weight="medium">
                          {folder.name}
                        </Typography>
                      </div>
                    )}
                  </AriaMenuItem>
                ))}
              </AriaMenu>
            </AriaPopover>
          </SubmenuTrigger>

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
  folders?: FolderOption[];
  onDownload?: (file: DocFile) => void;
  onShareFile?: (file: DocFile) => void;
  onDeleteFile?: (file: DocFile) => void;
  onFileMoved?: (file: DocFile, targetFolderId: string) => void;
}

const FileRow: FC<FileRowProps> = ({
  canDelete,
  file,
  folders,
  onDeleteFile,
  onDownload,
  onFileMoved,
  onShareFile,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className="tw:flex tw:items-center tw:gap-4 tw:px-4 tw:py-3 tw:border-b tw:border-secondary"
      data-testid={`document-row-${file.id}`}>
      <FileIcon
        className="tw:size-8"
        theme="light"
        type={file.fileExtension ?? ''}
        variant="default"
      />

      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
        <div className="tw:flex tw:items-center tw:gap-2">
          <Typography
            className="tw:truncate"
            data-testid="document-name"
            size="text-sm"
            weight="medium">
            {file.name}
          </Typography>
          <DocumentStatusBadge status={file.status} />
        </div>
        <div className="tw:flex tw:items-center tw:gap-1">
          <Typography
            className="tw:text-gray-500"
            data-testid="document-size"
            size="text-xs">
            {file.sizeLabel}
          </Typography>
          {file.updatedBy && (
            <>
              <span className="tw:text-gray-500 tw:leading-none tw:select-none">
                &middot;
              </span>
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
              <span className="tw:text-gray-500 tw:leading-none tw:select-none">
                &middot;
              </span>
              <Typography
                className="tw:text-gray-500"
                data-testid="document-updated-at"
                size="text-xs">
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

const DocumentViewLoading = () =>
  Array.from({ length: 8 }).map((_, idx) => <FileRowSkeleton key={idx} />);

const DocumentsView: FC<DocumentsViewProps> = ({
  canDelete,
  data,
  folders,
  isLoading,
  onDeleteFile,
  onDownload,
  onFileMoved,
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
                folders={folders}
                key={file.id}
                onDeleteFile={onDeleteFile}
                onDownload={onDownload}
                onFileMoved={onFileMoved}
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
