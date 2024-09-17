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

import { ReactNode } from 'react';
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

export interface PermissionProviderProps {
  children: ReactNode;
}

export enum ResourceEntity {
  ALL = 'all',
  BOT = 'bot',
  CHART = 'chart',
  DASHBOARD = 'dashboard',
  DASHBOARD_SERVICE = 'dashboardService',
  DATABASE = 'database',
  DATABASE_SCHEMA = 'databaseSchema',
  DATABASE_SERVICE = 'databaseService',
  SEARCH_SERVICE = 'searchService',
  DATA_INSIGHT_CHART = 'dataInsightChart',
  KPI = 'kpi',
  FEED = 'feed',
  GLOSSARY = 'glossary',
  GLOSSARY_TERM = 'glossaryTerm',
  INGESTION_PIPELINE = 'ingestionPipeline',
  LOCATION = 'location',
  MESSAGING_SERVICE = 'messagingService',
  METADATA_SERVICE = 'metadataService',
  METRIC = 'metric',
  ML_MODEL = 'mlmodel',
  ML_MODEL_SERVICE = 'mlmodelService',
  PIPELINE = 'pipeline',
  PIPELINE_SERVICE = 'pipelineService',
  POLICY = 'policy',
  REPORT = 'report',
  ROLE = 'role',
  TABLE = 'table',
  TAG = 'tag',
  CLASSIFICATION = 'classification',
  TEAM = 'team',
  TEST_CASE = 'testCase',
  TEST_CASE_RESOLUTION_STATUS = 'testCaseResolutionStatus',
  TEST_DEFINITION = 'testDefinition',
  TEST_SUITE = 'testSuite',
  TOPIC = 'topic',
  TYPE = 'type',
  USER = 'user',
  WEBHOOK = 'webhook',
  STORAGE_SERVICE = 'storageService',
  CONTAINER = 'container',
  QUERY = 'query',
  DASHBOARD_DATA_MODEL = 'dashboardDataModel',
  EVENT_SUBSCRIPTION = 'eventsubscription',
  SEARCH_INDEX = 'searchIndex',
  DOMAIN = 'domain',
  DATA_PRODUCT = 'dataProduct',
  STORED_PROCEDURE = 'storedProcedure',
  APPLICATION = 'application',
  PERSONA = 'persona',
  API_SERVICE = 'apiService',
  API_COLLECTION = 'apiCollection',
  API_ENDPOINT = 'apiEndpoint',
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
