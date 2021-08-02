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

import { AggregationType, Bucket } from 'Models';
import { tiers } from '../../constants/constants';

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
  aggregations: Array<AggregationType>
) => {
  const aggregation = aggregations.find(
    (aggregation) => aggregation.title === 'Tier'
  );

  if (aggregation) {
    const index = aggregations.indexOf(aggregation);
    aggregations[index].buckets = getBucketList(aggregations[index].buckets);

    return aggregations;
  } else {
    return aggregations;
  }
};
