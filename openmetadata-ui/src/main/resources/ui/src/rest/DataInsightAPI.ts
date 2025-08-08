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

import { SystemChartType } from '../enums/DataInsight.enum';
import { DataInsightChartResult } from '../generated/dataInsight/dataInsightChartResult';
import { ChartAggregateParam } from '../interface/data-insight.interface';
import {
  StartChartDataStreamConnectionResponse,
  StopChartDataStreamConnectionResponse,
} from './DataInsightAPI.interface';
import APIClient from './index';

export interface DataInsightCustomChartResult {
  results: Array<{
    count: number;
    day: number;
    group: string;
    term: string;
    metric?: string;
  }>;
}

export const getAggregateChartData = async (params: ChartAggregateParam) => {
  const response = await APIClient.get<DataInsightChartResult>(
    '/analytics/dataInsights/charts/aggregate',
    {
      params,
    }
  );

  return response.data;
};

export const getChartPreviewByName = async (
  name: SystemChartType,
  params: { start: number; end: number; filter?: string }
) => {
  const response = await APIClient.get<DataInsightCustomChartResult>(
    `/analytics/dataInsights/system/charts/name/${name}/data`,
    {
      params,
    }
  );

  return response.data;
};

export const getMultiChartsPreviewByName = async (
  chartNames: SystemChartType[],
  params: { start: number; end: number; filter?: string }
) => {
  const response = await APIClient.get<
    Record<SystemChartType, DataInsightCustomChartResult>
  >(`/analytics/dataInsights/system/charts/listChartData`, {
    params: {
      chartNames,
      ...params,
    },
  });

  return response.data;
};

export const setChartDataStreamConnection = async (params: {
  chartNames: SystemChartType[];
  serviceName: string;
  startTime: number;
  endTime: number;
  entityLink: string;
}) => {
  const response = await APIClient.post<StartChartDataStreamConnectionResponse>(
    `/analytics/dataInsights/system/charts/stream`,
    {},
    {
      params,
    }
  );

  return response.data;
};

export const stopChartDataStreamConnection = async (sessionId: string) => {
  const response =
    await APIClient.delete<StopChartDataStreamConnectionResponse>(
      `/analytics/dataInsights/system/charts/stream/${sessionId}`
    );

  return response.data;
};
