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

import type { ContextFile } from '../../../generated/entity/data/contextFile';
import { Folder } from '../../../generated/entity/data/folder';

export interface FolderOption {
  id: string;
  name: string;
}

export interface DocumentsViewProps {
  canDelete?: boolean;
  canEdit?: boolean;
  totalFileCount: number;
  data: ContextFile[];
  folders?: FolderOption[];
  isLoading: boolean;
  isLoadingMore?: boolean;
  previewFileId?: string;
  selectedIds?: Set<string>;
  onDownload?: (file: ContextFile) => void;
  onDeleteFile?: (file: ContextFile) => void;
  onFileMoved?: (file: ContextFile, targetFolderId: string | null) => void;
  onPreview?: (file: ContextFile | undefined) => void;
  onSelectFile?: (fileId: string) => void;
  onBulkDelete?: () => void;
  onBulkMove?: (folderId: string) => void;
  onBulkDownload?: () => void;
  onScrollEnd?: () => void;
}

export interface MetaRowProps {
  label: string;
  value: string;
}

export interface DocumentPreviewPanelProps {
  file: ContextFile;
  url: string;
  onClose: () => void;
}

export interface FolderPickerMenuProps {
  folders: FolderOption[];
  currentFolderId?: string;
  onPick: (folderId: string) => void;
}
export interface FileActionsProps {
  canDelete?: boolean;
  canEdit?: boolean;
  file: ContextFile;
  folders?: FolderOption[];
  onDeleteFile?: (file: ContextFile) => void;
  onFileMoved?: (file: ContextFile, targetFolderId: string | null) => void;
}
export interface ListHeaderProps {
  canDelete?: boolean;
  canEdit?: boolean;
  totalFileCount: number;
  folders?: FolderOption[];
  selectedCount: number;
  onClear?: () => void;
  onBulkDelete?: () => void;
  onBulkMove?: (folderId: string) => void;
  onBulkDownload?: () => void;
}

export interface FileRowProps {
  canDelete?: boolean;
  canEdit?: boolean;
  file: ContextFile;
  folders?: FolderOption[];
  isActive?: boolean;
  isSelected?: boolean;
  onDownload?: (file: ContextFile) => void;
  onDeleteFile?: (file: ContextFile) => void;
  onFileMoved?: (file: ContextFile, targetFolderId: string | null) => void;
  onPreview?: (file: ContextFile) => void;
  onSelectFile?: (fileId: string) => void;
}

export interface FolderFilesState {
  files: ContextFile[];
  after?: string;
  isExpanded: boolean;
  isLoadingMore: boolean;
}

export interface DocumentFolderViewProps {
  folders: Folder[];
  isLoading: boolean;
  totalFileCount?: number;
  selectedFolderId?: string;
  canCreate?: boolean;
  canDelete?: boolean;
  onSelectFolder: (folderId: string | undefined) => void;
  onFoldersChanged: () => void;
}

export interface DocumentFolderViewHandle {
  refetchFolderFiles: (folderIds: string[]) => Promise<void>;
}
