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
import { isUndefined } from 'lodash';
import Qs from 'qs';
import { CSSProperties } from 'react';
import { COOKIE_VERSION } from '../components/Modals/WhatsNewModal/whatsNewData';
import { EntityTabs } from '../enums/entity.enum';
import { getPartialNameFromFQN } from '../utils/CommonUtils';
import i18n from '../utils/i18next/LocalUtil';
import { getSettingPath } from '../utils/RouterUtils';
import { getEncodedFqn } from '../utils/StringsUtils';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from './GlobalSettings.constants';

export const PRIMERY_COLOR = '#0968da';
export const SECONDARY_COLOR = '#B02AAC';
export const INFO_COLOR = '#2196f3';
export const ERROR_COLOR = '#ff4c3b';
export const LITE_GRAY_COLOR = '#DBE0EB';
export const TEXT_BODY_COLOR = '#37352F';
export const TEXT_GREY_MUTED = '#757575';
export const SUCCESS_COLOR = '#008376';
export const DE_ACTIVE_COLOR = '#6B7280';
export const GRAPH_BACKGROUND_COLOR = '#f5f5f5';
export const GRAYED_OUT_COLOR = '#959595';
export const GREEN_COLOR = '#28A745';
export const GREEN_COLOR_OPACITY_30 = '#28A74530';
export const BORDER_COLOR = '#0000001a';
export const BLACK_COLOR = '#000000';
export const WHITE_COLOR = '#ffffff';
export const LIGHT_GREEN_COLOR = '#4CAF50';

export const DEFAULT_CHART_OPACITY = 1;
export const HOVER_CHART_OPACITY = 0.3;

export const SUPPORTED_FIELD_TYPES = ['string', 'markdown', 'integer', 'enum'];
export const LOGGED_IN_USER_STORAGE_KEY = 'loggedInUsers';
export const ACTIVE_DOMAIN_STORAGE_KEY = 'activeDomain';
export const DEFAULT_DOMAIN_VALUE = 'All Domains';

export const USER_DATA_SIZE = 5;
export const INITIAL_PAGING_VALUE = 1;
export const JSON_TAB_SIZE = 2;
export const PAGE_SIZE = 10;
export const PAGE_SIZE_BASE = 15;
export const PAGE_SIZE_MEDIUM = 25;
export const PAGE_SIZE_LARGE = 50;
export const API_RES_MAX_SIZE = 100000;
export const LIST_SIZE = 5;
export const ADD_USER_CONTAINER_HEIGHT = 250;
export const INGESTION_PROGRESS_START_VAL = 20;
export const INGESTION_PROGRESS_END_VAL = 80;
export const DEPLOYED_PROGRESS_VAL = 100;
export const DESCRIPTION_MAX_PREVIEW_CHARACTERS = 350;
export const MAX_CHAR_LIMIT_ENTITY_SUMMARY = 130;
export const SMALL_TABLE_LOADER_SIZE = 3;
export const ONE_MINUTE_IN_MILLISECOND = 60000;
export const TWO_MINUTE_IN_MILLISECOND = 120000;
export const LOCALSTORAGE_RECENTLY_VIEWED = `recentlyViewedData_${COOKIE_VERSION}`;
export const LOCALSTORAGE_RECENTLY_SEARCHED = `recentlySearchedData_${COOKIE_VERSION}`;
export const LOCALSTORAGE_USER_PROFILES = 'userProfiles';
export const oidcTokenKey = 'oidcIdToken';
export const refreshTokenKey = 'refreshToken';
export const REDIRECT_PATHNAME = 'redirectUrlPath';
export const TERM_ADMIN = 'Admin';
export const TERM_USER = 'User';
export const DISABLED = 'disabled';
export const imageTypes = {
  image: 's96-c',
  image192: 's192-c',
  image24: 's24-c',
  image32: 's32-c',
  image48: 's48-c',
  image512: 's512-c',
  image72: 's72-c',
};
export const NO_DATA_PLACEHOLDER = '--';
export const PIPE_SYMBOL = '|';
export const NO_DATA = '-';
export const STAR_OMD_USER = 'STAR_OMD_USER';

export const TOUR_SEARCH_TERM = 'dim_a';
export const ERROR500 = t('message.something-went-wrong');

export const PLACEHOLDER_ROUTE_INGESTION_TYPE = ':ingestionType';
export const PLACEHOLDER_ROUTE_INGESTION_FQN = ':ingestionFQN';
export const PLACEHOLDER_ROUTE_SERVICE_CAT = ':serviceCategory';
export const PLACEHOLDER_ROUTE_TAB = ':tab';
export const PLACEHOLDER_ROUTE_SUB_TAB = ':subTab';
export const PLACEHOLDER_ROUTE_FQN = ':fqn';
export const PLACEHOLDER_ROUTE_ID = ':id';
export const PLACEHOLDER_ROUTE_VERSION = ':version';
export const PLACEHOLDER_ROUTE_ENTITY_TYPE = ':entityType';

