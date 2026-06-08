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
import {
  first,
  isInteger,
  isString,
  isUndefined,
  last,
  round,
  toNumber,
} from 'lodash';
import { DateTime } from 'luxon';
import type { RangePickerProps } from '../components/common/DatePicker/DatePicker';
import { PLACEHOLDER_ROUTE_TAB, ROUTES } from '../constants/constants';
import { SystemChartType } from '../enums/DataInsight.enum';
import {
  DataInsightChartType,
  type DataInsightChartResult,
} from '../generated/dataInsight/dataInsightChartResult';
import type { DailyActiveUsers } from '../generated/dataInsight/type/dailyActiveUsers';
import {
  DataInsightTabs,
  type ChartValue,
} from '../interface/data-insight.interface';
import { customFormatDateTime } from './date-time/DateTimeUtils';

export const getEntryFormattedValue = (
  value: number | string | undefined,
  isPercentage?: boolean
) => {
  let suffix = '';
  if (isPercentage) {
    suffix = '%';
  }

  if (!isUndefined(value)) {
    if (isString(value)) {
      return `${value}${suffix}`;
    } else if (isInteger(value)) {
      return `${value}${suffix}`;
    } else {
      return `${round(value, 2)}${suffix}`;
    }
  } else {
    return '';
  }
};

const prepareGraphData = (
  timestamps: string[],
  rawData: (
    | {
        [x: string]: ChartValue;
        timestamp: string;
      }
    | undefined
  )[]
) => {
  return (
    timestamps.map((timestamp) => {
      return rawData.reduce((previous, current) => {
        if (current?.timestamp === timestamp) {
          return { ...previous, ...current };
        }

        return previous;
      }, {});
    }) || []
  );
};

const getLatestCount = (latestData = {}) => {
  let total = 0;
  const latestEntries = Object.entries(latestData ?? {});

  for (const entry of latestEntries) {
    if (!['timestamp', 'timestampValue'].includes(entry[0])) {
      total += toNumber(entry[1]);
    }
  }

  return total;
};

const getGraphFilteredData = (
  rawData: DataInsightChartResult['data'] = [],
  dataInsightChartType: DataInsightChartType
) => {
  const entities: string[] = [];
  const timestamps: string[] = [];

  const filteredData = rawData
    .map((data) => {
      if (data.timestamp && data.entityType) {
        let value;
        const timestamp = customFormatDateTime(data.timestamp, 'MMM dd');
        if (!entities.includes(data.entityType ?? '')) {
          entities.push(data.entityType ?? '');
        }

        if (!timestamps.includes(timestamp)) {
          timestamps.push(timestamp);
        }

        switch (dataInsightChartType) {
          case DataInsightChartType.PageViewsByEntities:
            value = data.pageViews;

            break;

          default:
            break;
        }

        return {
          timestamp: timestamp,
          timestampValue: data.timestamp,
          [data.entityType ?? '']: value,
        };
      }

      return;
    })
    .filter(Boolean);

  return { filteredData, entities, timestamps };
};

export const getGraphDataByEntityType = (
  rawData: DataInsightChartResult['data'] = [],
  dataInsightChartType: DataInsightChartType
) => {
  const { filteredData, entities, timestamps } = getGraphFilteredData(
    rawData,
    dataInsightChartType
  );

  const graphData = prepareGraphData(timestamps, filteredData);
  const latestData = last(graphData) as Record<string, number>;
  const oldData = first(graphData);
  const latestPercentage = toNumber(getLatestCount(latestData));
  const oldestPercentage = toNumber(getLatestCount(oldData));

  const relativePercentage = latestPercentage - oldestPercentage;

  return {
    data: graphData,
    entities,
    total: getLatestCount(latestData),
    relativePercentage: (relativePercentage / oldestPercentage) * 100,
    latestData,
  };
};

export const getFormattedActiveUsersData = (
  activeUsers: DailyActiveUsers[]
) => {
  const formattedData = activeUsers.map((user) => ({
    ...user,
    timestampValue: user.timestamp,
    timestamp: customFormatDateTime(user.timestamp, 'MMM dd'),
  }));

  const latestCount = Number(last(formattedData)?.activeUsers);
  const oldestCount = Number(first(formattedData)?.activeUsers);

  const relativePercentage = ((latestCount - oldestCount) / oldestCount) * 100;

  return {
    data: formattedData,
    total: latestCount,
    relativePercentage,
  };
};

export const getDisabledDates: RangePickerProps['disabledDate'] = (current) => {
  const today = DateTime.now().startOf('day');

  return current ? current.startOf('day') < today : false;
};

export const getDataInsightPathWithFqn = (tab = DataInsightTabs.DATA_ASSETS) =>
  ROUTES.DATA_INSIGHT_WITH_TAB.replace(PLACEHOLDER_ROUTE_TAB, tab);

export const getOptionalDataInsightTabFlag = (tab: DataInsightTabs) => {
  return {
    showDataInsightSummary:
      tab === DataInsightTabs.APP_ANALYTICS ||
      tab === DataInsightTabs.DATA_ASSETS,
    showKpiChart:
      tab === DataInsightTabs.KPIS || tab === DataInsightTabs.DATA_ASSETS,
  };
};

export const sortEntityByValue = (
  entities: string[],
  latestData: Record<string, number>
) => {
  const entityValues = entities.map((entity) => ({
    entity,
    value: latestData[entity] ?? 0,
  }));

  entityValues.sort((a, b) => b.value - a.value);

  return entityValues.map((entity) => entity.entity);
};

export const getRandomHexColor = () => {
  const randomColor = Math.floor(Math.random() * 16777215).toString(16);

  return `#${randomColor}`;
};

export const isPercentageSystemGraph = (graph: SystemChartType) => {
  return [
    SystemChartType.PercentageOfDataAssetWithDescription,
    SystemChartType.PercentageOfDataAssetWithOwner,
    SystemChartType.PercentageOfServiceWithDescription,
    SystemChartType.PercentageOfServiceWithOwner,
  ].includes(graph);
};

export const getQueryFilterForDataInsightChart = (
  teamFilter?: string[],
  tierFilter?: string[]
) => {
  if (!tierFilter && !teamFilter) {
    return undefined;
  }

  return JSON.stringify({
    query: {
      bool: {
        must: [
          ...(tierFilter
            ? [
                {
                  bool: {
                    should: tierFilter.map((tier) => ({
                      term: { 'tier.keyword': tier },
                    })),
                  },
                },
              ]
            : []),
          ...(teamFilter
            ? [
                {
                  nested: {
                    path: 'owners',
                    query: {
                      bool: {
                        should: teamFilter.map((team) => ({
                          term: { 'owners.name.keyword': team },
                        })),
                      },
                    },
                  },
                },
              ]
            : []),
        ],
      },
    },
  });
};
