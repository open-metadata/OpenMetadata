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
import { MYDATA_SUMMARY_OPTIONS, SERVICE_TYPE } from './constants';

export const SERVICES = {
  databaseServices: {
    type: SERVICE_TYPE.Database,
    name: 'mysqlService',
    displayName: 'mySQL Service',
  },
  messagingServices: {
    type: SERVICE_TYPE.Messaging,
    name: 'kafkaMessagingServices',
    displayName: 'Kafka Messaging Service',
  },
  dashboardServices: {
    type: SERVICE_TYPE.Dashboard,
    name: 'lookerDashboardService',
    displayName: 'Looker Dashboard Service',
  },
  pipelineServices: {
    type: SERVICE_TYPE.Pipelines,
    name: 'airflowPipelineService',
    displayName: 'Airflow Pipeline Service',
  },
  mlmodelServices: {
    type: SERVICE_TYPE.MLModels,
    name: 'mlFlowService',
    displayName: 'ML Flow Service',
  },
  storageServices: {
    type: SERVICE_TYPE.Storage,
    name: 'storageService',
    displayName: 'Storage Service',
  },
};

const DB_SERVICE = SERVICES.databaseServices.name;
const DATABASE_AND_SCHEMA = {
  schema: 'mysqlDatabaseSchemas',
  schemaDisplayName: 'mySQL Database Schemas',
  database: 'mysqlDatabase',
  databaseDisplayName: 'mySQL Database',
};

export const ENTITIES_DISPLAY_NAME = {
  table: {
    name: 'mysqlTable',
    displayName: 'mySQL Table',
    entity: MYDATA_SUMMARY_OPTIONS.tables,
    serviceName: DB_SERVICE,
    breadcrumb: [
      DATABASE_AND_SCHEMA.schemaDisplayName,
      DATABASE_AND_SCHEMA.databaseDisplayName,
      SERVICES.databaseServices.displayName,
    ],
  },
  topic: {
    name: 'kafkaTopic',
    displayName: 'Kafka Topic',
    entity: MYDATA_SUMMARY_OPTIONS.topics,
    serviceName: SERVICES.messagingServices.name,
    breadcrumb: [SERVICES.messagingServices.displayName],
  },
  dashboard: {
    name: 'lookerDashboards',
    displayName: 'Looker Dashboards',
    entity: MYDATA_SUMMARY_OPTIONS.dashboards,
    serviceName: SERVICES.dashboardServices.name,
    breadcrumb: [SERVICES.dashboardServices.displayName],
  },
  pipeline: {
    name: 'airflowPipelines',
    displayName: 'Airflow Pipelines',
    entity: MYDATA_SUMMARY_OPTIONS.pipelines,
    serviceName: SERVICES.pipelineServices.name,
    breadcrumb: [SERVICES.pipelineServices.displayName],
  },
  mlmodel: {
    name: 'mlFlowMlModel',
    displayName: 'ML Flow MlModel',
    entity: MYDATA_SUMMARY_OPTIONS.mlmodels,
    serviceName: SERVICES.mlmodelServices.name,
    breadcrumb: [SERVICES.mlmodelServices.displayName],
  },
  container: {
    name: 'containerFile',
    displayName: 'Container File',
    entity: MYDATA_SUMMARY_OPTIONS.containers,
    serviceName: SERVICES.storageServices.name,
    breadcrumb: [SERVICES.storageServices.displayName],
  },
};
export const DASHBOARD_DATA_MODEL = {
  service: SERVICES.dashboardServices,
  name: 'dashboardDataModel',
  displayName: 'Dashboard Data Model',
  breadcrumb: [SERVICES.dashboardServices.displayName],
};

export const SCHEMA_AND_DATABASE_DISPLAY_NAME = {
  ...ENTITIES_DISPLAY_NAME.table,
  ...DATABASE_AND_SCHEMA,
  schemaBreadcrumb: [
    DATABASE_AND_SCHEMA.databaseDisplayName,
    SERVICES.databaseServices.displayName,
  ],
  databaseBreadcrumb: [SERVICES.databaseServices.displayName],
};

