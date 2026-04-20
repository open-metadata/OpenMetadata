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
export const EXPECTED_BUCKETS = [
  'table',
  'tableColumn',
  'glossaryTerm',
  'databaseSchema',
  'chart',
  'storedProcedure',
  'database',
  'pipeline',
  'dashboard',
  'container',
  'tag',
  'dashboardDataModel',
  'apiEndpoint',
  'topic',
  'apiCollection',
  'searchIndex',
  'mlmodel',
];

export const DATA_ASSETS = [
  {
    key: 'table',
    label: 'tables',
    indexType: 'table',
  },
  {
    key: 'storedProcedure',
    label: 'stored procedures',
    indexType: 'storedProcedure',
  },
  {
    key: 'database',
    label: 'databases',
    indexType: 'database',
  },
  {
    key: 'databaseSchema',
    label: 'database schemas',
    indexType: 'databaseSchema',
  },
  {
    key: 'dashboard',
    label: 'dashboards',
    indexType: 'dashboard',
  },
  {
    key: 'dashboardDataModel',
    label: 'dashboard data models',
    indexType: 'dashboardDataModel',
  },
  {
    key: 'pipeline',
    label: 'pipelines',
    indexType: 'pipeline',
  },
  {
    key: 'topic',
    label: 'topics',
    indexType: 'topic',
  },
  {
    key: 'mlmodel',
    label: 'ml models',
    indexType: 'mlmodel',
  },
  {
    key: 'container',
    label: 'containers',
    indexType: 'container',
  },
  {
    key: 'searchIndex',
    label: 'search indexes',
    indexType: 'searchIndex',
  },
  {
    key: 'glossaryTerm',
    label: 'glossary terms',
    indexType: 'glossaryTerm',
  },
  {
    key: 'tag',
    label: 'tags',
    indexType: 'tag',
  },
  {
    key: 'dataProduct',
    label: 'data products',
    indexType: 'dataProduct',
  },
  {
    key: 'apiCollection',
    label: 'api collections',
    indexType: 'apiCollection',
  },
  {
    key: 'apiEndpoint',
    label: 'api endpoints',
    indexType: 'apiEndpoint',
  },
  {
    key: 'directory',
    label: 'directories',
    indexType: 'directory',
  },
  {
    key: 'file',
    label: 'files',
    indexType: 'file',
  },
  {
    key: 'spreadsheet',
    label: 'spreadsheets',
    indexType: 'spreadsheet',
  },
  {
    key: 'worksheet',
    label: 'worksheets',
    indexType: 'worksheet',
  },
];

export const DATA_ASSETS_SORT = [
  { name: 'Table', filter: 'table' },
  { name: 'Column', filter: 'tableColumn' },
  { name: 'Database', filter: 'database' },
  { name: 'Database Schema', filter: 'databaseSchema' },
  { name: 'Dashboard', filter: 'dashboard' },
  { name: 'Dashboard Data Model', filter: 'dashboardDataModel' },
  { name: 'Pipeline', filter: 'pipeline' },
  { name: 'Topic', filter: 'topic' },
  { name: 'ML Model', filter: 'mlmodel' },
  { name: 'Container', filter: 'container' },
  { name: 'Search Index', filter: 'searchIndex' },
  { name: 'API Endpoint', filter: 'apiEndpoint' },
  { name: 'API Collection', filter: 'apiCollection' },
  { name: 'Stored Procedure', filter: 'storedProcedure' },
  { name: 'Glossary Term', filter: 'glossaryTerm' },
  { name: 'Tags', filter: 'tag' },
  { name: 'Metrics', filter: 'metric' },
];
export const ENDPOINT_TO_FILTER_MAP: Record<string, string> = {
  tables: 'Table',
  databases: 'Database',
  topics: 'Topic',
  dashboards: 'Dashboard',
  pipelines: 'Pipeline',
  searchIndexes: 'Search Index',
  mlmodels: 'ML Model',
  containers: 'Container',
  glossaryTerms: 'Glossary Term',
  tags: 'Tag',
  dataProducts: 'Data Product',
};
