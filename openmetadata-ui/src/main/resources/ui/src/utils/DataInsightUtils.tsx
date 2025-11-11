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
import {
  first,
  get,
  isEmpty,
  isInteger,
  isString,
  isUndefined,
  last,
  meanBy,
  round,
  startCase,
  sumBy,
  toNumber,
  uniqBy,
} from 'lodash';
import { DateTime } from 'luxon';
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
import { RangePickerProps } from '../components/common/DatePicker/DatePicker';
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
  DataInsightChartTooltipProps,
  DataInsightTabs,
} from '../interface/data-insight.interface';
import { DataInsightCustomChartResult } from '../rest/DataInsightAPI';
import { entityChartColor } from '../utils/CommonUtils';
import { axisTickFormatter } from './ChartUtils';
import { pluralize } from './CommonUtils';
import { customFormatDateTime, formatDate } from './date-time/DateTimeUtils';
import { t } from './i18next/LocalUtil';

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
    cardStyles,
    customValueKey,
    dateTimeFormatter = formatDate,
    isPercentage,
    labelStyles,
    listContainerStyles,
    payload = [],
    timeStampKey = 'timestampValue',
    titleStyles,
    transformLabel = true,
    valueFormatter,
    valueStyles,
  } = props;

  if (active && payload && payload.length) {
    // we need to check if the xAxis is a date or not.
    const timestamp =
      timeStampKey === 'term'
        ? payload[0].payload[timeStampKey]
        : dateTimeFormatter(payload[0].payload[timeStampKey] || 0);
    const payloadValue = uniqBy(payload, 'dataKey');

    return (
      <Card
        className="custom-data-insight-tooltip"
        style={cardStyles}
        title={
          <Typography.Title level={5} style={titleStyles}>
            {timestamp}
          </Typography.Title>
        }>
        <ul
          className="custom-data-insight-tooltip-container"
          style={listContainerStyles}>
          {payloadValue.map((entry, index) => {
            const value = customValueKey
              ? entry.payload[customValueKey]
              : entry.value;

            return (
              <li
                className="d-flex items-center justify-between gap-6 p-b-xss text-sm"
                key={`item-${index}`}>
                <span className="flex items-center text-grey-muted">
                  <Surface
                    className="mr-2"
                    height={12}
                    version="1.1"
                    width={12}>
                    <rect fill={entry.color} height="14" rx="2" width="14" />
                  </Surface>
                  <span style={labelStyles}>
                    {transformLabel
                      ? startCase(entry.name ?? (entry.dataKey as string))
                      : entry.name ?? (entry.dataKey as string)}
                  </span>
                </span>
                <span className="font-medium" style={valueStyles}>
                  {valueFormatter
                    ? valueFormatter(value, entry.name ?? entry.dataKey)
                    : getEntryFormattedValue(value, isPercentage)}
                </span>
              </li>
            );
          })}
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

    let latest;
    if (chartType === DataInsightChartType.DailyActiveUsers) {
      latest = round(meanBy(data, 'activeUsers'));
    } else {
      latest = sumBy(data, 'pageViews');
    }

    updatedSummary.push({
      ...summary,
      latest: latest,
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

export const renderDataInsightLineChart = (
  graphData: Array<Record<string, number>>,
  labels: string[],
  activeKeys: string[],
  activeMouseHoverKey: string,
  isPercentage: boolean
) => {
  return (
    <LineChart data={graphData} margin={BAR_CHART_MARGIN}>
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
        tickFormatter={
          isPercentage
            ? (value: number) => axisTickFormatter(value, '%')
            : undefined
        }
      />

      {labels.map((s, i) => (
        <Line
          dataKey={s}
          hide={
            activeKeys.length && s !== activeMouseHoverKey
              ? !activeKeys.includes(s)
              : false
          }
          key={s}
          name={s}
          stroke={entityChartColor(i) ?? getRandomHexColor()}
          strokeOpacity={
            isEmpty(activeMouseHoverKey) || s === activeMouseHoverKey
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
                  bool: {
                    should: teamFilter.map((team) => ({
                      term: { 'owners.name.keyword': team },
                    })),
                  },
                },
              ]
            : []),
        ],
      },
    },
  });
};
