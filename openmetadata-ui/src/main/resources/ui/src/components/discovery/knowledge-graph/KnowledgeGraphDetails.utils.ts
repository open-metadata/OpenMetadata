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

/**
 * The searchable text of a tag cell: each distinct tag (by FQN, so two
 * glossaries' "Customer" terms both count) by its display name.
 */
export const getTagsText = (tags: TagLabel[]) =>
  uniqBy(tags, 'tagFQN')
    .map((tag) => tag.displayName || tag.name || tag.tagFQN)
    .join(', ');
