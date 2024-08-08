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

import { Card, Typography } from 'antd';
import { RangePickerProps } from 'antd/lib/date-picker';
import { t } from 'i18next';
import {
  first,
  get,
  groupBy,
  isEmpty,
  isInteger,
  isString,
  isUndefined,
  last,
  round,
  sortBy,
  startCase,
  sumBy,
  toNumber,
} from 'lodash';
import moment from 'moment';
import React from 'react';
import {
  CartesianGrid,
  LegendProps,
  Line,
  LineChart,
  Surface,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DEFAULT_CHART_OPACITY,
  GRAPH_BACKGROUND_COLOR,
  GRAYED_OUT_COLOR,
  HOVER_CHART_OPACITY,
  PLACEHOLDER_ROUTE_TAB,
  ROUTES,
} from '../constants/constants';
import {
  BAR_CHART_MARGIN,
  ENTITIES_SUMMARY_LIST,
  TOTAL_ENTITY_CHART_COLOR,
  WEB_SUMMARY_LIST,
} from '../constants/DataInsight.constants';
import {
  DataInsightChartResult,
  DataInsightChartType,
} from '../generated/dataInsight/dataInsightChartResult';
import { DailyActiveUsers } from '../generated/dataInsight/type/dailyActiveUsers';
import {
  ChartValue,
  DataInsightChartTooltipProps,
  DataInsightTabs,
} from '../interface/data-insight.interface';
import {
  DataInsightCustomChartResult,
  SystemChartType,
} from '../rest/DataInsightAPI';
import { axisTickFormatter } from './ChartUtils';
import { pluralize } from './CommonUtils';
import { customFormatDateTime, formatDate } from './date-time/DateTimeUtils';

const checkIsPercentageGraph = (dataInsightChartType: DataInsightChartType) =>
  [
    DataInsightChartType.PercentageOfEntitiesWithDescriptionByType,
    DataInsightChartType.PercentageOfEntitiesWithOwnerByType,
    DataInsightChartType.PercentageOfServicesWithDescription,
    DataInsightChartType.PercentageOfServicesWithOwner,
  ].includes(dataInsightChartType);

