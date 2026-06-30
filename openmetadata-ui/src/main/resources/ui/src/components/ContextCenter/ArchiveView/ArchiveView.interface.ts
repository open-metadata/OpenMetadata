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

export type ArchiveItemType = 'article' | 'document';

export interface ArchiveItem {
  id: string;
  name: string;
  type: ArchiveItemType;
  updatedBy?: string;
  updatedAt?: number;
  fileExtension?: string
}

export interface ArchiveViewProps {
  data: ArchiveItem[];
  isLoading: boolean;
  canRestore?: boolean;
  canDelete?: boolean;
  onRestore: (item: ArchiveItem) => void;
  onDelete: (item: ArchiveItem) => void;
}
