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
import { ContextMemory } from '../../../generated/entity/context/contextMemory';
import { MemoryActionPermissions } from '../../../hooks/discovery/context-center/useMemoryActionPermissions';

export type MemoryFilterTab =
  | ''
  | 'all'
  | 'created-by-me'
  | 'pinned'
  | 'needs-review';

export type MemorySortBy = 'updated' | 'created' | 'usage' | 'updatedBy';

export interface MemoriesViewProps {
  data: ContextMemory[];
  isLoading: boolean;
  /** Edit and Delete a row offers; a row without them offers neither. */
  getMemoryActions?: (memory: ContextMemory) => MemoryActionPermissions;
  onDeleteMemory?: (memory: ContextMemory) => void;
  onEditMemory?: (memory: ContextMemory) => void;
  onTogglePin?: (memory: ContextMemory) => void;
  onViewMemory?: (memory: ContextMemory) => void;
  isPinningMemoryId?: string;
  isSearching?: boolean;
  isFiltered?: boolean;
  onClearFilters?: () => void;
}

export interface MemoryActionsProps {
  memory: ContextMemory;
  onDeleteMemory?: (memory: ContextMemory) => void;
}
