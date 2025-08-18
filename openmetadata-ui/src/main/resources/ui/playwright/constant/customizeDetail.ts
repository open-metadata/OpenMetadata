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

export const TABLE_DEFAULT_TABS = [
  'Activity Feeds & Tasks',
  'Contract',
  'Custom Properties',
  'Data Observability',
  'Lineage',
  'Knowledge Graph',
  'Queries',
  'Sample Data',
  'Schema',
  'View Definition',
  'dbt',
];

export const TOPIC_DEFAULT_TABS = [
  'Schema',
  'Activity Feeds & Tasks',
  'Sample Data',
  'Config',
  'Lineage',
  'Custom Properties',
];

export const DASHBOARD_DEFAULT_TABS = [
  'Details',
  'Activity Feeds & Tasks',
  'Lineage',
  'Custom Properties',
];

export const MLMODEL_DEFAULT_TABS = [
  'Features',
  'Activity Feeds & Tasks',
  'Details',
  'Lineage',
  'Custom Properties',
];

export const PIPELINE_DEFAULT_TABS = [
  'Tasks',
  'Activity Feeds & Tasks',
  'Executions',
  'Lineage',
  'Custom Properties',
];

export const DASHBOARD_DATAMODEL_DEFAULT_TABS = [
  'Model',
  'Activity Feeds & Tasks',
  'SQL',
  'Lineage',
  'Custom Properties',
];

export const API_COLLECTION_DEFAULT_TABS = [
  'Endpoints',
  'Activity Feeds & Tasks',
  'Custom Properties',
];

export const SEARCH_INDEX_DEFAULT_TABS = [
  'Fields',
  'Activity Feeds & Tasks',
  'Sample Data',
  'Lineage',
  'Search Index Settings',
  'Custom Properties',
];

export const CONTAINER_DEFAULT_TABS = [
  'Schema',
  'Children',
  'Activity Feeds & Tasks',
  'Lineage',
  'Custom Properties',
];

export const DATABASE_DEFAULT_TABS = [
  'Schemas',
  'Activity Feeds & Tasks',
  'Custom Properties',
];

export const DATABASE_SCHEMA_DEFAULT_TABS = [
  'Tables',
  'Stored Procedures',
  'Activity Feeds & Tasks',
  'Custom Properties',
];

export const STORED_PROCEDURE_DEFAULT_TABS = [
  'Code',
  'Activity Feeds & Tasks',
  'Lineage',
  'Custom Properties',
];

export const API_ENDPOINT_DEFAULT_TABS = [
  'Schema',
  'Activity Feeds & Tasks',
  'Lineage',
  'Custom Properties',
];

export const DASHBOARD_DATA_MODEL_DEFAULT_TABS = [
  'Model',
  'Activity Feeds & Tasks',
  'Lineage',
  'Custom Properties',
];

export const ML_MODEL_DEFAULT_TABS = [
  'Features',
  'Activity Feeds & Tasks',
  'Details',
  'Lineage',
  'Custom Properties',
];

export const DOMAIN_DEFAULT_TABS = [
  'Documentation',
  'Sub Domains',
  'Data Products',
  'Assets',
  'Custom Properties',
];

export const GLOSSARY_DEFAULT_TABS = ['Terms', 'Activity Feeds & Tasks'];

export const GLOSSARY_TERM_DEFAULT_TABS = [
  'Overview',
  'Glossary Terms',
  'Assets',
  'Activity Feeds & Tasks',
  'Custom Properties',
];
