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

import { COOKIE_VERSION } from 'components/Modals/WhatsNewModal/whatsNewData';
import { t } from 'i18next';
import { isUndefined } from 'lodash';
import Qs from 'qs';
import { getSettingPath } from '../utils/RouterUtils';
import { getEncodedFqn } from '../utils/StringsUtils';
import { FQN_SEPARATOR_CHAR } from './char.constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from './GlobalSettings.constants';

export const PRIMERY_COLOR = '#7147E8';
export const SECONDARY_COLOR = '#B02AAC';
export const LITE_GRAY_COLOR = '#DBE0EB';
export const TEXT_BODY_COLOR = '#37352F';
export const SUCCESS_COLOR = '#008376';
export const DE_ACTIVE_COLOR = '#6B7280';
export const GRAPH_BACKGROUND_COLOR = '#f5f5f5';
export const GRAYED_OUT_COLOR = '#CCCCCC';

export const DEFAULT_CHART_OPACITY = 1;
export const HOVER_CHART_OPACITY = 0.3;

export const SUPPORTED_FIELD_TYPES = ['string', 'markdown', 'integer'];

export const TAG_VIEW_CAP = 33;
export const FOLLOWERS_VIEW_CAP = 20;
export const INITIAL_PAGING_VALUE = 1;
export const JSON_TAB_SIZE = 2;
export const PAGE_SIZE = 10;
export const PAGE_SIZE_BASE = 12;
export const PAGE_SIZE_MEDIUM = 15;
export const SERVICE_VIEW_CAP = 20;
export const PAGE_SIZE_LARGE = 100;
export const API_RES_MAX_SIZE = 100000;
export const LIST_SIZE = 5;
export const SIDEBAR_WIDTH_COLLAPSED = 290;
export const SIDEBAR_WIDTH_EXPANDED = 290;
export const ADD_USER_CONTAINER_HEIGHT = 250;
export const INGESTION_PROGRESS_START_VAL = 20;
export const INGESTION_PROGRESS_END_VAL = 80;
export const DEPLOYED_PROGRESS_VAL = 100;
export const DESCRIPTION_MAX_PREVIEW_CHARACTERS = 350;
export const MAX_CHAR_LIMIT_ENTITY_SUMMARY = 130;
export const MAX_CHAR_LIMIT_TEST_SUITE = 75;
export const LOCALSTORAGE_RECENTLY_VIEWED = `recentlyViewedData_${COOKIE_VERSION}`;
export const LOCALSTORAGE_RECENTLY_SEARCHED = `recentlySearchedData_${COOKIE_VERSION}`;
export const LOCALSTORAGE_USER_PROFILES = 'userProfiles';
export const oidcTokenKey = 'oidcIdToken';
export const refreshTokenKey = 'refreshToken';
export const accessToken = 'accessToken';
export const REDIRECT_PATHNAME = 'redirectUrlPath';
export const TERM_ADMIN = 'Admin';
export const TERM_USER = 'User';
export const TERM_ALL = 'all';
export const imageTypes = {
  image: 's96-c',
  image192: 's192-c',
  image24: 's24-c',
  image32: 's32-c',
  image48: 's48-c',
  image512: 's512-c',
  image72: 's72-c',
};
export const NO_DATA_PLACEHOLDER = '---';
export const ELLIPSES = '...';

export const TOUR_SEARCH_TERM = 'dim_a';
export const ERROR404 = t('label.no-data-found');
export const ERROR500 = t('message.something-went-wrong');
const PLACEHOLDER_ROUTE_TABLE_FQN = ':datasetFQN';
const PLACEHOLDER_ROUTE_TOPIC_FQN = ':topicFQN';
const PLACEHOLDER_ROUTE_PIPELINE_FQN = ':pipelineFQN';
const PLACEHOLDER_ROUTE_DASHBOARD_FQN = ':dashboardFQN';
const PLACEHOLDER_ROUTE_DATABASE_FQN = ':databaseFQN';
const PLACEHOLDER_ROUTE_DATABASE_SCHEMA_FQN = ':databaseSchemaFQN';

