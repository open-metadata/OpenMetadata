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
import i18n from '../utils/i18next/LocalUtil';

export const PAGE_HEADERS = {
  ADVANCE_SEARCH: {
    header: i18n.t('label.advanced-search'),
    subHeader: i18n.t('message.page-sub-header-for-advanced-search'),
  },
  TABLE_PROFILE: {
    header: i18n.t('label.table-profile'),
    subHeader: i18n.t('message.page-sub-header-for-table-profile'),
  },
  DATA_QUALITY: {
    header: i18n.t('label.data-quality'),
    subHeader: i18n.t('message.page-sub-header-for-data-quality'),
  },
  COLUMN_PROFILE: {
    header: i18n.t('label.column-profile'),
    subHeader: i18n.t('message.page-sub-header-for-column-profile'),
  },
  ADMIN: {
    header: i18n.t('label.admin-plural'),
    subHeader: i18n.t('message.page-sub-header-for-admins'),
  },
  USERS: {
    header: i18n.t('label.user-plural'),
    subHeader: i18n.t('message.page-sub-header-for-users'),
  },
  ONLINE_USERS: {
    header: i18n.t('label.online-user-plural'),
    subHeader: i18n.t('message.page-sub-header-for-online-users'),
  },
  PERSONAS: {
    header: i18n.t('label.persona-plural'),
    subHeader: i18n.t('message.page-sub-header-for-persona'),
  },
  TEAMS: {
    header: i18n.t('label.team-plural'),
    subHeader: i18n.t('message.page-sub-header-for-teams'),
  },
  ROLES: {
    header: i18n.t('label.role-plural'),
    subHeader: i18n.t('message.page-sub-header-for-roles'),
  },
  POLICIES: {
    header: i18n.t('label.policy-plural'),
    subHeader: i18n.t('message.page-sub-header-for-policies'),
  },
  DATABASES_SERVICES: {
    header: i18n.t('label.database-plural'),
    subHeader: i18n.t('message.page-sub-header-for-databases'),
  },
  MESSAGING_SERVICES: {
    header: i18n.t('label.messaging'),
    subHeader: i18n.t('message.page-sub-header-for-messagings'),
  },
  DASHBOARD_SERVICES: {
    header: i18n.t('label.dashboard-plural'),
    subHeader: i18n.t('message.page-sub-header-for-dashboards'),
  },
  PIPELINES_SERVICES: {
    header: i18n.t('label.pipeline-plural'),
    subHeader: i18n.t('message.page-sub-header-for-pipelines'),
  },
  ML_MODELS_SERVICES: {
    header: i18n.t('label.ml-model-plural'),
    subHeader: i18n.t('message.page-sub-header-for-ml-models'),
  },
  METADATA_SERVICES: {
    header: i18n.t('label.metadata-plural'),
    subHeader: i18n.t('message.page-sub-header-for-metadata'),
  },
  STORAGE_SERVICES: {
    header: i18n.t('label.storage-plural'),
    subHeader: i18n.t('message.page-sub-header-for-storages'),
  },
  SEARCH_SERVICES: {
    header: i18n.t('label.search'),
    subHeader: i18n.t('message.page-sub-header-for-search'),
  },
  API_SERVICES: {
    header: i18n.t('label.api-uppercase-plural'),
    subHeader: i18n.t('message.page-sub-header-for-apis'),
  },
  SECURITY_SERVICES: {
    header: i18n.t('label.security'),
    subHeader: i18n.t('message.page-sub-header-for-security'),
  },
  ACTIVITY_FEED: {
    header: i18n.t('label.activity-feed'),
    subHeader: i18n.t('message.page-sub-header-for-activity-feed'),
  },
  TABLES_CUSTOM_ATTRIBUTES: {
    header: i18n.t('label.table-plural'),
    subHeader: i18n.t('message.define-custom-property-for-entity', {
      entity: i18n.t('label.table-plural'),
    }),
  },
  TOPICS_CUSTOM_ATTRIBUTES: {
    header: i18n.t('label.topic-plural'),
    subHeader: i18n.t('message.define-custom-property-for-entity', {
      entity: i18n.t('label.topic-plural'),
    }),
  },
  DASHBOARD_CUSTOM_ATTRIBUTES: {
    header: i18n.t('label.dashboard-plural'),
    subHeader: i18n.t('message.define-custom-property-for-entity', {
      entity: i18n.t('label.dashboard-plural'),
    }),
  },
  DASHBOARD_DATA_MODEL_CUSTOM_ATTRIBUTES: {
    header: i18n.t('label.dashboard-data-model-plural'),
    subHeader: i18n.t('message.define-custom-property-for-entity', {
      entity: i18n.t('label.dashboard-data-model-plural'),
    }),
  },
  DATA_PRODUCT_CUSTOM_ATTRIBUTES: {
    header: i18n.t('label.data-product-plural'),
    subHeader: i18n.t('message.define-custom-property-for-entity', {
      entity: i18n.t('label.data-product-plural'),
    }),
  },
  PIPELINES_CUSTOM_ATTRIBUTES: {
    header: i18n.t('label.pipeline-plural'),
    subHeader: i18n.t('message.define-custom-property-for-entity', {
      entity: i18n.t('label.pipeline-plural'),
    }),
  },
  ML_MODELS_CUSTOM_ATTRIBUTES: {
    header: i18n.t('label.ml-model-plural'),
    subHeader: i18n.t('message.define-custom-property-for-entity', {
      entity: i18n.t('label.ml-model-plural'),
    }),
  },
  CONTAINER_CUSTOM_ATTRIBUTES: {
    header: i18n.t('label.container-plural'),
    subHeader: i18n.t('message.define-custom-property-for-entity', {
      entity: i18n.t('label.container-plural'),
    }),
  },
  STORED_PROCEDURE_CUSTOM_ATTRIBUTES: {
    header: i18n.t('label.stored-procedure-plural'),
    subHeader: i18n.t('message.define-custom-property-for-entity', {
      entity: i18n.t('label.stored-procedure-plural'),
    }),
  },
  DOMAIN_CUSTOM_ATTRIBUTES: {
    header: i18n.t('label.domain-plural'),
    subHeader: i18n.t('message.define-custom-property-for-entity', {
      entity: i18n.t('label.domain-plural'),
    }),
  },
  SEARCH_INDEX_CUSTOM_ATTRIBUTES: {
    header: i18n.t('label.search-index-plural'),
    subHeader: i18n.t('message.define-custom-property-for-entity', {
      entity: i18n.t('label.search-index-plural'),
    }),
  },
  GLOSSARY_TERM_CUSTOM_ATTRIBUTES: {
    header: i18n.t('label.glossary-term'),
    subHeader: i18n.t('message.define-custom-property-for-entity', {
      entity: i18n.t('label.glossary-term'),
    }),
  },
  DATABASE_CUSTOM_ATTRIBUTES: {
    header: i18n.t('label.database'),
    subHeader: i18n.t('message.define-custom-property-for-entity', {
      entity: i18n.t('label.database'),
    }),
  },
  DATABASE_SCHEMA_CUSTOM_ATTRIBUTES: {
    header: i18n.t('label.database-schema'),
    subHeader: i18n.t('message.define-custom-property-for-entity', {
      entity: i18n.t('label.database-schema'),
    }),
  },
  BOTS: {
    header: i18n.t('label.bot-plural'),
    subHeader: i18n.t('message.page-sub-header-for-bots'),
  },
  APPLICATION: {
    header: i18n.t('label.extend-open-meta-data'),
    subHeader: i18n.t('message.application-to-improve-data'),
  },
  CUSTOM_PAGE: {
    header: i18n.t('label.customize-entity', {
      entity: i18n.t('label.landing-page'),
    }),
    subHeader: i18n.t('message.page-sub-header-for-customize-landing-page'),
  },
  INCIDENT_MANAGER: {
    header: i18n.t('label.incident-manager'),
    subHeader: i18n.t('message.page-sub-header-for-data-quality'),
  },
  SETTING: {
    header: i18n.t('label.setting-plural'),
    subHeader: i18n.t('message.page-sub-header-for-setting', {
      brandName: brandClassBase.getPageTitle(),
    }),
  },
  LOGIN_CONFIGURATION: {
    header: i18n.t('label.login'),
    subHeader: i18n.t('message.page-sub-header-for-login-configuration'),
  },
  SEARCH_RBAC: {
    header: i18n.t('label.search'),
    subHeader: i18n.t('message.page-sub-header-for-search-setting'),
  },
  SEARCH_SETTINGS: {
    header: i18n.t('label.search'),
    subHeader: i18n.t('message.page-sub-header-for-search-setting'),
  },
  LINEAGE_CONFIG: {
    header: i18n.t('label.lineage-config'),
    subHeader: i18n.t('message.page-sub-header-for-lineage-config-setting'),
  },
  OM_URL_CONFIG: {
    header: i18n.t('label.entity-configuration', {
      entity: i18n.t('label.open-metadata-url'),
    }),
    subHeader: i18n.t('message.om-url-configuration-message'),
  },
  OM_HEALTH: {
    header: i18n.t('label.health-check'),
    subHeader: i18n.t('message.page-sub-header-for-om-health-configuration'),
  },
  NOTIFICATION: {
    header: i18n.t('label.notification-plural'),
    subHeader: i18n.t('message.alerts-description'),
  },
  CUSTOM_METRICS: {
    header: i18n.t('label.custom-metric'),
    // Todo: need to update message once @harshach provides the message
    subHeader: '',
  },
  API_COLLECTION_CUSTOM_ATTRIBUTES: {
    header: i18n.t('label.api-collection-plural'),
    subHeader: i18n.t('message.define-custom-property-for-entity', {
      entity: i18n.t('label.api-collection-plural'),
    }),
  },
  API_ENDPOINT_CUSTOM_ATTRIBUTES: {
    header: i18n.t('label.api-endpoint-plural'),
    subHeader: i18n.t('message.define-custom-property-for-entity', {
      entity: i18n.t('label.api-endpoint-plural'),
    }),
  },
  METRIC_CUSTOM_ATTRIBUTES: {
    header: i18n.t('label.metric-plural'),
    subHeader: i18n.t('message.define-custom-property-for-entity', {
      entity: i18n.t('label.metric-plural'),
    }),
  },
  PLATFORM_LINEAGE: {
    header: i18n.t('label.lineage'),
    subHeader: i18n.t('message.page-sub-header-for-platform-lineage'),
  },
};
