/*
 *  Copyright 2026 Collate.
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

import { Operation } from 'fast-json-patch';
import { CreateDataQualityDimension } from '../generated/api/tests/createDataQualityDimension';
import { DataQualityDimension } from '../generated/tests/dataQualityDimension';
import { Paging } from '../generated/type/paging';
import { ListParams } from '../interface/API.interface';
import APIClient from './index';

const dimensionUrl = '/dataQuality/dimensions';

export const getDataQualityDimensions = async (params?: ListParams) => {
  const response = await APIClient.get<{
    data: DataQualityDimension[];
    paging: Paging;
  }>(dimensionUrl, { params });

  return response.data;
};

/**
 * How many test cases reference each dimension, keyed by dimension id. Shown next to every
 * dimension in the settings list and in the delete confirmation, which tells the user how many
 * test cases will fall back to the dimension of their test definition.
 */
export const getDataQualityDimensionTestCaseCounts = async () => {
  const response = await APIClient.get<Record<string, number>>(
    `${dimensionUrl}/testCaseCounts`
  );

  return response.data;
};

export const createDataQualityDimension = async (
  data: CreateDataQualityDimension
) => {
  const response = await APIClient.post<DataQualityDimension>(
    dimensionUrl,
    data
  );

  return response.data;
};

export const patchDataQualityDimension = async (
  id: string,
  patch: Operation[]
) => {
  const response = await APIClient.patch<DataQualityDimension>(
    `${dimensionUrl}/${id}`,
    patch
  );

  return response.data;
};

export const deleteDataQualityDimension = async (id: string) => {
  const response = await APIClient.delete<DataQualityDimension>(
    `${dimensionUrl}/${id}`,
    { params: { hardDelete: true } }
  );

  return response.data;
};
