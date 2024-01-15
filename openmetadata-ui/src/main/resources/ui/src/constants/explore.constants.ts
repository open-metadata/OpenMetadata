/*
 *  Copyright 2023 Collate.
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

import { SortingField } from '../components/Explore/SortingDropDown';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import i18n from '../utils/i18next/LocalUtil';

export const INITIAL_SORT_FIELD = 'updatedAt';
export const INITIAL_SORT_ORDER = 'desc';
export const TIER_FQN_KEY = 'tier.tagFQN';
export const TAG_FQN_KEY = 'tags.tagFQN';

export const initialFilterQS = 'initialFilter';
export const searchFilterQS = 'searchFilter';
export const MAX_RESULT_HITS = 10000;

// as it is used only in unit tests it's not needed for translation
export const tableSortingFields: SortingField[] = [
  {
    name: i18n.t('label.last-updated'),
    value: 'updatedAt',
  },
  {
    name: i18n.t('label.weekly-usage'),
    value: 'usageSummary.weeklyStats.count',
  },
  { name: i18n.t('label.relevance'), value: '_score' },
];

export const entitySortingFields = [
  {
    name: i18n.t('label.last-updated'),
    value: 'updatedAt',
  },
  { name: i18n.t('label.relevance'), value: '_score' },
];

export interface ExploreTabInfo {
  label: string;
  sortingFields: SortingField[];
  sortField: string;
  path: string;
  icon?: string;
  selectedIcon?: string;
}

export const COMMON_FILTERS_FOR_DIFFERENT_TABS = [
  'owner.displayName',
  'tags.tagFQN',
];

export const EntityTypeSearchIndexMapping: Record<string, SearchIndex> = {
  [EntityType.ALL]: SearchIndex.ALL,
  [EntityType.TABLE]: SearchIndex.TABLE,
  [EntityType.PIPELINE]: SearchIndex.PIPELINE,
  [EntityType.DASHBOARD]: SearchIndex.DASHBOARD,
  [EntityType.MLMODEL]: SearchIndex.MLMODEL,
  [EntityType.TOPIC]: SearchIndex.TOPIC,
  [EntityType.CONTAINER]: SearchIndex.CONTAINER,
  [EntityType.TAG]: SearchIndex.TAG,
  [EntityType.GLOSSARY_TERM]: SearchIndex.GLOSSARY,
  [EntityType.STORED_PROCEDURE]: SearchIndex.STORED_PROCEDURE,
  [EntityType.DASHBOARD_DATA_MODEL]: SearchIndex.DASHBOARD_DATA_MODEL,
  [EntityType.SEARCH_INDEX]: SearchIndex.SEARCH_INDEX,
  [EntityType.DATABASE_SERVICE]: SearchIndex.DATABASE_SERVICE,
  [EntityType.MESSAGING_SERVICE]: SearchIndex.MESSAGING_SERVICE,
  [EntityType.DASHBOARD_SERVICE]: SearchIndex.DASHBOARD_SERVICE,
  [EntityType.PIPELINE_SERVICE]: SearchIndex.PIPELINE_SERVICE,
  [EntityType.MLMODEL_SERVICE]: SearchIndex.ML_MODEL_SERVICE,
  [EntityType.STORAGE_SERVICE]: SearchIndex.STORAGE_SERVICE,
  [EntityType.SEARCH_SERVICE]: SearchIndex.SEARCH_SERVICE,
  [EntityType.DOMAIN]: SearchIndex.DOMAIN,
  [EntityType.DATA_PRODUCT]: SearchIndex.DATA_PRODUCT,
  [EntityType.DATABASE]: SearchIndex.DATABASE,
  [EntityType.DATABASE_SCHEMA]: SearchIndex.DATABASE_SCHEMA,
};