export const PLACEHOLDER_ROUTE_QUERY_ID = ':queryId';
export const PLACEHOLDER_WEBHOOK_NAME = ':webhookName';
export const PLACEHOLDER_TASK_ID = ':taskId';
export const PLACEHOLDER_SETTING_CATEGORY = ':settingCategory';
export const PLACEHOLDER_USER_BOT = ':bot';
export const PLACEHOLDER_WEBHOOK_TYPE = ':webhookType';
export const PLACEHOLDER_RULE_NAME = ':ruleName';
export const PLACEHOLDER_DASHBOARD_TYPE = ':dashboardType';
export const LOG_ENTITY_TYPE = ':logEntityType';
export const LOG_ENTITY_NAME = ':logEntityName';
export const PLACEHOLDER_ACTION = ':action';

export const pagingObject = { after: '', before: '', total: 0 };

export const ONLY_NUMBER_REGEX = /^[0-9\b]+$/;

export const ES_UPDATE_DELAY = 500;

export const DESCRIPTION_LENGTH = 100;

export const CHART_WIDGET_DAYS_DURATION = 14;

export const ROUTES = {
  HOME: '/',
  CALLBACK: '/callback',
  SAML_CALLBACK: '/saml/callback',
  SILENT_CALLBACK: '/silent-callback',
  NOT_FOUND: '/404',
  MY_DATA: '/my-data',
  TOUR: '/tour',
  REPORTS: '/reports',
  EXPLORE: '/explore',
  EXPLORE_WITH_TAB: `/explore/${PLACEHOLDER_ROUTE_TAB}`,
  WORKFLOWS: '/workflows',
  SQL_BUILDER: '/sql-builder',
  SETTINGS: `/settings`,
  SETTINGS_WITH_CATEGORY: `/settings/${PLACEHOLDER_SETTING_CATEGORY}`,
  SETTINGS_WITH_CATEGORY_FQN: `/settings/${PLACEHOLDER_SETTING_CATEGORY}/${PLACEHOLDER_ROUTE_FQN}`,
  SETTINGS_WITH_TAB: `/settings/${PLACEHOLDER_SETTING_CATEGORY}/${PLACEHOLDER_ROUTE_TAB}`,
  SETTINGS_WITH_TAB_FQN: `/settings/${PLACEHOLDER_SETTING_CATEGORY}/${PLACEHOLDER_ROUTE_TAB}/${PLACEHOLDER_ROUTE_FQN}`,
  SETTINGS_WITH_TAB_FQN_ACTION: `/settings/${PLACEHOLDER_SETTING_CATEGORY}/${PLACEHOLDER_ROUTE_TAB}/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ACTION}`,
  SETTINGS_EDIT_EMAIL_CONFIG: `/settings/OpenMetadata/email/edit-email-configuration`,
  STORE: '/store',
  FEEDS: '/feeds',
  DUMMY: '/dummy',
  SERVICE: `/service/${PLACEHOLDER_ROUTE_SERVICE_CAT}/${PLACEHOLDER_ROUTE_FQN}`,
  SERVICE_VERSION: `/service/${PLACEHOLDER_ROUTE_SERVICE_CAT}/${PLACEHOLDER_ROUTE_FQN}/versions/${PLACEHOLDER_ROUTE_VERSION}`,
  SERVICE_WITH_TAB: `/service/${PLACEHOLDER_ROUTE_SERVICE_CAT}/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  ADD_SERVICE: `/${PLACEHOLDER_ROUTE_SERVICE_CAT}/add-service`,
  EDIT_SERVICE_CONNECTION: `/service/${PLACEHOLDER_ROUTE_SERVICE_CAT}/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}/edit-connection`,
  SERVICES_WITH_TAB: `/services/${PLACEHOLDER_ROUTE_SERVICE_CAT}`,
  ADD_INGESTION: `/service/${PLACEHOLDER_ROUTE_SERVICE_CAT}/${PLACEHOLDER_ROUTE_FQN}/add-ingestion/${PLACEHOLDER_ROUTE_INGESTION_TYPE}`,
  EDIT_INGESTION: `/service/${PLACEHOLDER_ROUTE_SERVICE_CAT}/${PLACEHOLDER_ROUTE_FQN}/edit-ingestion/${PLACEHOLDER_ROUTE_INGESTION_FQN}/${PLACEHOLDER_ROUTE_INGESTION_TYPE}`,
  USERS: '/users',
  SCORECARD: '/scorecard',
  SWAGGER: '/docs',
  TAGS: '/tags',
  TAG_DETAILS: `/tags/${PLACEHOLDER_ROUTE_FQN}`,
  TAG_VERSION: `/tags/${PLACEHOLDER_ROUTE_FQN}/versions/${PLACEHOLDER_ROUTE_VERSION}`,
  SIGNUP: '/signup',
  REGISTER: '/register',
  SIGNIN: '/signin',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/users/password/reset',
  ACCOUNT_ACTIVATION: '/users/registrationConfirmation',

  TABLE_DETAILS: `/table/${PLACEHOLDER_ROUTE_FQN}`,
  TABLE_DETAILS_WITH_TAB: `/table/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  ENTITY_VERSION: `/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/${PLACEHOLDER_ROUTE_FQN}/versions/${PLACEHOLDER_ROUTE_VERSION}`,
  ENTITY_VERSION_WITH_TAB: `/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/${PLACEHOLDER_ROUTE_FQN}/versions/${PLACEHOLDER_ROUTE_VERSION}/${PLACEHOLDER_ROUTE_TAB}`,
  TABLE_DETAILS_WITH_SUB_TAB: `/table/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}/${PLACEHOLDER_ROUTE_SUB_TAB}`,

  TOPIC_DETAILS: `/topic/${PLACEHOLDER_ROUTE_FQN}`,
  TOPIC_DETAILS_WITH_TAB: `/topic/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  TOPIC_DETAILS_WITH_SUB_TAB: `/topic/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}/${PLACEHOLDER_ROUTE_SUB_TAB}`,
  DASHBOARD_DETAILS: `/dashboard/${PLACEHOLDER_ROUTE_FQN}`,
  DASHBOARD_DETAILS_WITH_TAB: `/dashboard/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  DASHBOARD_DETAILS_WITH_SUB_TAB: `/dashboard/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}/${PLACEHOLDER_ROUTE_SUB_TAB}`,

  DATA_MODEL_DETAILS: `/dashboardDataModel/${PLACEHOLDER_ROUTE_FQN}`,
  DATA_MODEL_DETAILS_WITH_TAB: `/dashboardDataModel/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  DATA_MODEL_DETAILS_WITH_SUB_TAB: `/dashboardDataModel/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}/${PLACEHOLDER_ROUTE_SUB_TAB}`,

  DATABASE_DETAILS: `/database/${PLACEHOLDER_ROUTE_FQN}`,
  DATABASE_VERSION: `/database/${PLACEHOLDER_ROUTE_FQN}/versions/${PLACEHOLDER_ROUTE_VERSION}/${PLACEHOLDER_ROUTE_TAB}`,
  DATABASE_DETAILS_WITH_TAB: `/database/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  DATABASE_DETAILS_WITH_SUB_TAB: `/database/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}/${PLACEHOLDER_ROUTE_SUB_TAB}`,

  SCHEMA_DETAILS: `/databaseSchema/${PLACEHOLDER_ROUTE_FQN}`,
  SCHEMA_VERSION: `/databaseSchema/${PLACEHOLDER_ROUTE_FQN}/versions/${PLACEHOLDER_ROUTE_VERSION}/${PLACEHOLDER_ROUTE_TAB}`,
  SCHEMA_DETAILS_WITH_TAB: `/databaseSchema/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  SCHEMA_DETAILS_WITH_SUB_TAB: `/databaseSchema/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}/${PLACEHOLDER_ROUTE_SUB_TAB}`,

  PIPELINE_DETAILS: `/pipeline/${PLACEHOLDER_ROUTE_FQN}`,
  PIPELINE_DETAILS_WITH_TAB: `/pipeline/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  PIPELINE_DETAILS_WITH_SUB_TAB: `/pipeline/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}/${PLACEHOLDER_ROUTE_SUB_TAB}`,

  MLMODEL_DETAILS: `/mlmodel/${PLACEHOLDER_ROUTE_FQN}`,
  MLMODEL_DETAILS_WITH_TAB: `/mlmodel/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  MLMODEL_DETAILS_WITH_SUB_TAB: `/mlmodel/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}/${PLACEHOLDER_ROUTE_SUB_TAB}`,

  CONTAINER_DETAILS: `/container/${PLACEHOLDER_ROUTE_FQN}`,
  CONTAINER_DETAILS_WITH_TAB: `/container/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  CONTAINER_DETAILS_WITH_SUB_TAB: `/container/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}/${PLACEHOLDER_ROUTE_SUB_TAB}`,

  SEARCH_INDEX_DETAILS: `/searchIndex/${PLACEHOLDER_ROUTE_FQN}`,
  SEARCH_INDEX_DETAILS_WITH_TAB: `/searchIndex/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  SEARCH_INDEX_DETAILS_WITH_SUB_TAB: `/searchIndex/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}/${PLACEHOLDER_ROUTE_SUB_TAB}`,
  STORED_PROCEDURE_DETAILS: `/storedProcedure/${PLACEHOLDER_ROUTE_FQN}`,
  STORED_PROCEDURE_DETAILS_WITH_TAB: `/storedProcedure/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  STORED_PROCEDURE_DETAILS_WITH_SUB_TAB: `/storedProcedure/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}/${PLACEHOLDER_ROUTE_SUB_TAB}`,

  USER_LIST: '/user-list',
  CREATE_USER: '/create-user',
  CREATE_USER_WITH_BOT: `/create-user/${PLACEHOLDER_USER_BOT}`,
  USER_PROFILE: `/users/${PLACEHOLDER_ROUTE_FQN}`,
  USER_PROFILE_WITH_TAB: `/users/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  USER_PROFILE_WITH_SUB_TAB: `/users/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}/${PLACEHOLDER_ROUTE_SUB_TAB}`,

  ROLES: '/roles',
  ADD_WEBHOOK: '/add-webhook/',
  ADD_WEBHOOK_WITH_TYPE: `/add-webhook/${PLACEHOLDER_WEBHOOK_TYPE}`,
  EDIT_WEBHOOK: `/webhook/${PLACEHOLDER_WEBHOOK_NAME}`,

  ADD_APPLICATION: '/add-application',
  MARKETPLACE: '/marketplace',
  MARKETPLACE_APP_DETAILS: `/marketplace/apps/${PLACEHOLDER_ROUTE_FQN}`,
  MARKETPLACE_APP_INSTALL: `/marketplace/apps/${PLACEHOLDER_ROUTE_FQN}/install`,

  APP_DETAILS: `/apps/${PLACEHOLDER_ROUTE_FQN}`,
  APP_DETAILS_WITH_TAB: `/apps/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,

  DOMAIN: '/domain',
  DOMAIN_DETAILS: `/domain/${PLACEHOLDER_ROUTE_FQN}`,
  DOMAIN_DETAILS_WITH_TAB: `/domain/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  DOMAIN_VERSION: `/domain/${PLACEHOLDER_ROUTE_FQN}/versions/${PLACEHOLDER_ROUTE_VERSION}`,

  ADD_DOMAIN: '/add-domain',
  DATA_PRODUCT_DETAILS: `/data-product/${PLACEHOLDER_ROUTE_FQN}`,
  DATA_PRODUCT_DETAILS_WITH_TAB: `/data-product/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  DATA_PRODUCT_VERSION: `/data-product/${PLACEHOLDER_ROUTE_FQN}/versions/${PLACEHOLDER_ROUTE_VERSION}`,

  GLOSSARY: '/glossary',
  ADD_GLOSSARY: '/add-glossary',
  GLOSSARY_DETAILS: `/glossary/${PLACEHOLDER_ROUTE_FQN}`,
  GLOSSARY_DETAILS_WITH_ACTION: `/glossary/${PLACEHOLDER_ROUTE_FQN}/action/${PLACEHOLDER_ACTION}`,
  ADD_GLOSSARY_TERMS: `/glossary/${PLACEHOLDER_ROUTE_FQN}/add-term`,
  GLOSSARY_DETAILS_WITH_TAB: `/glossary/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  GLOSSARY_DETAILS_WITH_SUBTAB: `/glossary/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}/${PLACEHOLDER_ROUTE_SUB_TAB}`,
  GLOSSARY_VERSION: `/glossary/${PLACEHOLDER_ROUTE_ID}/versions/${PLACEHOLDER_ROUTE_VERSION}`,
  GLOSSARY_TERMS_VERSION: `/glossary-term/${PLACEHOLDER_ROUTE_ID}/versions/${PLACEHOLDER_ROUTE_VERSION}`,
  GLOSSARY_TERMS_VERSION_TAB: `/glossary-term/${PLACEHOLDER_ROUTE_ID}/versions/${PLACEHOLDER_ROUTE_VERSION}/${PLACEHOLDER_ROUTE_TAB}`,
  BOTS_PROFILE: `/bots/${PLACEHOLDER_ROUTE_FQN}`,

  ADD_CUSTOM_PROPERTY: `/custom-properties/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/add-field`,
  ADD_DATA_QUALITY_TEST_CASE: `/data-quality-test/${PLACEHOLDER_DASHBOARD_TYPE}/${PLACEHOLDER_ROUTE_FQN}`,

  // Query Routes
  QUERY_FULL_SCREEN_VIEW: `/query-view/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_QUERY_ID}`,
  ADD_QUERY: `/query/${PLACEHOLDER_ROUTE_FQN}/add-query`,

  // Tasks Routes
  REQUEST_DESCRIPTION: `/request-description/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/${PLACEHOLDER_ROUTE_FQN}`,
  REQUEST_TAGS: `/request-tags/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/${PLACEHOLDER_ROUTE_FQN}`,
  UPDATE_DESCRIPTION: `/update-description/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/${PLACEHOLDER_ROUTE_FQN}`,
  UPDATE_TAGS: `/update-tags/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/${PLACEHOLDER_ROUTE_FQN}`,
  TASK_DETAIL: `/tasks/${PLACEHOLDER_TASK_ID}`,

  ACTIVITY_PUSH_FEED: '/api/v1/push/feed',
  ADD_ROLE: '/settings/access/roles/add-role',
  ADD_POLICY: '/settings/access/policies/add-policy',
  ADD_POLICY_RULE: `/settings/access/policies/${PLACEHOLDER_ROUTE_FQN}/add-rule`,
  EDIT_POLICY_RULE: `/settings/access/policies/${PLACEHOLDER_ROUTE_FQN}/edit-rule/${PLACEHOLDER_RULE_NAME}`,

  // test suites
  TEST_SUITES_WITH_FQN: `/test-suites/${PLACEHOLDER_ROUTE_FQN}`,
  TEST_SUITES_ADD_INGESTION: `/test-suites/${PLACEHOLDER_ROUTE_FQN}/add-ingestion`,
  TEST_SUITES_EDIT_INGESTION: `/test-suites/${PLACEHOLDER_ROUTE_FQN}/edit-ingestion/${PLACEHOLDER_ROUTE_INGESTION_FQN}`,
  ADD_TEST_SUITES: `/add-test-suites`,

  // data quality
  DATA_QUALITY: '/data-quality',
  DATA_QUALITY_WITH_TAB: `/data-quality/${PLACEHOLDER_ROUTE_TAB}`,

  INCIDENT_MANAGER: '/incident-manager',
  INCIDENT_MANAGER_DETAILS: `/incident-manager/${PLACEHOLDER_ROUTE_FQN}`,
  INCIDENT_MANAGER_DETAILS_WITH_TAB: `/incident-manager/${PLACEHOLDER_ROUTE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,

  // logs viewer
  LOGS: `/${LOG_ENTITY_TYPE}/${PLACEHOLDER_ROUTE_FQN}/logs`,

  DATA_INSIGHT: `/data-insights`,
  DATA_INSIGHT_WITH_TAB: `/data-insights/${PLACEHOLDER_ROUTE_TAB}`,
  KPI_LIST: `/data-insights/kpi`,
  ADD_KPI: `/data-insights/kpi/add-kpi`,
  EDIT_KPI: `/data-insights/kpi/edit-kpi/${PLACEHOLDER_ROUTE_FQN}`,

  SETTINGS_EDIT_CUSTOM_LOGO_CONFIG: `/settings/OpenMetadata/customLogo/edit-custom-logo-configuration`,
  SETTINGS_EDIT_CUSTOM_LOGIN_CONFIG: `/settings/OpenMetadata/customLogo/edit-custom-login-configuration`,

  CUSTOMIZE_PAGE: `/customize-page/:fqn/:pageFqn`,

  ADD_CUSTOM_METRIC: `/add-custom-metric/${PLACEHOLDER_DASHBOARD_TYPE}/${PLACEHOLDER_ROUTE_FQN}`,

  // Observability
  OBSERVABILITY: '/observability',
  OBSERVABILITY_ALERTS: '/observability/alerts',
  OBSERVABILITY_ALERT_DETAILS: `/observability/alert/${PLACEHOLDER_ROUTE_FQN}`,
  ADD_OBSERVABILITY_ALERTS: '/observability/alerts/add',
  EDIT_OBSERVABILITY_ALERTS: `/observability/alerts/edit/${PLACEHOLDER_ROUTE_FQN}`,

  // Notification Alerts
  NOTIFICATION_ALERTS: `/settings/${GlobalSettingsMenuCategory.NOTIFICATIONS}`,
  NOTIFICATION_ALERT_DETAILS: `/settings/${GlobalSettingsMenuCategory.NOTIFICATIONS}/alert/${PLACEHOLDER_ROUTE_FQN}`,
  EDIT_NOTIFICATION_ALERTS: `/settings/${GlobalSettingsMenuCategory.NOTIFICATIONS}/${GlobalSettingOptions.EDIT_NOTIFICATION}/${PLACEHOLDER_ROUTE_FQN}`,
};

