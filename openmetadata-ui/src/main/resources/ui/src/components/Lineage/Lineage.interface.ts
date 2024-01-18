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
import { EntityReference } from '../../generated/entity/type';
import { ColumnLineage } from '../../generated/type/entityLineage';
import { SourceType } from '../SearchedData/SearchedData.interface';

export interface LineageProps {
  entityType: EntityType;
  deleted?: boolean;
  hasEditAccess: boolean;
  isFullScreen?: boolean;
  entity?: SourceType;
}

export interface EntityLineageReponse {
  entity: EntityReference;
  nodes?: EntityReference[];
  edges?: EdgeDetails[];
}

export type LineageRequest = {
  upstreamDepth?: number;
  downstreamDepth?: number;
  nodesPerLayer?: number;
};

export interface EdgeFromToData {
  fqn: string;
  id: string;
  type: string;
}

export interface EdgeDetails {
  fromEntity: EdgeFromToData;
  toEntity: EdgeFromToData;
  pipeline?: EntityReference;
  source?: string;
  sqlQuery?: string;
  columns?: ColumnLineage[];
}
