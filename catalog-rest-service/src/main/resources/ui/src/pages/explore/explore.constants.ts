/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { lowerCase } from 'lodash';
import { AggregationType, Bucket } from 'Models';
import {
  tableSortingFields,
  tiers,
  topicSortingFields,
} from '../../constants/constants';
import { SearchIndex } from '../../enums/search.enum';
import { Icons } from '../../utils/SvgUtils';

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

export const tabsInfo = [
  {
    label: 'Tables',
    index: SearchIndex.TABLE,
    sortingFields: tableSortingFields,
    sortField: tableSortingFields[0].value,
    tab: 1,
    path: 'tables',
    icon: Icons.TABLE_GREY,
  },
  {
    label: 'Topics',
    index: SearchIndex.TOPIC,
    sortingFields: topicSortingFields,
    sortField: topicSortingFields[0].value,
    tab: 2,
    path: 'topics',
    icon: Icons.TOPIC_GREY,
  },
  {
    label: 'Dashboards',
    index: SearchIndex.DASHBOARD,
    sortingFields: topicSortingFields,
    sortField: topicSortingFields[0].value,
    tab: 3,
    path: 'dashboards',
    icon: Icons.DASHBOARD_GREY,
  },
];
