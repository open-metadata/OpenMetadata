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
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { User } from '../../generated/entity/teams/user';
import { EntityLineage } from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';
import { TagLabel } from '../../generated/type/tagLabel';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface ChartType extends Chart {
  displayName: string;
}

export interface DashboardDetailsProps {
  version: string;
  isNodeLoading: LoadingNodeState;
  lineageLeafNodes: LeafNodes;
  entityLineage: EntityLineage;
  charts: Array<ChartType>;
  serviceType: string;
  dashboardUrl: string;
  tagList: Array<string>;
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
}
