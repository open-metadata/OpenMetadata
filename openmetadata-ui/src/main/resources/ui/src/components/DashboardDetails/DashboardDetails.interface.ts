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

import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import { Operation } from 'fast-json-patch';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard } from '../../generated/entity/data/dashboard';

export interface ChartType extends Chart {
  displayName: string;
}

export interface ChartsPermissions {
  id: string;
  permissions: OperationPermission;
}
export interface DashboardDetailsProps {
  charts: Array<ChartType>;
  dashboardDetails: Dashboard;
  fetchDashboard: () => void;
  createThread: (data: CreateThread) => void;
  followDashboardHandler: () => Promise<void>;
  unFollowDashboardHandler: () => Promise<void>;
  chartDescriptionUpdateHandler: (
    index: number,
    chartId: string,
    patch: Array<Operation>
  ) => Promise<void>;
  chartTagUpdateHandler: (
    chartId: string,
    patch: Array<Operation>
  ) => Promise<void>;
  versionHandler: () => void;
  onDashboardUpdate: (
    updatedDashboard: Dashboard,
    key: keyof Dashboard
  ) => Promise<void>;
}
