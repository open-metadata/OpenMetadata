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
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import { EntityType } from 'enums/entity.enum';
import { Container } from 'generated/entity/data/container';
import { Dashboard } from 'generated/entity/data/dashboard';
import { DashboardDataModel } from 'generated/entity/data/dashboardDataModel';
import { Mlmodel } from 'generated/entity/data/mlmodel';
import { Pipeline } from 'generated/entity/data/pipeline';
import { Table } from 'generated/entity/data/table';
import { Topic } from 'generated/entity/data/topic';
import { EntityReference } from 'generated/entity/type';
import { ReactNode } from 'react';

export type DataAssetsSourceMapping = {
  [EntityType.TABLE]: Table;
  [EntityType.TOPIC]: Topic;
  [EntityType.DASHBOARD]: Dashboard;
  [EntityType.PIPELINE]: Pipeline;
  [EntityType.MLMODEL]: Mlmodel;
  [EntityType.CONTAINER]: Container;
};

export type DataAssetsHeaderProps = {
  permissions: OperationPermission;
  onTierUpdate: (tier?: string) => Promise<void>;
  onOwnerUpdate: (owner?: EntityReference) => Promise<void>;
  onVersionClick: () => void;
  onFollowClick: () => Promise<void>;
  onRestoreDataAsset: () => Promise<void>;
  onDisplayNameUpdate: (data: EntityName) => Promise<void>;
} & (
  | DataAssetTable
  | DataAssetTopic
  | DataAssetPipeline
  | DataAssetDashboard
  | DataAssetMlmodel
  | DataAssetContainer
  | DataAssetDashboardDataModel
);

export interface DataAssetTable {
  dataAsset: Table;
  entityType: EntityType.TABLE;
}

export interface DataAssetTopic {
  dataAsset: Topic;
  entityType: EntityType.TOPIC;
}
export interface DataAssetDashboard {
  dataAsset: Dashboard;
  entityType: EntityType.DASHBOARD;
}

export interface DataAssetPipeline {
  dataAsset: Pipeline;
  entityType: EntityType.PIPELINE;
}

export interface DataAssetMlmodel {
  dataAsset: Mlmodel;
  entityType: EntityType.MLMODEL;
}

export interface DataAssetContainer {
  dataAsset: Container;
  entityType: EntityType.CONTAINER;
}

export interface DataAssetDashboardDataModel {
  dataAsset: DashboardDataModel;
  entityType: EntityType.DASHBOARD_DATA_MODEL;
}

export interface DataAssetHeaderInfo {
  extraInfo: ReactNode;
  breadcrumbs: TitleBreadcrumbProps['titleLinks'];
}
