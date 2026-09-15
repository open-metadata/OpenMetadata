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
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Operation } from 'fast-json-patch';
import { PagingResponse, RestoreRequestType } from 'Models';
import type { QueryVote as VoteType } from '../components/Database/TableQueries/TableQueries.interface';
import { APPLICATION_JSON_CONTENT_TYPE_HEADER } from '../constants/constants';
import { CreateMetric } from '../generated/api/data/createMetric';
import { MetricHierarchyContext } from '../generated/api/data/metricHierarchyContext';
import { MetricHierarchyItem } from '../generated/api/data/metricHierarchyItem';
import {
  Direction,
  MetricAssetDirection,
  MetricObservability,
} from '../generated/api/data/metricObservability';
import { Metric } from '../generated/entity/data/metric';
import { EntityReference } from '../generated/entity/type';
import { BulkOperationResult } from '../generated/type/bulkOperationResult';
import { EntityHistory } from '../generated/type/entityHistory';
import { Include } from '../generated/type/include';
import { ListParams, ListParamsWithOffset } from '../interface/API.interface';
import { getEncodedFqn } from '../utils/StringUtils';
import APIClient from './index';

/**
 * `parent` selects a slice of the hierarchy: omit it for every metric, pass the literal string
 * `'null'` for root metrics only, or pass a parent metric's fully qualified name for its immediate
 * children. Metric fully qualified names are flat, so the hierarchy cannot be inferred from the
 * name and has to be asked for explicitly.
 */
export type MetricListParams = ListParams & {
  parent?: string;
  entityStatus?: string;
};

export const ROOT_METRICS_PARENT = 'null';

export type MetricHierarchyListParams = Pick<
  ListParamsWithOffset,
  'limit' | 'offset'
> & {
  q?: string;
};

export type MetricHierarchyContextParams = {
  childLimit?: number;
  childOffset?: number;
  siblingLimit?: number;
  siblingOffset?: number;
};

export const getMetricHierarchy = async (params: MetricHierarchyListParams) => {
  const response = await APIClient.get<PagingResponse<MetricHierarchyItem[]>>(
    '/metrics/hierarchy',
    { params }
  );

  return response.data;
};

export const getMetricHierarchyContext = async (
  id: string,
  params?: MetricHierarchyContextParams
) => {
  const response = await APIClient.get<MetricHierarchyContext>(
    `/metrics/${id}/hierarchy`,
    { params }
  );

  return response.data;
};

export const getMetrics = async (
  params: MetricListParams,
  config?: Pick<AxiosRequestConfig, 'signal'>
) => {
  const response = await APIClient.get<PagingResponse<Metric[]>>(`/metrics`, {
    params: {
      ...params,
    },
    signal: config?.signal,
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
        includeRelations:
          params?.includeRelations ?? 'owners:non-deleted,experts:non-deleted',
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

export const exportMetricDetailsInCSV = async (fqn: string) => {
  const response = await APIClient.get(
    `/metrics/name/${getEncodedFqn(fqn)}/exportAsync`
  );

  return response.data;
};

// Synchronous export used only to LOAD rows into the Bulk Edit grid. Unlike the
// async export it does NOT create a background job (so it never appears in the
// Jobs tray) and returns the CSV string directly for the wizard to parse.
export const exportMetricDetailsInCSVSync = async (fqn: string) => {
  const response = await APIClient.get<string>(
    `/metrics/name/${getEncodedFqn(fqn)}/export`
  );

  return response.data;
};

export const deleteMetricAsync = async (id: string) => {
  const response = await APIClient.delete(`/metrics/async/${id}`);

  return response.data;
};

export const getCustomUnitsOfMeasurement = async () => {
  const response = await APIClient.get<string[]>('/metrics/customUnits');

  return response.data;
};

export const addAssetsToMetric = async (
  fqn: string,
  assets: EntityReference[]
) => {
  const response = await APIClient.put<
    { assets: EntityReference[] },
    AxiosResponse<BulkOperationResult>
  >(`/metrics/${getEncodedFqn(fqn)}/assets/add`, { assets });

  return response.data;
};

export const removeAssetsFromMetric = async (
  fqn: string,
  assets: EntityReference[]
) => {
  const response = await APIClient.put<
    { assets: EntityReference[] },
    AxiosResponse<BulkOperationResult>
  >(`/metrics/${getEncodedFqn(fqn)}/assets/remove`, { assets });

  return response.data;
};

export interface MetricAssetsParams {
  direction?: Direction;
  entityType?: string;
  limit?: number;
  offset?: number;
  q?: string;
}

export const getMetricAssets = async (
  id: string,
  params?: MetricAssetsParams,
  config?: Pick<AxiosRequestConfig, 'signal'>
) => {
  const response = await APIClient.get<PagingResponse<MetricAssetDirection[]>>(
    `/metrics/${id}/assets`,
    {
      params,
      signal: config?.signal,
    }
  );

  return response.data;
};

export const getMetricObservability = async (id: string) => {
  const response = await APIClient.get<MetricObservability>(
    `/metrics/${id}/observability`
  );

  return response.data;
};
