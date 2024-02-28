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

export enum SearchIndex {
  ALL = 'all',
  DATA_ASSET = 'dataAsset',
  TABLE = 'table_search_index',
  TOPIC = 'topic_search_index',
  DASHBOARD = 'dashboard_search_index',
  PIPELINE = 'pipeline_search_index',
  USER = 'user_search_index',
  TEAM = 'team_search_index',
  GLOSSARY = 'glossary_search_index',
  GLOSSARY_TERM = 'glossary_term_search_index',
  MLMODEL = 'mlmodel_search_index',
  TAG = 'tag_search_index',
  CONTAINER = 'container_search_index',
  QUERY = 'query_search_index',
  TEST_CASE = 'test_case_search_index',
  TEST_SUITE = 'test_suite_search_index',
  DATABASE_SCHEMA = 'database_schema_search_index',
  DATABASE = 'database_search_index',
  DATABASE_SERVICE = 'database_service_search_index',
  MESSAGING_SERVICE = 'messaging_service_search_index',
  PIPELINE_SERVICE = 'pipeline_service_search_index',
  SEARCH_SERVICE = 'search_service_search_index',
  DASHBOARD_SERVICE = 'dashboard_service_search_index',
  ML_MODEL_SERVICE = 'mlmodel_service_search_index',
  STORAGE_SERVICE = 'storage_service_search_index',
  DOMAIN = 'domain_search_index',
  SEARCH_INDEX = 'search_entity_search_index',
  STORED_PROCEDURE = 'stored_procedure_search_index',
  DASHBOARD_DATA_MODEL = 'dashboard_data_model_search_index',
  DATA_PRODUCT = 'data_product_search_index',
  INGESTION_PIPELINE = 'ingestion_pipeline_search_index',
}