export const renderLegend = (
  legendData: LegendProps,
  activeKeys = [] as string[],
  valueFormatter?: (value: string) => string
) => {
  const { payload = [] } = legendData;

  return (
    <ul className="custom-data-insight-legend">
      {payload.map((entry, index) => {
        const isActive =
          activeKeys.length === 0 || activeKeys.includes(entry.value);

        return (
          <li
            className="recharts-legend-item custom-data-insight-legend-item"
            key={`item-${index}`}
            onClick={(e) =>
              legendData.onClick && legendData.onClick(entry, index, e)
            }
            onMouseEnter={(e) =>
              legendData.onMouseEnter &&
              legendData.onMouseEnter(entry, index, e)
            }
            onMouseLeave={(e) =>
              legendData.onMouseLeave &&
              legendData.onMouseLeave(entry, index, e)
            }>
            <Surface className="m-r-xss" height={14} version="1.1" width={14}>
              <rect
                fill={isActive ? entry.color : GRAYED_OUT_COLOR}
                height="14"
                rx="2"
                width="14"
              />
            </Surface>
            <span style={{ color: isActive ? 'inherit' : GRAYED_OUT_COLOR }}>
              {valueFormatter ? valueFormatter(entry.value) : entry.value}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

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

export const CustomTooltip = (props: DataInsightChartTooltipProps) => {
  const {
    active,
    payload = [],
    valueFormatter,
    isPercentage,
    timeStampKey = 'timestampValue',
  } = props;

  if (active && payload && payload.length) {
    const timestamp = formatDate(payload[0].payload[timeStampKey] || 0);

    return (
      <Card
        className="custom-data-insight-tooltip"
        title={<Typography.Title level={5}>{timestamp}</Typography.Title>}>
        <ul className="custom-data-insight-tooltip-container">
          {payload.map((entry, index) => (
            <li
              className="d-flex items-center justify-between gap-6 p-b-xss text-sm"
              key={`item-${index}`}>
              <span className="flex items-center text-grey-muted">
                <Surface className="mr-2" height={12} version="1.1" width={12}>
                  <rect fill={entry.color} height="14" rx="2" width="14" />
                </Surface>
                {startCase(entry.name ?? (entry.dataKey as string))}
              </span>
              <span className="font-medium">
                {valueFormatter
                  ? valueFormatter(entry.value, entry.name ?? entry.dataKey)
                  : getEntryFormattedValue(entry.value, isPercentage)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  return null;
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
 * @returns latest percentage for the chart
 */
const getLatestPercentage = (
  rawData: DataInsightChartResult['data'] = [],
  dataInsightChartType: DataInsightChartType
) => {
  let totalEntityCount = 0;
  let totalEntityWithDescription = 0;
  let totalEntityWithOwner = 0;

  const modifiedData = rawData
    .map((raw) => {
      const timestamp = raw.timestamp;
      if (timestamp) {
        return {
          ...raw,
          timestamp,
        };
      }

      return;
    })
    .filter(Boolean);

  const sortedData = sortBy(modifiedData, 'timestamp');
  const groupDataByTimeStamp = groupBy(sortedData, 'timestamp');
  const latestData = last(sortedData);
  if (latestData) {
    const latestChartRecords = groupDataByTimeStamp[latestData.timestamp];

    latestChartRecords.forEach((record) => {
      totalEntityCount += record?.entityCount ?? 0;
      totalEntityWithDescription += record?.completedDescription ?? 0;
      totalEntityWithOwner += record?.hasOwner ?? 0;
    });
    switch (dataInsightChartType) {
      case DataInsightChartType.PercentageOfEntitiesWithDescriptionByType:
      case DataInsightChartType.PercentageOfServicesWithDescription:
        return ((totalEntityWithDescription / totalEntityCount) * 100).toFixed(
          2
        );

      case DataInsightChartType.PercentageOfEntitiesWithOwnerByType:
      case DataInsightChartType.PercentageOfServicesWithOwner:
        return ((totalEntityWithOwner / totalEntityCount) * 100).toFixed(2);

      default:
        return 0;
    }
  }

  return 0;
};

/**
 *
 * @param rawData raw chart data
 * @param dataInsightChartType chart type
 * @returns old percentage for the chart
 */
const getOldestPercentage = (
  rawData: DataInsightChartResult['data'] = [],
  dataInsightChartType: DataInsightChartType
) => {
  let totalEntityCount = 0;
  let totalEntityWithDescription = 0;
  let totalEntityWithOwner = 0;

  const modifiedData = rawData
    .map((raw) => {
      const timestamp = raw.timestamp;
      if (timestamp) {
        return {
          ...raw,
          timestamp,
        };
      }

      return;
    })
    .filter(Boolean);

  const sortedData = sortBy(modifiedData, 'timestamp');
  const groupDataByTimeStamp = groupBy(sortedData, 'timestamp');
  const oldestData = first(sortedData);
  if (oldestData) {
    const oldestChartRecords = groupDataByTimeStamp[oldestData.timestamp];

    oldestChartRecords.forEach((record) => {
      totalEntityCount += record?.entityCount ?? 0;
      totalEntityWithDescription += record?.completedDescription ?? 0;
      totalEntityWithOwner += record?.hasOwner ?? 0;
    });
    switch (dataInsightChartType) {
      case DataInsightChartType.PercentageOfEntitiesWithDescriptionByType:
      case DataInsightChartType.PercentageOfServicesWithDescription:
        return ((totalEntityWithDescription / totalEntityCount) * 100).toFixed(
          2
        );

      case DataInsightChartType.PercentageOfEntitiesWithOwnerByType:
      case DataInsightChartType.PercentageOfServicesWithOwner:
        return ((totalEntityWithOwner / totalEntityCount) * 100).toFixed(2);

      default:
        return 0;
    }
  }

  return 0;
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
      if (data.timestamp && (data.entityType || data.serviceName)) {
        let value;
        const timestamp = customFormatDateTime(data.timestamp, 'MMM dd');
        if (!entities.includes(data.entityType ?? data.serviceName ?? '')) {
          entities.push(data.entityType ?? data.serviceName ?? '');
        }

        if (!timestamps.includes(timestamp)) {
          timestamps.push(timestamp);
        }

        switch (dataInsightChartType) {
          case DataInsightChartType.TotalEntitiesByType:
            value = data.entityCount;

            break;
          case DataInsightChartType.PercentageOfEntitiesWithDescriptionByType:
          case DataInsightChartType.PercentageOfServicesWithDescription:
            value = (data.completedDescriptionFraction ?? 0) * 100;

            break;
          case DataInsightChartType.PercentageOfEntitiesWithOwnerByType:
          case DataInsightChartType.PercentageOfServicesWithOwner:
            value = (data.hasOwnerFraction ?? 0) * 100;

            break;

          case DataInsightChartType.PageViewsByEntities:
            value = data.pageViews;

            break;

          default:
            break;
        }

        return {
          timestamp: timestamp,
          timestampValue: data.timestamp,
          [data.entityType ?? data.serviceName ?? '']: value,
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
  const isPercentageGraph = checkIsPercentageGraph(dataInsightChartType);

  const { filteredData, entities, timestamps } = getGraphFilteredData(
    rawData,
    dataInsightChartType
  );

  const graphData = prepareGraphData(timestamps, filteredData);
  const latestData = last(graphData) as Record<string, number>;
  const oldData = first(graphData);
  const latestPercentage = toNumber(
    isPercentageGraph
      ? getLatestPercentage(rawData, dataInsightChartType)
      : getLatestCount(latestData)
  );
  const oldestPercentage = toNumber(
    isPercentageGraph
      ? getOldestPercentage(rawData, dataInsightChartType)
      : getLatestCount(oldData)
  );

  const relativePercentage = latestPercentage - oldestPercentage;

  return {
    data: graphData,
    entities,
    total: isPercentageGraph
      ? getLatestPercentage(rawData, dataInsightChartType)
      : getLatestCount(latestData),
    relativePercentage: isPercentageGraph
      ? relativePercentage
      : (relativePercentage / oldestPercentage) * 100,
    latestData,
    isPercentageGraph,
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
    const chartData = get(chartResults, summary.type);

    const count = round(first(chartData?.results)?.count ?? 0, 2);

    return chartData
      ? {
          ...summary,
          latest: count,
        }
      : summary;
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

    updatedSummary.push({
      ...summary,
      latest: sumBy(
        data,
        chartType === DataInsightChartType.DailyActiveUsers
          ? 'activeUsers'
          : 'pageViews'
      ),
    });
  }

  return updatedSummary;
};

export const getDisabledDates: RangePickerProps['disabledDate'] = (current) => {
  // Can not select days before today

  return current && current.isBefore(moment().subtract(1, 'day'));
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

export const renderDataInsightLineChart = (
  graphData: {
    name: string;
    data: { day: number; count: number }[];
  }[],
  activeKeys: string[],
  activeMouseHoverKey: string,
  isPercentage: boolean
) => {
  return (
    <LineChart margin={BAR_CHART_MARGIN}>
      <CartesianGrid stroke={GRAPH_BACKGROUND_COLOR} vertical={false} />
      <Tooltip
        content={
          <CustomTooltip isPercentage={isPercentage} timeStampKey="day" />
        }
        wrapperStyle={{ pointerEvents: 'auto' }}
      />
      <XAxis
        allowDuplicatedCategory={false}
        dataKey="day"
        tickFormatter={(value: number) => customFormatDateTime(value, 'MMM dd')}
        type="category"
      />
      <YAxis
        dataKey="count"
        tickFormatter={(value: number) => axisTickFormatter(value, '%')}
      />

      {graphData.map((s, i) => (
        <Line
          data={s.data}
          dataKey="count"
          hide={
            activeKeys.length && s.name !== activeMouseHoverKey
              ? !activeKeys.includes(s.name)
              : false
          }
          key={s.name}
          name={s.name}
          stroke={TOTAL_ENTITY_CHART_COLOR[i] ?? getRandomHexColor()}
          strokeOpacity={
            isEmpty(activeMouseHoverKey) || s.name === activeMouseHoverKey
              ? DEFAULT_CHART_OPACITY
              : HOVER_CHART_OPACITY
          }
          type="monotone"
        />
      ))}
    </LineChart>
  );
};

export const getQueryFilterForDataInsightChart = (
  teamFilter?: string,
  tierFilter?: string
) => {
  if (!tierFilter && !teamFilter) {
    return undefined;
  }

  return JSON.stringify({
    query: {
      bool: {
        must: [
          {
            bool: {
              must: [
                ...(tierFilter
                  ? [{ term: { 'tier.keyword': tierFilter } }]
                  : []),
                ...(teamFilter
                  ? [{ term: { 'owners.displayName.keyword': teamFilter } }]
                  : []),
              ],
            },
          },
        ],
      },
    },
  });
};
