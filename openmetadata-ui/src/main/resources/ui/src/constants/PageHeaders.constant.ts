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
  CUSTOM_PAGE: {
    header: i18n.t('label.customize-landing-page'),
    subHeader: i18n.t('message.page-sub-header-for-customize-landing-page'),
  },
};
