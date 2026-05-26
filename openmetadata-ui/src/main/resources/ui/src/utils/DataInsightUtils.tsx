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

import {
  first,
  get,
  isInteger,
  isString,
  isUndefined,
  last,
  meanBy,
  round,
  sumBy,
  toNumber,
} from 'lodash';
import { DateTime } from 'luxon';
import { RangePickerProps } from '../components/common/DatePicker/DatePicker';
import { PLACEHOLDER_ROUTE_TAB, ROUTES } from '../constants/constants';
import {
  ENTITIES_SUMMARY_LIST,
  WEB_SUMMARY_LIST,
} from '../constants/DataInsight.constants';
import { SystemChartType } from '../enums/DataInsight.enum';
import {
  DataInsightChartResult,
  DataInsightChartType,
} from '../generated/dataInsight/dataInsightChartResult';
import { DailyActiveUsers } from '../generated/dataInsight/type/dailyActiveUsers';
import {
  ChartValue,
  DataInsightTabs,
} from '../interface/data-insight.interface';
import { DataInsightCustomChartResult } from '../rest/DataInsightAPI';
import { pluralize } from './CommonUtils';
import { customFormatDateTime } from './date-time/DateTimeUtils';
import { t, translateWithNestedKeys } from './i18next/LocalUtil';

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

/**
 * takes timestamps and raw data as inputs and return the graph data by mapping timestamp
 * @param timestamps timestamps array
 * @param rawData graph rwa data
 * @returns graph data
 */
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

/**
 *
 * @param latestData latest chart data
 * @returns latest sum count for chart
 */
const getLatestCount = (latestData = {}) => {
  let total = 0;
  const latestEntries = Object.entries(latestData ?? {});

  for (const entry of latestEntries) {
    // if key is 'timestamp' or 'timestampValue' skipping its count for total
    if (!['timestamp', 'timestampValue'].includes(entry[0])) {
      total += toNumber(entry[1]);
    }
  }

  return total;
};

/**
 *
 * @param rawData raw chart data
 * @param dataInsightChartType chart type
 * @returns formatted chart for graph
 */
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

/**
 *
 * @param rawData raw chart data
 * @param dataInsightChartType chart type
 * @returns required graph data by entity type
 */
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

export const getEntitiesChartSummary = (
  chartResults?: Record<SystemChartType, DataInsightCustomChartResult>
) => {
  const updatedSummaryList = ENTITIES_SUMMARY_LIST.map((summary) => {
    const chartData = get(chartResults, summary.type) as
      | DataInsightCustomChartResult
      | undefined;

    const count = round(first(chartData?.results)?.count ?? 0, 2);
    const translatedLabel = translateWithNestedKeys(
      summary.label,
      summary.labelData
    );

    return chartData
      ? {
          ...summary,
          latest: count,
          label: translatedLabel,
        }
      : {
          ...summary,
          label: translatedLabel,
        };
  });

  return updatedSummaryList;
};

export const getWebChartSummary = (
  chartResults: (DataInsightChartResult | undefined)[]
) => {
  const updatedSummary = [];

  for (const summary of WEB_SUMMARY_LIST) {
    // grab the current chart type
    const chartData = chartResults.find(
      (chart) => chart?.chartType === summary.id
    );
    // return default summary if chart data is undefined else calculate the latest count for chartType
    if (isUndefined(chartData)) {
      updatedSummary.push(summary);

      continue;
    }

    const { chartType, data } = chartData;

    let latest;
    if (chartType === DataInsightChartType.DailyActiveUsers) {
      latest = round(meanBy(data, 'activeUsers'));
    } else {
      latest = sumBy(data, 'pageViews');
    }

    updatedSummary.push({
      ...summary,
      latest: latest,
      label: t(summary.label),
    });
  }

  return updatedSummary;
};

export const getDisabledDates: RangePickerProps['disabledDate'] = (current) => {
  // Can not select days before today
  const today = DateTime.now().startOf('day');

  return current ? current.startOf('day') < today : false;
};

export const getKpiResultFeedback = (day: number, isTargetMet: boolean) => {
  if (day > 0 && isTargetMet) {
    return t('message.kpi-target-achieved-before-time');
  } else if (day <= 0 && !isTargetMet) {
    return t('message.kpi-target-overdue', {
      count: day,
    });
  } else if (isTargetMet) {
    return t('message.kpi-target-achieved');
  } else {
    return t('label.day-left', { day: pluralize(day, 'day') });
  }
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

  // Sort the entities based on their values in descending order
  entityValues.sort((a, b) => b.value - a.value);

  // Extract the sorted entities without their values
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
