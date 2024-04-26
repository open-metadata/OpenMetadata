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
export enum EntityType {
  Table = 'tables',
  StoreProcedure = 'storedProcedures',
  Topic = 'topics',
  Dashboard = 'dashboards',
  Pipeline = 'pipelines',
  Container = 'containers',
  MlModel = 'mlmodels',
  Domain = 'domains',
  Glossary = 'glossaries',
  GlossaryTerm = 'glossaryTerms',
  SearchIndex = 'searchIndexes',
  DatabaseService = 'services/databaseServices',
  DashboardService = 'services/dashboardServices',
  StorageService = 'services/storageServices',
  MlModelService = 'services/mlmodelServices',
  PipelineService = 'services/pipelineServices',
  MessagingService = 'services/messagingServices',
  SearchService = 'services/searchServices',
  MetadataService = 'services/metadataServices',
  Database = 'databases',
  DatabaseSchema = 'databaseSchemas',
  DataModel = 'dashboard/datamodels',
  User = 'users',
}

export const EXPLORE_PAGE_TABS: Record<
  Exclude<
    EntityType,
    | EntityType.DashboardService
    | EntityType.DatabaseService
    | EntityType.MessagingService
    | EntityType.SearchService
    | EntityType.MlModelService
    | EntityType.StorageService
    | EntityType.PipelineService
    | EntityType.Database
    | EntityType.GlossaryTerm
    | EntityType.Domain
    | EntityType.MetadataService
    | EntityType.User
  >,
  string
> = {
  [EntityType.DatabaseSchema]: 'database schemas',
  [EntityType.Dashboard]: 'dashboards',
  [EntityType.DataModel]: 'dashboard data models',
  [EntityType.Pipeline]: 'pipelines',
  [EntityType.Topic]: 'topics',
  [EntityType.MlModel]: 'ml models',
  [EntityType.Container]: 'containers',
  [EntityType.SearchIndex]: 'search indexes',
  [EntityType.Table]: 'tables',
  [EntityType.StoreProcedure]: 'stored procedures',
  [EntityType.Glossary]: 'glossary terms',
} as const;

export const SEARCH_INDEX: Record<
  Exclude<
    EntityType,
    | EntityType.DashboardService
    | EntityType.DatabaseService
    | EntityType.MessagingService
    | EntityType.SearchService
    | EntityType.MlModelService
    | EntityType.StorageService
    | EntityType.PipelineService
    | EntityType.Database
    | EntityType.DatabaseSchema
    | EntityType.GlossaryTerm
    | EntityType.MetadataService
    | EntityType.User
  >,
  string
> = {
  [EntityType.Dashboard]: 'dashboard_search_index',
  [EntityType.DataModel]: 'dashboard_data_model_search_index',
  [EntityType.Pipeline]: 'pipeline_search_index',
  [EntityType.Topic]: 'topic_search_index',
  [EntityType.MlModel]: 'mlmodel_search_index',
  [EntityType.Container]: 'container_search_index',
  [EntityType.SearchIndex]: 'search_entity_search_index',
  [EntityType.Table]: 'table_search_index',
  [EntityType.StoreProcedure]: 'store_procedure_search_index',
  [EntityType.Glossary]: 'glossary_search_index',
  [EntityType.Domain]: 'domain_search_index',
} as const;

export enum SidebarItem {
  EXPLORE = 'explore',
  OBSERVABILITY = 'observability',
  DATA_QUALITY = 'data-quality',
  INCIDENT_MANAGER = 'incident-manager',
  OBSERVABILITY_ALERT = 'observability-alert',
  DATA_INSIGHT = 'data-insight',
  DOMAIN = 'domain',
  GOVERNANCE = 'governance',
  GLOSSARY = 'glossary',
  TAGS = 'tags',
  INSIGHTS = 'insights',
  SETTINGS = 'settings',
  LOGOUT = 'logout',
}

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
}