export const PLACEHOLDER_ROUTE_SERVICE_FQN = ':serviceFQN';
export const PLACEHOLDER_ROUTE_INGESTION_TYPE = ':ingestionType';
export const PLACEHOLDER_ROUTE_INGESTION_FQN = ':ingestionFQN';
export const PLACEHOLDER_ROUTE_SERVICE_CAT = ':serviceCategory';
export const PLACEHOLDER_ROUTE_TAB = ':tab';
export const PLACEHOLDER_ROUTE_FQN = ':fqn';
export const PLACEHOLDER_ROUTE_TEAM_AND_USER = ':teamAndUser';
export const PLAEHOLDER_ROUTE_VERSION = ':version';
export const PLACEHOLDER_ROUTE_ENTITY_TYPE = ':entityType';
export const PLACEHOLDER_ROUTE_ENTITY_FQN = ':entityFQN';
export const PLACEHOLDER_WEBHOOK_NAME = ':webhookName';
export const PLACEHOLDER_GLOSSARY_NAME = ':glossaryName';
export const PLACEHOLDER_GLOSSARY_TERMS_FQN = ':glossaryTermsFQN';
export const PLACEHOLDER_USER_NAME = ':username';
export const PLACEHOLDER_BOTS_NAME = ':botsName';
export const PLACEHOLDER_ROUTE_MLMODEL_FQN = ':mlModelFqn';
export const PLACEHOLDER_ENTITY_TYPE_FQN = ':entityTypeFQN';
export const PLACEHOLDER_TASK_ID = ':taskId';
export const PLACEHOLDER_TAG_NAME = ':tagCategoryName';
export const PLACEHOLDER_SETTING_CATEGORY = ':settingCategory';
export const PLACEHOLDER_USER_BOT = ':bot';
export const PLACEHOLDER_WEBHOOK_TYPE = ':webhookType';
export const PLACEHOLDER_RULE_NAME = ':ruleName';
export const PLACEHOLDER_DASHBOARD_TYPE = ':dashboardType';
export const PLACEHOLDER_TEST_SUITE_FQN = ':testSuiteFQN';
export const LOG_ENTITY_TYPE = ':logEntityType';
export const INGESTION_NAME = ':ingestionName';
export const LOG_ENTITY_NAME = ':logEntityName';
export const KPI_NAME = ':kpiName';
export const PLACEHOLDER_ACTION = ':action';
export const PLACEHOLDER_CONTAINER_NAME = ':containerName';

export const pagingObject = { after: '', before: '', total: 0 };

export const ONLY_NUMBER_REGEX = /^[0-9\b]+$/;

export const CUSTOM_AIRFLOW_DOCS =
  'https://docs.open-metadata.org/integrations/airflow/custom-airflow-installation';

export const tiers = [
  { key: `Tier${FQN_SEPARATOR_CHAR}Tier1`, doc_count: 0 },
  { key: `Tier${FQN_SEPARATOR_CHAR}Tier2`, doc_count: 0 },
  { key: `Tier${FQN_SEPARATOR_CHAR}Tier3`, doc_count: 0 },
  { key: `Tier${FQN_SEPARATOR_CHAR}Tier4`, doc_count: 0 },
  { key: `Tier${FQN_SEPARATOR_CHAR}Tier5`, doc_count: 0 },
];

export const versionTypes = [
  { name: t('label.all'), value: 'all' },
  { name: t('label.major'), value: 'major' },
  { name: t('label.minor'), value: 'minor' },
];

export const DESCRIPTIONLENGTH = 100;

export const visibleFilters = [
  'service',
  'tier',
  'tags',
  'database',
  'databaseschema',
  'servicename',
];

