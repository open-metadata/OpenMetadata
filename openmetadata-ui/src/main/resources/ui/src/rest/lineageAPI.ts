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

import { CSVExportResponse } from '../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { LineageConfig } from '../components/Entity/EntityLineage/EntityLineage.interface';
import {
  EdgeDetails,
  EntityLineageResponse,
  LineageData,
} from '../components/Lineage/Lineage.interface';
import {
  LineageNodeData,
  LineagePagingInfo,
} from '../components/LineageTable/LineageTable.interface';
import { EntityType } from '../enums/entity.enum';

import { AddLineage } from '../generated/api/lineage/addLineage';
import { LineageDirection } from '../generated/api/lineage/searchLineageRequest';
import APIClient from './index';

export const updateLineageEdge = async (edge: AddLineage) => {
  const response = await APIClient.put<AddLineage>(`/lineage`, edge);

  return response.data;
};

export const exportLineageAsync = async (
  fqn: string,
  entityType?: string,
  config?: LineageConfig,
  queryFilter?: string,
  columnFilter?: string
) => {
  const { upstreamDepth = 1, downstreamDepth = 1 } = config ?? {};
  const response = await APIClient.get<CSVExportResponse>(
    `/lineage/exportAsync`,
    {
      params: {
        fqn,
        type: entityType,
        upstreamDepth,
        downstreamDepth,
        query_filter: queryFilter,
        column_filter: columnFilter,
        includeDeleted: false,
      },
    }
  );

  return response.data;
};

export const getLineageDataByFQN = async ({
  fqn,
  entityType,
  config,
  queryFilter,
  columnFilter,
  from,
  direction,
}: {
  fqn: string;
  entityType: string;
  config?: LineageConfig;
  queryFilter?: string;
  columnFilter?: string;
  from?: number;
  direction?: LineageDirection;
}) => {
  const { upstreamDepth = 1, downstreamDepth = 1 } = config ?? {};
  const API_PATH = direction
    ? `lineage/getLineage/${direction}`
    : 'lineage/getLineage';
  const response = await APIClient.get<LineageData>(API_PATH, {
    params: {
      fqn,
      type: entityType,
      // upstreamDepth depth in BE is n+1 rather than exactly n, so we need to subtract 1 to get the correct depth
      // and we don't want to pass the negative value
      upstreamDepth: upstreamDepth === 0 ? 0 : upstreamDepth,
      downstreamDepth,
      query_filter: queryFilter,
      column_filter: columnFilter,
      includeDeleted: false,
      size: config?.nodesPerLayer,
      from,
    },
  });

  return response.data;
};

export const getPlatformLineage = async ({
  config,
  queryFilter,
  columnFilter,
  view,
}: {
  config?: LineageConfig;
  queryFilter?: string;
  columnFilter?: string;
  view: string;
}) => {
  const { upstreamDepth = 1, downstreamDepth = 1 } = config ?? {};
  const API_PATH = `lineage/getPlatformLineage`;

  const response = await APIClient.get<LineageData>(API_PATH, {
    params: {
      view,
      upstreamDepth,
      downstreamDepth,
      query_filter: queryFilter,
      column_filter: columnFilter,
      includeDeleted: false,
      size: config?.nodesPerLayer,
    },
  });

  return response.data;
};

export const getDataQualityLineage = async (
  fqn: string,
  config?: Partial<LineageConfig>,
  queryFilter?: string,
  columnFilter?: string
) => {
  const { upstreamDepth = 1 } = config ?? {};
  const response = await APIClient.get<EntityLineageResponse>(
    `lineage/getDataQualityLineage`,
    {
      params: {
        fqn,
        upstreamDepth,
        includeDeleted: false,
        query_filter: queryFilter,
        column_filter: columnFilter,
      },
    }
  );

  return response.data;
};

export const getLineageByEntityCount = async (params: {
  fqn: string;
  type: EntityType;
  direction: LineageDirection;
  nodeDepth: number;
  from: number;
  size: number;
  query_filter?: string;
  column_filter?: string;
}) => {
  const response = await APIClient.get<{
    nodes: Record<string, LineageNodeData>;
    upstreamEdges: Record<string, EdgeDetails>;
    downstreamEdges: Record<string, EdgeDetails>;
  }>(`lineage/getLineageByEntityCount`, {
    params,
  });

  return response.data;
};

export const exportLineageByEntityCountAsync = async (params: {
  fqn: string;
  type: EntityType;
  direction: LineageDirection;
  nodeDepth: number;
  from?: number;
  size?: number;
  query_filter?: string;
  column_filter?: string;
}) => {
  const response = await APIClient.get<CSVExportResponse>(
    `lineage/exportByEntityCountAsync`,
    {
      params,
    }
  );

  return response.data;
};

export const getLineagePagingData = async (params: {
  fqn: string;
  type?: EntityType;
  query_filter?: string;
  column_filter?: string;
}) => {
  const response = await APIClient.get<LineagePagingInfo>(
    `lineage/getPaginationInfo`,
    {
      params,
    }
  );

  return response.data;
};
