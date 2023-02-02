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
import { PagingResponse } from 'Models';
import axiosClient from '.';
import { AlertAction } from '../generated/alerts/alertAction';
import { CreateAlertAction } from '../generated/alerts/api/createAlertAction';

const BASE_URL = '/alertAction';

export const getAllAlertActions = async () => {
  const response = await axiosClient.get<PagingResponse<AlertAction[]>>(
    BASE_URL
  );

  return response.data;
};

export const createAlertAction = async (alertAction: CreateAlertAction) => {
  const response = await axiosClient.post<
    CreateAlertAction,
    AxiosResponse<AlertAction>
  >(BASE_URL, alertAction);

  return response.data;
};

export const patchAlertAction = async (id: string, operation: Operation) => {
  const response = await axiosClient.patch<
    Operation,
    AxiosResponse<AlertAction>
  >(`${BASE_URL}/${id}`, operation);

  return response.data;
};

export const updateAlertAction = async (alertAction: AlertAction) => {
  const response = await axiosClient.put<AlertAction>(BASE_URL, alertAction);

  return response.data;
};

export const deleteAlertAction = async (id: string) => {
  const response = await axiosClient.delete(`${BASE_URL}/${id}`);

  return response.data;
};
