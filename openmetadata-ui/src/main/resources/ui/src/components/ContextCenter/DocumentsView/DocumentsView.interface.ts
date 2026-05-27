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

export interface DocFile {
  id: string;
  driveFileId?: string;
  name: string;
  fileExtension?: string;
  sizeLabel: string;
  updatedBy?: string;
  updatedAt?: number;
  folderId?: string;
  folderFqn?: string;
}

export interface DocFolder {
  id: string;
  name: string;
  files: DocFile[];
}

export interface FolderOption {
  id: string;
  name: string;
}

export interface DocumentsViewProps {
  canDelete?: boolean;
  data: DocFile[];
  folders?: FolderOption[];
  isLoading: boolean;
  onDownload?: (file: DocFile) => void;
  onShareFile?: (file: DocFile) => void;
  onDeleteFile?: (file: DocFile) => void;
  onFileMoved?: (file: DocFile, targetFolderId: string) => void;
}
