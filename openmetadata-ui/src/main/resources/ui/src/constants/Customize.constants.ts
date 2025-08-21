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
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { PageType } from '../generated/system/ui/page';

export const TAB_LABEL_MAP: Record<EntityTabs, string> = {
  [EntityTabs.OVERVIEW]: 'label.overview',
  [EntityTabs.GLOSSARY_TERMS]: 'label.glossary-term-plural',
  [EntityTabs.ASSETS]: 'label.asset-plural',
  [EntityTabs.ACTIVITY_FEED]: 'label.activity-feed-and-task-plural',
  [EntityTabs.CUSTOM_PROPERTIES]: 'label.custom-property-plural',
  [EntityTabs.TERMS]: 'label.term-plural',
  [EntityTabs.SCHEMA]: 'label.schema',
  [EntityTabs.SAMPLE_DATA]: 'label.sample-data',
  [EntityTabs.TABLE_QUERIES]: 'label.query-plural',
  [EntityTabs.PROFILER]: 'label.data-observability',
  [EntityTabs.INCIDENTS]: 'label.incident-plural',
  [EntityTabs.LINEAGE]: 'label.lineage',
  [EntityTabs.KNOWLEDGE_GRAPH]: 'label.knowledge-graph',
  [EntityTabs.VIEW_DEFINITION]: 'label.view-definition',
  [EntityTabs.DBT]: 'label.dbt-lowercase',
  [EntityTabs.CHILDREN]: 'label.children',
  [EntityTabs.DETAILS]: 'label.detail-plural',
  [EntityTabs.SUBDOMAINS]: 'label.sub-domain-plural',
  [EntityTabs.DATA_PRODUCTS]: 'label.data-product-plural',
  [EntityTabs.DOCUMENTATION]: 'label.documentation',
  [EntityTabs.MODEL]: 'label.model',
  [EntityTabs.FEATURES]: 'label.feature-plural',
  [EntityTabs.TASKS]: 'label.task-plural',
  [EntityTabs.CONFIG]: 'label.config',
  [EntityTabs.EXECUTIONS]: 'label.execution-plural',
  [EntityTabs.TABLE]: 'label.table-plural',
  [EntityTabs.TEST_CASES]: 'label.test-case-plural',
  [EntityTabs.PIPELINE]: 'label.pipeline',
  [EntityTabs.DATA_Model]: 'label.data-model',
  [EntityTabs.AGENTS]: 'label.agent-plural',
  [EntityTabs.CONNECTION]: 'label.connection',
  [EntityTabs.SQL]: 'label.sql',
  [EntityTabs.FIELDS]: 'label.field-plural',
  [EntityTabs.SEARCH_INDEX_SETTINGS]: 'label.search-index-setting-plural',
  [EntityTabs.STORED_PROCEDURE]: 'label.stored-procedure-plural',
  [EntityTabs.CODE]: 'label.code',
  [EntityTabs.API_COLLECTION]: 'label.api-collection',
  [EntityTabs.API_ENDPOINT]: 'label.endpoint-plural',
  [EntityTabs.SCHEMA_DEFINITION]: 'label.schema-definition',
  [EntityTabs.EXPRESSION]: 'label.expression',
  [EntityTabs.DASHBOARD]: 'label.dashboard',
  [EntityTabs.INSIGHTS]: 'label.insight-plural',
  [EntityTabs.SCHEMAS]: 'label.schema-plural',
  [EntityTabs.CONTRACT]: 'label.contract',
  [EntityTabs.DIRECTORIES]: 'label.directory-plural',
} as const;

export type CustomizeEntityType =
  | EntityType.TABLE
  | EntityType.DASHBOARD
  | EntityType.DATABASE
  | EntityType.DATABASE_SCHEMA
  | EntityType.TOPIC
  | EntityType.PIPELINE
  | EntityType.STORED_PROCEDURE
  | EntityType.API_COLLECTION
  | EntityType.API_ENDPOINT
  | EntityType.SEARCH_INDEX
  | EntityType.MLMODEL
  | EntityType.DASHBOARD_DATA_MODEL
  | EntityType.DOMAIN
  | EntityType.GLOSSARY
  | EntityType.GLOSSARY_TERM
  | EntityType.CONTAINER
  | EntityType.METRIC
  | EntityType.CHART
  | EntityType.DIRECTORY;

export const ENTITY_PAGE_TYPE_MAP: Record<CustomizeEntityType, PageType> = {
  [EntityType.TABLE]: PageType.Table,
  [EntityType.DASHBOARD]: PageType.Dashboard,
  [EntityType.DATABASE]: PageType.Database,
  [EntityType.DATABASE_SCHEMA]: PageType.DatabaseSchema,
  [EntityType.TOPIC]: PageType.Topic,
  [EntityType.PIPELINE]: PageType.Pipeline,
  [EntityType.STORED_PROCEDURE]: PageType.StoredProcedure,
  [EntityType.API_COLLECTION]: PageType.APICollection,
  [EntityType.API_ENDPOINT]: PageType.APIEndpoint,
  [EntityType.SEARCH_INDEX]: PageType.SearchIndex,
  [EntityType.MLMODEL]: PageType.MlModel,
  [EntityType.DASHBOARD_DATA_MODEL]: PageType.DashboardDataModel,
  [EntityType.DOMAIN]: PageType.Domain,
  [EntityType.GLOSSARY]: PageType.Glossary,
  [EntityType.GLOSSARY_TERM]: PageType.GlossaryTerm,
  [EntityType.CONTAINER]: PageType.Container,
  [EntityType.METRIC]: PageType.Metric,
  [EntityType.CHART]: PageType.Chart,
  [EntityType.DIRECTORY]: PageType.Directory,
};
