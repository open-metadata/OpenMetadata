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
import { uuid } from '../common/common';
import {
  getContainerCreationDetails,
  getDashboardCreationDetails,
  getDashboardDataModelCreationDetails,
  getDashboardServiceCreationDetails,
  getDatabaseCreationDetails,
  getDatabaseSchemaCreationDetails,
  getDatabaseServiceCreationDetails,
  getMessagingServiceCreationDetails,
  getMlModelCreationDetails,
  getMlModelServiceCreationDetails,
  getPipelineCreationDetails,
  getPipelineServiceCreationDetails,
  getSearchIndexCreationDetails,
  getSearchServiceCreationDetails,
  getStorageServiceCreationDetails,
  getStoredProcedureCreationDetails,
  getTableCreationDetails,
  getTopicCreationDetails,
} from '../common/EntitiyUtils';
import { DATA_ASSETS } from './constants';
import { SERVICE_CATEGORIES } from './service.constants';

export const OWNER = 'Amber Green';
export const REVIEWER = 'Amanda York';
export const TIER = 'Tier1';

const DATABASE_SERVICE_NAME = `soft_del_db_service-${uuid()}`;
const MESSAGING_SERVICE_NAME = `soft_del_messaging_service-${uuid()}`;
const DASHBOARD_SERVICE_NAME = `soft_del_dashboard_service-${uuid()}`;
const PIPELINE_SERVICE_NAME = `soft_del_pipeline_service-${uuid()}`;
const ML_MODEL_SERVICE_NAME = `soft_del_ml_model_service-${uuid()}`;
const STORAGE_SERVICE_NAME = `soft_del_storage_service-${uuid()}`;
const SEARCH_SERVICE_NAME = `soft_del_search_service-${uuid()}`;
const DATABASE_NAME = `soft_del_database-${uuid()}`;
const DATABASE_SCHEMA_NAME = `soft_del_schema-${uuid()}`;
const TABLE_NAME = `soft_del_table-${uuid()}`;
const TOPIC_NAME = `soft_del_topic-${uuid()}`;
const DASHBOARD_NAME = `soft_del_dashboard-${uuid()}`;
const PIPELINE_NAME = `soft_del_pipeline-${uuid()}`;
const ML_MODEL_NAME = `soft_del_ml_model-${uuid()}`;
const CONTAINER_NAME = `soft_del_container-${uuid()}`;
const SEARCH_INDEX_NAME = `soft_del_search_index-${uuid()}`;
const STORED_PROCEDURE_NAME = `soft_del_stored_procedure-${uuid()}`;
const DATA_MODEL_NAME = `soft_del_data_model_${uuid()}`;

const DATABASE_FQN = `${DATABASE_SERVICE_NAME}.${DATABASE_NAME}`;
const DATABASE_SCHEMA_FQN = `${DATABASE_SERVICE_NAME}.${DATABASE_NAME}.${DATABASE_SCHEMA_NAME}`;

export const POLICY_NAME = `soft_del_policy_${uuid()}`;
export const ROLE_NAME = `soft_del_role_${uuid()}`;
export const TEAM_1_NAME = `soft_del_team_1_${uuid()}`;
export const TEAM_2_NAME = `soft_del_team_2_${uuid()}`;
export const CUSTOM_ATTRIBUTE_NAME = `softDeleteTestProperty${uuid()}`;

export const DATABASE_SERVICE_DETAILS_SOFT_DELETE_TEST = {
  settingsMenuId: 'services.databases',
  serviceCategory: SERVICE_CATEGORIES.DATABASE_SERVICES,
  serviceName: DATABASE_SERVICE_NAME,
};

export const DATABASE_SOFT_DELETE_TEST = {
  ...DATABASE_SERVICE_DETAILS_SOFT_DELETE_TEST,
  databaseName: DATABASE_NAME,
  entitySchemaName: 'database',
};

export const DATABASE_SCHEMA_SOFT_DELETE_TEST = {
  ...DATABASE_SOFT_DELETE_TEST,
  entitySchemaName: 'databaseSchema',
  databaseSchemaName: DATABASE_SCHEMA_NAME,
};

export const DATABASE_SERVICE_SOFT_DELETE_TEST = {
  service: getDatabaseServiceCreationDetails({ name: DATABASE_SERVICE_NAME }),
  database: getDatabaseCreationDetails({
    name: DATABASE_NAME,
    serviceFQN: DATABASE_SERVICE_NAME,
  }),
  schema: getDatabaseSchemaCreationDetails({
    name: DATABASE_SCHEMA_NAME,
    databaseFQN: DATABASE_FQN,
  }),
  entity: getTableCreationDetails({
    name: TABLE_NAME,
    databaseSchemaFQN: DATABASE_SCHEMA_FQN,
  }),
  firstTabKey: 'schema',
  entitySchemaName: 'table',
  serviceType: SERVICE_CATEGORIES.DATABASE_SERVICES,
  entityType: DATA_ASSETS.tables,
  entityTypeDisplay: 'Table',
};

