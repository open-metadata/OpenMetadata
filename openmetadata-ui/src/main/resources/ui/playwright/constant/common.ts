import { GlobalSettingOptions } from './settings';

/*
 *  Copyright 2024 Collate.
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
export const TAG_INVALID_NAMES = {
  MIN_LENGTH: 'c',
  MAX_LENGTH: 'a87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890ab',
  WITH_SPECIAL_CHARS: '!@#$%^&*()',
};

export const INVALID_NAMES = {
  MAX_LENGTH:
    'a87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890aba87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890abName can be a maximum of 128 characters',
  WITH_SPECIAL_CHARS: '::normalName::',
};

export const NAME_VALIDATION_ERROR =
  'Name must contain only letters, numbers, underscores, hyphens, periods, parenthesis, and ampersands.';

export const NAME_MIN_MAX_LENGTH_VALIDATION_ERROR =
  'Name size must be between 2 and 64';

export const NAME_MAX_LENGTH_VALIDATION_ERROR =
  'Name size must be between 1 and 128';

export const GLOBAL_SETTING_PERMISSIONS: Record<
  string,
  { testid: GlobalSettingOptions; isCustomProperty?: boolean }
> = {
  metadata: {
    testid: GlobalSettingOptions.METADATA,
  },
  customAttributesDatabase: {
    testid: GlobalSettingOptions.DATABASES,
    isCustomProperty: true,
  },
  customAttributesDatabaseSchema: {
    testid: GlobalSettingOptions.DATABASE_SCHEMA,
    isCustomProperty: true,
  },
  customAttributesStoredProcedure: {
    testid: GlobalSettingOptions.STORED_PROCEDURES,
    isCustomProperty: true,
  },
  customAttributesTable: {
    testid: GlobalSettingOptions.TABLES,
    isCustomProperty: true,
  },
  customAttributesTopics: {
    testid: GlobalSettingOptions.TOPICS,
    isCustomProperty: true,
  },
  customAttributesDashboards: {
    testid: GlobalSettingOptions.DASHBOARDS,
    isCustomProperty: true,
  },
  customAttributesPipelines: {
    testid: GlobalSettingOptions.PIPELINES,
    isCustomProperty: true,
  },
  customAttributesMlModels: {
    testid: GlobalSettingOptions.MLMODELS,
    isCustomProperty: true,
  },
  customAttributesSearchIndex: {
    testid: GlobalSettingOptions.SEARCH_INDEXES,
    isCustomProperty: true,
  },
  customAttributesGlossaryTerm: {
    testid: GlobalSettingOptions.GLOSSARY_TERM,
    isCustomProperty: true,
  },
  customAttributesAPICollection: {
    testid: GlobalSettingOptions.API_COLLECTIONS,
    isCustomProperty: true,
  },
  customAttributesAPIEndpoint: {
    testid: GlobalSettingOptions.API_ENDPOINTS,
    isCustomProperty: true,
  },
  bots: {
    testid: GlobalSettingOptions.BOTS,
  },
};
export const ID: Record<
  string,
  { testid: GlobalSettingOptions; button: string; api?: string }
> = {
  teams: {
    testid: GlobalSettingOptions.TEAMS,
    button: 'add-team',
  },
  users: {
    testid: GlobalSettingOptions.USERS,
    button: 'add-user',
    api: '/api/v1/users?*',
  },
  admins: {
    testid: GlobalSettingOptions.ADMINS,
    button: 'add-user',
    api: '/api/v1/users?*',
  },
  databases: {
    testid: GlobalSettingOptions.DATABASES,
    button: 'add-service-button',
    api: '/api/v1/services/databaseServices?*',
  },
  messaging: {
    testid: GlobalSettingOptions.MESSAGING,
    button: 'add-service-button',
    api: '/api/v1/services/messagingServices?*',
  },
  dashboard: {
    testid: GlobalSettingOptions.DASHBOARDS,
    button: 'add-service-button',
    api: '/api/v1/services/dashboardServices?*',
  },
  pipelines: {
    testid: GlobalSettingOptions.PIPELINES,
    button: 'add-service-button',
    api: '/api/v1/services/pipelineServices?*',
  },
  mlmodels: {
    testid: GlobalSettingOptions.MLMODELS,
    button: 'add-service-button',
    api: '/api/v1/services/mlmodelServices?*',
  },
  storage: {
    testid: GlobalSettingOptions.STORAGES,
    button: 'add-service-button',
    api: '/api/v1/services/storageServices?*',
  },
};
