/*
 *  Copyright 2021 Collate
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

import { COOKIE_VERSION } from '../components/Modals/WhatsNewModal/whatsNewData';
import { FQN_SEPARATOR_CHAR } from './char.constants';

export const PRIMERY_COLOR = '#7147E8';
export const LITE_GRAY_COLOR = '#DBE0EB';
export const TEXT_BODY_COLOR = '#37352F';

export const SUPPORTED_FIELD_TYPES = ['string', 'markdown', 'integer'];

export const FOLLOWERS_VIEW_CAP = 20;
export const INITIAL_PAGIN_VALUE = 1;
export const JSON_TAB_SIZE = 2;
export const PAGE_SIZE = 10;
export const PAGE_SIZE_BASE = 12;
export const PAGE_SIZE_MEDIUM = 16;
export const API_RES_MAX_SIZE = 100000;
export const LIST_SIZE = 5;
export const SIDEBAR_WIDTH_COLLAPSED = 290;
export const SIDEBAR_WIDTH_EXPANDED = 290;
export const INGESTION_PROGRESS_START_VAL = 20;
export const INGESTION_PROGRESS_END_VAL = 80;
export const DEPLOYED_PROGRESS_VAL = 100;
export const LOCALSTORAGE_RECENTLY_VIEWED = `recentlyViewedData_${COOKIE_VERSION}`;
export const LOCALSTORAGE_RECENTLY_SEARCHED = `recentlySearchedData_${COOKIE_VERSION}`;
export const LOCALSTORAGE_USER_PROFILES = 'userProfiles';
export const oidcTokenKey = 'oidcIdToken';
export const REDIRECT_PATHNAME = 'redirectUrlPath';
export const TERM_ADMIN = 'Admin';
export const TERM_USER = 'User';
export const imageTypes = {
  image: 's96-c',
  image192: 's192-c',
  image24: 's24-c',
  image32: 's32-c',
  image48: 's48-c',
  image512: 's512-c',
  image72: 's72-c',
};

export const TOUR_SEARCH_TERM = 'dim_a';
export const ERROR404 = 'No data found';
export const ERROR500 = 'Something went wrong';
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
export const PLACEHOLDER_ROUTE_SEARCHQUERY = ':searchQuery';
export const PLACEHOLDER_ROUTE_TAB = ':tab';
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

export const pagingObject = { after: '', before: '', total: 0 };

export const ONLY_NUMBER_REGEX = /^[0-9\b]+$/;

export const CUSTOM_AIRFLOW_DOCS =
  'https://docs.open-metadata.org/integrations/airflow/custom-airflow-installation';

/* eslint-disable @typescript-eslint/camelcase */
export const tiers = [
  { key: `Tier${FQN_SEPARATOR_CHAR}Tier1`, doc_count: 0 },
  { key: `Tier${FQN_SEPARATOR_CHAR}Tier2`, doc_count: 0 },
  { key: `Tier${FQN_SEPARATOR_CHAR}Tier3`, doc_count: 0 },
  { key: `Tier${FQN_SEPARATOR_CHAR}Tier4`, doc_count: 0 },
  { key: `Tier${FQN_SEPARATOR_CHAR}Tier5`, doc_count: 0 },
];

