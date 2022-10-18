/*
 *  Copyright 2021 Collate
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
import { Icons } from '../utils/SvgUtils';

export const INITIAL_SORT_FIELD = '_score';
export const INITIAL_SORT_ORDER = 'desc';

export const initialFilterQS = 'initialFilter';
export const searchFilterQS = 'searchFilter';
export const MAX_RESULT_HITS = 10000;

export const tableSortingFields: SortingField[] = [
  {
    name: 'Last Updated',
    value: 'updatedAt',
  },
  { name: 'Weekly Usage', value: 'usageSummary.weeklyStats.count' },
  { name: 'Relevance', value: '_score' },
];

export const entitySortingFields = [
  {
    name: 'Last Updated',
    value: 'updatedAt',
  },
  { name: 'Relevance', value: '_score' },
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
    label: 'Tables',
    sortingFields: tableSortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'tables',
    icon: Icons.TABLE_GREY,
    selectedIcon: Icons.TABLE,
  },
  [SearchIndex.TOPIC]: {
    label: 'Topics',
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'topics',
    icon: Icons.TOPIC_GREY,
    selectedIcon: Icons.TOPIC,
  },
  [SearchIndex.DASHBOARD]: {
    label: 'Dashboards',
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'dashboards',
    icon: Icons.DASHBOARD_GREY,
    selectedIcon: Icons.DASHBOARD,
  },
  [SearchIndex.PIPELINE]: {
    label: 'Pipelines',
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'pipelines',
    icon: Icons.PIPELINE_GREY,
    selectedIcon: Icons.PIPELINE,
  },
  [SearchIndex.MLMODEL]: {
    label: 'ML Models',
    sortingFields: entitySortingFields,
    sortField: INITIAL_SORT_FIELD,
    path: 'mlmodels',
  },
};
