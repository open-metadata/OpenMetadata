/*
 *  Copyright 2025 Collate.
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

import { EntityType } from '../../../enums/entity.enum';
import { TagLabel } from '../../../generated/type/tagLabel';

export interface GlossaryTermsProps {
  /** Glossary-source tags to display/edit. */
  terms?: TagLabel[];

  /** Display-only or editable. Default: 'display'. */
  mode?: 'display' | 'selector';

  /** Called with the updated glossary terms after the user saves. */
  onSelectionChange?: (terms: TagLabel[]) => Promise<void>;

  /** Max visible terms before "+ N more". Default: 3. */
  sizeCap?: number;

  showNoDataPlaceholder?: boolean;

  /** Whether the current user can edit. */
  permission?: boolean;

  /** Entity context (needed for multi-term rules). */
  entityType?: EntityType;

  className?: string;
}
