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

import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { Tag } from '../../../../generated/entity/classification/tag';
import { DashboardDataModel } from '../../../../generated/entity/data/dashboardDataModel';
import { EntityReference } from '../../../../generated/entity/type';
import { DataAssetWithDomains } from '../../../DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../../Database/TableQueries/TableQueries.interface';

export interface DataModelDetailsProps {
  updateDataModelDetailsState?: (data: DataAssetWithDomains) => void;
  dataModelData: DashboardDataModel;
  dataModelPermissions: OperationPermission;
  fetchDataModel: () => void;
  handleFollowDataModel: () => Promise<void>;
  handleUpdateOwner: (owner?: EntityReference[]) => Promise<void>;
  handleUpdateTier: (tier?: Tag) => Promise<void>;
  onUpdateVote: (data: QueryVote, id: string) => Promise<void>;
  onUpdateDataModel: (
    updatedDataModel: DashboardDataModel,
    key?: keyof DashboardDataModel
  ) => Promise<void>;
  handleToggleDelete: (version?: number) => void;
}

export interface DataModelTableProps {
  showDeleted: boolean;
  handleShowDeleted: (checked: boolean) => void;
}
