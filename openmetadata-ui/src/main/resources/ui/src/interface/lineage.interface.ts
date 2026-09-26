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

// Shared by the lineage store and the lineage UI, so it sits below the
// component layer. EntityLineage.interface re-exports it.
import type { LineageNodeType } from '../components/Lineage/Lineage.interface';
import { EntityType } from '../enums/entity.enum';
import { LineageSettings } from '../generated/configuration/lineageSettings';
import { EntityReference } from '../generated/entity/type';
import {
  ColumnLineage,
  TempLineageTable,
} from '../generated/type/entityLineage';
import { SearchSourceAlias } from './search.interface';

export interface LineageConfig extends Omit<LineageSettings, 'lineageLayer'> {
  nodesPerLayer: number;
}

export interface EntityLineageResponse {
  entity: LineageNodeType;
  nodes?: LineageNodeType[];
  edges?: EdgeDetails[];
  downstreamEdges?: EdgeDetails[];
  upstreamEdges?: EdgeDetails[];
}

export interface EdgeFromToData {
  id: string;
  type: string;
  fullyQualifiedName?: string;
}

export interface EdgeDetails {
  fromEntity: EdgeFromToData;
  toEntity: EdgeFromToData;
  pipeline?: EntityReference;
  source?: string;
  sqlQuery?: string;
  columns?: ColumnLineage[];
  description?: string;
  pipelineEntityType?: EntityType.PIPELINE | EntityType.STORED_PROCEDURE;
  docId?: string;
  extraInfo?: EdgeDetails;
  tempLineageTables?: TempLineageTable[];
  createdAt?: number;
  createdBy?: string;
  updatedAt?: number;
  updatedBy?: string;
}

export type NodeData = {
  entity: EntityReference;
  paging: {
    entityDownstreamCount?: number;
    entityUpstreamCount?: number;
  };
  nodeDepth?: number;
};

export type LineageData = {
  nodes: Record<string, NodeData>;
  downstreamEdges: Record<string, EdgeDetails>;
  upstreamEdges: Record<string, EdgeDetails>;
};

export interface LineageNodeData {
  entity: SearchSourceAlias;
  nodeDepth?: number;
  paging?: {
    entityDownstreamCount?: number;
    entityUpstreamCount?: number;
  };
}

export interface LineagePagingInfo {
  downstreamDepthInfo: { depth: number; entityCount: number }[];
  upstreamDepthInfo: { depth: number; entityCount: number }[];
  maxDownstreamDepth: number;
  maxUpstreamDepth: number;
  totalDownstreamEntities: number;
  totalUpstreamEntities: number;
}

export type CSVExportResponse = {
  jobId: string;
  message: string;
};
