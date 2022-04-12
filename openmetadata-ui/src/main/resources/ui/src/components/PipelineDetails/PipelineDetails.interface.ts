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
  EntityFieldThreadCount,
  EntityTags,
  EntityThread,
  LeafNodes,
  LineagePos,
  LoadingNodeState,
} from 'Models';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Pipeline, Task } from '../../generated/entity/data/pipeline';
import { User } from '../../generated/entity/teams/user';
import { EntityLineage } from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import { Edge, EdgeData } from '../EntityLineage/EntityLineage.interface';

export interface PipeLineDetailsProp {
  pipelineFQN: string;
  version: string;
  isNodeLoading: LoadingNodeState;
  lineageLeafNodes: LeafNodes;
  serviceType: string;
  pipelineUrl: string;
  entityName: string;
  users: Array<User>;
  pipelineDetails: Pipeline;
  activeTab: number;
  owner: EntityReference;
  description: string;
  tier: TagLabel;
  followers: Array<EntityReference>;
  pipelineTags: Array<EntityTags>;
  slashedPipelineName: TitleBreadcrumbProps['titleLinks'];
  entityLineage: EntityLineage;
  tasks: Task[];
  deleted?: boolean;
  isLineageLoading?: boolean;
  entityThread: EntityThread[];
  isentityThreadLoading: boolean;
  feedCount: number;
  entityFieldThreadCount: EntityFieldThreadCount[];
  paging: Paging;
  fetchFeedHandler: (after?: string) => void;
  createThread: (data: CreateThread) => void;
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
  entityLineageHandler: (lineage: EntityLineage) => void;
  postFeedHandler: (value: string, id: string) => void;
  deletePostHandler: (threadId: string, postId: string) => void;
}
