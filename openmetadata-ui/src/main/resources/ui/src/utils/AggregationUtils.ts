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
import { AggregationType, Sterm } from 'Models';

export const getAggregationList = (
  aggregation: Record<string, Sterm>,
  aggregationType = ''
): Array<AggregationType> => {
  const aggrEntriesArr = Object.entries(aggregation);
  const aggregationList: Array<AggregationType> = [];
  aggrEntriesArr.forEach((aggr) => {
    const aggrTitle = aggr[0].substring(aggr[0].indexOf('#') + 1);
    if (
      !aggregationType ||
      lowerCase(aggrTitle) === lowerCase(aggregationType)
    ) {
      aggregationList.push({
        title: aggrTitle,
        buckets: aggr[1].buckets,
      });
    }
  });

  return aggregationList;
};