export const SOCKET_EVENTS = {
  ACTIVITY_FEED: 'activityFeed',
  TASK_CHANNEL: 'taskChannel',
  MENTION_CHANNEL: 'mentionChannel',
  JOB_STATUS: 'jobStatus',
};

export const IN_PAGE_SEARCH_ROUTES: Record<string, Array<string>> = {
  '/database/': [t('message.in-this-database')],
};

export const getTableDetailsPath = (tableFQN: string, columnName?: string) => {
  let path = ROUTES.TABLE_DETAILS;
  path = path.replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(tableFQN));

  return `${path}${columnName ? `.${columnName}` : ''}`;
};

export const getTagsDetailsPath = (entityFQN: string) => {
  let path = ROUTES.TAG_DETAILS;
  const classification = getPartialNameFromFQN(entityFQN, ['service']);
  path = path.replace(PLACEHOLDER_ROUTE_FQN, classification);

  return path;
};

export const getVersionPath = (
  entityType: string,
  fqn: string,
  version: string
) => {
  let path = ROUTES.ENTITY_VERSION;
  path = path
    .replace(PLACEHOLDER_ROUTE_ENTITY_TYPE, entityType)
    .replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(fqn))
    .replace(PLACEHOLDER_ROUTE_VERSION, version);

  return path;
};

