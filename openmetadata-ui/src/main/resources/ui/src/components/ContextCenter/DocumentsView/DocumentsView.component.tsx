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
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  ChevronRight,
  Download01,
  Folder,
  Move,
  Share07,
  Trash01,
} from '@untitledui/icons';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import {
  DocFile,
  DocFileType,
  DocFolder,
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
  xlsx: { bg: 'tw:bg-green-100', label: 'XLSX', text: 'tw:text-green-700' },
};

const FileTypeBadge: FC<{ fileType: DocFileType }> = ({ fileType }) => {
  const { bg, label, text } = FILE_TYPE_STYLES[fileType];

  return (
    <span
      className={`tw:inline-flex tw:items-center tw:justify-center tw:w-10 tw:h-10 tw:rounded-lg tw:text-xs tw:font-bold tw:shrink-0 ${bg} ${text}`}>
      {label}
    </span>
  );
};

// ─── Actions dropdown ─────────────────────────────────────────────────────────

interface FileActionsProps {
  file: DocFile;
  onDownload?: (file: DocFile) => void;
  onMoveToFolder?: (file: DocFile) => void;
  onShareFile?: (file: DocFile) => void;
  onDeleteFile?: (file: DocFile) => void;
}

const FileActions: FC<FileActionsProps> = ({
  file,
  onDeleteFile,
  onDownload,
  onMoveToFolder,
  onShareFile,
}) => {
  const { t } = useTranslation();

  return (
    <Dropdown.Root>
      <Dropdown.DotsButton className="tw:flex tw:p-1 tw:rotate-z-90" />
      <Dropdown.Popover>
        <Dropdown.Menu
          onAction={(key) => {
            if (key === 'move') {
              onMoveToFolder?.(file);
            } else if (key === 'share') {
              onShareFile?.(file);
            } else if (key === 'delete') {
              onDeleteFile?.(file);
            }
          }}>
          <Dropdown.Item
            icon={Move}
            id="move"
            label={t('label.move-to-folder', {
              defaultValue: 'Move to folder',
            })}
          />
          <Dropdown.Item
            icon={Share07}
            id="share"
            label={t('label.share-file', { defaultValue: 'Share File' })}
          />
          <Dropdown.Item icon={Trash01} id="delete" label={t('label.delete')} />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

// ─── File row ─────────────────────────────────────────────────────────────────

interface FileRowProps {
  file: DocFile;
  onDownload?: (file: DocFile) => void;
  onMoveToFolder?: (file: DocFile) => void;
  onShareFile?: (file: DocFile) => void;
  onDeleteFile?: (file: DocFile) => void;
}

const FileRow: FC<FileRowProps> = ({
  file,
  onDeleteFile,
  onDownload,
  onMoveToFolder,
  onShareFile,
}) => (
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
        <span className="tw:text-gray-500 tw:leading-none tw:select-none">
          &middot;
        </span>
        <Typography className="tw:text-gray-500" size="text-xs">
          {file.uploadedBy}
        </Typography>
        <span className="tw:text-gray-500 tw:leading-none tw:select-none">
          &middot;
        </span>
        <Typography className="tw:text-gray-500" size="text-xs">
          {file.uploadedAt}
        </Typography>
      </div>
    </div>

    <div className="tw:flex tw:items-center tw:gap-2 tw:shrink-0">
      <ButtonUtility
        color="secondary"
        icon={
          <Download01 className="tw:text-gray-500" height={18} width={18} />
        }
        onClick={() => onDownload?.(file)}
      />
      <FileActions
        file={file}
        onDeleteFile={onDeleteFile}
        onDownload={onDownload}
        onMoveToFolder={onMoveToFolder}
        onShareFile={onShareFile}
      />
    </div>
  </div>
);

// ─── Folder tree item ─────────────────────────────────────────────────────────

interface FolderTreeItemProps {
  folder: DocFolder;
  isSelected: boolean;
  selectedFileId: string | null;
  onSelectFolder: (folderId: string) => void;
  onSelectFile: (file: DocFile) => void;
}

const FolderTreeItem: FC<FolderTreeItemProps> = ({
  folder,
  isSelected,
  onSelectFile,
  onSelectFolder,
  selectedFileId,
}) => {
  const [isOpen, setIsOpen] = useState(isSelected);

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
    onSelectFolder(folder.id);
  };

  return (
    <div>
      <button
        className="tw:w-full tw:flex tw:items-center tw:gap-2 tw:px-3 tw:py-2 tw:rounded-lg tw:border-0 tw:bg-transparent tw:cursor-pointer tw:text-left tw:text-[var(--color-text-secondary)] tw:hover:bg-[var(--color-bg-secondary)] tw:transition-colors tw:duration-100"
        type="button"
        onClick={toggleOpen}>
        {isOpen ? (
          <ChevronDown className="tw:w-4 tw:h-4 tw:shrink-0" strokeWidth={2} />
        ) : (
          <ChevronRight className="tw:w-4 tw:h-4 tw:shrink-0" strokeWidth={2} />
        )}
        <Folder
          className={
            isOpen
              ? 'tw:w-4 tw:h-4 tw:shrink-0 tw:text-[var(--color-text-brand)]'
              : 'tw:w-4 tw:h-4 tw:shrink-0 tw:text-[var(--color-text-tertiary)]'
          }
          strokeWidth={1.75}
        />
        <Typography
          className="tw:truncate tw:text-[var(--color-text-primary)]"
          size="text-sm"
          weight="medium">
          {folder.name}
        </Typography>
      </button>

      {isOpen && (
        <div className="tw:ml-6 tw:mt-0.5 tw:flex tw:flex-col tw:gap-0.5">
          {folder.files.map((file) => (
            <button
              className={[
                'tw:w-full tw:flex tw:items-center tw:gap-2 tw:px-3 tw:py-1.5 tw:rounded-md tw:border-0 tw:bg-transparent tw:cursor-pointer tw:text-left tw:transition-colors tw:duration-100',
                selectedFileId === file.id
                  ? 'tw:bg-[var(--color-bg-brand-secondary)] tw:text-[var(--color-text-brand)]'
                  : 'tw:text-[var(--color-text-secondary)] tw:hover:bg-[var(--color-bg-secondary)]',
              ].join(' ')}
              key={file.id}
              type="button"
              onClick={() => onSelectFile(file)}>
              <FileTypeBadge fileType={file.fileType} />
              <Typography
                className="tw:truncate"
                size="text-xs"
                weight="medium">
                {file.name}
              </Typography>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const DocumentsView: FC<DocumentsViewProps> = ({
  folders,
  onDeleteFile,
  onDownload,
  onMoveToFolder,
  onShareFile,
}) => {
  const { t } = useTranslation();
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    folders[0]?.id ?? ''
  );
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const visibleFiles: DocFile[] = selectedFolderId
    ? folders.find((f) => f.id === selectedFolderId)?.files ?? []
    : folders.flatMap((f) => f.files);

  return (
    <Card
      className="tw:flex tw:h-full tw:overflow-hidden"
      data-testid="documents-view">
      {/* Left: folder tree */}
      {/* <aside className="tw:w-72 tw:shrink-0 tw:border-r tw:border-[var(--color-border-primary)] tw:p-3 tw:flex tw:flex-col tw:gap-1 tw:overflow-y-auto">
        <div className="tw:flex tw:items-center tw:gap-2 tw:px-3 tw:py-2 tw:mb-1">
          <Folder
            className="tw:w-5 tw:h-5 tw:text-[var(--color-text-tertiary)]"
            strokeWidth={1.75}
          />
          <Typography
            className="tw:text-[var(--color-text-primary)]"
            size="text-sm"
            weight="semibold">
            {t('label.folder', { defaultValue: 'Folder' })}
          </Typography>
          <Typography
            className="tw:text-[var(--color-text-tertiary)] tw:ml-1"
            size="text-xs">
            {t('message.group-documents-by-folder', {
              defaultValue: 'Group documents by folder',
            })}
          </Typography>
        </div>

        {folders.map((folder) => (
          <FolderTreeItem
            folder={folder}
            isSelected={selectedFolderId === folder.id}
            key={folder.id}
            selectedFileId={selectedFileId}
            onSelectFile={(file) => setSelectedFileId(file.id)}
            onSelectFolder={setSelectedFolderId}
          />
        ))}
      </aside> */}

      {/* Right: file list */}
      <div className="tw:flex tw:flex-1 tw:flex-col tw:overflow-y-auto">
        {visibleFiles.length === 0 ? (
          <div className="tw:flex tw:flex-1 tw:items-center tw:justify-center tw:p-12">
            <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.NO_DATA} />
          </div>
        ) : (
          visibleFiles.map((file) => (
            <FileRow
              file={file}
              key={file.id}
              onDeleteFile={onDeleteFile}
              onDownload={onDownload}
              onMoveToFolder={onMoveToFolder}
              onShareFile={onShareFile}
            />
          ))
        )}
      </div>
    </Card>
  );
};

export default DocumentsView;
