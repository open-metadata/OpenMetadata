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
import { EntityTabs } from '../enums/entity.enum';

export const TAB_LABEL_MAP: Record<EntityTabs, string> = {
  [EntityTabs.OVERVIEW]: 'label.overview',
  [EntityTabs.GLOSSARY_TERMS]: 'label.glossary-terms',
  [EntityTabs.ASSETS]: 'label.asset-plural',
  [EntityTabs.ACTIVITY_FEED]: 'label.activity-feed-and-task-plural',
  [EntityTabs.CUSTOM_PROPERTIES]: 'label.custom-property-plural',
  [EntityTabs.TERMS]: 'label.terms',
  [EntityTabs.SCHEMA]: 'label.schema',
  [EntityTabs.SAMPLE_DATA]: 'label.sample-data',
  [EntityTabs.TABLE_QUERIES]: 'label.query-plural',
  [EntityTabs.PROFILER]: 'label.data-observability',
  [EntityTabs.INCIDENTS]: 'label.incident-plural',
  [EntityTabs.LINEAGE]: 'label.lineage',
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
  [EntityTabs.TABLE]: 'label.table',
  [EntityTabs.TEST_CASES]: 'label.test-case-plural',
  [EntityTabs.PIPELINE]: 'label.pipeline',
  [EntityTabs.DATA_Model]: 'label.data-model',
  [EntityTabs.INGESTIONS]: 'label.ingestion-plural',
  [EntityTabs.CONNECTION]: 'label.connection',
  [EntityTabs.SQL]: 'label.sql',
  [EntityTabs.FIELDS]: 'label.field-plural',
  [EntityTabs.SEARCH_INDEX_SETTINGS]: 'label.search-index-settings',
  [EntityTabs.STORED_PROCEDURE]: 'label.stored-procedure',
  [EntityTabs.CODE]: 'label.code',
  [EntityTabs.API_COLLECTION]: 'label.api-collection',
  [EntityTabs.API_ENDPOINT]: 'label.api-endpoint',
  [EntityTabs.SCHEMA_DEFINITION]: 'label.schema-definition',
  [EntityTabs.EXPRESSION]: 'label.expression',
  [EntityTabs.DASHBOARD]: 'label.dashboard',
  [EntityTabs.INSIGHTS]: 'label.insight-plural',
} as const;
