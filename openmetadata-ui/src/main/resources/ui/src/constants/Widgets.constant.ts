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
import { ActivityFeedTabs } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CURATED_ASSETS_SORT_BY_KEYS } from '../components/MyData/Widgets/CuratedAssetsWidget/CuratedAssetsWidget.constants';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { FeedFilter, MyTaskFilter } from '../enums/mydata.enum';
import { getEntityName } from '../utils/EntityUtils';

export const TAB_SUPPORTED_FILTER = [
  ActivityFeedTabs.ALL,
  ActivityFeedTabs.TASKS,
];

export const TASK_FEED_FILTER_LIST = [
  {
    title: 'label.all',
    key: FeedFilter.OWNER,
    description: 'message.feed-filter-all',
  },
  {
    title: 'label.assigned',
    key: FeedFilter.ASSIGNED_TO,
    description: 'message.feed-filter-owner',
  },
  {
    title: 'label.created-by',
    key: FeedFilter.ASSIGNED_BY,
    description: 'message.feed-filter-following',
  },
];

export const ACTIVITY_FEED_FILTER_LIST = [
  {
    title: 'label.my-data',
    key: FeedFilter.OWNER,
    description: 'message.feed-filter-owner',
  },
  {
    title: 'label.following',
    key: FeedFilter.FOLLOWS,
    description: 'message.feed-filter-following',
  },
];

export const WIDGETS_MORE_MENU_KEYS = {
  HALF_SIZE: 'half-size',
  FULL_SIZE: 'full-size',
  REMOVE_WIDGET: 'remove-widget',
};

export const WIDGETS_MORE_MENU_OPTIONS = [
  {
    key: WIDGETS_MORE_MENU_KEYS.HALF_SIZE,
    label: 'label.half-size',
  },
  {
    key: WIDGETS_MORE_MENU_KEYS.FULL_SIZE,
    label: 'label.full-size',
  },
  {
    key: WIDGETS_MORE_MENU_KEYS.REMOVE_WIDGET,
    label: 'label.remove-entity',
    labelKeyOptions: {
      entity: 'label.widget',
    },
  },
];

export const FEED_WIDGET_FILTER_OPTIONS = [
  {
    label: 'label.all-activity',
    value: FeedFilter.ALL,
    key: FeedFilter.ALL,
  },
  {
    label: 'label.my-data',
    value: FeedFilter.OWNER,
    key: FeedFilter.OWNER,
  },
  {
    label: 'label.following',
    value: FeedFilter.FOLLOWS,
    key: FeedFilter.FOLLOWS,
  },
];

export const MY_TASK_WIDGET_FILTER_OPTIONS = [
  {
    label: 'label.all',
    value: MyTaskFilter.OWNER_OR_FOLLOWS,
    key: MyTaskFilter.OWNER_OR_FOLLOWS,
  },
  {
    label: 'label.assigned',
    value: MyTaskFilter.ASSIGNED_TO,
    key: MyTaskFilter.ASSIGNED_TO,
  },
  {
    label: 'label.mention-plural',
    value: MyTaskFilter.MENTIONS,
    key: MyTaskFilter.MENTIONS,
  },
];

// Filter options for entity types
export const FOLLOWING_WIDGET_FILTER_OPTIONS = [
  {
    label: 'label.latest',
    value: CURATED_ASSETS_SORT_BY_KEYS.LATEST,
    key: CURATED_ASSETS_SORT_BY_KEYS.LATEST,
  },
  {
    label: 'label.a-to-z',
    value: CURATED_ASSETS_SORT_BY_KEYS.A_TO_Z,
    key: CURATED_ASSETS_SORT_BY_KEYS.A_TO_Z,
  },
  {
    label: 'label.z-to-a',
    value: CURATED_ASSETS_SORT_BY_KEYS.Z_TO_A,
    key: CURATED_ASSETS_SORT_BY_KEYS.Z_TO_A,
  },
];

export const MY_DATA_WIDGET_FILTER_OPTIONS = [
  {
    label: 'label.latest',
    value: CURATED_ASSETS_SORT_BY_KEYS.LATEST,
    key: CURATED_ASSETS_SORT_BY_KEYS.LATEST,
  },
  {
    label: 'label.a-to-z',
    value: CURATED_ASSETS_SORT_BY_KEYS.A_TO_Z,
    key: CURATED_ASSETS_SORT_BY_KEYS.A_TO_Z,
  },
  {
    label: 'label.z-to-a',
    value: CURATED_ASSETS_SORT_BY_KEYS.Z_TO_A,
    key: CURATED_ASSETS_SORT_BY_KEYS.Z_TO_A,
  },
];
export const getSortField = (
  filterKey: string,
  filterValue?: string
): string => {
  switch (filterKey) {
    case CURATED_ASSETS_SORT_BY_KEYS.LATEST:
      return filterValue ?? 'updatedAt';
    case CURATED_ASSETS_SORT_BY_KEYS.A_TO_Z:
      return filterValue ?? 'name.keyword';
    case CURATED_ASSETS_SORT_BY_KEYS.Z_TO_A:
      return filterValue ?? 'name.keyword';
    default:
      return filterValue ?? 'updatedAt';
  }
};

export const getSortOrder = (filterKey: string): 'asc' | 'desc' => {
  switch (filterKey) {
    case CURATED_ASSETS_SORT_BY_KEYS.LATEST:
      return 'desc';
    case CURATED_ASSETS_SORT_BY_KEYS.A_TO_Z:
      return 'asc';
    case CURATED_ASSETS_SORT_BY_KEYS.Z_TO_A:
      return 'desc';
    default:
      return 'desc';
  }
};

// Client-side sorting as fallback
export const applySortToData = (
  data: SourceType[],
  filterKey: string
): SourceType[] => {
  const sortedData = [...data];

  switch (filterKey) {
    case CURATED_ASSETS_SORT_BY_KEYS.A_TO_Z:
      return sortedData.sort((a, b) => {
        const aName = getEntityName(a).toLowerCase();
        const bName = getEntityName(b).toLowerCase();

        return aName.localeCompare(bName);
      });
    case CURATED_ASSETS_SORT_BY_KEYS.Z_TO_A:
      return sortedData.sort((a, b) => {
        const aName = getEntityName(a).toLowerCase();
        const bName = getEntityName(b).toLowerCase();

        return bName.localeCompare(aName);
      });
    case CURATED_ASSETS_SORT_BY_KEYS.LATEST:
    default:
      // For Latest sorting, rely on API sorting since SourceType doesn't have timestamp fields
      return sortedData;
  }
};

export const KPI_WIDGET_GRAPH_COLORS = [
  '#7262F6',
  '#6AD2FF',
  '#2ED3B7',
  '#E478FA',
  //   TODO: Add more colors for more KPIs
  '#7262F6',
  '#6AD2FF',
  '#2ED3B7',
  '#E478FA',
  '#7262F6',
  '#6AD2FF',
  '#2ED3B7',
  '#E478FA',
];