export const getVersionPathWithTab = (
  entityType: string,
  fqn: string,
  version: string,
  tab: string
) => {
  let path = ROUTES.ENTITY_VERSION_WITH_TAB;
  path = path
    .replace(PLACEHOLDER_ROUTE_ENTITY_TYPE, entityType)
    .replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(fqn))
    .replace(PLACEHOLDER_ROUTE_VERSION, version)
    .replace(PLACEHOLDER_ROUTE_TAB, tab);

  return path;
};

export const getTableTabPath = (
  tableFQN: string,
  tab = 'schema',
  subTab = 'all'
) => {
  let path = ROUTES.TABLE_DETAILS_WITH_TAB;
  if (tab === EntityTabs.ACTIVITY_FEED) {
    path = ROUTES.TABLE_DETAILS_WITH_SUB_TAB;

    path = path.replace(PLACEHOLDER_ROUTE_SUB_TAB, subTab);
  }
  path = path
    .replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(tableFQN))
    .replace(PLACEHOLDER_ROUTE_TAB, tab);

  return path;
};

export const getServiceDetailsPath = (
  serviceFQN: string,
  serviceCat: string,
  tab?: string
) => {
  let path = tab ? ROUTES.SERVICE_WITH_TAB : ROUTES.SERVICE;
  path = path
    .replace(PLACEHOLDER_ROUTE_SERVICE_CAT, serviceCat)
    .replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(serviceFQN));

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  return path;
};

