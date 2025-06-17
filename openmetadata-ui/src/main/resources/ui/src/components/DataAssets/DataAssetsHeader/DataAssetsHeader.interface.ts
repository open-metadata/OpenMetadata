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
import { ReactNode } from 'react';
import { EntityName } from '../../../components/Modals/EntityNameModal/EntityNameModal.interface';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { APICollection } from '../../../generated/entity/data/apiCollection';
import { APIEndpoint } from '../../../generated/entity/data/apiEndpoint';
import { Container } from '../../../generated/entity/data/container';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { DashboardDataModel } from '../../../generated/entity/data/dashboardDataModel';
import { Database } from '../../../generated/entity/data/database';
import { DatabaseSchema } from '../../../generated/entity/data/databaseSchema';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { Metric } from '../../../generated/entity/data/metric';
import { Mlmodel } from '../../../generated/entity/data/mlmodel';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import { SearchIndex } from '../../../generated/entity/data/searchIndex';
import { StoredProcedure } from '../../../generated/entity/data/storedProcedure';
import { Table } from '../../../generated/entity/data/table';
import { Topic } from '../../../generated/entity/data/topic';
import { APIService } from '../../../generated/entity/services/apiService';
import { DashboardService } from '../../../generated/entity/services/dashboardService';
import { DatabaseService } from '../../../generated/entity/services/databaseService';
import { MessagingService } from '../../../generated/entity/services/messagingService';
import { MetadataService } from '../../../generated/entity/services/metadataService';
import { MlmodelService } from '../../../generated/entity/services/mlmodelService';
import { PipelineService } from '../../../generated/entity/services/pipelineService';
import { SearchService } from '../../../generated/entity/services/searchService';
import { StorageService } from '../../../generated/entity/services/storageService';
import { EntityReference } from '../../../generated/entity/type';
import { ServicesType } from '../../../interface/service.interface';
import { ManageButtonProps } from '../../common/EntityPageInfos/ManageButton/ManageButton.interface';
import { TitleBreadcrumbProps } from '../../common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { QueryVote } from '../../Database/TableQueries/TableQueries.interface';

export type DataAssetsType =
  | Table
  | Topic
  | Dashboard
  | Pipeline
  | Mlmodel
  | Container
  | SearchIndex
  | Database
  | DashboardDataModel
  | StoredProcedure
  | DatabaseSchema
  | DatabaseService
  | MessagingService
  | PipelineService
  | DashboardService
  | MlmodelService
  | MetadataService
  | StorageService
  | SearchService
  | APIService
  | APICollection
  | APIEndpoint
  | Metric;

export type DataAssetsWithoutServiceField =
  | DatabaseService
  | MessagingService
  | PipelineService
  | DashboardService
  | MlmodelService
  | MetadataService
  | StorageService
  | SearchService
  | APIService
  | Metric;

export type DataAssetsWithFollowersField =
  | Table
  | Topic
  | Dashboard
  | Pipeline
  | Mlmodel
  | Container
  | SearchIndex
  | DashboardDataModel
  | StoredProcedure
  | APIEndpoint
  | Metric;

export type DataAssetsWithServiceField =
  | Table
  | Topic
  | Dashboard
  | Pipeline
  | Mlmodel
  | Container
  | SearchIndex
  | Database
  | DashboardDataModel
  | StoredProcedure
  | DatabaseSchema
  | APICollection
  | APIEndpoint;

export type DataAssetWithDomains =
  | Exclude<DataAssetsType, MetadataService>
  | GlossaryTerm;

