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

// Shared by the lineage store, the lineage provider and the lineage UI, so it
// sits below the component layer. EntityLineage.interface re-exports it.
import { EntityType } from '../enums/entity.enum';
import { ContainerDataModel } from '../generated/api/data/createContainer';
import { EsLineageData } from '../generated/api/lineage/esLineageData';
import { LineageDirection } from '../generated/api/lineage/lineageDirection';
import { LineageSettings } from '../generated/configuration/lineageSettings';
import { Chart } from '../generated/entity/data/chart';
import { MlFeature } from '../generated/entity/data/mlmodel';
import { SearchIndexField } from '../generated/entity/data/searchIndex';
import { Column } from '../generated/entity/data/table';
import { Field, MessageSchemaObject } from '../generated/entity/data/topic';
import { EntityReference } from '../generated/entity/type';
import { APISchema } from '../generated/type/apiSchema';
import {
  ColumnLineage,
  TempLineageTable,
} from '../generated/type/entityLineage';
import { SearchSourceAlias, TableSearchSource } from './search.interface';

export interface LineageConfig extends Omit<LineageSettings, 'lineageLayer'> {
  nodesPerLayer: number;
}

export interface Edge {
  edge: {
    fromEntity: {
      id: string;
      type: string;
    };
    toEntity: {
      id: string;
      type: string;
    };
  };
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

export interface LineageNodeType
  extends Exclude<EntityReference, 'type'>,
    Pick<
      TableSearchSource,
      'entityType' | 'deleted' | 'serviceType' | 'testSuite' | 'columns'
    > {
  nodeDepth?: number;
  paging?: {
    entityDownstreamCount?: number;
    entityUpstreamCount?: number;
  };
  pagination_data?: {
    index: number;
    parentId: string;
    childrenLength: number;
  };
  direction?: LineageDirection;
  upstreamExpandPerformed?: boolean;
  downstreamExpandPerformed?: boolean;
  upstreamLineage?: EsLineageData[];
  flattenChildren?: EntityChildren;
  dataModel?: ContainerDataModel;
  mlFeatures?: MlFeature[];
  charts?: Chart[];
  messageSchema?: MessageSchemaObject;
  responseSchema?: APISchema;
  requestSchema?: APISchema;
  fields?: SearchIndexField[];
  isTempTable?: boolean;
  lineageMapSubtitle?: string;
}

export interface EntityLineageResponse {
  entity: LineageNodeType;
  nodes?: LineageNodeType[];
  edges?: EdgeDetails[];
  downstreamEdges?: EdgeDetails[];
  upstreamEdges?: EdgeDetails[];
}

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

export type Flatten<T> = T & {
  depth?: number;
};

export type EntityChildrenItem =
  | Flatten<Column>
  | Flatten<Field>
  | Flatten<EntityReference>
  | Flatten<MlFeature>
  | Flatten<Field>
  | Flatten<SearchIndexField>;

export type EntityChildren = EntityChildrenItem[];
