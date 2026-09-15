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
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { PagingResponse } from 'Models';
import { EntityType } from '../enums/entity.enum';
import {
  Direction,
  MetricAssetDirection,
  MetricObservability,
} from '../generated/api/data/metricObservability';
import { EntityReference } from '../generated/entity/type';
import { BulkOperationResult } from '../generated/type/bulkOperationResult';
import { EntityLineage } from '../generated/type/entityLineage';
import { getEncodedFqn } from '../utils/StringUtils';
import APIClient from './index';

const ASSET_COLLECTIONS: Partial<Record<EntityType, string>> = {
  [EntityType.API_COLLECTION]: 'apiCollections',
  [EntityType.API_ENDPOINT]: 'apiEndpoints',
  [EntityType.CONTAINER]: 'containers',
  [EntityType.DASHBOARD]: 'dashboards',
  [EntityType.MLMODEL]: 'mlmodels',
  [EntityType.PIPELINE]: 'pipelines',
  [EntityType.SEARCH_INDEX]: 'searchIndexes',
  [EntityType.STORED_PROCEDURE]: 'storedProcedures',
  [EntityType.TABLE]: 'tables',
  [EntityType.TOPIC]: 'topics',
};

const COMMON_ASSET_FIELDS = ['domains', 'owners', 'tags'];
const ASSET_DETAIL_FIELDS: Partial<Record<EntityType, string[]>> = {
  [EntityType.DASHBOARD]: ['usageSummary'],
  [EntityType.MLMODEL]: ['usageSummary'],
  [EntityType.PIPELINE]: ['usageSummary'],
  [EntityType.TABLE]: ['columns', 'usageSummary'],
};

export interface MetricAssetsParams {
  direction?: Direction;
  entityType?: string;
  limit?: number;
  offset?: number;
  q?: string;
}

export const getMetricTabAssetFields = (entityType: string): string =>
  [
    ...COMMON_ASSET_FIELDS,
    ...(ASSET_DETAIL_FIELDS[entityType as EntityType] ?? []),
  ].join(',');

export const getMetricTabAssets = async (
  id: string,
  params?: MetricAssetsParams,
  config?: Pick<AxiosRequestConfig, 'signal'>
) => {
  const response = await APIClient.get<PagingResponse<MetricAssetDirection[]>>(
    `/metrics/${id}/assets`,
    { params, signal: config?.signal }
  );

  return response.data;
};

export const getMetricTabObservability = async (id: string) => {
  const response = await APIClient.get<MetricObservability>(
    `/metrics/${id}/observability`
  );

  return response.data;
};

export const getMetricTabLineage = async (metricFqn: string) => {
  const response = await APIClient.get<EntityLineage>('/lineage/getLineage', {
    params: {
      downstreamDepth: 1,
      fqn: metricFqn,
      type: EntityType.METRIC,
      upstreamDepth: 1,
    },
  });

  return response.data;
};

export const addMetricTabAssets = async (
  metricFqn: string,
  assets: EntityReference[]
) => {
  const response = await APIClient.put<
    { assets: EntityReference[] },
    AxiosResponse<BulkOperationResult>
  >(`/metrics/${getEncodedFqn(metricFqn)}/assets/add`, { assets });

  return response.data;
};

export const removeMetricTabAssets = async (
  metricFqn: string,
  assets: EntityReference[]
) => {
  const response = await APIClient.put<
    { assets: EntityReference[] },
    AxiosResponse<BulkOperationResult>
  >(`/metrics/${getEncodedFqn(metricFqn)}/assets/remove`, { assets });

  return response.data;
};

export const getMetricTabAssetDetails = async (
  entityType: string,
  fqn: string,
  config?: Pick<AxiosRequestConfig, 'signal'>
): Promise<unknown> => {
  const collection = ASSET_COLLECTIONS[entityType as EntityType];
  if (!collection) {
    return;
  }
  const response = await APIClient.get<unknown>(
    `/${collection}/name/${getEncodedFqn(fqn)}`,
    {
      params: {
        fields: getMetricTabAssetFields(entityType),
        include: 'all',
      },
      ...(config?.signal ? { signal: config.signal } : {}),
    }
  );

  return response.data;
};