export const MESSAGING_SERVICE_SOFT_DELETE_TEST = {
  service: getMessagingServiceCreationDetails({ name: MESSAGING_SERVICE_NAME }),
  entity: getTopicCreationDetails({
    name: TOPIC_NAME,
    serviceFQN: MESSAGING_SERVICE_NAME,
  }),
  firstTabKey: 'schema',
  entitySchemaName: 'topic',
  serviceType: SERVICE_CATEGORIES.MESSAGING_SERVICES,
  entityType: DATA_ASSETS.topics,
  entityTypeDisplay: 'Topic',
};
export const DASHBOARD_SERVICE_SOFT_DELETE_TEST = {
  service: getDashboardServiceCreationDetails({ name: DASHBOARD_SERVICE_NAME }),
  entity: getDashboardCreationDetails({
    name: DASHBOARD_NAME,
    serviceFQN: DASHBOARD_SERVICE_NAME,
  }),
  firstTabKey: 'details',
  entitySchemaName: 'dashboard',
  serviceType: SERVICE_CATEGORIES.DASHBOARD_SERVICES,
  entityType: DATA_ASSETS.dashboards,
  entityTypeDisplay: 'Dashboard',
};
export const PIPELINE_SERVICE_SOFT_DELETE_TEST = {
  service: getPipelineServiceCreationDetails({ name: PIPELINE_SERVICE_NAME }),
  entity: getPipelineCreationDetails({
    name: PIPELINE_NAME,
    serviceFQN: PIPELINE_SERVICE_NAME,
  }),
  firstTabKey: 'tasks',
  entitySchemaName: 'pipeline',
  serviceType: SERVICE_CATEGORIES.PIPELINE_SERVICES,
  entityType: DATA_ASSETS.pipelines,
  entityTypeDisplay: 'Pipeline',
};
export const ML_MODEL_SERVICE_SOFT_DELETE_TEST = {
  service: getMlModelServiceCreationDetails({ name: ML_MODEL_SERVICE_NAME }),
  entity: getMlModelCreationDetails({
    name: ML_MODEL_NAME,
    serviceFQN: ML_MODEL_SERVICE_NAME,
  }),
  firstTabKey: 'features',
  entitySchemaName: 'mlmodel',
  serviceType: SERVICE_CATEGORIES.ML_MODEL_SERVICES,
  entityType: DATA_ASSETS.mlmodels,
  entityTypeDisplay: 'ML Model',
};

export const STORAGE_SERVICE_SOFT_DELETE_TEST = {
  service: getStorageServiceCreationDetails({ name: STORAGE_SERVICE_NAME }),
  entity: getContainerCreationDetails({
    name: CONTAINER_NAME,
    serviceFQN: STORAGE_SERVICE_NAME,
  }),
  firstTabKey: 'children',
  entitySchemaName: 'container',
  serviceType: SERVICE_CATEGORIES.STORAGE_SERVICES,
  entityType: DATA_ASSETS.containers,
  entityTypeDisplay: 'Container',
};

export const SEARCH_SERVICE_SOFT_DELETE_TEST = {
  service: getSearchServiceCreationDetails({ name: SEARCH_SERVICE_NAME }),
  entity: getSearchIndexCreationDetails({
    name: SEARCH_INDEX_NAME,
    serviceFQN: SEARCH_SERVICE_NAME,
  }),
  firstTabKey: 'fields',
  entitySchemaName: 'searchIndex',
  serviceType: SERVICE_CATEGORIES.SEARCH_SERVICES,
  entityType: DATA_ASSETS.searchIndexes,
  entityTypeDisplay: 'Search Index',
};

export const DASHBOARD_DATA_MODEL_SOFT_DELETE_TEST =
  getDashboardDataModelCreationDetails({
    name: DATA_MODEL_NAME,
    serviceFQN: DASHBOARD_SERVICE_NAME,
  });

export const STORED_PROCEDURE_SOFT_DELETE_TEST =
  getStoredProcedureCreationDetails({
    name: STORED_PROCEDURE_NAME,
    databaseSchemaFQN: DATABASE_SCHEMA_FQN,
  });

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
    entity: STORED_PROCEDURE_SOFT_DELETE_TEST,
    firstTabKey: 'code',
    entitySchemaName: 'storedProcedure',
    entityType: DATA_ASSETS.storedProcedures,
    entityTypeDisplay: 'Stored Procedure',
  },
  {
    ...DASHBOARD_SERVICE_SOFT_DELETE_TEST,
    entity: DASHBOARD_DATA_MODEL_SOFT_DELETE_TEST,
    entityType: DATA_ASSETS.dataModel,
    entityTypeDisplay: 'Data Model',
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
