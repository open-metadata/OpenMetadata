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
  MemoryStatus,
  MemoryType,
  ShareVisibility,
  TagLabel,
} from '../../../generated/entity/context/contextMemory';
import { EntityReference } from '../../../generated/type/entityReference';

export interface MemoryItem {
  id: string;
  name: string;
  title?: string;
  summary?: string;
  question: string;
  answer: string;
  memoryType?: MemoryType;
  status?: MemoryStatus;
  updatedBy?: string;
  updatedAt?: number;
  tags?: TagLabel[];
  usageCount?: number;
  lastUsedAt?: number;
  relatedEntities?: EntityReference[];
  visibility?: ShareVisibility;
  owners?: EntityReference[];
}

export type MemoryFilterTab =
  | ''
  | 'all'
  | 'created-by-me'
  | 'pinned'
  | 'needs-review';

export type MemorySortBy = 'updated' | 'created' | 'usage' | 'author';

export interface MemoriesViewProps {
  data: MemoryItem[];
  isLoading: boolean;
  canDelete?: boolean;
  currentUserName?: string;
  isAdminUser?: boolean;
  onDeleteMemory?: (memory: MemoryItem) => void;
  onEditMemory?: (memory: MemoryItem) => void;
  onViewMemory?: (memory: MemoryItem) => void;
}

export interface MemoryActionsProps {
  canDelete?: boolean;
  memory: MemoryItem;
  onDeleteMemory?: (memory: MemoryItem) => void;
}

export interface MemoryActionsWithOpenProps extends MemoryActionsProps {
  onOpenChange: (isOpen: boolean) => void;
}