export const getExplorePath: (args: {
  tab?: string;
  search?: string;
  extraParameters?: Record<string, unknown>;
  isPersistFilters?: boolean;
}) => string = ({ tab, search, extraParameters, isPersistFilters = true }) => {
  const pathname = ROUTES.EXPLORE_WITH_TAB.replace(
    PLACEHOLDER_ROUTE_TAB,
    tab ?? ''
  );
  let paramsObject: Record<string, unknown> = Qs.parse(
    location.search.startsWith('?')
      ? location.search.substr(1)
      : location.search
  );

  const { search: paramSearch } = paramsObject;

  /**
   * persist the filters if isPersistFilters is true
   * otherwise only persist the search and passed extra params
   * */
  if (isPersistFilters) {
    if (!isUndefined(search)) {
      paramsObject = {
        ...paramsObject,
        search,
      };
    }
    if (!isUndefined(extraParameters)) {
      paramsObject = {
        ...paramsObject,
        ...extraParameters,
      };
    }
  } else {
    paramsObject = {
      search: isUndefined(search) ? paramSearch : search,
      ...(!isUndefined(extraParameters) ? extraParameters : {}),
    };
  }

  const query = Qs.stringify(paramsObject);

  return `${pathname}?${query}`;
};

export const getDatabaseDetailsPath = (
  databaseFQN: string,
  tab?: string,
  subTab = 'all'
) => {
  let path = tab ? ROUTES.DATABASE_DETAILS_WITH_TAB : ROUTES.DATABASE_DETAILS;

  if (tab === EntityTabs.ACTIVITY_FEED) {
    path = ROUTES.DATABASE_DETAILS_WITH_SUB_TAB;
    path = path.replace(PLACEHOLDER_ROUTE_SUB_TAB, subTab);
  }

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  path = path.replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(databaseFQN));

  return path;
};

