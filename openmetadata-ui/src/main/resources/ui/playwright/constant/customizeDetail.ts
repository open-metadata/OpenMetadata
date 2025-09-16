/*
 *  Copyright 2025 Collate.
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
export enum ECustomizedDataAssets {
  TABLE = 'Table',
  TOPIC = 'Topic',
  DASHBOARD = 'Dashboard',
  ML_MODEL = 'Ml Model',
  PIPELINE = 'Pipeline',
  DASHBOARD_DATA_MODEL = 'Dashboard Data Model',
  API_COLLECTION = 'API Collection',
  SEARCH_INDEX = 'Search Index',
  CONTAINER = 'Container',
  DATABASE = 'Database',
  DATABASE_SCHEMA = 'Database Schema',
  STORED_PROCEDURE = 'Stored Procedure',
  API_ENDPOINT = 'API Endpoint',
}

export enum ECustomizedGovernance {
  DOMAIN = 'Domain',
  GLOSSARY = 'Glossary',
  GLOSSARY_TERM = 'Glossary Term',
}

export enum EntityTabs {
  SCHEMA = 'schema',
  SCHEMAS = 'schemas',
  ACTIVITY_FEED = 'activity_feed',
  SAMPLE_DATA = 'sample_data',
  TABLE_QUERIES = 'table_queries',
  PROFILER = 'profiler',
  LINEAGE = 'lineage',
  KNOWLEDGE_GRAPH = 'knowledge_graph',
  DBT = 'dbt',
  VIEW_DEFINITION = 'view_definition',
  SCHEMA_DEFINITION = 'schema_definition',
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
  AGENTS = 'agents',
  CONNECTION = 'connection',
  SQL = 'sql',
  FIELDS = 'fields',
  SEARCH_INDEX_SETTINGS = 'search-index-settings',
  STORED_PROCEDURE = 'stored_procedure',
  CODE = 'code',
  API_COLLECTION = 'apiCollection',
  API_ENDPOINT = 'apiEndpoint',
  OVERVIEW = 'overview',
  INCIDENTS = 'incidents',
  TERMS = 'terms',
  GLOSSARY_TERMS = 'glossary_terms',
  ASSETS = 'assets',
  EXPRESSION = 'expression',
  INSIGHTS = 'insights',
  DASHBOARD = 'dashboard',
  DOCUMENTATION = 'documentation',
  DATA_PRODUCTS = 'data_products',
  SUBDOMAINS = 'subdomains',
  CONTRACT = 'contract',
}

export const TABLE_DEFAULT_TABS = [
  EntityTabs.ACTIVITY_FEED,
  EntityTabs.CONTRACT,
  EntityTabs.CUSTOM_PROPERTIES,
  EntityTabs.PROFILER,
  EntityTabs.LINEAGE,
  EntityTabs.KNOWLEDGE_GRAPH,
  EntityTabs.TABLE_QUERIES,
  EntityTabs.SAMPLE_DATA,
  EntityTabs.SCHEMA,
  EntityTabs.VIEW_DEFINITION,
  EntityTabs.DBT,
];

export const TOPIC_DEFAULT_TABS = [
  EntityTabs.SCHEMA,
  EntityTabs.ACTIVITY_FEED,
  EntityTabs.SAMPLE_DATA,
  EntityTabs.CONFIG,
  EntityTabs.LINEAGE,
  EntityTabs.CUSTOM_PROPERTIES,
];

export const DASHBOARD_DEFAULT_TABS = [
  EntityTabs.DETAILS,
  EntityTabs.ACTIVITY_FEED,
  EntityTabs.LINEAGE,
  EntityTabs.CUSTOM_PROPERTIES,
];

export const MLMODEL_DEFAULT_TABS = [
  EntityTabs.FEATURES,
  EntityTabs.ACTIVITY_FEED,
  EntityTabs.DETAILS,
  EntityTabs.LINEAGE,
  EntityTabs.CUSTOM_PROPERTIES,
];

export const PIPELINE_DEFAULT_TABS = [
  EntityTabs.TASKS,
  EntityTabs.ACTIVITY_FEED,
  EntityTabs.EXECUTIONS,
  EntityTabs.LINEAGE,
  EntityTabs.CUSTOM_PROPERTIES,
];

export const DASHBOARD_DATAMODEL_DEFAULT_TABS = [
  EntityTabs.MODEL,
  EntityTabs.ACTIVITY_FEED,
  EntityTabs.SQL,
  EntityTabs.LINEAGE,
  EntityTabs.CUSTOM_PROPERTIES,
];

export const API_COLLECTION_DEFAULT_TABS = [
  EntityTabs.API_ENDPOINT,
  EntityTabs.ACTIVITY_FEED,
  EntityTabs.CUSTOM_PROPERTIES,
];

export const SEARCH_INDEX_DEFAULT_TABS = [
  EntityTabs.FIELDS,
  EntityTabs.ACTIVITY_FEED,
  EntityTabs.SAMPLE_DATA,
  EntityTabs.LINEAGE,
  EntityTabs.SEARCH_INDEX_SETTINGS,
  EntityTabs.CUSTOM_PROPERTIES,
];

export const CONTAINER_DEFAULT_TABS = [
  EntityTabs.SCHEMA,
  EntityTabs.CHILDREN,
  EntityTabs.ACTIVITY_FEED,
  EntityTabs.LINEAGE,
  EntityTabs.CUSTOM_PROPERTIES,
];

export const DATABASE_DEFAULT_TABS = [
  EntityTabs.SCHEMAS,
  EntityTabs.ACTIVITY_FEED,
  EntityTabs.CUSTOM_PROPERTIES,
];

export const DATABASE_SCHEMA_DEFAULT_TABS = [
  EntityTabs.TABLE,
  EntityTabs.STORED_PROCEDURE,
  EntityTabs.ACTIVITY_FEED,
  EntityTabs.CUSTOM_PROPERTIES,
];

export const STORED_PROCEDURE_DEFAULT_TABS = [
  EntityTabs.CODE,
  EntityTabs.ACTIVITY_FEED,
  EntityTabs.LINEAGE,
  EntityTabs.CUSTOM_PROPERTIES,
];

export const API_ENDPOINT_DEFAULT_TABS = [
  EntityTabs.SCHEMA,
  EntityTabs.ACTIVITY_FEED,
  EntityTabs.LINEAGE,
  EntityTabs.CUSTOM_PROPERTIES,
];

export const DASHBOARD_DATA_MODEL_DEFAULT_TABS = [
  EntityTabs.MODEL,
  EntityTabs.ACTIVITY_FEED,
  EntityTabs.LINEAGE,
  EntityTabs.CUSTOM_PROPERTIES,
];

export const ML_MODEL_DEFAULT_TABS = [
  EntityTabs.FEATURES,
  EntityTabs.ACTIVITY_FEED,
  EntityTabs.DETAILS,
  EntityTabs.LINEAGE,
  EntityTabs.CUSTOM_PROPERTIES,
];

export const DOMAIN_DEFAULT_TABS = [
  EntityTabs.DOCUMENTATION,
  EntityTabs.SUBDOMAINS,
  EntityTabs.DATA_PRODUCTS,
  EntityTabs.ASSETS,
  EntityTabs.CUSTOM_PROPERTIES,
];

export const GLOSSARY_DEFAULT_TABS = [
  EntityTabs.TERMS,
  EntityTabs.ACTIVITY_FEED,
];

export const GLOSSARY_TERM_DEFAULT_TABS = [
  EntityTabs.OVERVIEW,
  EntityTabs.GLOSSARY_TERMS,
  EntityTabs.ASSETS,
  EntityTabs.ACTIVITY_FEED,
  EntityTabs.CUSTOM_PROPERTIES,
];
