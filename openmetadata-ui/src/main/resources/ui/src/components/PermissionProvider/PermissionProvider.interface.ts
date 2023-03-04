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

import { Operation } from '../../generated/entity/policies/accessControl/resourcePermission';

export type UIPermission = {
  [key in ResourceEntity]: OperationPermission;
};

export type OperationPermission = {
  [key in Operation]: boolean;
};

export type IngestionServicePermission = {
  [key: string]: OperationPermission;
};

export enum ResourceEntity {
  ALL = 'all',
  BOT = 'bot',
  CHART = 'chart',
  DASHBOARD = 'dashboard',
  DASHBOARD_SERVICE = 'dashboardService',
  DATABASE = 'database',
  DATABASE_SCHEMA = 'databaseSchema',
  DATABASE_SERVICE = 'databaseService',
  EVENTS = 'events',
  FEED = 'feed',
  GLOSSARY = 'glossary',
  GLOSSARY_TERM = 'glossaryTerm',
  INGESTION_PIPELINE = 'ingestionPipeline',
  LOCATION = 'location',
  MESSAGING_SERVICE = 'messagingService',
  METADATA_SERVICE = 'metadataService',
  METRICS = 'metrics',
  ML_MODEL = 'mlmodel',
  ML_MODEL_SERVICE = 'mlmodelService',
  PIPELINE = 'pipeline',
  PIPELINE_SERVICE = 'pipelineService',
  POLICY = 'policy',
  REPORT = 'report',
  ROLE = 'role',
  STORAGE_SERVICE = 'storageService',
  TABLE = 'table',
  TAG = 'tag',
  CLASSIFICATION = 'classification',
  TEAM = 'team',
  TEST_CASE = 'testCase',
  TEST_DEFINITION = 'testDefinition',
  TEST_SUITE = 'testSuite',
  TOPIC = 'topic',
  TYPE = 'type',
  USER = 'user',
  WEBHOOK = 'webhook',
  OBJECT_STORE_SERVICE = 'objectStoreService',
}

export interface PermissionContextType {
  permissions: UIPermission;
  getEntityPermission: (
    resource: ResourceEntity,
    entityId: string
  ) => Promise<OperationPermission>;
  getEntityPermissionByFqn: (
    resource: ResourceEntity,
    entityFqn: string
  ) => Promise<OperationPermission>;
  getResourcePermission: (
    resource: ResourceEntity
  ) => Promise<OperationPermission>;
}

export interface EntityPermissionMap {
  [key: string]: OperationPermission;
}
