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

import { Card, Typography } from 'antd';
import { isInteger, last, toNumber } from 'lodash';
import React from 'react';
import { ListItem, ListValues } from 'react-awesome-query-builder';
import { LegendProps, Surface, TooltipProps } from 'recharts';
import {
  DataInsightChartResult,
  DataInsightChartType,
} from '../generated/dataInsight/dataInsightChartResult';
import { TotalEntitiesByTier } from '../generated/dataInsight/type/totalEntitiesByTier';
import { getFormattedDateFromMilliSeconds } from './TimeUtils';

export const renderLegend = (legendData: LegendProps, latest: string) => {
  const { payload = [] } = legendData;

  return (
    <>
      <Typography.Text className="data-insight-label-text">
        Latest
      </Typography.Text>
      <Typography
        className="font-semibold text-2xl"
        style={{ margin: '5px 0px' }}>
        {latest}
      </Typography>
      <ul className="mr-2">
        {payload.map((entry, index) => (
          <li
            className="recharts-legend-item d-flex items-center"
            key={`item-${index}`}>
            <Surface className="mr-2" height={14} version="1.1" width={14}>
              <rect fill={entry.color} height="14" rx="2" width="14" />
            </Surface>
            <span>{entry.value}</span>
          </li>
        ))}
      </ul>
    </>
  );
};

/**
 * we don't have type for Tooltip value and Tooltip
 * that's why we have to use the type "any"
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CustomTooltip = (props: TooltipProps<any, any>) => {
  const { active, payload = [], label } = props;

  if (active && payload && payload.length) {
    return (
      <Card>
        {/* this is a graph tooltip so using the explicit title here */}
        <Typography.Title level={5}>{label}</Typography.Title>
        {payload.map((entry, index) => (
          <li className="d-flex items-center" key={`item-${index}`}>
            <Surface className="mr-2" height={14} version="1.1" width={14}>
              <rect fill={entry.color} height="14" rx="2" width="14" />
            </Surface>
            <span>
              {entry.dataKey} -{' '}
              {isInteger(entry.value) ? entry.value : entry.value?.toFixed(2)}
            </span>
          </li>
        ))}
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
        [x: string]: string | number | undefined;
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
    if (entry[0] !== 'timestamp') {
      total += toNumber(entry[1]);
    }
  }

  return isInteger(total) ? total : total.toFixed(2);
};

export const getGraphDataByEntityType = (
  rawData: DataInsightChartResult['data'] = [],
  dataInsightChartType: DataInsightChartType
) => {
  const entities: string[] = [];
  const timestamps: string[] = [];

  const filteredData = rawData.map((data) => {
    if (data.timestamp && data.entityType) {
      let value;
      const timestamp = getFormattedDateFromMilliSeconds(data.timestamp);
      if (!entities.includes(data.entityType ?? '')) {
        entities.push(data.entityType ?? '');
      }

      if (!timestamps.includes(timestamp)) {
        timestamps.push(timestamp);
      }

      switch (dataInsightChartType) {
        case DataInsightChartType.TotalEntitiesByType:
          value = data.entityCount;

          break;
        case DataInsightChartType.PercentageOfEntitiesWithDescriptionByType:
          value = data.completedDescriptionFraction;

          break;
        case DataInsightChartType.PercentageOfEntitiesWithOwnerByType:
          value = data.hasOwnerFraction;

          break;

        default:
          break;
      }

      return {
        timestamp: timestamp,
        [data.entityType]: value,
      };
    }

    return;
  });

  const graphData = prepareGraphData(timestamps, filteredData);
  const latestData = last(graphData);

  return {
    data: graphData,
    entities,
    total: getLatestCount(latestData),
  };
};

export const getGraphDataByTierType = (rawData: TotalEntitiesByTier[]) => {
  const tiers: string[] = [];
  const timestamps: string[] = [];

  const filteredData = rawData.map((data) => {
    if (data.timestamp && data.entityTier) {
      const tiering = data.entityTier;
      const timestamp = getFormattedDateFromMilliSeconds(data.timestamp);
      if (!tiers.includes(tiering)) {
        tiers.push(tiering);
      }

      if (!timestamps.includes(timestamp)) {
        timestamps.push(timestamp);
      }

      return {
        timestamp: timestamp,
        [tiering]: data.entityCount,
      };
    }

    return;
  });

  const graphData = prepareGraphData(timestamps, filteredData);
  const latestData = last(graphData);

  return {
    data: graphData,
    tiers,
    total: getLatestCount(latestData),
  };
};

export const getTeamFilter = (suggestionValues: ListValues = []) => {
  return (suggestionValues as ListItem[]).map((suggestion: ListItem) => ({
    label: suggestion.title,
    value: suggestion.value,
  }));
};
