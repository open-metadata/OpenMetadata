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
import { CreateEventSubscription } from '../generated/events/api/createEventSubscription';
import {
  EventSubscription,
  Status,
  SubscriptionType,
} from '../generated/events/eventSubscription';
import { FilterResourceDescriptor } from '../generated/events/filterResourceDescriptor';
import { Function } from '../generated/type/function';
import { getEncodedFqn } from '../utils/StringsUtils';

const BASE_URL = '/events/subscriptions/observability';

interface ListAlertsRequestParams {
  status?: Status;
  alertType?: SubscriptionType;
  before?: string;
  after?: string;
  include?: string;
  limit?: number;
}

export const getAlertsFromId = async (
  id: string,
  params?: Pick<ListAlertsRequestParams, 'include'>
) => {
  const response = await axiosClient.get<EventSubscription>(
    `${BASE_URL}/${id}`,
    {
      params: {
        ...params,
        include: 'all',
      },
    }
  );

  return response.data;
};

export const getAlertsFromName = async (
  name: string,
  params?: Pick<ListAlertsRequestParams, 'include'>
) => {
  const response = await axiosClient.get<EventSubscription>(
    `${BASE_URL}/name/${getEncodedFqn(name)}`,
    {
      params: {
        ...params,
        include: 'all',
      },
    }
  );

  return response.data;
};

export const getAllAlerts = async (params: ListAlertsRequestParams) => {
  const response = await axiosClient.get<PagingResponse<EventSubscription[]>>(
    BASE_URL,
    {
      params: {
        ...params,
      },
    }
  );

  return response.data;
};

export const createObservabilityAlert = async (
  alert: CreateEventSubscription
) => {
  const response = await axiosClient.post<EventSubscription>(
    `/events/subscriptions`,
    alert
  );

  return response.data;
};

export const updateObservabilityAlert = async (alert: EventSubscription) => {
  const response = await axiosClient.put<EventSubscription>(BASE_URL, alert);

  return response.data;
};

export const deleteObservabilityAlert = async (id: string) => {
  const response = await axiosClient.delete(`${BASE_URL}/${id}`);

  return response.data;
};

export const getFilterFunctions = async () => {
  const response = await axiosClient.get<Function[]>(`${BASE_URL}/functions`);

  return response.data;
};

export const getResourceFunctions = async () => {
  const response = await axiosClient.get<
    PagingResponse<FilterResourceDescriptor[]>
  >(`${BASE_URL}/resources`);

  return response.data;
};

export const triggerEventById = async (id: string) => {
  const response = await axiosClient.put<EventSubscription>(
    `${BASE_URL}/trigger/${id}`
  );

  return response.data;
};
