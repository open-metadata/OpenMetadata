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

import { ExploreSearchIndex } from '../components/Explore/explore.interface';
import { SortingField } from '../components/Explore/SortingDropDown';
import { SearchIndex } from '../enums/search.enum';
import i18n from '../utils/i18next/LocalUtil';
import { Icons } from '../utils/SvgUtils';

export const INITIAL_SORT_FIELD = 'updatedAt';
export const INITIAL_SORT_ORDER = 'desc';
export const TIER_FQN_KEY = 'tier.tagFQN';

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

export const tabsInfo: { [K in ExploreSearchIndex]: ExploreTabInfo } = {
  [SearchIndex.TABLE]: {
    label: i18n.t('label.table-plural'),
    sortingFields: tableSortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'tables',
    icon: Icons.TABLE_GREY,
    selectedIcon: Icons.TABLE,
  },
  [SearchIndex.STORED_PROCEDURE]: {
    label: i18n.t('label.stored-procedure-plural'),
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'storedProcedure',
  },
  [SearchIndex.DASHBOARD]: {
    label: i18n.t('label.dashboard-plural'),
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'dashboards',
    icon: Icons.DASHBOARD_GREY,
    selectedIcon: Icons.DASHBOARD,
  },
  [SearchIndex.DASHBOARD_DATA_MODEL]: {
    label: i18n.t('label.dashboard-data-model-plural'),
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'dashboardDataModel',
  },
  [SearchIndex.PIPELINE]: {
    label: i18n.t('label.pipeline-plural'),
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'pipelines',
    icon: Icons.PIPELINE_GREY,
    selectedIcon: Icons.PIPELINE,
  },
  [SearchIndex.TOPIC]: {
    label: i18n.t('label.topic-plural'),
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'topics',
    icon: Icons.TOPIC_GREY,
    selectedIcon: Icons.TOPIC,
  },
  [SearchIndex.MLMODEL]: {
    label: i18n.t('label.ml-model-plural'),
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'mlmodels',
  },
  [SearchIndex.CONTAINER]: {
    label: i18n.t('label.container-plural'),
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'containers',
  },
  [SearchIndex.SEARCH_INDEX]: {
    label: i18n.t('label.search-index-plural'),
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'searchIndexes',
  },
  [SearchIndex.GLOSSARY]: {
    label: i18n.t('label.glossary-plural'),
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'glossaries',
  },
  [SearchIndex.TAG]: {
    label: i18n.t('label.tag-plural'),
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'tags',
  },
  [SearchIndex.DATA_PRODUCT]: {
    label: i18n.t('label.data-product-plural'),
    sortingFields: tableSortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'dataProducts',
  },
};

export const COMMON_FILTERS_FOR_DIFFERENT_TABS = [
  'owner.displayName',
  'tags.tagFQN',
];

export const ALL_EXPLORE_SEARCH_INDEX =
  // eslint-disable-next-line max-len
  `${SearchIndex.TABLE},${SearchIndex.TOPIC},${SearchIndex.DASHBOARD},${SearchIndex.PIPELINE},${SearchIndex.MLMODEL},${SearchIndex.STORED_PROCEDURE},${SearchIndex.DASHBOARD_DATA_MODEL},${SearchIndex.CONTAINER},${SearchIndex.GLOSSARY},${SearchIndex.TAG},${SearchIndex.SEARCH_INDEX}` as SearchIndex;
