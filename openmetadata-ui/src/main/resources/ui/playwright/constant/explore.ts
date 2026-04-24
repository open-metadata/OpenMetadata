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
import { EntityTypeEndpoint } from '../support/entity/Entity.interface';

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
  [EntityTypeEndpoint.Table]: 'Table',
  [EntityTypeEndpoint.Database]: 'Database',
  [EntityTypeEndpoint.Topic]: 'Topic',
  [EntityTypeEndpoint.Dashboard]: 'Dashboard',
  [EntityTypeEndpoint.Pipeline]: 'Pipeline',
  [EntityTypeEndpoint.SearchIndex]: 'Search Index',
  [EntityTypeEndpoint.MlModel]: 'ML Model',
  [EntityTypeEndpoint.Container]: 'Container',
  [EntityTypeEndpoint.StoreProcedure]: 'Stored Procedure',
  [EntityTypeEndpoint.API_ENDPOINT]: 'API Endpoint',
  [EntityTypeEndpoint.API_COLLECTION]: 'API Collection',
  [EntityTypeEndpoint.DatabaseSchema]: 'Database Schema',
  [EntityTypeEndpoint.DataModel]: 'Data Model',
  [EntityTypeEndpoint.DATA_PRODUCT]: 'Data Product',
  [EntityTypeEndpoint.GlossaryTerm]: 'Glossary',
  [EntityTypeEndpoint.Tag]: 'Tag',
};

export const ENDPOINT_TO_EXPLORE_TAB_MAP: Record<string, string> = {
  [EntityTypeEndpoint.Table]: 'Tables',
  [EntityTypeEndpoint.Database]: 'Databases',
  [EntityTypeEndpoint.Topic]: 'Topics',
  [EntityTypeEndpoint.Dashboard]: 'Dashboards',
  [EntityTypeEndpoint.Pipeline]: 'Pipelines',
  [EntityTypeEndpoint.SearchIndex]: 'Search Indexes',
  [EntityTypeEndpoint.MlModel]: 'ML Models',
  [EntityTypeEndpoint.Container]: 'Containers',
  [EntityTypeEndpoint.StoreProcedure]: 'Stored Procedures',
  [EntityTypeEndpoint.API_ENDPOINT]: 'API Endpoints',
  [EntityTypeEndpoint.API_COLLECTION]: 'API Collections',
  [EntityTypeEndpoint.DatabaseSchema]: 'Database Schemas',
  [EntityTypeEndpoint.DataModel]: 'Dashboard Data Models',
  [EntityTypeEndpoint.DATA_PRODUCT]: 'Data Products',
  [EntityTypeEndpoint.GlossaryTerm]: 'Glossary Terms',
  [EntityTypeEndpoint.Tag]: 'Tags',
};
