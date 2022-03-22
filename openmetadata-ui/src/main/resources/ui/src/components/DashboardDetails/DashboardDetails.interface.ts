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
  TableDetail,
} from 'Models';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { User } from '../../generated/entity/teams/user';
import { EntityLineage } from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';
import { TagLabel } from '../../generated/type/tagLabel';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import { Edge, EdgeData } from '../EntityLineage/EntityLineage.interface';

export interface ChartType extends Chart {
  displayName: string;
}

export interface DashboardDetailsProps {
  dashboardFQN: string;
  version: string;
  isNodeLoading: LoadingNodeState;
  lineageLeafNodes: LeafNodes;
  entityLineage: EntityLineage;
  charts: Array<ChartType>;
  serviceType: string;
  dashboardUrl: string;
  users: Array<User>;
  dashboardDetails: Dashboard;
  entityName: string;
  activeTab: number;
  owner: TableDetail['owner'];
  description: string;
  tier: TagLabel;
  followers: Array<User>;
  dashboardTags: Array<EntityTags>;
  slashedDashboardName: TitleBreadcrumbProps['titleLinks'];
  entityThread: EntityThread[];
  deleted?: boolean;
  isLineageLoading?: boolean;
  isentityThreadLoading: boolean;
  feedCount: number;
  entityFieldThreadCount: EntityFieldThreadCount[];
  createThread: (data: CreateThread) => void;
  setActiveTabHandler: (value: number) => void;
  followDashboardHandler: () => void;
  unfollowDashboardHandler: () => void;
  settingsUpdateHandler: (updatedDashboard: Dashboard) => Promise<void>;
  descriptionUpdateHandler: (updatedDashboard: Dashboard) => void;
  chartDescriptionUpdateHandler: (
    index: number,
    chartId: string,
    patch: Array<Operation>
  ) => void;
  chartTagUpdateHandler: (
    index: number,
    chartId: string,
    patch: Array<Operation>
  ) => void;
  tagUpdateHandler: (updatedDashboard: Dashboard) => void;
  loadNodeHandler: (node: EntityReference, pos: LineagePos) => void;
  versionHandler: () => void;
  addLineageHandler: (edge: Edge) => Promise<void>;
  removeLineageHandler: (data: EdgeData) => void;
  entityLineageHandler: (lineage: EntityLineage) => void;
  postFeedHandler: (value: string, id: string) => void;
  deletePostHandler: (threadId: string, postId: string) => void;
}