export const ROUTES = {
  HOME: '/',
  CALLBACK: '/callback',
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
  SETTINGS_WITH_TAB: `/settings/${PLACEHOLDER_SETTING_CATEGORY}/${PLACEHOLDER_ROUTE_TAB}`,
  SETTINGS_WITH_TAB_FQN: `/settings/${PLACEHOLDER_SETTING_CATEGORY}/${PLACEHOLDER_ROUTE_TAB}/${PLACEHOLDER_ROUTE_FQN}`,
  STORE: '/store',
  FEEDS: '/feeds',
  DUMMY: '/dummy',
  SERVICE: `/service/${PLACEHOLDER_ROUTE_SERVICE_CAT}/${PLACEHOLDER_ROUTE_SERVICE_FQN}`,
  SERVICE_WITH_TAB: `/service/${PLACEHOLDER_ROUTE_SERVICE_CAT}/${PLACEHOLDER_ROUTE_SERVICE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  ADD_SERVICE: `/${PLACEHOLDER_ROUTE_SERVICE_CAT}/add-service`,
  EDIT_SERVICE_CONNECTION: `/service/${PLACEHOLDER_ROUTE_SERVICE_CAT}/${PLACEHOLDER_ROUTE_SERVICE_FQN}/${PLACEHOLDER_ROUTE_TAB}/edit-connection`,
  SERVICES_WITH_TAB: `/services/${PLACEHOLDER_ROUTE_SERVICE_CAT}`,
  ADD_INGESTION: `/service/${PLACEHOLDER_ROUTE_SERVICE_CAT}/${PLACEHOLDER_ROUTE_SERVICE_FQN}/add-ingestion/${PLACEHOLDER_ROUTE_INGESTION_TYPE}`,
  EDIT_INGESTION: `/service/${PLACEHOLDER_ROUTE_SERVICE_CAT}/${PLACEHOLDER_ROUTE_SERVICE_FQN}/edit-ingestion/${PLACEHOLDER_ROUTE_INGESTION_FQN}/${PLACEHOLDER_ROUTE_INGESTION_TYPE}`,
  USERS: '/users',
  SCORECARD: '/scorecard',
  SWAGGER: '/docs',
  TAGS: '/tags',
  TAG_DETAILS: `/tags/${PLACEHOLDER_TAG_NAME}`,
  SIGNUP: '/signup',
  REGISTER: '/register',
  SIGNIN: '/signin',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/users/password/reset',
  ACCOUNT_ACTIVATION: '/users/registrationConfirmation',
  TABLE_DETAILS: `/table/${PLACEHOLDER_ROUTE_TABLE_FQN}`,
  TABLE_DETAILS_WITH_TAB: `/table/${PLACEHOLDER_ROUTE_TABLE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  ENTITY_VERSION: `/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/${PLACEHOLDER_ROUTE_ENTITY_FQN}/versions/${PLAEHOLDER_ROUTE_VERSION}`,
  TOPIC_DETAILS: `/topic/${PLACEHOLDER_ROUTE_TOPIC_FQN}`,
  TOPIC_DETAILS_WITH_TAB: `/topic/${PLACEHOLDER_ROUTE_TOPIC_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  DASHBOARD_DETAILS: `/dashboard/${PLACEHOLDER_ROUTE_DASHBOARD_FQN}`,
  DASHBOARD_DETAILS_WITH_TAB: `/dashboard/${PLACEHOLDER_ROUTE_DASHBOARD_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  DATABASE_DETAILS: `/database/${PLACEHOLDER_ROUTE_DATABASE_FQN}`,
  SCHEMA_DETAILS: `/databaseSchema/${PLACEHOLDER_ROUTE_DATABASE_SCHEMA_FQN}`,
  DATABASE_DETAILS_WITH_TAB: `/database/${PLACEHOLDER_ROUTE_DATABASE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  SCHEMA_DETAILS_WITH_TAB: `/databaseSchema/${PLACEHOLDER_ROUTE_DATABASE_SCHEMA_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  PIPELINE_DETAILS: `/pipeline/${PLACEHOLDER_ROUTE_PIPELINE_FQN}`,
  PIPELINE_DETAILS_WITH_TAB: `/pipeline/${PLACEHOLDER_ROUTE_PIPELINE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  USER_LIST: '/user-list',
  CREATE_USER: '/create-user',
  CREATE_USER_WITH_BOT: `/create-user/${PLACEHOLDER_USER_BOT}`,
  USER_PROFILE: `/users/${PLACEHOLDER_USER_NAME}`,
  USER_PROFILE_WITH_TAB: `/users/${PLACEHOLDER_USER_NAME}/${PLACEHOLDER_ROUTE_TAB}`,
  ROLES: '/roles',
  ADD_WEBHOOK: '/add-webhook/',
  ADD_WEBHOOK_WITH_TYPE: `/add-webhook/${PLACEHOLDER_WEBHOOK_TYPE}`,
  EDIT_WEBHOOK: `/webhook/${PLACEHOLDER_WEBHOOK_NAME}`,
  GLOSSARY: '/glossary',
  ADD_GLOSSARY: '/add-glossary',
  GLOSSARY_DETAILS: `/glossary/${PLACEHOLDER_GLOSSARY_NAME}`,
  GLOSSARY_DETAILS_WITH_ACTION: `/glossary/${PLACEHOLDER_GLOSSARY_NAME}/action/${PLACEHOLDER_ACTION}`,
  ADD_GLOSSARY_TERMS: `/glossary/${PLACEHOLDER_GLOSSARY_NAME}/add-term`,
  GLOSSARY_TERMS: `/glossary/${PLACEHOLDER_GLOSSARY_NAME}/term/${PLACEHOLDER_GLOSSARY_TERMS_FQN}`,
  ADD_GLOSSARY_TERMS_CHILD: `/glossary/${PLACEHOLDER_GLOSSARY_NAME}/term/${PLACEHOLDER_GLOSSARY_TERMS_FQN}/add-term`,
  BOTS_PROFILE: `/bots/${PLACEHOLDER_BOTS_NAME}`,
  MLMODEL_DETAILS: `/mlmodel/${PLACEHOLDER_ROUTE_MLMODEL_FQN}`,
  MLMODEL_DETAILS_WITH_TAB: `/mlmodel/${PLACEHOLDER_ROUTE_MLMODEL_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  CUSTOM_ENTITY_DETAIL: `/custom-properties/${PLACEHOLDER_ENTITY_TYPE_FQN}`,
  ADD_CUSTOM_PROPERTY: `/custom-properties/${PLACEHOLDER_ENTITY_TYPE_FQN}/add-field`,
  PROFILER_DASHBOARD: `/profiler-dashboard/${PLACEHOLDER_DASHBOARD_TYPE}/${PLACEHOLDER_ENTITY_TYPE_FQN}`,
  PROFILER_DASHBOARD_WITH_TAB: `/profiler-dashboard/${PLACEHOLDER_DASHBOARD_TYPE}/${PLACEHOLDER_ENTITY_TYPE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  ADD_DATA_QUALITY_TEST_CASE: `/data-quality-test/${PLACEHOLDER_DASHBOARD_TYPE}/${PLACEHOLDER_ENTITY_TYPE_FQN}`,
  LINEAGE_FULL_SCREEN_VIEW: `/lineage-view/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/${PLACEHOLDER_ROUTE_ENTITY_FQN}`,

  // Tasks Routes
  REQUEST_DESCRIPTION: `/request-description/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/${PLACEHOLDER_ROUTE_ENTITY_FQN}`,
  REQUEST_TAGS: `/request-tags/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/${PLACEHOLDER_ROUTE_ENTITY_FQN}`,
  UPDATE_DESCRIPTION: `/update-description/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/${PLACEHOLDER_ROUTE_ENTITY_FQN}`,
  UPDATE_TAGS: `/update-tags/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/${PLACEHOLDER_ROUTE_ENTITY_FQN}`,
  TASK_DETAIL: `/tasks/${PLACEHOLDER_TASK_ID}`,

  ACTIVITY_PUSH_FEED: '/api/v1/push/feed',
  ADD_ROLE: '/settings/access/roles/add-role',
  ADD_POLICY: '/settings/access/policies/add-policy',
  ADD_POLICY_RULE: `/settings/access/policies/${PLACEHOLDER_ROUTE_FQN}/add-rule`,
  EDIT_POLICY_RULE: `/settings/access/policies/${PLACEHOLDER_ROUTE_FQN}/edit-rule/${PLACEHOLDER_RULE_NAME}`,

  // test suites
  TEST_SUITES: `/test-suites`,
  TEST_SUITES_WITH_FQN: `/test-suites/${PLACEHOLDER_TEST_SUITE_FQN}`,
  TEST_SUITES_ADD_INGESTION: `/test-suites/${PLACEHOLDER_TEST_SUITE_FQN}/add-ingestion`,
  TEST_SUITES_EDIT_INGESTION: `/test-suites/${PLACEHOLDER_TEST_SUITE_FQN}/edit-ingestion/${PLACEHOLDER_ROUTE_INGESTION_FQN}`,
  ADD_TEST_SUITES: `/add-test-suites`,
  TEST_SUITES_DUPLICATE: `/testSuites`,

  // logs viewer
  LOGS: `/${LOG_ENTITY_TYPE}/${INGESTION_NAME}/logs`,

  DATA_INSIGHT: `/data-insights`,
  DATA_INSIGHT_WITH_TAB: `/data-insights/${PLACEHOLDER_ROUTE_TAB}`,
  KPI_LIST: `/data-insights/kpi`,
  ADD_KPI: `/data-insights/kpi/add-kpi`,
  EDIT_KPI: `/data-insights/kpi/edit-kpi/${KPI_NAME}`,

  CONTAINER_DETAILS: `/container/${PLACEHOLDER_CONTAINER_NAME}`,
  CONTAINER_DETAILS_WITH_TAB: `/container/${PLACEHOLDER_CONTAINER_NAME}/${PLACEHOLDER_ROUTE_TAB}`,
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
  path = path.replace(PLACEHOLDER_ROUTE_TABLE_FQN, tableFQN);

  return `${path}${columnName ? `.${columnName}` : ''}`;
};

export const getVersionPath = (
  entityType: string,
  fqn: string,
  version: string
) => {
  let path = ROUTES.ENTITY_VERSION;
  path = path
    .replace(PLACEHOLDER_ROUTE_ENTITY_TYPE, entityType)
    .replace(PLACEHOLDER_ROUTE_ENTITY_FQN, fqn)
    .replace(PLAEHOLDER_ROUTE_VERSION, version);

  return path;
};

export const getTableTabPath = (tableFQN: string, tab = 'schema') => {
  let path = ROUTES.TABLE_DETAILS_WITH_TAB;
  path = path
    .replace(PLACEHOLDER_ROUTE_TABLE_FQN, getEncodedFqn(tableFQN))
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
    .replace(PLACEHOLDER_ROUTE_SERVICE_FQN, serviceFQN);

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

export const getDatabaseDetailsPath = (databaseFQN: string, tab?: string) => {
  let path = tab ? ROUTES.DATABASE_DETAILS_WITH_TAB : ROUTES.DATABASE_DETAILS;
  path = path.replace(PLACEHOLDER_ROUTE_DATABASE_FQN, databaseFQN);

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  return path;
};

export const getDatabaseSchemaDetailsPath = (
  schemaFQN: string,
  tab?: string
) => {
  let path = tab ? ROUTES.SCHEMA_DETAILS_WITH_TAB : ROUTES.SCHEMA_DETAILS;
  path = path.replace(PLACEHOLDER_ROUTE_DATABASE_SCHEMA_FQN, schemaFQN);

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  return path;
};

export const getTopicDetailsPath = (topicFQN: string, tab?: string) => {
  let path = tab ? ROUTES.TOPIC_DETAILS_WITH_TAB : ROUTES.TOPIC_DETAILS;
  path = path.replace(PLACEHOLDER_ROUTE_TOPIC_FQN, topicFQN);

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  return path;
};

export const getDashboardDetailsPath = (dashboardFQN: string, tab?: string) => {
  let path = tab ? ROUTES.DASHBOARD_DETAILS_WITH_TAB : ROUTES.DASHBOARD_DETAILS;
  path = path.replace(PLACEHOLDER_ROUTE_DASHBOARD_FQN, dashboardFQN);

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  return path;
};

export const getPipelineDetailsPath = (pipelineFQN: string, tab?: string) => {
  let path = tab ? ROUTES.PIPELINE_DETAILS_WITH_TAB : ROUTES.PIPELINE_DETAILS;
  path = path.replace(PLACEHOLDER_ROUTE_PIPELINE_FQN, pipelineFQN);

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  return path;
};

export const getMlModelDetailsPath = (mlModelFQN: string, tab?: string) => {
  let path = tab ? ROUTES.MLMODEL_DETAILS_WITH_TAB : ROUTES.MLMODEL_DETAILS;
  path = path.replace(PLACEHOLDER_ROUTE_MLMODEL_FQN, mlModelFQN);

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

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
    path = path.replace(PLACEHOLDER_ROUTE_FQN, name);
  }

  return path;
};

export const getEditWebhookPath = (webhookName: string) => {
  let path = ROUTES.EDIT_WEBHOOK;
  path = path.replace(PLACEHOLDER_WEBHOOK_NAME, webhookName);

  return path;
};

export const getUserPath = (username: string, tab?: string) => {
  let path = tab ? ROUTES.USER_PROFILE_WITH_TAB : ROUTES.USER_PROFILE;
  path = path.replace(PLACEHOLDER_USER_NAME, username);
  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  return path;
};

export const getBotsPath = (botsName: string) => {
  let path = ROUTES.BOTS_PROFILE;
  path = path.replace(PLACEHOLDER_BOTS_NAME, botsName);

  return path;
};

export const getMlModelPath = (mlModelFqn: string, tab = '') => {
  let path = ROUTES.MLMODEL_DETAILS_WITH_TAB;
  path = path
    .replace(PLACEHOLDER_ROUTE_MLMODEL_FQN, mlModelFqn)
    .replace(PLACEHOLDER_ROUTE_TAB, tab);

  return path;
};

export const getAddCustomPropertyPath = (entityTypeFQN: string) => {
  let path = ROUTES.ADD_CUSTOM_PROPERTY;
  path = path.replace(PLACEHOLDER_ENTITY_TYPE_FQN, entityTypeFQN);

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
  return `${ROUTES.SETTINGS}/${GlobalSettingsMenuCategory.INTEGRATIONS}/bots`;
};

export const getKpiPath = (kpiName: string) => {
  let path = ROUTES.EDIT_KPI;

  path = path.replace(KPI_NAME, kpiName);

  return path;
};

export const TIMEOUT = {
  USER_LIST: 60000, // 60 seconds for user retrieval
  TOAST_DELAY: 5000, // 5 seconds timeout for toaster autohide delay
};

export const configOptions = {
  headers: { 'Content-type': 'application/json-patch+json' },
};

export const NOTIFICATION_READ_TIMER = 2500;
export const TIER_CATEGORY = 'Tier';

export const ENTITY_PATH: Record<string, string> = {
  tables: 'table',
  topics: 'topic',
  dashboards: 'dashboard',
  pipelines: 'pipeline',
  mlmodels: 'mlmodel',
  containers: 'container',
};

export const VALIDATE_MESSAGES = {
  required: t('message.field-text-is-required', {
    fieldText: '${label}',
  }),
};