export type DataAssetsHeaderProps = {
  permissions: OperationPermission;
  openTaskCount?: number;
  allowSoftDelete?: boolean;
  showDomain?: boolean;
  isRecursiveDelete?: boolean;
  isDqAlertSupported?: boolean;
  badge?: React.ReactNode;
  afterDomainUpdateAction?: (asset: DataAssetWithDomains) => void;
  afterDeleteAction?: (isSoftDelete?: boolean, version?: number) => void;
  onTierUpdate: (tier?: Tag) => Promise<void>;
  onOwnerUpdate: (owner?: EntityReference[]) => Promise<void>;
  onVersionClick?: () => void;
  onFollowClick?: () => Promise<void>;
  onRestoreDataAsset: () => Promise<void>;
  onDisplayNameUpdate: (data: EntityName) => Promise<void>;
  onProfilerSettingUpdate?: () => void;
  onUpdateVote?: (data: QueryVote, id: string) => Promise<void>;
  onUpdateRetentionPeriod?: (value: string) => Promise<void>;
  extraDropdownContent?: ManageButtonProps['extraDropdownContent'];
  onMetricUpdate?: (updatedData: Metric, key: keyof Metric) => Promise<void>;
  isCustomizedView?: boolean;
  disableRunAgentsButton?: boolean;
  afterTriggerAction?: VoidFunction;
  isAutoPilotWorkflowStatusLoading?: boolean;
  onCertificationUpdate?: (certificate?: Tag) => Promise<void>;
} & (
  | DataAssetTable
  | DataAssetTopic
  | DataAssetPipeline
  | DataAssetDashboard
  | DataAssetMlmodel
  | DataAssetContainer
  | DataAssetSearchIndex
  | DataAssetDashboardDataModel
  | DataAssetStoredProcedure
  | DataAssetDatabase
  | DataAssetDatabaseSchema
  | DataAssetDatabaseService
  | DataAssetMessagingService
  | DataAssetPipelineService
  | DataAssetDashboardService
  | DataAssetMlModelService
  | DataAssetMetadataService
  | DataAssetStorageService
  | DataAssetSearchService
  | DataAssetApiService
  | DataAssetAPICollection
  | DataAssetAPIEndpoint
  | DataAssetMetric
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

export interface DataAssetSearchIndex {
  dataAsset: SearchIndex;
  entityType: EntityType.SEARCH_INDEX;
}

export interface DataAssetDashboardDataModel {
  dataAsset: DashboardDataModel;
  entityType: EntityType.DASHBOARD_DATA_MODEL;
}

export interface DataAssetStoredProcedure {
  dataAsset: StoredProcedure;
  entityType: EntityType.STORED_PROCEDURE;
}

export interface DataAssetDatabase {
  dataAsset: Database;
  entityType: EntityType.DATABASE;
}
export interface DataAssetDatabaseSchema {
  dataAsset: DatabaseSchema;
  entityType: EntityType.DATABASE_SCHEMA;
}
export interface DataAssetDatabaseService {
  dataAsset: ServicesType;
  entityType: EntityType.DATABASE_SERVICE;
}
export interface DataAssetMessagingService {
  dataAsset: ServicesType;
  entityType: EntityType.MESSAGING_SERVICE;
}
export interface DataAssetPipelineService {
  dataAsset: ServicesType;
  entityType: EntityType.PIPELINE_SERVICE;
}
export interface DataAssetDashboardService {
  dataAsset: ServicesType;
  entityType: EntityType.DASHBOARD_SERVICE;
}
export interface DataAssetMlModelService {
  dataAsset: ServicesType;
  entityType: EntityType.MLMODEL_SERVICE;
}
export interface DataAssetMetadataService {
  dataAsset: ServicesType;
  entityType: EntityType.METADATA_SERVICE;
}
export interface DataAssetStorageService {
  dataAsset: ServicesType;
  entityType: EntityType.STORAGE_SERVICE;
}

export interface DataAssetSearchService {
  dataAsset: ServicesType;
  entityType: EntityType.SEARCH_SERVICE;
}

export interface DataAssetApiService {
  dataAsset: ServicesType;
  entityType: EntityType.API_SERVICE;
}

export interface DataAssetAPICollection {
  dataAsset: APICollection;
  entityType: EntityType.API_COLLECTION;
}

export interface DataAssetAPIEndpoint {
  dataAsset: APIEndpoint;
  entityType: EntityType.API_ENDPOINT;
}

export interface DataAssetMetric {
  dataAsset: Metric;
  entityType: EntityType.METRIC;
}

export interface DataAssetHeaderInfo {
  extraInfo: ReactNode;
  breadcrumbs: TitleBreadcrumbProps['titleLinks'];
}

export type EntitiesWithDomainField = Exclude<
  DataAssetsHeaderProps['dataAsset'],
  MetadataService
>;
