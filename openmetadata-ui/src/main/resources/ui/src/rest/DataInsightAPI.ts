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

import { PagingResponse } from 'Models';
import { DataInsightChart } from '../generated/dataInsight/dataInsightChart';
import { DataInsightChartResult } from '../generated/dataInsight/dataInsightChartResult';
import { ChartAggregateParam } from '../interface/data-insight.interface';
import APIClient from './index';

export const getAggregateChartData = async (params: ChartAggregateParam) => {
  const response = await APIClient.get<DataInsightChartResult>(
    '/analytics/dataInsights/charts/aggregate',
    {
      params,
    }
  );

  return response.data;
};

export const getListDataInsightCharts = async () => {
  const response = await APIClient.get<PagingResponse<DataInsightChart[]>>(
    '/analytics/dataInsights/charts'
  );

  return response.data;
};

export const getChartById = async (id: string) => {
  const response = await APIClient.get<DataInsightChart>(
    `/analytics/dataInsights/charts/${id}`
  );

  return response.data;
};
