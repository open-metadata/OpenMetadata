/*
 *  Copyright 2024 Collate.
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
export enum EntityTypeEndpoint {
  API_COLLECTION = 'apiCollections',
  API_ENDPOINT = 'apiEndpoints',
  ApiService = 'services/apiServices',
  Container = 'containers',
  DATA_PRODUCT = 'dataProducts',
  Dashboard = 'dashboards',
  DashboardService = 'services/dashboardServices',
  DataModel = 'dashboard/datamodels',
  DataProduct = 'dataProducts',
  Database = 'databases',
  DatabaseSchema = 'databaseSchemas',
  DatabaseService = 'services/databaseServices',
  Domain = 'domains',
  Glossary = 'glossaries',
  GlossaryTerm = 'glossaryTerms',
  METRIC = 'metrics',
  MessagingService = 'services/messagingServices',
  MetadataService = 'services/metadataServices',
  MlModel = 'mlmodels',
  MlModelService = 'services/mlmodelServices',
  NotificationAlert = 'events/subscriptions',
  Pipeline = 'pipelines',
  PipelineService = 'services/pipelineServices',
  SearchIndex = 'searchIndexes',
  SearchService = 'services/searchServices',
  StorageService = 'services/storageServices',
  StoreProcedure = 'storedProcedures',
  Table = 'tables',
  Teams = 'teams',
  TestSuites = 'dataQuality/testSuites',
  Topic = 'topics',
  User = 'users',
  Classification = 'classifications',
  Tag = 'tags',
}

export type EntityDataType = {
  entityName: string;
  entityDetails: unknown;
  endPoint: EntityTypeEndpoint;
};

export enum ENTITY_PATH {
  tables = 'table',
  topics = 'topic',
  dashboards = 'dashboard',
  pipelines = 'pipeline',
  mlmodels = 'mlmodel',
  containers = 'container',
  tags = 'tag',
  glossaries = 'glossary',
  searchIndexes = 'searchIndex',
  storedProcedures = 'storedProcedure',
  glossaryTerm = 'glossaryTerm',
  databases = 'database',
  databaseSchemas = 'databaseSchema',
  'dashboard/datamodels' = 'dashboardDataModel',
  'apiCollections' = 'apiCollection',
  'apiEndpoints' = 'apiEndpoint',
  'dataProducts' = 'dataProduct',
  'metrics' = 'metric',
}

export type ResponseDataType = {
  name: string;
  displayName: string;
  description: string;
  id: string;
  fullyQualifiedName: string;
};
export type TestCaseData = {
  parameterValues?: unknown[];
  name?: string;
  entityLink?: string;
  testDefinition?: string;
  testSuite?: string;
};

export type TestSuiteData = {
  name?: string;
  basicEntityReference?: string;
  description?: string;
};

export interface ResponseDataWithServiceType extends ResponseDataType {
  service: ResponseDataType;
}

export interface UserResponseDataType extends ResponseDataType {
  email: string;
  isAdmin: boolean;
  isBot: boolean;
  href?: string;
}

export interface EntityReference {
  id: string;
  type: string;
  name: string;
  displayName?: string;
  deleted?: boolean;
  description?: string;
  fullyQualifiedName?: string;
  href?: string;
  inherited?: boolean;
}

export interface ServiceEntity {
  name: string;
  serviceType: string;
  connection: {
    config: Record<string, unknown>;
  };
}
