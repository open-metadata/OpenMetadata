/*
 *  Copyright 2023 Collate.
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
import { CustomMetric, Table } from '../generated/entity/data/table';
import APIClient from './index';

const BASE_URL = '/tables';

export const deleteCustomMetric = async ({
  tableId,
  columnName,
  customMetricName,
}: {
  tableId: string;
  columnName?: string;
  customMetricName: string;
}) => {
  const url = columnName
    ? `${columnName}/${customMetricName}`
    : customMetricName;

  return await APIClient.delete<Table>(
    `${BASE_URL}/${tableId}/customMetric/${url}`
  );
};

export const putCustomMetric = async (
  tableId: string,
  customMetric: CustomMetric
) => {
  return await APIClient.put<CustomMetric, AxiosResponse<Table>>(
    `${BASE_URL}/${tableId}/customMetric`,
    customMetric
  );
};
