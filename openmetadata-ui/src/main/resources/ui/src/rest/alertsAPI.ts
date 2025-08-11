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
import { Destination } from '../generated/events/api/testEventSubscriptionDestination';
import {
  Status as TypedEventStatus,
  TypedEvent,
} from '../generated/events/api/typedEvent';
import {
  AlertType,
  EventSubscription,
  Status,
} from '../generated/events/eventSubscription';
import { FilterResourceDescriptor } from '../generated/events/filterResourceDescriptor';
import { Function } from '../generated/type/function';
import { getEncodedFqn } from '../utils/StringsUtils';

const BASE_URL = '/events/subscriptions';

interface ListAlertsRequestParams {
  status?: Status;
  alertType?: AlertType;
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

export const createNotificationAlert = async (
  alert: CreateEventSubscription
) => {
  const response = await axiosClient.post<EventSubscription>(BASE_URL, alert);

  return response.data;
};

export const updateNotificationAlert = async (
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

export const deleteAlert = async (id: string) => {
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
  >(`${BASE_URL}/${AlertType.Notification}/resources`);

  return response.data;
};

export const getAlertEventsFromId = async ({
  id,
  params,
}: {
  id: string;
  params?: {
    status?: TypedEventStatus;
    limit?: number;
    paginationOffset?: number;
  };
}) => {
  const response = await axiosClient.get<PagingResponse<TypedEvent[]>>(
    `${BASE_URL}/id/${id}/listEvents`,
    {
      params,
    }
  );

  return response.data;
};

export const testAlertDestination = async ({
  destinations,
}: {
  destinations: Destination[];
}) => {
  const response = await axiosClient.post<Destination[]>(
    `${BASE_URL}/testDestination`,
    {
      destinations,
    }
  );

  return response.data;
};
