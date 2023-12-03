/*
 *  Copyright 2023 Collate.
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

// eslint-disable-next-line spaced-comment
/// <reference types="cypress" />

import { uuid } from '../common/common';
import { DATA_ASSETS } from './constants';
import {
  DASHBOARD_DATA_MODEL_DETAILS,
  DASHBOARD_SERVICE,
  DATABASE_SERVICE,
  MESSAGING_SERVICE,
  ML_MODEL_SERVICE,
  PIPELINE_SERVICE,
  SEARCH_SERVICE,
  STORAGE_SERVICE,
  STORED_PROCEDURE_DETAILS,
} from './EntityConstant';
import { SERVICE_CATEGORIES } from './service.constants';

export const OWNER = 'Amber Green';
export const REVIEWER = 'Amanda York';
export const TIER = 'Tier1';

export const POLICY_NAME = `soft_del_policy_${uuid()}`;
export const ROLE_NAME = `soft_del_role_${uuid()}`;
export const TEST_CASE_NAME = `soft_del_test_case_${uuid()}`;
export const TEAM_1_NAME = `soft_del_team_1_${uuid()}`;
export const TEAM_2_NAME = `soft_del_team_2_${uuid()}`;
export const CUSTOM_ATTRIBUTE_NAME = `softDeleteTestProperty${uuid()}`;

export const DATABASE_SERVICE_DETAILS_SOFT_DELETE_TEST = {
  settingsMenuId: 'services.databases',
  serviceCategory: SERVICE_CATEGORIES.DATABASE_SERVICES,
  serviceName: DATABASE_SERVICE.service.name,
  childName: DATABASE_SERVICE.database.name,
};

export const MESSAGING_SERVICE_DETAILS_SOFT_DELETE_TEST = {
  settingsMenuId: 'services.messaging',
  serviceCategory: SERVICE_CATEGORIES.MESSAGING_SERVICES,
  serviceName: MESSAGING_SERVICE.service.name,
  childName: MESSAGING_SERVICE.entity.name,
};

export const DASHBOARD_SERVICE_DETAILS_SOFT_DELETE_TEST = {
  settingsMenuId: 'services.dashboards',
  serviceCategory: SERVICE_CATEGORIES.DASHBOARD_SERVICES,
  serviceName: DASHBOARD_SERVICE.service.name,
  childName: DASHBOARD_SERVICE.entity.name,
};

export const PIPELINE_SERVICE_DETAILS_SOFT_DELETE_TEST = {
  settingsMenuId: 'services.pipelines',
  serviceCategory: SERVICE_CATEGORIES.PIPELINE_SERVICES,
  serviceName: PIPELINE_SERVICE.service.name,
  childName: PIPELINE_SERVICE.entity.name,
};

export const ML_MODEL_SERVICE_DETAILS_SOFT_DELETE_TEST = {
  settingsMenuId: 'services.mlModels',
  serviceCategory: SERVICE_CATEGORIES.ML_MODEL_SERVICES,
  serviceName: ML_MODEL_SERVICE.service.name,
  childName: ML_MODEL_SERVICE.entity.name,
};

export const STORAGE_SERVICE_DETAILS_SOFT_DELETE_TEST = {
  settingsMenuId: 'services.storages',
  serviceCategory: SERVICE_CATEGORIES.STORAGE_SERVICES,
  serviceName: STORAGE_SERVICE.service.name,
  childName: STORAGE_SERVICE.entity.name,
};

export const SEARCH_SERVICE_DETAILS_SOFT_DELETE_TEST = {
  settingsMenuId: 'services.search',
  serviceCategory: SERVICE_CATEGORIES.SEARCH_SERVICES,
  serviceName: SEARCH_SERVICE.service.name,
  childName: SEARCH_SERVICE.entity.name,
};

export const SERVICES_LIST = [
  DATABASE_SERVICE_DETAILS_SOFT_DELETE_TEST,
  MESSAGING_SERVICE_DETAILS_SOFT_DELETE_TEST,
  DASHBOARD_SERVICE_DETAILS_SOFT_DELETE_TEST,
  PIPELINE_SERVICE_DETAILS_SOFT_DELETE_TEST,
  ML_MODEL_SERVICE_DETAILS_SOFT_DELETE_TEST,
  STORAGE_SERVICE_DETAILS_SOFT_DELETE_TEST,
  SEARCH_SERVICE_DETAILS_SOFT_DELETE_TEST,
];

export const DATABASE_SOFT_DELETE_TEST = {
  ...DATABASE_SERVICE_DETAILS_SOFT_DELETE_TEST,
  databaseName: DATABASE_SERVICE.database.name,
  entitySchemaName: 'database',
};

export const DATABASE_SCHEMA_SOFT_DELETE_TEST = {
  ...DATABASE_SOFT_DELETE_TEST,
  entitySchemaName: 'databaseSchema',
  databaseSchemaName: DATABASE_SERVICE.schema.name,
};

export const DATABASE_SERVICE_SOFT_DELETE_TEST = {
  ...DATABASE_SERVICE,
  firstTabKey: 'schema',
  entitySchemaName: 'table',
};

export const MESSAGING_SERVICE_SOFT_DELETE_TEST = {
  ...MESSAGING_SERVICE,
  firstTabKey: 'schema',
  entitySchemaName: 'topic',
};
export const DASHBOARD_SERVICE_SOFT_DELETE_TEST = {
  ...DASHBOARD_SERVICE,
  firstTabKey: 'details',
  entitySchemaName: 'dashboard',
};
export const PIPELINE_SERVICE_SOFT_DELETE_TEST = {
  ...PIPELINE_SERVICE,
  firstTabKey: 'tasks',
  entitySchemaName: 'pipeline',
};
export const ML_MODEL_SERVICE_SOFT_DELETE_TEST = {
  ...ML_MODEL_SERVICE,
  firstTabKey: 'features',
  entitySchemaName: 'mlmodel',
};

export const STORAGE_SERVICE_SOFT_DELETE_TEST = {
  ...STORAGE_SERVICE,
  firstTabKey: 'children',
  entitySchemaName: 'container',
};

export const SEARCH_SERVICE_SOFT_DELETE_TEST = {
  ...SEARCH_SERVICE,
  firstTabKey: 'fields',
  entitySchemaName: 'searchIndex',
};

export const ALL_SERVICES_SOFT_DELETE_TEST = [
  DATABASE_SERVICE_SOFT_DELETE_TEST,
  MESSAGING_SERVICE_SOFT_DELETE_TEST,
  DASHBOARD_SERVICE_SOFT_DELETE_TEST,
  PIPELINE_SERVICE_SOFT_DELETE_TEST,
  ML_MODEL_SERVICE_SOFT_DELETE_TEST,
  STORAGE_SERVICE_SOFT_DELETE_TEST,
  SEARCH_SERVICE_SOFT_DELETE_TEST,
  {
    ...DATABASE_SERVICE_SOFT_DELETE_TEST,
    entity: STORED_PROCEDURE_DETAILS,
    firstTabKey: 'code',
    entitySchemaName: 'storedProcedure',
    entityType: DATA_ASSETS.storedProcedures,
  },
  {
    ...DASHBOARD_SERVICE_SOFT_DELETE_TEST,
    entity: DASHBOARD_DATA_MODEL_DETAILS,
    entityType: DATA_ASSETS.dataModel,
    entitySchemaName: undefined,
  },
];

export const CUSTOM_ATTRIBUTE_ASSETS_SOFT_DELETE_TEST = [
  ...ALL_SERVICES_SOFT_DELETE_TEST,
  DATABASE_SOFT_DELETE_TEST,
  DATABASE_SCHEMA_SOFT_DELETE_TEST,
];

export const OMIT_SERVICE_CREATION_FOR_ENTITIES = [
  'dashboardDataModel',
  'storedProcedures',
];

export const SINGLE_LEVEL_SERVICE_SOFT_DELETE_TEST =
  ALL_SERVICES_SOFT_DELETE_TEST.filter(
    (service) => service.serviceType !== SERVICE_CATEGORIES.DATABASE_SERVICES
  );

export const LIST_OF_FIELDS_TO_EDIT_NOT_TO_BE_PRESENT = [
  {
    containerSelector: '[data-testid="header-domain-container"]',
    elementSelector: '[data-testid="add-domain"]',
  },
  {
    containerSelector: '[data-testid="owner-label"]',
    elementSelector: '[data-testid="edit-owner"]',
  },
  {
    containerSelector: '[data-testid="header-tier-container"]',
    elementSelector: '[data-testid="edit-tier"]',
  },
  {
    containerSelector: '[data-testid="asset-description-container"]',
    elementSelector: '[data-testid="edit-description"]',
  },
  {
    containerSelector:
      '[data-testid="entity-right-panel"] [data-testid="tags-container"]',
    elementSelector: '[data-testid="add-tag"]',
  },
  {
    containerSelector:
      '[data-testid="entity-right-panel"] [data-testid="glossary-container"]',
    elementSelector: '[data-testid="add-tag"]',
  },
];

export const LIST_OF_FIELDS_TO_EDIT_TO_BE_DISABLED = [
  {
    containerSelector: '[data-testid="asset-header-btn-group"]',
    elementSelector: '[data-testid="up-vote-btn"]',
  },
  {
    containerSelector: '[data-testid="asset-header-btn-group"]',
    elementSelector: '[data-testid="down-vote-btn"]',
  },
  {
    containerSelector: '[data-testid="asset-header-btn-group"]',
    elementSelector: '[data-testid="entity-follow-button"]',
  },
];

export const ENTITIES_WITHOUT_FOLLOWING_BUTTON = [
  'databases',
  'databaseSchemas',
  'services/databaseServices',
  'services/messagingServices',
  'services/pipelineServices',
  'services/dashboardServices',
  'services/mlmodelServices',
  'services/storageServices',
  'services/metadataServices',
  'services/searchServices',
];

export const TEAM_1_DETAILS_SOFT_DELETE_TEST = {
  name: TEAM_1_NAME,
  displayName: TEAM_1_NAME,
  teamType: 'Division',
};

export const TEAM_2_DETAILS_SOFT_DELETE_TEST = {
  name: TEAM_2_NAME,
  displayName: TEAM_2_NAME,
  teamType: 'Group',
};

// eslint-disable-next-line max-len
export const TABLE_FQN = `${DATABASE_SERVICE_SOFT_DELETE_TEST.service.name}.${DATABASE_SERVICE_SOFT_DELETE_TEST.database.name}.${DATABASE_SERVICE_SOFT_DELETE_TEST.schema.name}.${DATABASE_SERVICE_SOFT_DELETE_TEST.entity.name}`;

export const TEST_CASE_DETAILS = {
  name: TEST_CASE_NAME,
  entityLink: `<#E::table::${TABLE_FQN}>`,
  testDefinition: 'tableColumnCountToEqual',
  testSuite: `${TABLE_FQN}.testSuite`,
  parameterValues: [
    {
      name: 'columnCount',
      value: 5,
    },
  ],
};
