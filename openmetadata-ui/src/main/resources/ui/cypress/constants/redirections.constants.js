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

import { BASE_URL } from './constants';

export const LEFT_PANEL_DETAILS = {
  tables: {
    testid: '[data-testid="tables"]',
    url: `${BASE_URL}/explore/tables`,
  },
  topics: {
    testid: '[data-testid="topics"]',
    url: `${BASE_URL}/explore/topics`,
  },
  dashboard: {
    testid: '[data-testid="dashboards"]',
    url: `${BASE_URL}/explore/dashboards`,
  },
  pipelines: {
    testid: '[data-testid="pipelines"]',
    url: `${BASE_URL}/explore/pipelines`,
  },
  mlmodels: {
    testid: '[data-testid="mlmodels"]',
    url: `${BASE_URL}/explore/mlmodels`,
  },
  services: {
    testid: '[data-testid="service"]',
    url: `${BASE_URL}/settings/services/databases`,
  },
  users: {
    testid: '[data-testid="user"]',
    url: `${BASE_URL}/settings/members/users`,
  },
  teams: {
    testid: '[data-testid="teams"]',
    url: `${BASE_URL}/settings/members/teams`,
  },
  testSuites: {
    testid: '[data-testid="test-suite"]',
    url: `${BASE_URL}/test-suites`,
  },
  containers: {
    testid: '[data-testid="containers"]',
    url: `${BASE_URL}/explore/containers`,
  },
  glossaryTerms: {
    testid: '[data-testid="glossary-terms"]',
    url: `${BASE_URL}/glossary`,
  },
};

export const NAVBAR_DETAILS = {
  explore: {
    testid: '[data-testid="appbar-item-explore"]',
    url: `${BASE_URL}/explore/tables?page=1`,
  },
  quality: {
    testid: '[data-testid="appbar-item-data-quality"]',
    url: `${BASE_URL}/test-suites`,
  },
  insights: {
    testid: '[data-testid="appbar-item-data-insight"]',
    url: `${BASE_URL}/data-insights`,
  },
  glossary: {
    testid: `[data-testid="governance"]`,
    subMenu: `[data-testid="appbar-item-glossary"]`,
    url: `${BASE_URL}/glossary`,
  },
  tags: {
    testid: `[data-testid="governance"]`,
    subMenu: '[data-testid="appbar-item-tags"]',
    url: `${BASE_URL}/tags/`,
  },
  settings: {
    testid: '[data-testid="appbar-item-settings"]',
    url: `${BASE_URL}/settings/members/teams/Organization`,
  },
  profile: {
    testid: '[data-testid="dropdown-profile"]',
    subMenu: '[data-testid="greeting-text"] [data-testid="user-name"]',
    url: `${BASE_URL}/users/admin`,
  },
};

export const SETTINGS_LEFT_PANEL = {
  settings: {
    testid: '[data-testid="appbar-item-settings"]',
    url: `${BASE_URL}/settings/members/teams/Organization`,
  },
  teams: {
    testid: '[data-menu-id*="teams"]',
    url: `${BASE_URL}/settings/members/teams/Organization`,
  },
  users: {
    testid: '[data-menu-id*="users"]',
    url: `${BASE_URL}/settings/members/users`,
  },
  admins: {
    testid: '[data-menu-id*="admins"]',
    url: `${BASE_URL}/settings/members/admins`,
  },
  roles: {
    testid: '[data-menu-id*="roles"]',
    url: `${BASE_URL}/settings/access/roles`,
  },
  policies: {
    testid: '[data-menu-id*="policies"]',
    url: `${BASE_URL}/settings/access/policies`,
  },
  databases: {
    testid: '[data-menu-id*="databases"]',
    url: `${BASE_URL}/settings/services/databases`,
  },
  messaging: {
    testid: '[data-menu-id*="messaging"]',
    url: `${BASE_URL}/settings/services/messaging`,
  },
  dashboard: {
    testid: '[data-menu-id*="services.dashboards"]',
    url: `${BASE_URL}/settings/services/dashboards`,
  },
  pipelines: {
    testid: '[data-menu-id*="services.pipelines"]',
    url: `${BASE_URL}/settings/services/pipelines`,
  },
  mlmodels: {
    testid: '[data-menu-id*="services.mlModels"]',
    url: `${BASE_URL}/settings/services/mlModels`,
  },
  metadata: {
    testid: '[data-menu-id*="metadata"]',
    url: `${BASE_URL}/settings/services/metadata`,
  },
  customAttributesTable: {
    testid: '[data-menu-id*="tables"]',
    url: `${BASE_URL}/settings/customAttributes/tables`,
  },
  customAttributesTopics: {
    testid: '[data-menu-id*="topics"]',
    url: `${BASE_URL}/settings/customAttributes/topics`,
  },
  customAttributesDashboards: {
    testid: '[data-menu-id*="customAttributes.dashboards"]',
    url: `${BASE_URL}/settings/customAttributes/dashboards`,
  },
  customAttributesPipelines: {
    testid: '[data-menu-id*="customAttributes.pipelines"]',
    url: `${BASE_URL}/settings/customAttributes/pipelines`,
  },
  customAttributesMlModels: {
    testid: '[data-menu-id*="customAttributes.mlModels"]',
    url: `${BASE_URL}/settings/customAttributes/mlModels`,
  },
  search: {
    testid: '[data-menu-id*="search"]',
    url: `${BASE_URL}/settings/openMetadata/search`,
  },
  bots: {
    testid: '[data-menu-id*="bots"]',
    url: `${BASE_URL}/settings/integrations/bots`,
  },
};
