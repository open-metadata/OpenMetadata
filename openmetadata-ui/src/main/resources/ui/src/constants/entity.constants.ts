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

import { t } from 'i18next';
import { startCase } from 'lodash';
import { EntityType } from '../enums/entity.enum';
import { FeedCounts } from '../interface/feed.interface';
import i18n from '../utils/i18next/LocalUtil';
import { EntityField } from './Feeds.constants';

export const FEED_COUNT_INITIAL_DATA: FeedCounts = {
  conversationCount: 0,
  totalTasksCount: 0,
  openTaskCount: 0,
  closedTaskCount: 0,
  totalCount: 0,
  mentionCount: 0,
};

export const STEPS_FOR_IMPORT_ENTITY = [
  {
    name: startCase(i18n.t('label.upload-csv-uppercase-file')),
    step: 1,
  },
  {
    name: startCase(i18n.t('label.preview-data')),
    step: 2,
  },
];

export const ENTITY_TASKS_TOOLTIP = {
  [EntityField.DESCRIPTION]: {
    request: i18n.t('message.request-description'),
    update: i18n.t('message.request-update-description'),
  },
  [EntityField.TAGS]: {
    request: i18n.t('label.request-tag-plural'),
    update: i18n.t('label.update-request-tag-plural'),
  },
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
  [EntityType.MLMODEL]: t('label.mlmodel'),
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
};
