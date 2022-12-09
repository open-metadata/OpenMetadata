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

import { sortBy } from 'lodash';
import { MetricChartType } from '../components/ProfilerDashboard/profilerDashboard.interface';
import { TableProfile } from '../generated/entity/data/table';
import { getFormattedDateFromSeconds } from './TimeUtils';

export const calculateRowCountMetrics = (
  profiler: TableProfile[],
  currentMetrics: MetricChartType
): MetricChartType => {
  const updateProfilerData = sortBy(profiler, 'timestamp');
  const rowCountMetricData: MetricChartType['data'] = [];

  updateProfilerData.forEach((data) => {
    const timestamp = getFormattedDateFromSeconds(data.timestamp);

    rowCountMetricData.push({
      name: timestamp,
      timestamp: data.timestamp,
      rowCount: Number(data.rowCount),
    });
  });
  const countMetricInfo = currentMetrics.information.map((item) => ({
    ...item,
    latestValue:
      rowCountMetricData[rowCountMetricData.length - 1]?.[item.dataKey] || 0,
  }));

  return { data: rowCountMetricData, information: countMetricInfo };
};
