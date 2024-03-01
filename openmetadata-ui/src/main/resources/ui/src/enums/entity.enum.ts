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

export enum EntityType {
  TABLE = 'table',
  TOPIC = 'topic',
  CLASSIFICATION = 'classification',
  DASHBOARD = 'dashboard',
  PIPELINE = 'pipeline',
  DATABASE = 'database',
  DATABASE_SCHEMA = 'databaseSchema',
  GLOSSARY = 'glossary',
  GLOSSARY_TERM = 'glossaryTerm',
  DATABASE_SERVICE = 'databaseService',
  MESSAGING_SERVICE = 'messagingService',
  METADATA_SERVICE = 'metadataService',
  DASHBOARD_SERVICE = 'dashboardService',
  PIPELINE_SERVICE = 'pipelineService',
  MLMODEL_SERVICE = 'mlmodelService',
  STORAGE_SERVICE = 'storageService',
  SEARCH_SERVICE = 'searchService',
  WEBHOOK = 'webhook',
  MLMODEL = 'mlmodel',
  TYPE = 'type',
  TEAM = 'team',
  USER = 'user',
  BOT = 'bot',
  ROLE = 'role',
  POLICY = 'policy',
  TEST_SUITE = 'testSuite',
  TEST_CASE = 'testCase',
  DATA_INSIGHT_CHART = 'dataInsightChart',
  KPI = 'kpi',
  ALERT = 'alert',
  CONTAINER = 'container',
  TAG = 'tag',
  DASHBOARD_DATA_MODEL = 'dashboardDataModel',
  SUBSCRIPTION = 'subscription',
  CHART = 'chart',
  DOMAIN = 'domain',
  DATA_PRODUCT = 'dataProduct',
  SAMPLE_DATA = 'sampleData',
  STORED_PROCEDURE = 'storedProcedure',
  SEARCH_INDEX = 'searchIndex',
  APP_MARKET_PLACE_DEFINITION = 'appMarketPlaceDefinition',
  APPLICATION = 'app',
  PERSONA = 'persona',
  DOC_STORE = 'docStore',
  PAGE = 'Page',
  knowledgePanels = 'KnowLedgePanels',
  GOVERN = 'govern',
  ALL = 'all',
  CUSTOM_METRIC = 'customMetric',
  INGESTION_PIPELINE = 'ingestionPipeline',
  QUERY = 'query',
}

export enum AssetsType {
  TABLE = 'table',
  TOPIC = 'topic',
  DASHBOARD = 'dashboard',
  PIPELINE = 'pipeline',
  MLMODEL = 'mlmodel',
  DASHBOARD_DATA_MODEL = 'dashboardDataModel',
  STORED_PROCEDURE = 'storedProcedure',
}

export enum EntityLineageDirection {
  TOP_BOTTOM = 'TB',
  LEFT_RIGHT = 'LR',
}

export enum EntityLineageNodeType {
  INPUT = 'input',
  OUTPUT = 'output',
  DEFAULT = 'default',
  NOT_CONNECTED = 'not-connected',
  LOAD_MORE = 'load-more',
}

export enum TabSpecificField {
  SAMPLE_DATA = 'sampleData',
  ACTIVITY_FEED = 'activity_feed',
  TABLE_PROFILE = 'profile',
  LINEAGE = 'lineage',
  COLUMNS = 'columns',
  USAGE_SUMMARY = 'usageSummary',
  FOLLOWERS = 'followers',
  JOINS = 'joins',
  TAGS = 'tags',
  OWNER = 'owner',
  DATAMODEL = 'dataModel',
  CHARTS = 'charts',
  TASKS = 'tasks',
  TABLE_QUERIES = 'tableQueries',
  TESTS = 'tests',
  PIPELINE_STATUS = 'pipelineStatus',
  DASHBOARD = 'dashboard',
  TABLE_CONSTRAINTS = 'tableConstraints',
  EXTENSION = 'extension',
  EXECUTIONS = 'executions',
  SCHEDULE_INTERVAL = 'scheduleInterval',
  TESTSUITE = 'testSuite',
  VIEW_DEFINITION = 'viewDefinition',
  FIELDS = 'fields',
  VOTES = 'votes',
  DOMAIN = 'domain',
  DATA_PRODUCTS = 'dataProducts',
}

export enum FqnPart {
  Service,
  Database,
  Schema,
  Table,
  Column,
  NestedColumn,
  Topic,
  SearchIndexField,
}

export enum EntityTabs {
  SCHEMA = 'schema',
  ACTIVITY_FEED = 'activity_feed',
  SAMPLE_DATA = 'sample_data',
  TABLE_QUERIES = 'table_queries',
  PROFILER = 'profiler',
  LINEAGE = 'lineage',
  DBT = 'dbt',
  VIEW_DEFINITION = 'view_definition',
  CUSTOM_PROPERTIES = 'custom_properties',
  MODEL = 'model',
  FEATURES = 'features',
  TASKS = 'tasks',
  CONFIG = 'config',
  DETAILS = 'details',
  CHILDREN = 'children',
  EXECUTIONS = 'executions',
  TABLE = 'table',
  TEST_CASES = 'test-cases',
  PIPELINE = 'pipeline',
  DATA_Model = 'data-model',
  INGESTIONS = 'ingestions',
  CONNECTION = 'connection',
  SQL = 'sql',
  FIELDS = 'fields',
  SEARCH_INDEX_SETTINGS = 'search-index-settings',
  STORED_PROCEDURE = 'stored_procedure',
  CODE = 'code',
}

export enum EntityAction {
  EXPORT = 'export',
  IMPORT = 'import',
}
