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

import { EntityType } from './entity.enum';

export enum SearchIndex {
  ALL = 'all',
  DATA_ASSET = 'dataAsset',
  TABLE = 'table_search_index',
  TOPIC = 'topic_search_index',
  DASHBOARD = 'dashboard_search_index',
  PIPELINE = 'pipeline_search_index',
  USER = 'user_search_index',
  TEAM = 'team_search_index',
  GLOSSARY = 'glossary_term_search_index',
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
}

export const ENTITY_TO_SEARCH_INDEX_MAP: Record<string, SearchIndex> =
  Object.freeze({
    [EntityType.TABLE]: SearchIndex.TABLE,
    [EntityType.TOPIC]: SearchIndex.TOPIC,
    [EntityType.DASHBOARD]: SearchIndex.DASHBOARD,
    [EntityType.PIPELINE]: SearchIndex.PIPELINE,
    [EntityType.USER]: SearchIndex.USER,
    [EntityType.TEAM]: SearchIndex.TEAM,
    [EntityType.GLOSSARY_TERM]: SearchIndex.GLOSSARY,
    [EntityType.MLMODEL]: SearchIndex.MLMODEL,
    [EntityType.TAG]: SearchIndex.TAG,
    [EntityType.CONTAINER]: SearchIndex.CONTAINER,
    [EntityType.TEST_CASE]: SearchIndex.TEST_CASE,
    [EntityType.TEST_SUITE]: SearchIndex.TEST_SUITE,
    [EntityType.DATABASE_SCHEMA]: SearchIndex.DATABASE_SCHEMA,
    [EntityType.DATABASE]: SearchIndex.DATABASE,
    [EntityType.DATABASE_SERVICE]: SearchIndex.DATABASE_SERVICE,
    [EntityType.MESSAGING_SERVICE]: SearchIndex.MESSAGING_SERVICE,
    [EntityType.PIPELINE_SERVICE]: SearchIndex.PIPELINE_SERVICE,
    [EntityType.SEARCH_SERVICE]: SearchIndex.SEARCH_SERVICE,
    [EntityType.DASHBOARD_SERVICE]: SearchIndex.DASHBOARD_SERVICE,
    [EntityType.MLMODEL_SERVICE]: SearchIndex.ML_MODEL_SERVICE,
    [EntityType.STORAGE_SERVICE]: SearchIndex.STORAGE_SERVICE,
    [EntityType.DOMAIN]: SearchIndex.DOMAIN,
    [EntityType.SEARCH_INDEX]: SearchIndex.SEARCH_INDEX,
    [EntityType.STORED_PROCEDURE]: SearchIndex.STORED_PROCEDURE,
    [EntityType.DASHBOARD_DATA_MODEL]: SearchIndex.DASHBOARD_DATA_MODEL,
    [EntityType.DATA_PRODUCT]: SearchIndex.DATA_PRODUCT,
    [EntityType.GLOSSARY]: SearchIndex.GLOSSARY,
    [EntityType.ALL]: SearchIndex.ALL,
  });
