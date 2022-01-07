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

export const FOLLOWERS_VIEW_CAP = 20;
export const JSON_TAB_SIZE = 2;
export const PAGE_SIZE = 10;
export const API_RES_MAX_SIZE = 100000;
export const LIST_SIZE = 5;
export const SIDEBAR_WIDTH_COLLAPSED = 290;
export const SIDEBAR_WIDTH_EXPANDED = 290;
export const LOCALSTORAGE_RECENTLY_VIEWED = 'recentlyViewedData';
export const LOCALSTORAGE_RECENTLY_SEARCHED = 'recentlySearchedData';
export const oidcTokenKey = 'oidcIdToken';
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
const PLACEHOLDER_ROUTE_DATASET_FQN = ':datasetFQN';
const PLACEHOLDER_ROUTE_TOPIC_FQN = ':topicFQN';
const PLACEHOLDER_ROUTE_PIPELINE_FQN = ':pipelineFQN';
const PLACEHOLDER_ROUTE_DASHBOARD_FQN = ':dashboardFQN';
const PLACEHOLDER_ROUTE_DATABASE_FQN = ':databaseFQN';
const PLACEHOLDER_ROUTE_SERVICE_FQN = ':serviceFQN';
const PLACEHOLDER_ROUTE_SERVICE_TYPE = ':serviceType';
const PLACEHOLDER_ROUTE_SERVICE_CAT = ':serviceCategory';
const PLACEHOLDER_ROUTE_SEARCHQUERY = ':searchQuery';
const PLACEHOLDER_ROUTE_TAB = ':tab';
const PLACEHOLDER_ROUTE_TEAM = ':team';
const PLAEHOLDER_ROUTE_VERSION = ':version';
const PLACEHOLDER_ROUTE_ENTITY_TYPE = ':entityType';
const PLACEHOLDER_ROUTE_ENTITY_FQN = ':entityFQN';

export const pagingObject = { after: '', before: '' };

/* eslint-disable @typescript-eslint/camelcase */
export const tiers = [
  { key: 'Tier.Tier1', doc_count: 0 },
  { key: 'Tier.Tier2', doc_count: 0 },
  { key: 'Tier.Tier3', doc_count: 0 },
  { key: 'Tier.Tier4', doc_count: 0 },
  { key: 'Tier.Tier5', doc_count: 0 },
];

export const versionTypes = [
  { name: 'All', value: 'all' },
  { name: 'Major', value: 'major' },
  { name: 'Minor', value: 'minor' },
];

export const DESCRIPTIONLENGTH = 100;

export const visibleFilters = ['service', 'tier', 'tags', 'database'];

export const tableSortingFields = [
  {
    name: 'Last Updated',
    value: 'last_updated_timestamp',
  },
  { name: 'Weekly Usage', value: 'weekly_stats' },
  // { name: 'Daily Usage', value: 'daily_stats' },
  // { name: 'Monthly Usage', value: 'monthly_stats' },
];

