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

import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Chart } from '../../../generated/entity/data/chart';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { EntityReference } from '../../../generated/type/entityReference';
import { DataAssetWithDomains } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../Database/TableQueries/TableQueries.interface';

export interface ChartType extends Chart {
  displayName: string;
}

export interface ChartsPermissions {
  id: string;
  permissions: OperationPermission;
}
export interface DashboardDetailsProps {
  updateDashboardDetailsState?: (data: DataAssetWithDomains) => void;
  charts: Array<EntityReference>;
  dashboardDetails: Dashboard;
  fetchDashboard: () => void;
  followDashboardHandler: () => Promise<void>;
  unFollowDashboardHandler: () => Promise<void>;
  versionHandler: () => void;
  onDashboardUpdate: (
    updatedDashboard: Dashboard,
    key?: keyof Dashboard
  ) => Promise<void>;
  handleToggleDelete: (version?: number) => void;
  onUpdateVote?: (data: QueryVote, id: string) => Promise<void>;
}
