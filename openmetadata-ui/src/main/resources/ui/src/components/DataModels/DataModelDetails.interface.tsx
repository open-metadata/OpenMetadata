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

import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import { CreateThread } from 'generated/api/feed/createThread';
import { DashboardDataModel } from 'generated/entity/data/dashboardDataModel';
import { Column } from 'generated/entity/data/table';
import { EntityFieldThreadCount } from 'interface/feed.interface';
import { EntityTags } from 'Models';

export interface DataModelDetailsProps {
  entityFieldThreadCount: EntityFieldThreadCount[];
  entityFieldTaskCount: EntityFieldThreadCount[];
  feedCount: number;
  dataModelData?: DashboardDataModel;
  dashboardDataModelFQN: string;
  dataModelPermissions: OperationPermission;
  createThread: (data: CreateThread) => void;
  handleFollowDataModel: () => void;
  handleUpdateTags: (selectedTags?: Array<EntityTags>) => void;
  handleUpdateOwner: (updatedOwner?: DashboardDataModel['owner']) => void;
  handleUpdateTier: (updatedTier?: string) => void;
  activeTab: string;
  handleTabChange: (tabValue: string) => void;
  handleUpdateDescription: (value: string) => Promise<void>;
  handleUpdateDataModel: (updatedDataModel: Column[]) => Promise<void>;
  onUpdateDataModel: (
    updatedDataModel: DashboardDataModel,
    key: keyof DashboardDataModel
  ) => Promise<void>;
}
