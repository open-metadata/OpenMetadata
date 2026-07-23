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

import { startCase } from 'lodash';
import { DEFAULT_DOMAIN_VALUE } from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import type { EntityReference } from '../generated/type/entityUsage';
import i18n from './i18next/LocalUtil';

const { t } = i18n;

/**
 * Take entity reference as input and return name for entity
 * @param entity - entity reference
 * @returns - entity name
 */
export const getEntityName = (entity?: {
  name?: string;
  displayName?: string;
}) => {
  return entity?.displayName || entity?.name || '';
};

export const getDomainDisplayName = (
  activeDomainEntityRef?: EntityReference,
  activeDomain?: string
) => {
  if (activeDomainEntityRef) {
    return getEntityName(activeDomainEntityRef);
  }

  return activeDomain === DEFAULT_DOMAIN_VALUE
    ? t('label.all-domain-plural')
    : activeDomain;
};

export const getEntityNameLabel = (entityName?: string) => {
  const entityNameLabels = {
    table: t('label.table'),
    topic: t('label.topic'),
    pipeline: t('label.pipeline'),
    container: t('label.container'),
    dashboard: t('label.dashboard'),
    testCase: t('label.test-case'),
    testSuite: t('label.test-suite'),
    dataContract: t('label.data-contract'),
    ingestionPipeline: t('label.ingestion-pipeline'),
    all: t('label.all'),
    announcement: t('label.announcement'),
    chart: t('label.chart'),
    conversation: t('label.conversation'),
    dashboardDataModel: t('label.data-model'),
    databaseSchema: t('label.database-schema'),
    databaseService: t('label.entity-service', {
      entity: t('label.database'),
    }),
    dashboardService: t('label.entity-service', {
      entity: t('label.dashboard'),
    }),
    messagingService: t('label.entity-service', {
      entity: t('label.messaging'),
    }),
    mlmodelService: t('label.entity-service', {
      entity: t('label.ml-model'),
    }),
    pipelineService: t('label.entity-service', {
      entity: t('label.pipeline'),
    }),
    storageService: t('label.entity-service', {
      entity: t('label.storage'),
    }),
    searchService: t('label.entity-service', { entity: t('label.search') }),
    metadataService: t('label.entity-service', {
      entity: t('label.metadata'),
    }),
    driveService: t('label.entity-service', {
      entity: t('label.drive'),
    }),
    glossary: t('label.glossary'),
    glossaryTerm: t('label.glossary-term'),
    tag: t('label.tag'),
    tagCategory: t('label.classification'),
    user: t('label.user'),
    domain: t('label.domain'),
    dataProduct: t('label.data-product'),
    storedProcedure: t('label.stored-procedure'),
    searchIndex: t('label.search-index'),
    task: t('label.task'),
    mlmodel: t('label.ml-model'),
    location: t('label.location'),
    database: t('label.database'),
    alert: t('label.alert-plural'),
    query: t('label.query'),
    THREAD: t('label.thread'),
    app: t('label.application'),
    apiCollection: t('label.api-collection'),
    apiEndpoint: t('label.api-endpoint'),
    metric: t('label.metric'),
    page: t('label.knowledge-page'),
    directory: t('label.directory'),
    file: t('label.file'),
    spreadsheet: t('label.spreadsheet'),
    worksheet: t('label.worksheet'),
    tableColumn: t('label.column'),
  };

  return (
    entityNameLabels[entityName as keyof typeof entityNameLabels] ||
    startCase(entityName)
  );
};

export const getPluralizeEntityName = (entityType?: string) => {
  const entityNameLabels = {
    [EntityType.TABLE]: t('label.table-plural'),
    [EntityType.TABLE_COLUMN]: t('label.column-plural'),
    [EntityType.TOPIC]: t('label.topic-plural'),
    [EntityType.PIPELINE]: t('label.pipeline-plural'),
    [EntityType.CONTAINER]: t('label.container-plural'),
    [EntityType.DASHBOARD]: t('label.dashboard-plural'),
    [EntityType.CHART]: t('label.chart-plural'),
    [EntityType.STORED_PROCEDURE]: t('label.stored-procedure-plural'),
    [EntityType.MLMODEL]: t('label.ml-model-plural'),
    [EntityType.DASHBOARD_DATA_MODEL]: t('label.data-model-plural'),
    [EntityType.SEARCH_INDEX]: t('label.search-index-plural'),
    [EntityType.API_COLLECTION]: t('label.api-collection-plural'),
    [EntityType.API_ENDPOINT]: t('label.api-endpoint-plural'),
    [EntityType.METRIC]: t('label.metric-plural'),
    [EntityType.DIRECTORY]: t('label.directory-plural'),
    [EntityType.FILE]: t('label.file-plural'),
    [EntityType.SPREADSHEET]: t('label.spreadsheet-plural'),
    [EntityType.WORKSHEET]: t('label.worksheet-plural'),
  };

  return (
    entityNameLabels[entityType as keyof typeof entityNameLabels] ||
    getEntityNameLabel(entityType)
  );
};

