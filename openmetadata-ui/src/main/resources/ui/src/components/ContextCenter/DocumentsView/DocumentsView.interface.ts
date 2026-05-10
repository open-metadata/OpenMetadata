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

export type DocFileType = 'pdf' | 'xlsx' | 'csv' | 'doc' | 'image' | 'other';

export interface DocFile {
  id: string;
  name: string;
  fileType: DocFileType;
  sizeLabel: string;
  uploadedBy: string;
  uploadedAt: string;
  folderId?: string;
}

export interface DocFolder {
  id: string;
  name: string;
  files: DocFile[];
}

export interface DocumentsViewProps {
  folders: DocFolder[];
  onDownload?: (file: DocFile) => void;
  onMoveToFolder?: (file: DocFile) => void;
  onShareFile?: (file: DocFile) => void;
  onDeleteFile?: (file: DocFile) => void;
}
