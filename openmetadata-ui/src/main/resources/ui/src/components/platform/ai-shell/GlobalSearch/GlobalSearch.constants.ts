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
import { EntityFields } from '../../../../enums/AdvancedSearch.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { TaskStatus, TaskType } from '../../../../generated/entity/tasks/task';
import { GlobalSearchCategory } from './GlobalSearch.types';

export const GLOBAL_SEARCH_DEBOUNCE_MS = 300;
export const MAX_VISIBLE_TABS = 5;
export const RECENTLY_VIEWED_LIMIT = 3;
export const ACTIVE_TAB_PAGE_SIZE = 25;
export const ALL_TAB_ASSET_ROWS = 3;
export const ALL_TAB_OTHER_ROWS = 2;

/** Display order when counts tie, and the order of the "+N more" menu. */
export const CATEGORY_ORDER: GlobalSearchCategory[] = [
  'assets',
  'chats',
  'tasks',
  'glossary',
  'people',
  'domains',
  'products',
  'articles',
];

/** Labels for built-in types; contributed types bring their own `labelKey`. */
export const CATEGORY_LABEL_KEY: Partial<Record<GlobalSearchCategory, string>> =
  {
    assets: 'label.data-asset-plural',
    tasks: 'label.task-plural',
    glossary: 'label.glossary',
    people: 'label.people',
    domains: 'label.domain-plural',
    products: 'label.data-product-plural',
    articles: 'label.context-center',
  };

/** Search-index backed categories other than data assets. */
export const INDEX_CATEGORIES: Partial<
  Record<GlobalSearchCategory, SearchIndex[]>
> = {
  glossary: [SearchIndex.GLOSSARY_TERM],
  people: [SearchIndex.USER, SearchIndex.TEAM],
  domains: [SearchIndex.DOMAIN],
  products: [SearchIndex.DATA_PRODUCT],
  articles: [SearchIndex.KNOWLEDGE_PAGE_INDEX],
};

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

export const ASSET_SORT_OPTIONS = [
  { value: '_score', labelKey: 'label.relevance' },
  { value: 'totalVotes', labelKey: 'label.popularity' },
  { value: 'displayName.keyword', labelKey: 'label.name' },
  { value: 'updatedAt', labelKey: 'label.last-updated' },
];

export const TASK_STATUS_OPTIONS = Object.values(TaskStatus);
export const TASK_TYPE_OPTIONS = Object.values(TaskType);

/** Key glyphs shown in shortcut hints; symbols, not translatable copy. */
export const KEY_HINT = {
  mod: '⌘',
  enter: '↵',
  tab: 'Tab',
  esc: 'esc',
} as const;

export const ASK_AI_OPTION_ID = 'global-search-ask-ai';
export const RESULTS_LIST_ID = 'global-search-results';
