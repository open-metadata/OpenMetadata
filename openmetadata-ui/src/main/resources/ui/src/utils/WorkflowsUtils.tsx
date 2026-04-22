/*
 *  Copyright 2026 Collate.
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
import { EntityType } from '../enums/entity.enum';

export enum EXTERNAL_ENTITY_TYPES {
  TEST_DEFINITION = 'testDefinition',
  WEB_ANALYTIC_EVENT = 'webAnalyticEvent',
  THREAD = 'thread',
  REPORT = 'report',
}

export const WORKFLOW_DATA_ASSETS_LIST = [
  EntityType.API_COLLECTION,
  EntityType.API_ENDPOINT,
  EntityType.CHART,
  EntityType.CONTAINER,
  EntityType.DASHBOARD,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.DATABASE,
  EntityType.DATABASE_SCHEMA,
  EntityType.MLMODEL,
  EntityType.PIPELINE,
  EntityType.SEARCH_INDEX,
  EntityType.STORED_PROCEDURE,
  EntityType.TABLE,
  EntityType.TOPIC,
  EntityType.GLOSSARY_TERM,
  EntityType.DATABASE_SERVICE,
  EntityType.DASHBOARD_SERVICE,
  EntityType.MESSAGING_SERVICE,
  EntityType.PIPELINE_SERVICE,
  EntityType.MLMODEL_SERVICE,
  EntityType.STORAGE_SERVICE,
  EntityType.SEARCH_SERVICE,
  EntityType.API_SERVICE,
  EntityType.METADATA_SERVICE,
  EntityType.DOMAIN,
  EntityType.DATA_PRODUCT,
  EntityType.GLOSSARY,
  EntityType.CLASSIFICATION,
  EntityType.TAG,
  EntityType.TEAM,
  EntityType.USER,
  EntityType.TEST_SUITE,
  EntityType.TEST_CASE,
  EntityType.QUERY,
  EXTERNAL_ENTITY_TYPES.REPORT,
  EntityType.METRIC,
  EntityType.DATA_INSIGHT_CHART,
  EntityType.DATA_CONTRACT,
  EntityType.KNOWLEDGE_PAGE,
];
