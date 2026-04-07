/*
 *  Copyright 2023 Collate.
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
import { EntityType } from '../../enums/entity.enum';
import { ContainerDataModel } from '../../generated/api/data/createContainer';
import { EsLineageData } from '../../generated/api/lineage/esLineageData';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import { Chart } from '../../generated/entity/data/chart';
import { MlFeature } from '../../generated/entity/data/mlmodel';
import { SearchIndexField } from '../../generated/entity/data/searchIndex';
import { MessageSchemaObject } from '../../generated/entity/data/topic';
import { EntityReference } from '../../generated/entity/type';
import { TagLabel } from '../../generated/tests/testCase';
import { APISchema } from '../../generated/type/apiSchema';
import { ColumnLineage } from '../../generated/type/entityLineage';
import {
  SearchSourceAlias,
  TableSearchSource,
} from '../../interface/search.interface';
import { FormattedDatabaseServiceType } from '../../utils/EntityUtils.interface';
import { EntityChildren } from '../Entity/EntityLineage/NodeChildren/NodeChildren.interface';
import { SourceType } from '../SearchedData/SearchedData.interface';

export interface LineageProps {
  entityType: EntityType;
  deleted?: boolean;
  hasEditAccess: boolean;
  isFullScreen?: boolean;
  entity?: SourceType;
  isPlatformLineage?: boolean;
  platformHeader?: React.ReactNode;
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
}

export interface ColumnLevelLineageNode
  extends Pick<
    TableSearchSource,
    'owners' | 'tags' | 'domains' | 'description' | 'id'
  > {
  fromEntity: EdgeFromToData;
  toEntity: EdgeFromToData;
  fromColumn?: string;
  toColumn?: string;
  pipeline?: EntityReference;
  source?: string;
  sqlQuery?: string;
  description?: string;
  pipelineEntityType?: EntityType.PIPELINE | EntityType.STORED_PROCEDURE;
  docId?: string;
  extraInfo?: EdgeDetails;
  nodeDepth?: number;
  tier?: TagLabel | string;
  name?: string;
  entityType?: EntityType;
}

export type LineageSourceType = Omit<SourceType, 'service'> & {
  direction: string;
  depth: number;
};

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

export interface LineageEntityReference extends EntityReference {
  paging?: {
    entityDownstreamCount?: number;
    entityUpstreamCount?: number;
  };
  pagination_data?: {
    index?: number;
    parentId?: string;
    childrenLength?: number;
  };
  nodeDepth?: number;
  upstreamExpandPerformed?: boolean;
  downstreamExpandPerformed?: boolean;
  direction?: LineageDirection;
  serviceType?: FormattedDatabaseServiceType;
}

export type LineageNode = SearchSourceAlias & {
  nodeDepth?: number;
  paging: {
    entityDownstreamCount?: number;
    entityUpstreamCount?: number;
  };
};

export interface DirectionalLineageResponse {
  nodes: Record<string, LineageNodeType>;
  upstreamEdges: Record<string, EdgeDetails>;
  downstreamEdges: Record<string, EdgeDetails>;
}

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
}