export const versionTypes = [
  { name: 'All', value: 'all' },
  { name: 'Major', value: 'major' },
  { name: 'Minor', value: 'minor' },
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

export const tableSortingFields = [
  {
    name: 'Last Updated',
    value: 'last_updated_timestamp',
  },
  { name: 'Weekly Usage', value: 'weekly_stats' },
  { name: 'Relevance', value: '' },
];

export const entitySortingFields = [
  {
    name: 'Last Updated',
    value: 'last_updated_timestamp',
  },
  { name: 'Relevance', value: '' },
];

export const sortingOrder = [
  { name: 'Ascending', value: 'asc' },
  { name: 'Descending', value: 'desc' },
];

export const facetFilterPlaceholder = [
  {
    name: 'Service',
    value: 'Service',
  },
  {
    name: 'Tier',
    value: 'Tier',
  },
  {
    name: 'Tags',
    value: 'Tags',
  },
  {
    name: 'Database',
    value: 'Database',
  },
  {
    name: 'DatabaseSchema',
    value: 'Schema',
  },
  {
    name: 'ServiceName',
    value: 'Service Name',
  },
];

export const ROUTES = {
  HOME: '/',
  CALLBACK: '/callback',
  NOT_FOUND: '/404',
  MY_DATA: '/my-data',
  TOUR: '/tour',
  REPORTS: '/reports',
  EXPLORE: '/explore',
  EXPLORE_WITH_SEARCH: `/explore/${PLACEHOLDER_ROUTE_TAB}/${PLACEHOLDER_ROUTE_SEARCHQUERY}`,
  EXPLORE_WITH_TAB: `/explore/${PLACEHOLDER_ROUTE_TAB}`,
  WORKFLOWS: '/workflows',
  SQL_BUILDER: '/sql-builder',
  TEAMS_AND_USERS: '/teams-and-users',
  TEAMS_AND_USERS_DETAILS: `/teams-and-users/${PLACEHOLDER_ROUTE_TEAM_AND_USER}`,
  SETTINGS: '/settings',
  STORE: '/store',
  FEEDS: '/feeds',
  DUMMY: '/dummy',
  SERVICE: `/service/${PLACEHOLDER_ROUTE_SERVICE_CAT}/${PLACEHOLDER_ROUTE_SERVICE_FQN}`,
  SERVICE_WITH_TAB: `/service/${PLACEHOLDER_ROUTE_SERVICE_CAT}/${PLACEHOLDER_ROUTE_SERVICE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  ADD_SERVICE: `/${PLACEHOLDER_ROUTE_SERVICE_CAT}/add-service`,
  EDIT_SERVICE_CONNECTION: `/service/${PLACEHOLDER_ROUTE_SERVICE_CAT}/${PLACEHOLDER_ROUTE_SERVICE_FQN}/${PLACEHOLDER_ROUTE_TAB}/edit-connection`,
  SERVICES: '/services',
  SERVICES_WITH_TAB: `/services/${PLACEHOLDER_ROUTE_SERVICE_CAT}`,
  ADD_INGESTION: `/service/${PLACEHOLDER_ROUTE_SERVICE_CAT}/${PLACEHOLDER_ROUTE_SERVICE_FQN}/add-ingestion/${PLACEHOLDER_ROUTE_INGESTION_TYPE}`,
  EDIT_INGESTION: `/service/${PLACEHOLDER_ROUTE_SERVICE_CAT}/${PLACEHOLDER_ROUTE_SERVICE_FQN}/edit-ingestion/${PLACEHOLDER_ROUTE_INGESTION_FQN}/${PLACEHOLDER_ROUTE_INGESTION_TYPE}`,
  USERS: '/users',
  SCORECARD: '/scorecard',
  SWAGGER: '/docs',
  TAGS: '/tags',
  SIGNUP: '/signup',
  SIGNIN: '/signin',
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
  USER_PROFILE: `/users/${PLACEHOLDER_USER_NAME}`,
  USER_PROFILE_WITH_TAB: `/users/${PLACEHOLDER_USER_NAME}/${PLACEHOLDER_ROUTE_TAB}`,
  ROLES: '/roles',
  WEBHOOKS: '/webhooks',
  ADD_WEBHOOK: '/add-webhook',
  EDIT_WEBHOOK: `/webhook/${PLACEHOLDER_WEBHOOK_NAME}`,
  GLOSSARY: '/glossary',
  ADD_GLOSSARY: '/add-glossary',
  GLOSSARY_DETAILS: `/glossary/${PLACEHOLDER_GLOSSARY_NAME}`,
  ADD_GLOSSARY_TERMS: `/glossary/${PLACEHOLDER_GLOSSARY_NAME}/add-term`,
  GLOSSARY_TERMS: `/glossary/${PLACEHOLDER_GLOSSARY_NAME}/term/${PLACEHOLDER_GLOSSARY_TERMS_FQN}`,
  ADD_GLOSSARY_TERMS_CHILD: `/glossary/${PLACEHOLDER_GLOSSARY_NAME}/term/${PLACEHOLDER_GLOSSARY_TERMS_FQN}/add-term`,
  BOTS: `/bots`,
  BOTS_PROFILE: `/bots/${PLACEHOLDER_BOTS_NAME}`,
  MLMODEL_DETAILS: `/mlmodel/${PLACEHOLDER_ROUTE_MLMODEL_FQN}`,
  MLMODEL_DETAILS_WITH_TAB: `/mlmodel/${PLACEHOLDER_ROUTE_MLMODEL_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  CUSTOM_PROPERTIES: `/custom-properties`,
  CUSTOM_ENTITY_DETAIL: `/custom-properties/${PLACEHOLDER_ENTITY_TYPE_FQN}`,
  ADD_CUSTOM_PROPERTY: `/custom-properties/${PLACEHOLDER_ENTITY_TYPE_FQN}/add-field`,

  // Tasks Routes
  REQUEST_DESCRIPTION: `/request-description/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/${PLACEHOLDER_ROUTE_ENTITY_FQN}`,
  UPDATE_DESCRIPTION: `/update-description/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/${PLACEHOLDER_ROUTE_ENTITY_FQN}`,
  TASK_DETAIL: `/tasks/${PLACEHOLDER_TASK_ID}`,

  ACTIVITY_PUSH_FEED: '/api/v1/push/feed',
};

export const SOCKET_EVENTS = {
  ACTIVITY_FEED: 'activityFeed',

};

export const IN_PAGE_SEARCH_ROUTES: Record<string, Array<string>> = {
  '/database/': ['In this Database'],
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
    .replace(PLACEHOLDER_ROUTE_TABLE_FQN, tableFQN)
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

export const getExplorePathWithSearch = (searchQuery = '', tab = 'tables') => {
  let path = ROUTES.EXPLORE_WITH_SEARCH;
  path = path
    .replace(PLACEHOLDER_ROUTE_SEARCHQUERY, searchQuery)
    .replace(PLACEHOLDER_ROUTE_TAB, tab);

  return path;
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

export const getTeamAndUserDetailsPath = (name?: string) => {
  let path = ROUTES.TEAMS_AND_USERS;
  if (name) {
    path = ROUTES.TEAMS_AND_USERS_DETAILS;
    path = path.replace(PLACEHOLDER_ROUTE_TEAM_AND_USER, name);
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

export const getCustomEntityPath = (entityTypeFQN: string) => {
  let path = ROUTES.CUSTOM_ENTITY_DETAIL;
  path = path.replace(PLACEHOLDER_ENTITY_TYPE_FQN, entityTypeFQN);

  return path;
};

export const TIMEOUT = {
  USER_LIST: 60000, // 60 seconds for user retrieval
  TOAST_DELAY: 5000, // 5 seconds timeout for toaster autohide delay
};

export const navLinkDevelop = [
  { name: 'Reports', to: '/reports', disabled: false },
  { name: 'SQL Builder', to: '/sql-builder', disabled: false },
  { name: 'Workflows', to: '/workflows', disabled: false },
];

export const navLinkSettings = [
  { name: 'Bots', to: '/bots', disabled: false, isAdminOnly: true },
  {
    name: 'Custom Properties',
    to: '/custom-properties',
    disabled: false,
    isAdminOnly: true,
  },
  { name: 'Glossaries', to: '/glossary', disabled: false },
  { name: 'Roles', to: '/roles', disabled: false, isAdminOnly: true },
  { name: 'Services', to: '/services', disabled: false },
  { name: 'Tags', to: '/tags', disabled: false },
  {
    name: 'Teams & Users',
    to: ROUTES.TEAMS_AND_USERS,
    disabled: false,
    isAdminOnly: true,
  },
  { name: 'Webhooks', to: '/webhooks', disabled: false },
];

export const TITLE_FOR_NON_OWNER_ACTION =
  'You need to be owner to perform this action';

export const TITLE_FOR_NON_ADMIN_ACTION =
  'Only Admin is allowed for the action';

export const TITLE_FOR_UPDATE_OWNER =
  'You do not have permissions to update the owner.';

export const configOptions = {
  headers: { 'Content-type': 'application/json-patch+json' },
};
