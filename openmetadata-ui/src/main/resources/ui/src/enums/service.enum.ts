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

import { DashboardServiceType } from '../generated/entity/data/dashboard';
import { DatabaseServiceType } from '../generated/entity/data/database';
import { MlModelServiceType } from '../generated/entity/data/mlmodel';
import { MessagingServiceType } from '../generated/entity/data/topic';
import { APIServiceType } from '../generated/entity/services/apiService';
import { DriveServiceType } from '../generated/entity/services/driveService';
import { MetadataServiceType } from '../generated/entity/services/metadataService';
import { PipelineServiceType } from '../generated/entity/services/pipelineService';
import { SearchServiceType } from '../generated/entity/services/searchService';
import { Type as SecurityServiceType } from '../generated/entity/services/securityService';
import { StorageServiceType } from '../generated/entity/services/storageService';

export enum ServiceCategory {
  DATABASE_SERVICES = 'databaseServices',
  MESSAGING_SERVICES = 'messagingServices',
  DASHBOARD_SERVICES = 'dashboardServices',
  PIPELINE_SERVICES = 'pipelineServices',
  ML_MODEL_SERVICES = 'mlmodelServices',
  METADATA_SERVICES = 'metadataServices',
  STORAGE_SERVICES = 'storageServices',
  SEARCH_SERVICES = 'searchServices',
  API_SERVICES = 'apiServices',
  SECURITY_SERVICES = 'securityServices',
  DRIVE_SERVICES = 'driveServices',
}

export enum ServiceCategoryPlural {
  databaseService = 'databaseServices',
  messagingService = 'messagingServices',
  dashboardService = 'dashboardServices',
  pipelineService = 'pipelineServices',
  mlmodelService = 'mlmodelServices',
  metadataService = 'metadataServices',
  storageService = 'storageServices',
  searchService = 'searchServices',
  apiService = 'apiServices',
  securityService = 'securityServices',
  driveService = 'driveServices',
}

export type DatabaseServiceTypeSmallCaseType = {
  [K in keyof typeof DatabaseServiceType]: Lowercase<
    typeof DatabaseServiceType[K]
  >;
};

export type MessagingServiceTypeSmallCaseType = {
  [K in keyof typeof MessagingServiceType]: Lowercase<
    typeof MessagingServiceType[K]
  >;
};

export type DashboardServiceTypeSmallCaseType = {
  [K in keyof typeof DashboardServiceType]: Lowercase<
    typeof DashboardServiceType[K]
  >;
};

export type PipelineServiceTypeSmallCaseType = {
  [K in keyof typeof PipelineServiceType]: Lowercase<
    typeof PipelineServiceType[K]
  >;
};

export type MlModelServiceTypeSmallCaseType = {
  [K in keyof typeof MlModelServiceType]: Lowercase<
    typeof MlModelServiceType[K]
  >;
};

export type StorageServiceTypeSmallCaseType = {
  [K in keyof typeof StorageServiceType]: Lowercase<
    typeof StorageServiceType[K]
  >;
};

export type MetadataServiceTypeSmallCaseType = {
  [K in keyof typeof MetadataServiceType]: Lowercase<
    typeof MetadataServiceType[K]
  >;
};

export type SearchServiceTypeSmallCaseType = {
  [K in keyof typeof SearchServiceType]: Lowercase<typeof SearchServiceType[K]>;
};

export type ApiServiceTypeSmallCaseType = {
  [K in keyof typeof APIServiceType]: Lowercase<typeof APIServiceType[K]>;
};

export type SecurityServiceTypeSmallCaseType = {
  [K in keyof typeof SecurityServiceType]: Lowercase<
    typeof SecurityServiceType[K]
  >;
};

export type DriveServiceTypeSmallCaseType = {
  [K in keyof typeof DriveServiceType]: Lowercase<typeof DriveServiceType[K]>;
};

export enum ServiceAgentSubTabs {
  METADATA = 'metadata',
  COLLATE_AI = 'collateAI',
}

// These are fields which have reference to the connection schema of other services
export enum ServiceNestedConnectionFields {
  CONNECTION = 'connection',
  METASTORE_CONNECTION = 'metastoreConnection',
  DATABASE_CONNECTION = 'databaseConnection',
}