export const EntityTypeName: Record<EntityType, string> = {
  [EntityType.API_SERVICE]: t('label.api-service'),
  [EntityType.DATABASE_SERVICE]: t('label.database-service'),
  [EntityType.MESSAGING_SERVICE]: t('label.messaging-service'),
  [EntityType.PIPELINE_SERVICE]: t('label.pipeline-service'),
  [EntityType.MLMODEL_SERVICE]: t('label.mlmodel-service'),
  [EntityType.DASHBOARD_SERVICE]: t('label.dashboard-service'),
  [EntityType.STORAGE_SERVICE]: t('label.storage-service'),
  [EntityType.SEARCH_SERVICE]: t('label.search-service'),
  [EntityType.DRIVE_SERVICE]: t('label.entity-service', {
    entity: t('label.drive'),
  }),
  [EntityType.METRIC]: t('label.metric'),
  [EntityType.CONTAINER]: t('label.container'),
  [EntityType.DASHBOARD_DATA_MODEL]: t('label.dashboard-data-model'),
  [EntityType.TABLE]: t('label.table'),
  [EntityType.GLOSSARY_TERM]: t('label.glossary-term'),
  [EntityType.PAGE]: t('label.page'),
  [EntityType.DATABASE_SCHEMA]: t('label.database-schema'),
  [EntityType.CHART]: t('label.chart'),
  [EntityType.STORED_PROCEDURE]: t('label.stored-procedure'),
  [EntityType.DATABASE]: t('label.database'),
  [EntityType.PIPELINE]: t('label.pipeline'),
  [EntityType.TAG]: t('label.tag'),
  [EntityType.DASHBOARD]: t('label.dashboard'),
  [EntityType.API_ENDPOINT]: t('label.api-endpoint'),
  [EntityType.TOPIC]: t('label.topic'),
  [EntityType.DATA_PRODUCT]: t('label.data-product'),
  [EntityType.MLMODEL]: t('label.ml-model'),
  [EntityType.SEARCH_INDEX]: t('label.search-index'),
  [EntityType.API_COLLECTION]: t('label.api-collection'),
  [EntityType.TEST_SUITE]: t('label.test-suite'),
  [EntityType.TEAM]: t('label.team'),
  [EntityType.TEST_CASE]: t('label.test-case'),
  [EntityType.DOMAIN]: t('label.domain'),
  [EntityType.PERSONA]: t('label.persona'),
  [EntityType.POLICY]: t('label.policy'),
  [EntityType.ROLE]: t('label.role'),
  [EntityType.APPLICATION]: t('label.application'),
  [EntityType.CLASSIFICATION]: t('label.classification'),
  [EntityType.GLOSSARY]: t('label.glossary'),
  [EntityType.METADATA_SERVICE]: t('label.metadata-service'),
  [EntityType.WEBHOOK]: t('label.webhook'),
  [EntityType.TYPE]: t('label.type'),
  [EntityType.USER]: t('label.user'),
  [EntityType.BOT]: t('label.bot'),
  [EntityType.DATA_INSIGHT_CHART]: t('label.data-insight-chart'),
  [EntityType.KPI]: t('label.kpi'),
  [EntityType.ALERT]: t('label.alert'),
  [EntityType.SUBSCRIPTION]: t('label.subscription'),
  [EntityType.SAMPLE_DATA]: t('label.sample-data'),
  [EntityType.APP_MARKET_PLACE_DEFINITION]: t(
    'label.app-market-place-definition'
  ),
  [EntityType.DOC_STORE]: t('label.doc-store'),
  [EntityType.KNOWLEDGE_PAGE]: t('label.knowledge-page'),
  [EntityType.knowledgePanels]: t('label.knowledge-panels'),
  [EntityType.GOVERN]: t('label.govern'),
  [EntityType.ALL]: t('label.all'),
  [EntityType.CUSTOM_METRIC]: t('label.custom-metric'),
  [EntityType.INGESTION_PIPELINE]: t('label.ingestion-pipeline'),
  [EntityType.QUERY]: t('label.query'),
  [EntityType.ENTITY_REPORT_DATA]: t('label.entity-report-data'),
  [EntityType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA]: t(
    'label.web-analytic-entity-view-report-data'
  ),
  [EntityType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA]: t(
    'label.web-analytic-user-activity-report-data'
  ),
  [EntityType.TEST_CASE_RESOLUTION_STATUS]: t(
    'label.test-case-resolution-status'
  ),
  [EntityType.TEST_CASE_RESULT]: t('label.test-case-result'),
  [EntityType.EVENT_SUBSCRIPTION]: t('label.event-subscription'),
  [EntityType.LINEAGE_EDGE]: t('label.lineage-edge'),
  [EntityType.WORKFLOW_DEFINITION]: t('label.workflow-definition'),
  [EntityType.SERVICE]: t('label.service'),
  [EntityType.DATA_CONTRACT]: t('label.data-contract'),
  [EntityType.SECURITY_SERVICE]: t('label.security-service'),
  [EntityType.INGESTION_RUNNER]: t('label.ingestion-runner'),
  [EntityType.DIRECTORY]: t('label.directory'),
  [EntityType.FILE]: t('label.file'),
  [EntityType.SPREADSHEET]: t('label.spreadsheet'),
  [EntityType.WORKSHEET]: t('label.worksheet'),
  [EntityType.NOTIFICATION_TEMPLATE]: t('label.notification-template'),
  [EntityType.TABLE_COLUMN]: t('label.column'),
  [EntityType.KNOWLEDGE_CENTER]: t('label.knowledge-center'),
};
