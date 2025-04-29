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

import { AxiosResponse } from 'axios';
import { Operation } from 'fast-json-patch';
import { PagingResponse } from 'Models';
import axiosClient from '.';
import { CreateEventSubscription } from '../generated/events/api/createEventSubscription';
import { EventsRecord } from '../generated/events/api/eventsRecord';
import { EventSubscription } from '../generated/events/eventSubscription';
import { FilterResourceDescriptor } from '../generated/events/filterResourceDescriptor';
import { Function } from '../generated/type/function';
import { ListParams } from '../interface/API.interface';
import { getEncodedFqn } from '../utils/StringsUtils';

const BASE_URL = '/events/subscriptions';

/**
 *
 * @param fqn -- Decoded FQN
 * @param params -- ListParams
 * @returns - EventSubscription
 */
export const getObservabilityAlertByFQN = async (
  fqn: string,
  params?: ListParams
) => {
  const response = await axiosClient.get<EventSubscription>(
    `${BASE_URL}/name/${getEncodedFqn(fqn)}`,
    {
      params: {
        ...params,
        include: 'all',
      },
    }
  );

  return response.data;
};
export const syncOffset = async (fqn: string) => {
  const response = await axiosClient.put(
    `${BASE_URL}/name/${getEncodedFqn(fqn)}/syncOffset`
  );

  return response.data;
};
export const getDiagnosticInfo = async (fqn: string) => {
  const response = await axiosClient.get(
    `${BASE_URL}/name/${getEncodedFqn(fqn)}/diagnosticInfo`
  );

  return response.data;
};

export const getAllAlerts = async (params: ListParams) => {
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
  const response = await axiosClient.post<EventSubscription>(BASE_URL, alert);

  return response.data;
};

export const updateObservabilityAlert = async (
  id: string,
  data: Operation[]
) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await axiosClient.patch<
    Operation[],
    AxiosResponse<EventSubscription>
  >(`${BASE_URL}/${id}`, data, configOptions);

  return response.data;
};

export const deleteObservabilityAlert = async (id: string) => {
  const response = await axiosClient.delete(`${BASE_URL}/${id}`);

  return response.data;
};

export const getFilterFunctions = async () => {
  const response = await axiosClient.get<Function[]>(
    `${BASE_URL}/observability/functions`
  );

  return response.data;
};

export const getResourceFunctions = async () => {
  const response = await axiosClient.get<
    PagingResponse<FilterResourceDescriptor[]>
  >(`${BASE_URL}/observability/resources`);

  return response.data;
};

export const getAlertEventsDiagnosticsInfo = async ({
  fqn,
  params,
  listCountOnly = false,
}: {
  fqn: string;
  params?: ListParams;
  listCountOnly?: boolean;
}) => {
  const response = await axiosClient.get<EventsRecord>(
    `${BASE_URL}/name/${fqn}/eventsRecord`,
    {
      params: {
        ...params,
        listCountOnly,
      },
    }
  );

  return response.data;
};