export const topicSortingFields = [
  {
    name: 'Last Updated',
    value: 'last_updated_timestamp',
  },
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
  TEAMS: '/teams',
  TEAM_DETAILS: `/teams/${PLACEHOLDER_ROUTE_TEAM}`,
  SETTINGS: '/settings',
  STORE: '/store',
  FEEDS: '/feeds',
  DUMMY: '/dummy',
  SERVICE: `/service/${PLACEHOLDER_ROUTE_SERVICE_CAT}/${PLACEHOLDER_ROUTE_SERVICE_TYPE}/${PLACEHOLDER_ROUTE_SERVICE_FQN}`,
  SERVICES: '/services',
  USERS: '/users',
  SCORECARD: '/scorecard',
  SWAGGER: '/docs',
  TAGS: '/tags',
  SIGNUP: '/signup',
  SIGNIN: '/signin',
  DATASET_DETAILS: `/dataset/${PLACEHOLDER_ROUTE_DATASET_FQN}`,
  DATASET_DETAILS_WITH_TAB: `/dataset/${PLACEHOLDER_ROUTE_DATASET_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  ENTITY_VERSION: `/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/${PLACEHOLDER_ROUTE_ENTITY_FQN}/versions/${PLAEHOLDER_ROUTE_VERSION}`,
  TOPIC_DETAILS: `/topic/${PLACEHOLDER_ROUTE_TOPIC_FQN}`,
  TOPIC_DETAILS_WITH_TAB: `/topic/${PLACEHOLDER_ROUTE_TOPIC_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  DASHBOARD_DETAILS: `/dashboard/${PLACEHOLDER_ROUTE_DASHBOARD_FQN}`,
  DASHBOARD_DETAILS_WITH_TAB: `/dashboard/${PLACEHOLDER_ROUTE_DASHBOARD_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  DATABASE_DETAILS: `/database/${PLACEHOLDER_ROUTE_DATABASE_FQN}`,
  PIPELINE_DETAILS: `/pipeline/${PLACEHOLDER_ROUTE_PIPELINE_FQN}`,
  PIPELINE_DETAILS_WITH_TAB: `/pipeline/${PLACEHOLDER_ROUTE_PIPELINE_FQN}/${PLACEHOLDER_ROUTE_TAB}`,
  ONBOARDING: '/onboarding',
  INGESTION: '/ingestion',
  USER_LIST: '/user-list',
};

export const IN_PAGE_SEARCH_ROUTES: Record<string, Array<string>> = {
  '/database/': ['In this Database'],
};

export const getDatasetDetailsPath = (
  datasetFQN: string,
  columnName?: string
) => {
  let path = ROUTES.DATASET_DETAILS;
  path = path.replace(PLACEHOLDER_ROUTE_DATASET_FQN, datasetFQN);

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

export const getDatasetTabPath = (datasetFQN: string, tab = 'schema') => {
  let path = ROUTES.DATASET_DETAILS_WITH_TAB;
  path = path
    .replace(PLACEHOLDER_ROUTE_DATASET_FQN, datasetFQN)
    .replace(PLACEHOLDER_ROUTE_TAB, tab);

  return path;
};

export const getServiceDetailsPath = (
  serviceFQN: string,
  serviceType: string,
  serviceCat: string
) => {
  let path = ROUTES.SERVICE;
  path = path
    .replace(PLACEHOLDER_ROUTE_SERVICE_CAT, serviceCat)
    .replace(PLACEHOLDER_ROUTE_SERVICE_TYPE, serviceType)
    .replace(PLACEHOLDER_ROUTE_SERVICE_FQN, serviceFQN);

  return path;
};

export const getExplorePathWithSearch = (searchQuery = '', tab = 'tables') => {
  let path = ROUTES.EXPLORE_WITH_SEARCH;
  path = path
    .replace(PLACEHOLDER_ROUTE_SEARCHQUERY, searchQuery)
    .replace(PLACEHOLDER_ROUTE_TAB, tab);

  return path;
};

export const getDatabaseDetailsPath = (databaseFQN: string) => {
  let path = ROUTES.DATABASE_DETAILS;
  path = path.replace(PLACEHOLDER_ROUTE_DATABASE_FQN, databaseFQN);

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

export const getTeamDetailsPath = (teamName: string) => {
  let path = ROUTES.TEAM_DETAILS;
  path = path.replace(PLACEHOLDER_ROUTE_TEAM, teamName);

  return path;
};

export const LIST_TYPES = ['numbered-list', 'bulleted-list'];

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
  { name: 'Teams', to: '/teams', disabled: false },
  { name: 'Users', to: '/user-list', disabled: false, isAdminOnly: true },
  { name: 'Tags', to: '/tags', disabled: false },
  // { name: 'Store', to: '/store', disabled: false },
  { name: 'Services', to: '/services', disabled: false },
  { name: 'Ingestions', to: '/ingestion', disabled: false },
  // { name: 'Marketplace', to: '/marketplace', disabled: true },
  // { name: 'Preferences', to: '/preference', disabled: true },
];

export const TITLE_FOR_NON_OWNER_ACTION =
  'You need to be owner to perform this action';

export const TITLE_FOR_NON_ADMIN_ACTION =
  'Only Admin is allowed for the action';

// Entity Lineage Constant
export const positionX = 150;
export const positionY = 60;

export const nodeWidth = 172;
export const nodeHeight = 36;