export const getDatabaseSchemaDetailsPath = (
  schemaFQN: string,
  tab?: string,
  subTab = 'all'
) => {
  let path = tab ? ROUTES.SCHEMA_DETAILS_WITH_TAB : ROUTES.SCHEMA_DETAILS;

  if (tab === EntityTabs.ACTIVITY_FEED) {
    path = ROUTES.SCHEMA_DETAILS_WITH_SUB_TAB;
    path = path.replace(PLACEHOLDER_ROUTE_SUB_TAB, subTab);
  }

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  path = path.replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(schemaFQN));

  return path;
};

export const getTopicDetailsPath = (
  topicFQN: string,
  tab?: string,
  subTab = 'all'
) => {
  let path = tab ? ROUTES.TOPIC_DETAILS_WITH_TAB : ROUTES.TOPIC_DETAILS;

  if (tab === EntityTabs.ACTIVITY_FEED) {
    path = ROUTES.TOPIC_DETAILS_WITH_SUB_TAB;
    path = path.replace(PLACEHOLDER_ROUTE_SUB_TAB, subTab);
  }

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  path = path.replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(topicFQN));

  return path;
};

export const getDashboardDetailsPath = (
  dashboardFQN: string,
  tab?: string,
  subTab = 'all'
) => {
  let path = tab ? ROUTES.DASHBOARD_DETAILS_WITH_TAB : ROUTES.DASHBOARD_DETAILS;

  if (tab === EntityTabs.ACTIVITY_FEED) {
    path = ROUTES.DASHBOARD_DETAILS_WITH_SUB_TAB;
    path = path.replace(PLACEHOLDER_ROUTE_SUB_TAB, subTab);
  }

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  path = path.replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(dashboardFQN));

  return path;
};

