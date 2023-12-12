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

import { findLast, isUndefined, last, sortBy } from 'lodash';
import { MetricChartType } from '../components/ProfilerDashboard/profilerDashboard.interface';
import { SystemProfile } from '../generated/api/data/createTableProfile';
import { Table, TableProfile } from '../generated/entity/data/table';
import { CustomMetric } from '../generated/tests/customMetric';
import { customFormatDateTime } from './date-time/DateTimeUtils';
import { isHasKey } from './ObjectUtils';
import {
  CalculateColumnProfilerMetricsInterface,
  ColumnMetricsInterface,
} from './TableProfilerUtils.interface';

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
      rowCount: data.rowCount,
    });
  });
  const countMetricInfo = currentMetrics.information.map((item) => ({
    ...item,
    latestValue:
      rowCountMetricData[rowCountMetricData.length - 1]?.[item.dataKey],
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
      [data.operation ?? 'value']: data.rowsAffected,
    });
    operationDateMetrics.push({
      name: timestamp,
      timestamp: Number(data.timestamp),
      data: data.rowsAffected,
      [data.operation ?? 'value']: 5,
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
      latestValue: operation?.rowsAffected,
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

// organize custom metrics data based on timestamp
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

export const calculateColumnProfilerMetrics = ({
  columnProfilerData,
  countMetrics,
  proportionMetrics,
  mathMetrics,
  sumMetrics,
  quartileMetrics,
}: CalculateColumnProfilerMetricsInterface): ColumnMetricsInterface => {
  const updateProfilerData = sortBy(columnProfilerData, 'timestamp');
  const countMetricData: MetricChartType['data'] = [];
  const proportionMetricData: MetricChartType['data'] = [];
  const mathMetricData: MetricChartType['data'] = [];
  const sumMetricData: MetricChartType['data'] = [];
  const quartileMetricData: MetricChartType['data'] = [];
  updateProfilerData.forEach((col) => {
    const { timestamp, sum } = col;
    const name = customFormatDateTime(timestamp, 'MMM dd, hh:mm');
    const defaultData = { name, timestamp };

    if (
      isHasKey(col, [
        'distinctCount',
        'nullCount',
        'uniqueCount',
        'valuesCount',
      ])
    ) {
      const { distinctCount, nullCount, uniqueCount, valuesCount } = col;
      countMetricData.push({
        ...defaultData,
        distinctCount,
        nullCount,
        uniqueCount,
        valuesCount,
      });
    }

    if (isHasKey(col, ['sum'])) {
      sumMetricData.push({
        ...defaultData,
        sum,
      });
    }

    if (isHasKey(col, ['max', 'min', 'mean'])) {
      const { max, min, mean } = col;
      mathMetricData.push({
        ...defaultData,
        max,
        min,
        mean,
      });
    }

    if (
      isHasKey(col, [
        'distinctProportion',
        'nullProportion',
        'uniqueProportion',
      ])
    ) {
      const { distinctProportion, nullProportion, uniqueProportion } = col;
      proportionMetricData.push({
        ...defaultData,
        distinctProportion: isUndefined(distinctProportion)
          ? undefined
          : Math.round(distinctProportion * 100),
        nullProportion: isUndefined(nullProportion)
          ? undefined
          : Math.round(nullProportion * 100),
        uniqueProportion: isUndefined(uniqueProportion)
          ? undefined
          : Math.round(uniqueProportion * 100),
      });
    }

    if (
      isHasKey(col, [
        'firstQuartile',
        'thirdQuartile',
        'interQuartileRange',
        'median',
      ])
    ) {
      const { firstQuartile, thirdQuartile, interQuartileRange, median } = col;
      quartileMetricData.push({
        ...defaultData,
        firstQuartile,
        thirdQuartile,
        interQuartileRange,
        median,
      });
    }
  });

  const countMetricInfo = countMetrics.information.map((item) => ({
    ...item,
    latestValue: last(countMetricData)?.[item.dataKey],
  }));
  const proportionMetricInfo = proportionMetrics.information.map((item) => ({
    ...item,
    latestValue: isUndefined(last(proportionMetricData)?.[item.dataKey])
      ? undefined
      : parseFloat(`${last(proportionMetricData)?.[item.dataKey]}`).toFixed(2),
  }));
  const mathMetricInfo = mathMetrics.information.map((item) => ({
    ...item,
    latestValue: last(mathMetricData)?.[item.dataKey],
  }));
  const sumMetricInfo = sumMetrics.information.map((item) => ({
    ...item,
    latestValue: last(sumMetricData)?.[item.dataKey],
  }));
  const quartileMetricInfo = quartileMetrics.information.map((item) => ({
    ...item,
    latestValue: last(quartileMetricData)?.[item.dataKey],
  }));

  return {
    countMetrics: {
      information: countMetricInfo,
      data: countMetricData,
    },
    proportionMetrics: {
      information: proportionMetricInfo,
      data: proportionMetricData,
    },
    mathMetrics: {
      information: mathMetricInfo,
      data: mathMetricData,
    },
    sumMetrics: {
      information: sumMetricInfo,
      data: sumMetricData,
    },
    quartileMetrics: {
      information: quartileMetricInfo,
      data: quartileMetricData,
    },
  };
};
