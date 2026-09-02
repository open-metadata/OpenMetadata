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

import { EntityTags } from 'Models';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';

export enum DisplayType {
  READ_MORE = 'read-more',
  POPOVER = 'popover',
}

export interface TagsProps {
  /**
   * The full list of entity tags (may contain both Classification and Glossary
   * tags). The component filters by `tagType` when rendering.
   */
  tags: EntityTags[];

  /** Display-only or editable selector. Default: 'display'. */
  mode?: 'display' | 'selector';

  /**
   * Which source to show/edit. When omitted, shows all tags regardless of
   * source (display mode only).
   */
  tagType?: TagSource;

  /**
   * Called with the full updated tag list (all sources merged) after the user
   * saves a change. Required when mode='selector'.
   */
  onSelectionChange?: (tags: EntityTags[]) => Promise<void>;

  /** Max tags visible before overflow. -1 = unlimited. Default: 10. */
  sizeCap?: number;

  displayType?: DisplayType;

  showNoDataPlaceholder?: boolean;

  /** Whether the current user can edit tags. Controls edit UI visibility. */
  permission?: boolean;

  /** Show request/update-tag task navigation buttons. Default: true. */
  showTaskHandler?: boolean;

  entityType?: string;
  entityFqn?: string;

  /** For column-level tags in table schema view. */
  columnData?: { fqn: string; name?: string };

  /** Override for how tags are constructed when saving. */
  defaultLabelType?: LabelType;
  defaultState?: State;

  className?: string;
}
