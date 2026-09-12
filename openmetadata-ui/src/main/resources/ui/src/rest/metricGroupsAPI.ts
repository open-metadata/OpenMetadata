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
import type { AxiosResponse } from 'axios';
import type { Operation } from 'fast-json-patch';
import type { PagingResponse } from 'Models';
import type { CreateMetricGroup } from '../generated/api/data/createMetricGroup';
import type { Metric } from '../generated/entity/data/metric';
import type { MetricGroup } from '../generated/entity/data/metricGroup';
import type { EntityReference } from '../generated/entity/type';
import type { BulkOperationResult } from '../generated/type/bulkOperationResult';
import type {
  ListParams,
  ListParamsWithOffset,
} from '../interface/API.interface';
import { getEncodedFqn } from '../utils/StringUtils';
import APIClient from './index';

export const getMetricGroups = async (params?: ListParams) => {
  const response = await APIClient.get<PagingResponse<MetricGroup[]>>(
    '/metricGroups',
    { params }
  );

  return response.data;
};

export const getMetricGroupByFqn = async (fqn: string, params?: ListParams) => {
  const response = await APIClient.get<MetricGroup>(
    `/metricGroups/name/${getEncodedFqn(fqn)}`,
    { params }
  );

  return response.data;
};

export type MetricGroupMetricsParams = Pick<
  ListParamsWithOffset,
  'limit' | 'offset'
> & {
  q?: string;
  rootOnly?: boolean;
};

export const getMetricGroupMetrics = async (
  id: string,
  params: MetricGroupMetricsParams
) => {
  const response = await APIClient.get<PagingResponse<Metric[]>>(
    `/metricGroups/${id}/metrics`,
    { params }
  );

  return response.data;
};

export const createMetricGroup = async (data: CreateMetricGroup) => {
  const response = await APIClient.post<
    CreateMetricGroup,
    AxiosResponse<MetricGroup>
  >('/metricGroups', data);

  return response.data;
};

export const patchMetricGroup = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<MetricGroup>
  >(`/metricGroups/${id}`, data);

  return response.data;
};

export const deleteMetricGroup = async (id: string, hardDelete = false) => {
  const response = await APIClient.delete(
    `/metricGroups/${id}?hardDelete=${hardDelete}`
  );

  return response.data;
};

export const addMetricsToGroup = async (
  groupName: string,
  metrics: EntityReference[]
) => {
  const response = await APIClient.put<
    { assets: EntityReference[] },
    AxiosResponse<BulkOperationResult>
  >(`/metricGroups/${getEncodedFqn(groupName)}/metrics/add`, {
    assets: metrics,
  });

  return response.data;
};

export const removeMetricsFromGroup = async (
  groupName: string,
  metrics: EntityReference[]
) => {
  const response = await APIClient.put<
    { assets: EntityReference[] },
    AxiosResponse<BulkOperationResult>
  >(`/metricGroups/${getEncodedFqn(groupName)}/metrics/remove`, {
    assets: metrics,
  });

  return response.data;
};