export const getDataModelDetailsPath = (
  dataModelFQN: string,
  tab?: string,
  subTab = 'all'
) => {
  let path = tab
    ? ROUTES.DATA_MODEL_DETAILS_WITH_TAB
    : ROUTES.DATA_MODEL_DETAILS;

  if (tab === EntityTabs.ACTIVITY_FEED) {
    path = ROUTES.DATA_MODEL_DETAILS_WITH_SUB_TAB;
    path = path.replace(PLACEHOLDER_ROUTE_SUB_TAB, subTab);
  }

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  path = path.replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(dataModelFQN));

  return path;
};

export const getPipelineDetailsPath = (
  pipelineFQN: string,
  tab?: string,
  subTab = 'all'
) => {
  let path = tab ? ROUTES.PIPELINE_DETAILS_WITH_TAB : ROUTES.PIPELINE_DETAILS;

  if (tab === EntityTabs.ACTIVITY_FEED) {
    path = ROUTES.PIPELINE_DETAILS_WITH_SUB_TAB;
    path = path.replace(PLACEHOLDER_ROUTE_SUB_TAB, subTab);
  }

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  path = path.replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(pipelineFQN));

  return path;
};

export const getMlModelDetailsPath = (
  mlModelFQN: string,
  tab?: string,
  subTab = 'all'
) => {
  let path = tab ? ROUTES.MLMODEL_DETAILS_WITH_TAB : ROUTES.MLMODEL_DETAILS;

  if (tab === EntityTabs.ACTIVITY_FEED) {
    path = ROUTES.MLMODEL_DETAILS_WITH_SUB_TAB;
    path = path.replace(PLACEHOLDER_ROUTE_SUB_TAB, subTab);
  }

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  path = path.replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(mlModelFQN));

  return path;
};

export const getContainerDetailPath = (
  containerFQN: string,
  tab?: string,
  subTab = 'all'
) => {
  let path = tab ? ROUTES.CONTAINER_DETAILS_WITH_TAB : ROUTES.CONTAINER_DETAILS;

  if (tab === EntityTabs.ACTIVITY_FEED) {
    path = ROUTES.CONTAINER_DETAILS_WITH_SUB_TAB;
    path = path.replace(PLACEHOLDER_ROUTE_SUB_TAB, subTab);
  }

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  path = path.replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(containerFQN));

  return path;
};

export const getStoredProcedureDetailPath = (
  storedProcedureFQN: string,
  tab?: string,
  subTab = 'all'
) => {
  let path = tab
    ? ROUTES.STORED_PROCEDURE_DETAILS_WITH_TAB
    : ROUTES.STORED_PROCEDURE_DETAILS;

  if (tab === EntityTabs.ACTIVITY_FEED) {
    path = ROUTES.STORED_PROCEDURE_DETAILS_WITH_SUB_TAB;
    path = path.replace(PLACEHOLDER_ROUTE_SUB_TAB, subTab);
  }

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  path = path.replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(storedProcedureFQN));

  return path;
};

