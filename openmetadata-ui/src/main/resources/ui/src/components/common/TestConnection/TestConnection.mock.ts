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
export const FORM_DATA = {
  type: 'Mysql',
  scheme: 'mysql+pymysql',
  username: 'openmetadata_user',
  password: 'openmetadata_password',
  hostPort: 'mysql:3306',
};

export const CREATE_WORKFLOW_PAYLOAD = {
  name: 'test-connection-Mysql-01',
  workflowType: 'TEST_CONNECTION',
  request: {
    connection: {
      config: {
        type: 'Mysql',
        scheme: 'mysql+pymysql',
        username: 'openmetadata_user',
        password: 'openmetadata_password',
        hostPort: 'mysql:3306',
      },
    },
    serviceType: 'Database',
    connectionType: 'Mysql',
  },
};

export const WORKFLOW_DETAILS = {
  id: 'd6a5178d-06ba-4702-9b32-ce72349aa88c',
  name: 'test-connection-Mysql-01',
  description: 'mysql test connection workflow',
  fullyQualifiedName: 'test-connection-mysql-01',
  workflowType: 'TEST_CONNECTION',
  status: 'Successful',
  request: {
    connection: {
      config: {
        type: 'Mysql',
        scheme: 'mysql+pymysql',
        username: 'openmetadata_user',
        password: 'openmetadata_password',
        hostPort: 'mysql:3306',
        supportsMetadataExtraction: true,
        supportsDBTExtraction: true,
        supportsProfiler: true,
        supportsQueryComment: true,
      },
    },
    serviceType: 'Database',
    connectionType: 'Mysql',
    serviceName: 'mysql_local_01',
    secretsManagerProvider: 'noop',
  },
  response: {
    steps: [
      {
        name: 'CheckAccess',
        passed: true,
        message: null,
        mandatory: true,
      },
      {
        name: 'GetSchemas',
        passed: true,
        message: null,
        mandatory: true,
      },
      {
        name: 'GetTables',
        passed: true,
        message: null,
        mandatory: true,
      },
      {
        name: 'GetViews',
        passed: true,
        message: null,
        mandatory: false,
      },
    ],
    status: 'Successful',
    lastUpdatedAt: 1.679640427492524e9,
  },
  openMetadataServerConnection: {
    clusterName: 'openmetadata',
    type: 'OpenMetadata',
    hostPort: 'http://openmetadata-server:8585/api',
    authProvider: 'openmetadata',
    verifySSL: 'no-ssl',
    securityConfig: {
      jwtToken: '',
    },
    secretsManagerProvider: 'noop',
    apiVersion: 'v1',
    includeTopics: true,
    includeTables: true,
    includeDashboards: true,
    includePipelines: true,
    includeMlModels: true,
    includeUsers: true,
    includeTeams: true,
    includeGlossaryTerms: true,
    includeTags: true,
    includePolicy: true,
    includeMessagingServices: true,
    enableVersionValidation: true,
    includeDatabaseServices: true,
    includePipelineServices: true,
    limitRecords: 1000,
    forceEntityOverwriting: false,
    supportsDataInsightExtraction: true,
    supportsElasticSearchReindexingExtraction: true,
  },
  version: 0.6,
  updatedAt: 1679640427530,
  updatedBy: 'ingestion-bot',
  href: 'http://localhost:8585/api/v1/automations/workflow/d6a5178d-06ba-4702-9b32-ce72349aa88c',
  deleted: false,
};

export const TEST_CONNECTION_DEFINITION = {
  id: '4222ce22-e838-41ad-bb7c-2271bd9d0ac6',
  name: 'Mysql',
  displayName: 'Mysql Test Connection',
  description:
    'This Test Connection validates the access against the database and basic metadata extraction of schemas and tables.',
  fullyQualifiedName: 'Mysql',
  steps: [
    {
      name: 'CheckAccess',
      description:
        'Validate that we can properly reach the database and authenticate with the given credentials.',
      mandatory: true,
    },
    {
      name: 'GetSchemas',
      description: 'List all the schemas available to the user.',
      mandatory: true,
    },
    {
      name: 'GetTables',
      description:
        "From a given schema, list the tables belonging to that schema. If no schema is specified, we'll list the tables of a random schema.",
      mandatory: true,
    },
    {
      name: 'GetViews',
      description:
        "From a given schema, list the views belonging to that schema. If no schema is specified, we'll list the tables of a random schema.",
      mandatory: false,
    },
  ],
  version: 0.1,
  updatedAt: 1679501180013,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/services/testConnectionDefinition/4222ce22-e838-41ad-bb7c-2271bd9d0ac6',
  deleted: false,
};
