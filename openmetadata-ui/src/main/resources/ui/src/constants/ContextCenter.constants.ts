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
// ─── File type badge ──────────────────────────────────────────────────────────

import {
  MemoryType,
  ShareVisibility,
} from '../generated/entity/context/contextMemory';

export const DOCUMENT_MAX_FILE_SIZE = 5 * 1024 * 1024;

export const MEMORY_TYPE_OPTIONS = [
  { id: MemoryType.FAQ, labelKey: 'label.faq' },
  { id: MemoryType.Note, labelKey: 'label.note' },
  { id: MemoryType.Preference, labelKey: 'label.preference' },
  { id: MemoryType.Runbook, labelKey: 'label.runbook' },
  { id: MemoryType.UseCase, labelKey: 'label.use-case' },
];

export const VISIBILITY_OPTIONS = [
  {
    id: ShareVisibility.Shared,
    labelKey: 'label.shared',
    descriptionKey: 'message.visible-to-everyone-in-workspace',
    badgeColor: 'brand' as const,
    iconName: 'Share07' as const,
  },
  {
    id: ShareVisibility.Entity,
    labelKey: 'label.entity',
    descriptionKey: 'message.visible-to-linked-entities',
    badgeColor: 'orange' as const,
    iconName: 'Database01' as const,
  },
  {
    id: ShareVisibility.Private,
    labelKey: 'label.private',
    descriptionKey: 'message.visible-only-to-you',
    badgeColor: 'gray' as const,
    iconName: 'FileLock02' as const,
  },
];
