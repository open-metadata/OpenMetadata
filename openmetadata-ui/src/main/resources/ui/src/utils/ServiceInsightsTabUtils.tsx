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
import { isNil, isUndefined } from 'lodash';
import type { ServiceTypes } from 'Models';
import type { DataInsightCustomChartResult } from '../rest/DataInsightAPI';
import { getEntityNameLabel } from './EntityNameUtils';
import { getAssetsByServiceType } from './ServiceInsightsTabPureUtils';
import { getEntityIcon } from './TableUtils';

export const getFormattedTotalAssetsDataFromSocketData = (
  socketData: DataInsightCustomChartResult,
  serviceCategory: ServiceTypes
) => {
  if (isNil(socketData) || isNil(socketData.results)) {
    return [];
  }

  const assets = getAssetsByServiceType(serviceCategory);

  const buckets = assets.reduce((acc, curr) => {
    const bucket = socketData.results.find((bucket) => bucket.group === curr);

    if (!isUndefined(bucket)) {
      return [...acc, bucket];
    }

    return acc;
  }, [] as DataInsightCustomChartResult['results']);

  const entityCountsArray = buckets.map((result) => ({
    name: getEntityNameLabel(result.group),
    value: result.count ?? 0,
    icon: getEntityIcon(result.group, '', { height: 16, width: 16 }) ?? <></>,
  }));

  return entityCountsArray;
};
