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

import { ProcessingStatus } from '../../../generated/entity/data/contextFile';

export type DocumentFileType = 'doc' | 'pdf' | 'xls' | 'image' | 'other';

export interface UploadedDocumentItem {
  id: string;
  driveFileId?: string;
  name: string;
  fileExtension: string;
  sizeLabel: string;
  status?: ProcessingStatus;
  updatedBy: string;
  updatedAt: number;
}

export interface UploadedDocumentCardProps {
  document: UploadedDocumentItem;
  onDownload?: (document: UploadedDocumentItem) => void;
  onClick?: (document: UploadedDocumentItem) => void;
}
