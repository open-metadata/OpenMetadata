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
import { isAppleDevice } from '@react-aria/utils';
import { EntityFields } from '../../../../enums/AdvancedSearch.enum';
import { TaskStatus, TaskType } from '../../../../generated/entity/tasks/task';

export const GLOBAL_SEARCH_DEBOUNCE_MS = 300;
export const MAX_VISIBLE_TABS = 5;
export const RECENTLY_VIEWED_LIMIT = 3;
export const RECENT_SOURCE_ROWS = 2;
export const ACTIVE_TAB_PAGE_SIZE = 25;
export const ALL_TAB_ASSET_ROWS = 3;
export const ALL_TAB_OTHER_ROWS = 2;

/** All data asset types roll up into this one category. */
export const ASSETS_CATEGORY = 'assets';
export const TASKS_CATEGORY = 'tasks';

export const ASSET_FACETS: { field: string; labelKey: string }[] = [
  {
    field: EntityFields.ENTITY_TYPE_KEYWORD,
    labelKey: 'label.data-asset-plural',
  },
  { field: EntityFields.DOMAINS, labelKey: 'label.domain-plural' },
  { field: EntityFields.DATA_PRODUCT, labelKey: 'label.data-product-plural' },
  { field: EntityFields.OWNERS, labelKey: 'label.owner-plural' },
  { field: EntityFields.TAG, labelKey: 'label.tag' },
  { field: EntityFields.TIER, labelKey: 'label.tier' },
  { field: EntityFields.CERTIFICATION, labelKey: 'label.certification' },
  { field: EntityFields.SERVICE, labelKey: 'label.service' },
  { field: EntityFields.SERVICE_TYPE, labelKey: 'label.service-type' },
  { field: EntityFields.ENTITY_STATUS, labelKey: 'label.status' },
];

export const DEFAULT_ASSET_SORT = '_score';

export const TASK_STATUS_OPTIONS = Object.values(TaskStatus);
export const TASK_TYPE_OPTIONS = Object.values(TaskType);

const IS_APPLE = isAppleDevice();

/** Key glyphs shown in shortcut hints; symbols, not translatable copy. */
export const KEY_HINT = {
  mod: IS_APPLE ? '⌘' : 'Ctrl',
  enter: '↵',
  tab: 'Tab',
  esc: 'esc',
} as const;

/** The handler accepts ⌘ or Ctrl; the label names the one this platform uses. */
export const OPEN_SEARCH_SHORTCUT = IS_APPLE ? '⌘K' : 'Ctrl+K';
export const OPEN_SCOPED_SEARCH_SHORTCUT = IS_APPLE ? '⌥⌘K' : 'Ctrl+Alt+K';

export const QUERY_ACTION_OPTION_ID = 'global-search-query-action';
export const RESULTS_LIST_ID = 'global-search-results';
export const QUERY_ACTION_LIST_ID = 'global-search-query-action-list';
export const BREADCRUMB_SEPARATOR = ' › ';
