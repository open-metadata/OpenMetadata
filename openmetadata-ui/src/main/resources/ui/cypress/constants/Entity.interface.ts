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
  SeachIndex = 'searchIndexes',
  DatabaseService = 'services/databaseServices',
  DashboardService = 'services/dashboardServices',
  StorageService = 'services/storageServices',
  MlModelService = 'services/mlmodelServices',
  PipelineService = 'services/pipelineServices',
  MessagingService = 'services/messagingServices',
  SearchService = 'services/searchServices',
  Database = 'databases',
  DatabaseSchema = 'databaseSchemas',
  DataModel = 'dashboard/datamodels',
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
    | EntityType.DatabaseSchema
    | EntityType.GlossaryTerm
    | EntityType.Domain
  >,
  string
> = {
  [EntityType.Dashboard]: 'dashboards',
  [EntityType.DataModel]: 'dashboard data models',
  [EntityType.Pipeline]: 'pipelines',
  [EntityType.Topic]: 'topics',
  [EntityType.MlModel]: 'ml models',
  [EntityType.Container]: 'containers',
  [EntityType.SeachIndex]: 'search indexes',
  [EntityType.Table]: 'tables',
  [EntityType.StoreProcedure]: 'stored procedures',
  [EntityType.Glossary]: 'glossaries',
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
  >,
  string
> = {
  [EntityType.Dashboard]: 'dashboard_search_index',
  [EntityType.DataModel]: 'dashboard_data_model_search_index',
  [EntityType.Pipeline]: 'pipeline_search_index',
  [EntityType.Topic]: 'topic_search_index',
  [EntityType.MlModel]: 'mlmodel_search_index',
  [EntityType.Container]: 'container_search_index',
  [EntityType.SeachIndex]: 'search_entity_search_index',
  [EntityType.Table]: 'table_search_index',
  [EntityType.StoreProcedure]: 'store_procedure_search_index',
  [EntityType.Glossary]: 'glossary_search_index',
  [EntityType.Domain]: 'domain_search_index',
} as const;