export const DATABASE_SERVICE_API = [
  {
    url: '/api/v1/services/databaseServices',
    method: 'POST',
    body: {
      name: DB_SERVICE,
      serviceType: 'Mysql',
      description: '',
      connection: {
        config: {
          type: 'Mysql',
          scheme: 'mysql+pymysql',
          connectionOptions: {},
          connectionArguments: {},
          supportsMetadataExtraction: true,
          supportsDBTExtraction: true,
          supportsProfiler: true,
          supportsQueryComment: true,
          username: 'openmetadata',
          password: 'openmetadata',
          hostPort: 'host.docker.internal:3306',
        },
      },
    },
  },
  {
    url: '/api/v1/databases',
    method: 'POST',
    body: {
      name: SCHEMA_AND_DATABASE_DISPLAY_NAME.database,
      service: DB_SERVICE,
    },
  },
  {
    url: '/api/v1/databaseSchemas',
    method: 'POST',
    body: {
      name: SCHEMA_AND_DATABASE_DISPLAY_NAME.schema,
      database: `${DB_SERVICE}.${SCHEMA_AND_DATABASE_DISPLAY_NAME.database}`,
    },
  },
  {
    url: '/api/v1/tables',
    method: 'POST',
    body: {
      columns: [
        {
          dataType: 'STRING',
          name: 'product_name',
        },
      ],
      databaseSchema: `${DB_SERVICE}.${SCHEMA_AND_DATABASE_DISPLAY_NAME.database}.${SCHEMA_AND_DATABASE_DISPLAY_NAME.schema}`,
      name: ENTITIES_DISPLAY_NAME.table.name,
    },
  },
];
export const MESSAGING_SERVICE_API = [
  {
    url: '/api/v1/services/messagingServices',
    method: 'POST',
    body: {
      name: SERVICES.messagingServices.name,
      serviceType: 'Kafka',
      connection: {
        config: {
          type: 'Kafka',
          saslMechanism: 'PLAIN',
          consumerConfig: {},
          schemaRegistryConfig: {},
          supportsMetadataExtraction: true,
          bootstrapServers: 'testBootstrpServers:8585',
        },
      },
    },
  },
  {
    url: '/api/v1/topics',
    method: 'POST',
    body: {
      name: ENTITIES_DISPLAY_NAME.topic.name,
      partitions: 128,
      service: SERVICES.messagingServices.name,
    },
  },
];
export const DASHBOARD_SERVICE_API = [
  {
    url: '/api/v1/services/dashboardServices',
    method: 'POST',
    body: {
      name: SERVICES.dashboardServices.name,
      serviceType: 'Looker',
      connection: {
        config: {
          type: 'Looker',
          supportsMetadataExtraction: true,
          clientId: 'openmetadata',
          clientSecret: 'openmetadata',
          hostPort: 'host.docker.internal:3306',
        },
      },
    },
  },
  {
    url: '/api/v1/dashboards',
    method: 'POST',
    body: {
      name: ENTITIES_DISPLAY_NAME.dashboard.name,
      displayName: ENTITIES_DISPLAY_NAME.dashboard.name,
      service: SERVICES.dashboardServices.name,
    },
  },
  {
    url: '/api/v1/dashboard/datamodels',
    method: 'POST',
    body: {
      columns: [
        {
          dataType: 'STRING',
          name: 'datamodel_name',
        },
      ],
      dataModelType: 'LookMlExplore',
      name: DASHBOARD_DATA_MODEL.name,
      displayName: DASHBOARD_DATA_MODEL.name,
      service: SERVICES.dashboardServices.name,
    },
  },
];
export const PIPELINE_SERVICE_API = [
  {
    url: '/api/v1/services/pipelineServices',
    method: 'POST',
    body: {
      name: SERVICES.pipelineServices.name,
      serviceType: 'Airflow',
      connection: {
        config: {
          type: 'Airflow',
          numberOfStatus: '10',
          connection: { type: 'Backend' },
          supportsMetadataExtraction: true,
          hostPort: 'host.docker.internal:3306',
        },
      },
    },
  },
  {
    url: '/api/v1/pipelines',
    method: 'POST',
    body: {
      name: ENTITIES_DISPLAY_NAME.pipeline.name,
      service: SERVICES.pipelineServices.name,
    },
  },
];
export const ML_MODAL_SERVICE_API = [
  {
    url: '/api/v1/services/mlmodelServices',
    method: 'POST',
    body: {
      name: SERVICES.mlmodelServices.name,
      serviceType: 'Mlflow',
      connection: {
        config: {
          type: 'Mlflow',
          supportsMetadataExtraction: true,
          trackingUri: 'localhost:8585',
          registryUri: 'localhost:8585',
        },
      },
    },
  },
  {
    url: '/api/v1/mlmodels',
    method: 'POST',
    body: {
      name: ENTITIES_DISPLAY_NAME.mlmodel.name,
      service: SERVICES.mlmodelServices.name,
      algorithm: 'Neural Network',
    },
  },
];
export const STORAGE_SERVICE_API = [
  {
    url: '/api/v1/services/storageServices',
    method: 'POST',
    body: {
      name: SERVICES.storageServices.name,
      serviceType: 'S3',
      connection: {
        config: {
          type: 'S3',
          awsConfig: {
            assumeRoleSessionName: 'OpenMetadataSession',
            awsRegion: 'us',
          },
          connectionOptions: {},
          connectionArguments: {},
          supportsMetadataExtraction: true,
        },
      },
    },
  },
  {
    url: '/api/v1/containers',
    method: 'POST',
    body: {
      name: ENTITIES_DISPLAY_NAME.container.name,
      service: SERVICES.storageServices.name,
    },
  },
];

export const DELETE_SERVICES = Object.entries(SERVICES).map(
  ([type, { name }]) => ({ type, name })
);
