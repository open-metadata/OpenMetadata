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

import brandClassBase from '../utils/BrandData/BrandClassBase';

export const PAGE_HEADERS = {
  ADVANCE_SEARCH: {
    header: 'label.advanced-search',
    subHeader: 'message.page-sub-header-for-advanced-search',
  },
  TABLE_PROFILE: {
    header: 'label.table-profile',
    subHeader: 'message.page-sub-header-for-table-profile',
  },
  DATA_QUALITY: {
    header: 'label.data-quality',
    subHeader: 'message.page-sub-header-for-data-quality',
  },
  COLUMN_PROFILE: {
    header: 'label.column-profile',
    subHeader: 'message.page-sub-header-for-column-profile',
  },
  ADMIN: {
    header: 'label.admin-plural',
    subHeader: 'message.page-sub-header-for-admins',
  },
  USERS: {
    header: 'label.user-plural',
    subHeader: 'message.page-sub-header-for-users',
  },
  ONLINE_USERS: {
    header: 'label.online-user-plural',
    subHeader: 'message.page-sub-header-for-online-users',
  },
  PERSONAS: {
    header: 'label.persona-plural',
    subHeader: 'message.page-sub-header-for-persona',
  },
  TEAMS: {
    header: 'label.team-plural',
    subHeader: 'message.page-sub-header-for-teams',
  },
  ROLES: {
    header: 'label.role-plural',
    subHeader: 'message.page-sub-header-for-roles',
  },
  POLICIES: {
    header: 'label.policy-plural',
    subHeader: 'message.page-sub-header-for-policies',
  },
  AUDIT_LOGS: {
    header: 'label.audit-log-plural',
    subHeader: 'message.page-sub-header-for-audit-logs',
  },
  DATABASES_SERVICES: {
    header: 'label.database-plural',
    subHeader: 'message.page-sub-header-for-databases',
  },
  MESSAGING_SERVICES: {
    header: 'label.messaging',
    subHeader: 'message.page-sub-header-for-messagings',
  },
  DASHBOARD_SERVICES: {
    header: 'label.dashboard-plural',
    subHeader: 'message.page-sub-header-for-dashboards',
  },
  PIPELINES_SERVICES: {
    header: 'label.pipeline-plural',
    subHeader: 'message.page-sub-header-for-pipelines',
  },
  ML_MODELS_SERVICES: {
    header: 'label.ml-model-plural',
    subHeader: 'message.page-sub-header-for-ml-models',
  },
  METADATA_SERVICES: {
    header: 'label.metadata-plural',
    subHeader: 'message.page-sub-header-for-metadata',
  },
  STORAGE_SERVICES: {
    header: 'label.storage-plural',
    subHeader: 'message.page-sub-header-for-storages',
  },
  SEARCH_SERVICES: {
    header: 'label.search',
    subHeader: 'message.page-sub-header-for-search',
  },
  API_SERVICES: {
    header: 'label.api-uppercase-plural',
    subHeader: 'message.page-sub-header-for-apis',
  },
  SECURITY_SERVICES: {
    header: 'label.security',
    subHeader: 'message.page-sub-header-for-security',
  },
  DRIVE_SERVICES: {
    header: 'label.drive',
    subHeader: 'message.page-sub-header-for-drive',
  },
  ACTIVITY_FEED: {
    header: 'label.activity-feed',
    subHeader: 'message.page-sub-header-for-activity-feed',
  },
  TABLES_CUSTOM_ATTRIBUTES: {
    header: 'label.table-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.table-plural' },
  },
  COLUMN_CUSTOM_ATTRIBUTES: {
    header: 'label.column-profile',
    subHeader: 'message.define-custom-property-for-column',
  },
  TOPICS_CUSTOM_ATTRIBUTES: {
    header: 'label.topic-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.topic-plural' },
  },
  DASHBOARD_CUSTOM_ATTRIBUTES: {
    header: 'label.dashboard-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.dashboard-plural' },
  },
  DASHBOARD_DATA_MODEL_CUSTOM_ATTRIBUTES: {
    header: 'label.dashboard-data-model-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.dashboard-data-model-plural' },
  },
  DATA_PRODUCT_CUSTOM_ATTRIBUTES: {
    header: 'label.data-product-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.data-product-plural' },
  },
  PIPELINES_CUSTOM_ATTRIBUTES: {
    header: 'label.pipeline-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.pipeline-plural' },
  },
  ML_MODELS_CUSTOM_ATTRIBUTES: {
    header: 'label.ml-model-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.ml-model-plural' },
  },
  CONTAINER_CUSTOM_ATTRIBUTES: {
    header: 'label.container-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.container-plural' },
  },
  STORED_PROCEDURE_CUSTOM_ATTRIBUTES: {
    header: 'label.stored-procedure-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.stored-procedure-plural' },
  },
  DOMAIN_CUSTOM_ATTRIBUTES: {
    header: 'label.domain-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.domain-plural' },
  },
  SEARCH_INDEX_CUSTOM_ATTRIBUTES: {
    header: 'label.search-index-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.search-index-plural' },
  },
  GLOSSARY_TERM_CUSTOM_ATTRIBUTES: {
    header: 'label.glossary-term',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.glossary-term' },
  },
  DATABASE_CUSTOM_ATTRIBUTES: {
    header: 'label.database',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.database' },
  },
  DATABASE_SCHEMA_CUSTOM_ATTRIBUTES: {
    header: 'label.database-schema',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.database-schema' },
  },
  BOTS: {
    header: 'label.bot-plural',
    subHeader: 'message.page-sub-header-for-bots',
  },
  APPLICATION: {
    header: 'label.extend-open-meta-data',
    headerParams: { brandName: brandClassBase.getPageTitle() },
    subHeader: 'message.application-to-improve-data',
  },
  CUSTOM_PAGE: {
    header: 'label.customize-entity',
    headerParams: { entity: 'label.landing-page' },
    subHeader: 'message.page-sub-header-for-customize-landing-page',
    subHeaderParams: { brandName: brandClassBase.getPageTitle() },
  },
  INCIDENT_MANAGER: {
    header: 'label.incident-manager',
    subHeader: 'message.page-sub-header-for-data-quality',
  },
  SETTING: {
    header: 'label.setting-plural',
    subHeader: 'message.page-sub-header-for-setting',
    subHeaderParams: { brandName: brandClassBase.getPageTitle() },
  },
  LOGIN_CONFIGURATION: {
    header: 'label.login',
    subHeader: 'message.page-sub-header-for-login-configuration',
  },
  SEARCH_RBAC: {
    header: 'label.search',
    subHeader: 'message.page-sub-header-for-search-setting',
  },
  SEARCH_SETTINGS: {
    header: 'label.search',
    subHeader: 'message.page-sub-header-for-search-setting',
  },
  LINEAGE_CONFIG: {
    header: 'label.lineage-config',
    subHeader: 'message.page-sub-header-for-lineage-config-setting',
  },
  OM_URL_CONFIG: {
    header: 'label.entity-configuration',
    headerParams: { entity: 'label.open-metadata-url' },
    subHeader: 'message.om-url-configuration-message',
    subHeaderParams: { brandName: brandClassBase.getPageTitle() },
  },
  OM_HEALTH: {
    header: 'label.health-check',
    subHeader: 'message.page-sub-header-for-om-health-configuration',
  },
  NOTIFICATION: {
    header: 'label.notification-plural',
    subHeader: 'message.alerts-description',
  },
  CUSTOM_METRICS: {
    header: 'label.custom-metric',
    subHeader: '',
  },
  API_COLLECTION_CUSTOM_ATTRIBUTES: {
    header: 'label.api-collection-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.api-collection-plural' },
  },
  API_ENDPOINT_CUSTOM_ATTRIBUTES: {
    header: 'label.api-endpoint-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.api-endpoint-plural' },
  },
  METRIC_CUSTOM_ATTRIBUTES: {
    header: 'label.metric-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.metric-plural' },
  },
  CHARTS_CUSTOM_ATTRIBUTES: {
    header: 'label.chart-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.chart-plural' },
  },
  PLATFORM_LINEAGE: {
    header: 'label.lineage',
    subHeader: 'message.page-sub-header-for-platform-lineage',
  },
  DIRECTORY_CUSTOM_ATTRIBUTES: {
    header: 'label.directory-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.directory-plural' },
  },
  FILE_CUSTOM_ATTRIBUTES: {
    header: 'label.file-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.file-plural' },
  },
  SPREADSHEET_CUSTOM_ATTRIBUTES: {
    header: 'label.spreadsheet-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.spreadsheet-plural' },
  },
  WORKSHEET_CUSTOM_ATTRIBUTES: {
    header: 'label.worksheet-plural',
    subHeader: 'message.define-custom-property-for-entity',
    subHeaderParams: { entity: 'label.worksheet-plural' },
  },
};
