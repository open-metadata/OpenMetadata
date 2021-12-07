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

import { lowerCase } from 'lodash';
import { AggregationType, Bucket, FilterObject } from 'Models';
import { SearchIndex } from '../enums/search.enum';
import { Icons } from '../utils/SvgUtils';
import { tableSortingFields, tiers, topicSortingFields } from './constants';

export const INITIAL_SORT_FIELD = 'last_updated_timestamp';
export const INITIAL_SORT_ORDER = 'desc';
export const INITIAL_FROM = 1;
export const ZERO_SIZE = 0;
export const emptyValue = '';

export const getBucketList = (buckets: Array<Bucket>) => {
  let bucketList: Array<Bucket> = [...tiers];
  buckets.forEach((el) => {
    bucketList = bucketList.map((tier) => {
      if (tier.key === el.key) {
        return el;
      } else {
        return tier;
      }
    });
  });

  return bucketList ?? [];
};

export const getQueryParam = (urlSearchQuery = ''): FilterObject => {
  const arrSearchQuery = urlSearchQuery
    ? urlSearchQuery.startsWith('?')
      ? urlSearchQuery.substr(1).split('&')
      : urlSearchQuery.split('&')
    : [];

  return arrSearchQuery
    .map((filter) => {
      const arrFilter = filter.split('=');

      return { [arrFilter[0]]: [arrFilter[1]] };
    })
    .reduce((prev, curr) => {
      return Object.assign(prev, curr);
    }, {}) as FilterObject;
};

export const getAggrWithDefaultValue = (
  aggregations: Array<AggregationType>,
  visibleAgg: Array<string> = []
): Array<AggregationType> => {
  const aggregation = aggregations.find(
    (aggregation) => aggregation.title === 'Tier'
  );

  const allowedAgg = visibleAgg.map((item) => lowerCase(item));

  if (aggregation) {
    const index = aggregations.indexOf(aggregation);
    aggregations[index].buckets = getBucketList(aggregations[index].buckets);
  }

  const visibleAggregations = !allowedAgg.length
    ? aggregations
    : aggregations.filter((item) => allowedAgg.includes(lowerCase(item.title)));

  return allowedAgg
    .map((agg) => {
      const aggregation = visibleAggregations.find(
        (a) => lowerCase(a.title) === agg
      );

      return aggregation;
    })
    .filter(Boolean) as Array<AggregationType>;
};

export const getCurrentIndex = (tab: string) => {
  let currentIndex = SearchIndex.TABLE;
  switch (tab) {
    case 'topics':
      currentIndex = SearchIndex.TOPIC;

      break;
    case 'dashboards':
      currentIndex = SearchIndex.DASHBOARD;

      break;
    case 'pipelines':
      currentIndex = SearchIndex.PIPELINE;

      break;
    case 'dbt_model':
      currentIndex = SearchIndex.DBT_MODEL;

      break;

    case 'tables':
    default:
      currentIndex = SearchIndex.TABLE;

      break;
  }

  return currentIndex;
};

export const getCurrentTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'topics':
      currentTab = 2;

      break;
    case 'dashboards':
      currentTab = 3;

      break;
    case 'pipelines':
      currentTab = 4;

      break;

    case 'dbt_model':
      currentTab = 5;

      break;

    case 'tables':
    default:
      currentTab = 1;

      break;
  }

  return currentTab;
};

export const tabsInfo = [
  {
    label: 'Tables',
    index: SearchIndex.TABLE,
    sortingFields: tableSortingFields,
    sortField: '',
    tab: 1,
    path: 'tables',
    icon: Icons.TABLE_GREY,
  },
  {
    label: 'Topics',
    index: SearchIndex.TOPIC,
    sortingFields: topicSortingFields,
    sortField: '',
    tab: 2,
    path: 'topics',
    icon: Icons.TOPIC_GREY,
  },
  {
    label: 'Dashboards',
    index: SearchIndex.DASHBOARD,
    sortingFields: topicSortingFields,
    sortField: '',
    tab: 3,
    path: 'dashboards',
    icon: Icons.DASHBOARD_GREY,
  },
  {
    label: 'Pipelines',
    index: SearchIndex.PIPELINE,
    sortingFields: topicSortingFields,
    sortField: '',
    tab: 4,
    path: 'pipelines',
    icon: Icons.PIPELINE_GREY,
  },
  {
    label: 'DBT Model',
    index: SearchIndex.DBT_MODEL,
    sortingFields: topicSortingFields,
    sortField: '',
    tab: 5,
    path: 'dbt_model',
    icon: Icons.DBTMODEL_GREY,
  },
];
