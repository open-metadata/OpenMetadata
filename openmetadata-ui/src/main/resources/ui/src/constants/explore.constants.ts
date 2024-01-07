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

import { ExploreSearchIndex } from '../components/Explore/ExplorePage.interface';
import { SortingField } from '../components/Explore/SortingDropDown';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import i18n from '../utils/i18next/LocalUtil';
import { Icons } from '../utils/SvgUtils';

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
  category?: string;
}

export const EXPLORE_TAB_ITEMS = [
  {
    label: i18n.t('label.database-plural'),
    key: EntityType.DATABASE,
    children: [
      {
        key: SearchIndex.DATABASE,
        label: i18n.t('label.database-plural'),
        sortingFields: tableSortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'databases',
        icon: Icons.TABLE_GREY,
        selectedIcon: Icons.TABLE,
        category: i18n.t('label.database'),
      },
      {
        key: SearchIndex.TABLE,
        label: i18n.t('label.table-plural'),
        sortingFields: tableSortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'tables',
        icon: Icons.TABLE_GREY,
        selectedIcon: Icons.TABLE,
        category: i18n.t('label.database'),
      },
      {
        key: SearchIndex.STORED_PROCEDURE,
        label: i18n.t('label.stored-procedure-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'storedProcedure',
        category: i18n.t('label.database'),
      },
    ],
  },
  {
    label: i18n.t('label.dashboard-plural'),
    key: EntityType.DASHBOARD,
    children: [
      {
        key: SearchIndex.DASHBOARD,
        label: i18n.t('label.dashboard-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'dashboards',
        icon: Icons.DASHBOARD_GREY,
        selectedIcon: Icons.DASHBOARD,
        category: i18n.t('label.dashboard-plural'),
      },
      {
        key: SearchIndex.DASHBOARD_DATA_MODEL,
        label: i18n.t('label.data-model-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'dashboardDataModel',
        category: i18n.t('label.dashboard-plural'),
      },
    ],
  },
  {
    label: i18n.t('label.pipeline-plural'),
    key: EntityType.PIPELINE,
    children: [
      {
        key: SearchIndex.PIPELINE,
        label: i18n.t('label.pipeline-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'pipelines',
        icon: Icons.PIPELINE_GREY,
        selectedIcon: Icons.PIPELINE,
      },
    ],
  },
  {
    label: i18n.t('label.topic-plural'),
    key: EntityType.TOPIC,
    children: [
      {
        key: SearchIndex.TOPIC,
        label: i18n.t('label.topic-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'topics',
        icon: Icons.TOPIC_GREY,
        selectedIcon: Icons.TOPIC,
      },
    ],
  },
  {
    label: i18n.t('label.ml-model-plural'),
    key: EntityType.MLMODEL,
    children: [
      {
        key: SearchIndex.MLMODEL,
        label: i18n.t('label.ml-model-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'mlmodels',
      },
    ],
  },
  {
    label: i18n.t('label.container-plural'),
    key: EntityType.CONTAINER,
    children: [
      {
        key: SearchIndex.CONTAINER,
        label: i18n.t('label.container-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'containers',
      },
    ],
  },
  {
    label: i18n.t('label.search-index-plural'),
    key: EntityType.SEARCH_INDEX,
    children: [
      {
        key: SearchIndex.SEARCH_INDEX,
        label: i18n.t('label.search-index-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'searchIndexes',
      },
    ],
  },
  {
    key: EntityType.GOVERN,
    label: i18n.t('label.governance'),
    children: [
      {
        key: SearchIndex.GLOSSARY,
        label: i18n.t('label.glossary-plural'),
        value: EntityType.GLOSSARY,
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'glossaries',
        category: i18n.t('label.governance'),
      },
      {
        key: SearchIndex.TAG,
        label: i18n.t('label.tag-plural'),
        value: EntityType.TAG,
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'tags',
        category: i18n.t('label.governance'),
      },
    ],
  },
  {
    key: EntityType.DOMAIN,
    label: i18n.t('label.domain-plural'),
    children: [
      {
        key: SearchIndex.DATA_PRODUCT,
        label: i18n.t('label.data-product-plural'),
        value: EntityType.DATA_PRODUCT,
      },
    ],
  },
];

export const tabsInfo: { [K in ExploreSearchIndex]: ExploreTabInfo } = {
  [SearchIndex.TABLE]: {
    label: i18n.t('label.table-plural'),
    sortingFields: tableSortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'tables',
    icon: Icons.TABLE_GREY,
    selectedIcon: Icons.TABLE,
    category: i18n.t('label.database'),
  },
  [SearchIndex.STORED_PROCEDURE]: {
    label: i18n.t('label.stored-procedure-plural'),
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'storedProcedure',
    category: i18n.t('label.database'),
  },
  [SearchIndex.DASHBOARD]: {
    label: i18n.t('label.dashboard-plural'),
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'dashboards',
    icon: Icons.DASHBOARD_GREY,
    selectedIcon: Icons.DASHBOARD,
    category: i18n.t('label.dashboard-plural'),
  },
  [SearchIndex.DASHBOARD_DATA_MODEL]: {
    label: i18n.t('label.dashboard-data-model-plural'),
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'dashboardDataModel',
    category: i18n.t('label.dashboard-plural'),
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
    category: i18n.t('label.governance'),
  },
  [SearchIndex.TAG]: {
    label: i18n.t('label.tag-plural'),
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'tags',
    category: i18n.t('label.governance'),
  },
  [SearchIndex.DATA_PRODUCT]: {
    label: i18n.t('label.data-product-plural'),
    sortingFields: tableSortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'dataProducts',
    category: i18n.t('label.domain'),
  },
};

export const COMMON_FILTERS_FOR_DIFFERENT_TABS = [
  'owner.displayName',
  'tags.tagFQN',
];

export const TABS_SEARCH_INDEXES: ExploreSearchIndex[] = Object.keys(
  tabsInfo
) as ExploreSearchIndex[];