export const getGlossaryTermDetailsPath = (
  glossaryFQN: string,
  tab?: string,
  subTab = 'all'
) => {
  let path = tab ? ROUTES.GLOSSARY_DETAILS_WITH_TAB : ROUTES.GLOSSARY_DETAILS;

  if (tab === EntityTabs.ACTIVITY_FEED) {
    path = ROUTES.GLOSSARY_DETAILS_WITH_SUBTAB;
    path = path.replace(PLACEHOLDER_ROUTE_SUB_TAB, subTab);
  }

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }
  path = path.replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(glossaryFQN));

  return path;
};

export const getTeamAndUserDetailsPath = (name?: string) => {
  let path = getSettingPath(
    GlobalSettingsMenuCategory.MEMBERS,
    GlobalSettingOptions.TEAMS
  );
  if (name) {
    path = getSettingPath(
      GlobalSettingsMenuCategory.MEMBERS,
      GlobalSettingOptions.TEAMS,
      true
    );
    path = path.replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(name));
  }

  return path;
};

export const getEditWebhookPath = (webhookName: string) => {
  let path = ROUTES.EDIT_WEBHOOK;
  path = path.replace(PLACEHOLDER_WEBHOOK_NAME, getEncodedFqn(webhookName));

  return path;
};

export const getUserPath = (username: string, tab?: string, subTab = 'all') => {
  let path = tab ? ROUTES.USER_PROFILE_WITH_TAB : ROUTES.USER_PROFILE;

  if (tab === EntityTabs.ACTIVITY_FEED) {
    path = ROUTES.USER_PROFILE_WITH_SUB_TAB;
    path = path.replace(PLACEHOLDER_ROUTE_SUB_TAB, subTab);
  }

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }
  path = path.replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(username));

  return path;
};

export const getBotsPath = (botsName: string) => {
  let path = ROUTES.BOTS_PROFILE;
  path = path.replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(botsName));

  return path;
};

export const getMlModelPath = (mlModelFqn: string, tab = '') => {
  let path = ROUTES.MLMODEL_DETAILS_WITH_TAB;
  path = path
    .replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(mlModelFqn))
    .replace(PLACEHOLDER_ROUTE_TAB, tab);

  return path;
};

export const getAddCustomPropertyPath = (entityTypeFQN: string) => {
  let path = ROUTES.ADD_CUSTOM_PROPERTY;
  path = path.replace(
    PLACEHOLDER_ROUTE_ENTITY_TYPE,
    getEncodedFqn(entityTypeFQN)
  );

  return path;
};

export const getCreateUserPath = (bot: boolean) => {
  let path = bot ? ROUTES.CREATE_USER_WITH_BOT : ROUTES.CREATE_USER;

  if (bot) {
    path = path.replace(PLACEHOLDER_USER_BOT, 'bot');
  }

  return path;
};

export const getUsersPagePath = () => {
  return `${ROUTES.SETTINGS}/${GlobalSettingsMenuCategory.MEMBERS}/users`;
};

export const getBotsPagePath = () => {
  return `${ROUTES.SETTINGS}/${GlobalSettingsMenuCategory.BOTS}`;
};

export const getKpiPath = (kpiName: string) => {
  let path = ROUTES.EDIT_KPI;

  path = path.replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(kpiName));

  return path;
};

export const NOTIFICATION_READ_TIMER = 2500;
export const TIER_CATEGORY = 'Tier';

export const ENTITY_PATH = {
  tables: 'table',
  topics: 'topic',
  dashboards: 'dashboard',
  pipelines: 'pipeline',
  mlmodels: 'mlmodel',
  containers: 'container',
  tags: 'tag',
  glossaries: 'glossary',
  searchIndexes: 'searchIndex',
  storedProcedures: 'storedProcedure',
  glossaryTerm: 'glossaryTerm',
  databases: 'database',
  databaseSchemas: 'databaseSchema',
};

export const VALIDATION_MESSAGES = {
  required: i18n.t('message.field-text-is-required', {
    fieldText: '${label}',
  }),
  types: {
    email: i18n.t('message.entity-is-not-valid', {
      entity: '${label}',
    }),
  },
  whitespace: i18n.t('message.field-text-is-required', {
    fieldText: '${label}',
  }),
  string: {
    range: i18n.t('message.entity-size-in-between', {
      entity: '${label}',
      min: '${min}',
      max: '${max}',
    }),
  },
  number: {
    range: i18n.t('message.entity-size-in-between', {
      entity: '${label}',
      min: '${min}',
      max: '${max}',
    }),
  },
};

export const ERROR_MESSAGE = {
  alreadyExist: 'already exists',
};

export const ICON_DIMENSION = {
  with: 14,
  height: 14,
  fontSize: 14,
};

export const COMMON_ICON_STYLES: CSSProperties = {
  verticalAlign: 'middle',
};

export const APPLICATION_JSON_CONTENT_TYPE_HEADER = {
  headers: { 'Content-type': 'application/json' },
};
