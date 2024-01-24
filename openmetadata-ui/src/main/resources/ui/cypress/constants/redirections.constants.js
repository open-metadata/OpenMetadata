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

import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../src/constants/GlobalSettings.constants';
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
    testid: 'app-bar-item-explore',
    url: `${BASE_URL}/explore/tables`,
  },
  quality: {
    testid: `observability`,
    subMenu: 'app-bar-item-data-quality',
    url: `${BASE_URL}/data-quality`,
  },
  incidentManager: {
    testid: `observability`,
    subMenu: 'app-bar-item-incident-manager',
    url: `${BASE_URL}/incident-manager`,
  },
  insights: {
    testid: 'app-bar-item-data-insight',
    url: `${BASE_URL}/data-insights`,
  },
  glossary: {
    testid: 'governance',
    subMenu: `app-bar-item-glossary`,
    url: `${BASE_URL}/glossary`,
  },
  tags: {
    testid: 'governance',
    subMenu: 'app-bar-item-tags',
    url: `${BASE_URL}/tags/`,
  },
  settings: {
    testid: 'app-bar-item-settings',
    url: `${BASE_URL}/settings`,
  },
  profile: {
    testid: 'dropdown-profile',
    subMenu: 'user-name',
    url: `${BASE_URL}/users/admin`,
  },
};

export const SETTINGS_PAGE_OPTIONS = {
  // Services
  databases: {
    testid: GlobalSettingOptions.DATABASES,
    url: `${BASE_URL}/settings/services/databases`,
  },
  messaging: {
    testid: GlobalSettingOptions.MESSAGING,
    url: `${BASE_URL}/settings/services/messaging`,
  },
  dashboard: {
    testid: GlobalSettingOptions.DASHBOARDS,
    url: `${BASE_URL}/settings/services/dashboards`,
  },
  pipeline: {
    testid: GlobalSettingOptions.PIPELINES,
    url: `${BASE_URL}/settings/services/pipelines`,
  },
  mlmodel: {
    testid: GlobalSettingOptions.MLMODELS,
    url: `${BASE_URL}/settings/services/mlmodels`,
  },
  storages: {
    testid: GlobalSettingOptions.STORAGES,
    url: `${BASE_URL}/settings/services/storages`,
  },

  searchService: {
    testid: GlobalSettingOptions.SEARCH,
    url: `${BASE_URL}/settings/services/search`,
  },
  metadata: {
    testid: GlobalSettingOptions.METADATA,
    url: `${BASE_URL}/settings/services/metadata`,
  },

  // Integrations
  applications: {
    testid: GlobalSettingOptions.APPLICATIONS,
    url: `${BASE_URL}/settings/apps`,
  },
  bots: {
    testid: GlobalSettingOptions.BOTS,
    url: `${BASE_URL}/settings/bots`,
  },

  // Notification
  notification: {
    testid: GlobalSettingsMenuCategory.NOTIFICATIONS,
    url: `${BASE_URL}/settings/notifications`,
  },

  // Teams  User Management
  users: {
    testid: GlobalSettingOptions.USERS,
    url: `${BASE_URL}/settings/members/users`,
  },
  teams: {
    testid: GlobalSettingOptions.TEAMS,
    url: `${BASE_URL}/settings/members/teams/Organization`,
  },
  admins: {
    testid: GlobalSettingOptions.ADMINS,
    url: `${BASE_URL}/settings/members/admins`,
  },
  persona: {
    testid: GlobalSettingOptions.PERSONA,
    url: `${BASE_URL}/settings/members/persona`,
  },

  // Access Control
  roles: {
    testid: GlobalSettingOptions.ROLES,
    url: `${BASE_URL}/settings/access/roles`,
  },
  policies: {
    testid: GlobalSettingOptions.POLICIES,
    url: `${BASE_URL}/settings/access/policies`,
  },

  // Open-metadata
  customizeLandingPage: {
    testid: GlobalSettingOptions.CUSTOMIZE_LANDING_PAGE,
    url: `${BASE_URL}/settings/openMetadata/customizeLandingPage`,
  },
  email: {
    testid: GlobalSettingOptions.EMAIL,
    url: `${BASE_URL}/settings/openMetadata/email`,
  },
  customLogo: {
    testid: GlobalSettingOptions.CUSTOM_LOGO,
    url: `${BASE_URL}/settings/openMetadata/customLogo`,
  },
  loginConfiguration: {
    testid: GlobalSettingOptions.LOGIN_CONFIGURATION,
    url: `${BASE_URL}/settings/openMetadata/loginConfiguration`,
  },

  // CustomProperties

  customPropertiesTable: {
    testid: GlobalSettingOptions.TABLES,
    url: `${BASE_URL}/settings/customProperties/tables`,
    isCustomProperty: true,
  },
  customPropertiesTopics: {
    testid: GlobalSettingOptions.TOPICS,
    url: `${BASE_URL}/settings/customProperties/topics`,
    isCustomProperty: true,
  },
  customPropertiesDashboards: {
    testid: GlobalSettingOptions.DASHBOARDS,
    url: `${BASE_URL}/settings/customProperties/dashboards`,
    isCustomProperty: true,
  },
  customPropertiesPipelines: {
    testid: GlobalSettingOptions.PIPELINES,
    url: `${BASE_URL}/settings/customProperties/pipelines`,
    isCustomProperty: true,
  },
  customPropertiesMlModels: {
    testid: GlobalSettingOptions.MLMODELS,
    url: `${BASE_URL}/settings/customProperties/mlmodels`,
    isCustomProperty: true,
  },
  customPropertiesContainers: {
    testid: GlobalSettingOptions.CONTAINERS,
    url: `${BASE_URL}/settings/customProperties/containers`,
    isCustomProperty: true,
  },
  customPropertiesSearchIndex: {
    testid: GlobalSettingOptions.SEARCH_INDEXES,
    url: `${BASE_URL}/settings/customProperties/searchIndexes`,
    isCustomProperty: true,
  },
  customPropertiesStoredProcedure: {
    testid: GlobalSettingOptions.STORED_PROCEDURES,
    url: `${BASE_URL}/settings/customProperties/storedProcedures`,
    isCustomProperty: true,
  },
  customPropertiesGlossaryTerm: {
    testid: GlobalSettingOptions.GLOSSARY_TERM,
    url: `${BASE_URL}/settings/customProperties/glossaryTerm`,
    isCustomProperty: true,
  },
  customPropertiesDatabases: {
    testid: GlobalSettingOptions.DATABASES,
    url: `${BASE_URL}/settings/customProperties/databases`,
    isCustomProperty: true,
  },
  customPropertiesDatabaseSchema: {
    testid: GlobalSettingOptions.DATABASE_SCHEMA,
    url: `${BASE_URL}/settings/customProperties/databaseSchemas`,
    isCustomProperty: true,
  },
};
