/*
 *  Copyright 2022 Collate.
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

import { findLast, isUndefined, sortBy } from 'lodash';
import { MetricChartType } from '../components/ProfilerDashboard/profilerDashboard.interface';
import { SystemProfile } from '../generated/api/data/createTableProfile';
import { Table, TableProfile } from '../generated/entity/data/table';
import { CustomMetric } from '../generated/tests/customMetric';
import { customFormatDateTime } from './date-time/DateTimeUtils';

export const calculateRowCountMetrics = (
  profiler: TableProfile[],
  currentMetrics: MetricChartType
): MetricChartType => {
  const updateProfilerData = sortBy(profiler, 'timestamp');
  const rowCountMetricData: MetricChartType['data'] = [];

  updateProfilerData.forEach((data) => {
    const timestamp = customFormatDateTime(data.timestamp, 'MMM dd, hh:mm');

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

export const calculateSystemMetrics = (
  profiler: SystemProfile[],
  currentMetrics: MetricChartType,
  stackId?: string
) => {
  const updateProfilerData = sortBy(profiler, 'timestamp');
  const operationMetrics: MetricChartType['data'] = [];
  const operationDateMetrics: MetricChartType['data'] = [];

  updateProfilerData.forEach((data) => {
    const timestamp = customFormatDateTime(data.timestamp, 'MMM dd, hh:mm');

    operationMetrics.push({
      name: timestamp,
      timestamp: Number(data.timestamp),
      [data.operation || 'value']: Number(data.rowsAffected),
    });
    operationDateMetrics.push({
      name: timestamp,
      timestamp: Number(data.timestamp),
      data: data.rowsAffected || 0,
      [data.operation || 'value']: 5,
    });
  });
  const operationMetricsInfo = currentMetrics.information.map((item) => {
    const operation = findLast(
      updateProfilerData,
      (value) => value.operation === item.dataKey
    );

    return {
      ...item,
      stackId: stackId,
      latestValue: operation?.rowsAffected ?? 0,
    };
  });
  const operationDateMetricsInfo = currentMetrics.information.map((item) => {
    const operation = findLast(
      updateProfilerData,
      (value) => value.operation === item.dataKey
    );

    return {
      ...item,
      stackId: stackId,
      latestValue: operation?.timestamp
        ? customFormatDateTime(operation?.timestamp, 'MMM dd, hh:mm')
        : '--',
    };
  });

  return {
    operationMetrics: {
      data: operationMetrics,
      information: operationMetricsInfo,
    },
    operationDateMetrics: {
      data: operationDateMetrics,
      information: operationDateMetricsInfo,
    },
  };
};

export const calculateCustomMetrics = (
  profiler: TableProfile[],
  customMetrics: CustomMetric[]
) => {
  const updateProfilerData = sortBy(profiler, 'timestamp');
  const customMetricsData: Record<string, MetricChartType['data']> =
    customMetrics.reduce((acc, metric) => {
      acc[metric.name] = [];

      return acc;
    }, {} as Record<string, MetricChartType['data']>);

  updateProfilerData.forEach((data) => {
    const timestamp = customFormatDateTime(data.timestamp, 'MMM dd, hh:mm');
    data?.customMetrics?.forEach((metric) => {
      if (!isUndefined(metric.name)) {
        const updatedMetric = {
          [metric.name]: metric.value,
          formattedTimestamp: timestamp,
          timestamp: data.timestamp,
        };
        if (isUndefined(customMetricsData?.[metric.name])) {
          customMetricsData[metric.name] = [updatedMetric];
        } else {
          customMetricsData[metric.name].push(updatedMetric);
        }
      }
    });
  });

  return customMetricsData;
};

export const getColumnCustomMetric = (table?: Table, columnFqn?: string) => {
  return table?.columns.find(
    (column) => column.fullyQualifiedName === columnFqn
  )?.customMetrics;
};
