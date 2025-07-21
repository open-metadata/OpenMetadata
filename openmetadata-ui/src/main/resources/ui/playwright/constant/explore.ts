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
    key: 'storedProcedure',
    label: 'stored procedures',
    indexType: 'stored_procedure_search_index',
  },
  {
    key: 'database',
    label: 'databases',
    indexType: 'database_search_index',
  },
  {
    key: 'databaseSchema',
    label: 'database schemas',
    indexType: 'database_schema_search_index',
  },
  {
    key: 'dashboard',
    label: 'dashboards',
    indexType: 'dashboard_search_index',
  },
  {
    key: 'dashboardDataModel',
    label: 'dashboard data models',
    indexType: 'dashboard_data_model_search_index',
  },
  {
    key: 'pipeline',
    label: 'pipelines',
    indexType: 'pipeline_search_index',
  },
  {
    key: 'topic',
    label: 'topics',
    indexType: 'topic_search_index',
  },
  {
    key: 'mlmodel',
    label: 'ml models',
    indexType: 'mlmodel_search_index',
  },
  {
    key: 'container',
    label: 'containers',
    indexType: 'container_search_index',
  },
  {
    key: 'searchIndex',
    label: 'search indexes',
    indexType: 'search_entity_search_index',
  },
  {
    key: 'glossaryTerm',
    label: 'glossary terms',
    indexType: 'glossary_term_search_index',
  },
  {
    key: 'tag',
    label: 'tags',
    indexType: 'tag_search_index',
  },
  {
    key: 'dataProduct',
    label: 'data products',
    indexType: 'data_product_search_index',
  },
  {
    key: 'apiCollection',
    label: 'api collections',
    indexType: 'api_collection_search_index',
  },
  {
    key: 'apiEndpoint',
    label: 'api endpoints',
    indexType: 'api_endpoint_search_index',
  },
  {
    key: 'table',
    label: 'tables',
    indexType: 'table_search_index',
  },
];
