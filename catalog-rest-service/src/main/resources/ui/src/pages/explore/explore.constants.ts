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
) => {
  const aggregation = aggregations.find(
    (aggregation) => aggregation.title === 'Tier'
  );

  const allowedAgg = visibleAgg.map((item) => lowerCase(item));

  if (aggregation) {
    const index = aggregations.indexOf(aggregation);
    aggregations[index].buckets = getBucketList(aggregations[index].buckets);
  }

  return !allowedAgg.length
    ? aggregations
    : aggregations.filter((item) => allowedAgg.includes(lowerCase(item.title)));
};

export const tabsInfo = [
  {
    label: 'Tables',
    index: SearchIndex.TABLE,
    sortingFields: tableSortingFields,
    sortField: tableSortingFields[0].value,
    tab: 1,
  },
  {
    label: 'Topics',
    index: SearchIndex.TOPIC,
    sortingFields: topicSortingFields,
    sortField: topicSortingFields[0].value,
    tab: 2,
  },
  {
    label: 'Dashboards',
    index: SearchIndex.DASHBOARD,
    sortingFields: topicSortingFields,
    sortField: topicSortingFields[0].value,
    tab: 3,
  },
];
