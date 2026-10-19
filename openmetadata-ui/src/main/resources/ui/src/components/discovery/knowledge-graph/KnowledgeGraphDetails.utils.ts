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

import { uniqBy } from 'lodash';
import type { TagLabel } from '../../../generated/type/tagLabel';
import type { KnowledgeGraphChip } from './KnowledgeGraphChipList';

/**
 * One chip per distinct tag. Distinct by FQN, not display name: two glossaries
 * can each hold a "Customer" term, and both belong on the column.
 */
export const toChips = (
  tags: TagLabel[],
  kind: KnowledgeGraphChip['kind']
): KnowledgeGraphChip[] =>
  uniqBy(tags, 'tagFQN').map((tag) => ({
    id: tag.tagFQN,
    label: tag.displayName || tag.name || tag.tagFQN,
    kind,
  }));

export const chipText = (chips: KnowledgeGraphChip[]) =>
  chips.map((chip) => chip.label).join(', ');
