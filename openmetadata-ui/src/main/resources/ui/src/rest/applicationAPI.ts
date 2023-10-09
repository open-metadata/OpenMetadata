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
import { PagingResponse } from 'Models';
import { AxiosResponse } from 'axios';
import { ListParams } from '../interface/API.interface';
import APIClient from './index';
import { getURLWithQueryFields } from '../utils/APIUtils';
import { App } from '../generated/entity/applications/app';
import { CreateAppRequest } from '../generated/entity/applications/createAppRequest';

const BASE_URL = '/apps';

export const getApplicationList = async (params?: ListParams) => {
  const response = await APIClient.get<PagingResponse<App[]>>(BASE_URL, {
    params,
  });

  return response.data;
};

export const installApplication = (
  appName: string,
  data: CreateAppRequest
): Promise<AxiosResponse> => {
  return APIClient.post(`${BASE_URL}/install/${appName}`, data);
};

export const getApplicationByName = async (
  appName: string,
  arrQueryFields: string | string[]
) => {
  const url = getURLWithQueryFields(
    `${BASE_URL}/name/${appName}`,
    arrQueryFields
  );

  const response = await APIClient.get<App>(url);

  return response.data;
};
