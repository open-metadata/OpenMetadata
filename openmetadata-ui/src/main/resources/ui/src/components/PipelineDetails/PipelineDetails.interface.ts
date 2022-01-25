/*
 *  Copyright 2021 Collate
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

import { Operation } from 'fast-json-patch';
import {
  EntityTags,
  LeafNodes,
  LineagePos,
  LoadingNodeState,
  TableDetail,
} from 'Models';
import { Pipeline, Task } from '../../generated/entity/data/pipeline';
import { User } from '../../generated/entity/teams/user';
import {
  EntityLineage,
  EntityReference,
} from '../../generated/type/entityLineage';
import { TagLabel } from '../../generated/type/tagLabel';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import { Edge, EdgeData } from '../EntityLineage/EntityLineage.interface';

export interface PipeLineDetailsProp {
  version: string;
  isNodeLoading: LoadingNodeState;
  lineageLeafNodes: LeafNodes;
  serviceType: string;
  pipelineUrl: string;
  entityName: string;
  tagList: Array<string>;
  users: Array<User>;
  pipelineDetails: Pipeline;
  activeTab: number;
  owner: TableDetail['owner'];
  description: string;
  tier: TagLabel;
  followers: Array<User>;
  pipelineTags: Array<EntityTags>;
  slashedPipelineName: TitleBreadcrumbProps['titleLinks'];
  entityLineage: EntityLineage;
  tasks: Task[];
  deleted?: boolean;
  setActiveTabHandler: (value: number) => void;
  followPipelineHandler: () => void;
  unfollowPipelineHandler: () => void;
  settingsUpdateHandler: (updatedPipeline: Pipeline) => Promise<void>;
  descriptionUpdateHandler: (updatedPipeline: Pipeline) => void;
  tagUpdateHandler: (updatedPipeline: Pipeline) => void;
  taskUpdateHandler: (patch: Array<Operation>) => void;
  loadNodeHandler: (node: EntityReference, pos: LineagePos) => void;
  versionHandler: () => void;
  addLineageHandler: (edge: Edge) => Promise<void>;
  removeLineageHandler: (data: EdgeData) => void;
}
