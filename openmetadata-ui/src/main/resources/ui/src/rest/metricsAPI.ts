/*
 *  Copyright 2024 Collate.
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
import { PagingResponse, RestoreRequestType } from 'Models';
import { QueryVote as VoteType } from '../components/Database/TableQueries/TableQueries.interface';
import { APPLICATION_JSON_CONTENT_TYPE_HEADER } from '../constants/constants';
import { CreateMetric } from '../generated/api/data/createMetric';
import { Metric } from '../generated/entity/data/metric';
import { EntityReference } from '../generated/entity/type';
import { EntityHistory } from '../generated/type/entityHistory';
import { Include } from '../generated/type/include';
import { ListParams } from '../interface/API.interface';
import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';

export const getMetrics = async (params: ListParams) => {
  const response = await APIClient.get<PagingResponse<Metric[]>>(`/metrics`, {
    params: {
      ...params,
    },
  });

  return response.data;
};

export const getMetricByFqn = async (fqn: string, params?: ListParams) => {
  const response = await APIClient.get<Metric>(
    `/metrics/name/${getEncodedFqn(fqn)}`,
    {
      params: {
        ...params,
        include: params?.include ?? Include.All,
      },
    }
  );

  return response.data;
};

export const patchMetric = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<Operation[], AxiosResponse<Metric>>(
    `/metrics/${id}`,
    data
  );

  return response.data;
};

export const restoreMetric = async (id: string) => {
  const response = await APIClient.put<
    RestoreRequestType,
    AxiosResponse<Metric>
  >(`/metrics/restore`, { id });

  return response.data;
};

export const getMetricVersions = async (id: string) => {
  const response = await APIClient.get<EntityHistory>(
    `/metrics/${id}/versions`
  );

  return response.data;
};

export const getMetricVersion = async (id: string, versionId?: string) => {
  const response = await APIClient.get<Metric>(
    `/metrics/${id}/versions/${versionId}`
  );

  return response.data;
};

export const updateMetricVote = async (id: string, data: VoteType) => {
  const response = await APIClient.put<VoteType, AxiosResponse<Metric>>(
    `/metrics/${id}/vote`,
    data
  );

  return response.data;
};

export const addMetricFollower = async (id: string, userId: string) => {
  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(`/metrics/${id}/followers`, userId, APPLICATION_JSON_CONTENT_TYPE_HEADER);

  return response.data;
};

export const removeMetricFollower = async (id: string, userId: string) => {
  const response = await APIClient.delete<
    string,
    AxiosResponse<{
      changeDescription: { fieldsDeleted: { oldValue: EntityReference[] }[] };
    }>
  >(`/metrics/${id}/followers/${userId}`, APPLICATION_JSON_CONTENT_TYPE_HEADER);

  return response.data;
};

export const createMetric = async (data: CreateMetric) => {
  const response = await APIClient.post<CreateMetric, AxiosResponse<Metric>>(
    '/metrics',
    data
  );

  return response.data;
};
