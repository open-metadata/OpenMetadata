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

import { AxiosResponse } from 'axios';
import { Operation } from 'fast-json-patch';
import { ChartType } from 'pages/DashboardDetailsPage/DashboardDetailsPage.component';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getChartById = async (
  id: string,
  arrQueryFields: string | string[]
) => {
  const url = getURLWithQueryFields(`/charts/${id}`, arrQueryFields);

  const response = await APIClient.get<ChartType>(url);

  return response.data;
};

export const updateChart = async (id: string, data: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<Operation[], AxiosResponse<ChartType>>(
    `/charts/${id}`,
    data,
    configOptions
  );

  return response.data;
};
