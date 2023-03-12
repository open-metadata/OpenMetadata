/* eslint-disable @typescript-eslint/ban-types */
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
import axiosClient from '.';
import {
  AlertAction,
  AlertActionType,
  Status,
} from '../generated/alerts/alertAction';
import { Alerts, TriggerConfig } from '../generated/alerts/alerts';
import { EntitySpelFilters } from '../generated/alerts/entitySpelFilters';
import { Function } from '../generated/type/function';

const BASE_URL = '/alerts';

interface ListAlertsRequestParams {
  status?: Status;
  alertType?: AlertActionType;
  before?: string;
  after?: string;
  include?: string;
}

export const getAlertsFromId = async (
  id: string,
  params?: Pick<ListAlertsRequestParams, 'include'>
) => {
  const response = await axiosClient.get<Alerts>(`${BASE_URL}/${id}`, {
    params: {
      ...params,
      include: 'all',
    },
  });

  return response.data;
};

export const getAlertsFromName = async (
  name: string,
  params?: Pick<ListAlertsRequestParams, 'include'>
) => {
  const response = await axiosClient.get<Alerts>(`${BASE_URL}/name/${name}`, {
    params: {
      ...params,
      include: 'all',
    },
  });

  return response.data;
};

export const getAllAlerts = async (params: ListAlertsRequestParams) => {
  const response = await axiosClient.get<PagingResponse<Alerts[]>>(BASE_URL, {
    params: {
      ...params,
    },
  });

  return response.data;
};

export const createAlert = async (alert: Alerts) => {
  const response = await axiosClient.post<Alerts>(BASE_URL, alert);

  return response.data;
};

export const updateAlert = async (alert: Alerts) => {
  const response = await axiosClient.put<Alerts>(BASE_URL, alert);

  return response.data;
};

export const deleteAlert = async (id: string) => {
  const response = await axiosClient.delete(`${BASE_URL}/${id}`);

  return response.data;
};

export const getFilterFunctions = async () => {
  const response = await axiosClient.get<Function[]>(`${BASE_URL}/functions`);

  return response.data;
};

export const getEntityFilterFunctions = async () => {
  const response = await axiosClient.get<Record<string, EntitySpelFilters>>(
    `${BASE_URL}/entityFunctions`
  );

  return response.data;
};

export const getDefaultTriggerConfigs = async (after?: string) => {
  const response = await axiosClient.get<TriggerConfig[]>(
    `${BASE_URL}/defaultTriggers`,
    {
      params: {
        after,
      },
    }
  );

  return response.data;
};

export const getAlertActionForAlerts = async (id: string) => {
  const response = await axiosClient.get<AlertAction[]>(
    `${BASE_URL}/allAlertAction/${id}`
  );

  return response.data;
};
