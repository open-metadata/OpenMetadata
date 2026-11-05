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
import { SourceType } from '../../../../generated/entity/context/contextMemory';
import { DiffChange, UnavailableMemory } from './MemoryConflictCompare.types';

export const SEGMENT_CLASS: Record<DiffChange, string> = {
  removed:
    'tw:rounded-xs tw:bg-utility-error-100 tw:text-utility-error-700 tw:line-through',
  added:
    'tw:rounded-xs tw:bg-utility-success-100 tw:text-utility-success-700 tw:underline',
};

export const CHANGED_CELL_CLASS = {
  current: 'tw:bg-utility-error-50',
  proposed: 'tw:bg-utility-success-50',
};

export const MEMORY_SOURCE_LABEL_KEYS: Record<SourceType, string> = {
  [SourceType.ChatPromotion]: 'label.conversation',
  [SourceType.ConversationExtraction]: 'label.conversation',
  [SourceType.FileExtraction]: 'label.file',
  [SourceType.Manual]: 'label.manual',
  [SourceType.PageExtraction]: 'label.page',
  [SourceType.RememberRequest]: 'label.conversation',
};

export const UNAVAILABLE_BY_STATUS: Record<number, UnavailableMemory> = {
  403: 'hidden',
  404: 'gone',
};

export const UNAVAILABLE_MEMORY_LABEL_KEYS: Record<UnavailableMemory, string> =
  {
    gone: 'message.memory-no-longer-exists',
    hidden: 'message.no-permission-to-view',
    failed: 'server.entity-fetch-error',
  };

export const SEGMENT_TAG: Record<DiffChange, 'ins' | 'del'> = {
  added: 'ins',
  removed: 'del',
};

export const DIFF_SKELETON_ROW_KEYS = ['title', 'memory', 'question', 'type'];
