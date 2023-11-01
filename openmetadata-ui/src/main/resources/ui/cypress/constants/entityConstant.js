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
import { uuid } from './constants';
import { SERVICE_CATEGORIES } from './service.constants';

const DATABASE_SERVICE_NAME = `cy-database-service-${uuid()}`;
const MESSAGING_SERVICE_NAME = `cy-messaging-service-${uuid()}`;
const DASHBOARD_SERVICE_NAME = `cy-dashboard-service-${uuid()}`;
const PIPELINE_SERVICE_NAME = `cy-pipeline-service-${uuid()}`;
const ML_MODEL_SERVICE_NAME = `cy-ml-model-service-${uuid()}`;
const STORAGE_SERVICE_NAME = `cy-storage-service-${uuid()}`;
const SEARCH_SERVICE_NAME = `cy-search-service-${uuid()}`;

// Database entity details
export const DATABASE_SERVICE_DETAILS = {
  name: DATABASE_SERVICE_NAME,
  serviceType: 'Mysql',
  connection: {
    config: {
      type: 'Mysql',
      scheme: 'mysql+pymysql',
      username: 'username',
      authType: {
        password: 'password',
      },
      hostPort: 'mysql:3306',
      supportsMetadataExtraction: true,
      supportsDBTExtraction: true,
      supportsProfiler: true,
      supportsQueryComment: true,
    },
  },
};

export const MESSAGING_SERVICE_DETAILS = {
  name: MESSAGING_SERVICE_NAME,
  serviceType: 'Kafka',
  connection: {
    config: {
      type: 'Kafka',
      bootstrapServers: 'Bootstrap Servers',
      saslUsername: 'admin',
      saslPassword: 'admin',
      saslMechanism: 'PLAIN',
      supportsMetadataExtraction: true,
    },
  },
};
export const DASHBOARD_SERVICE_DETAILS = {
  name: DASHBOARD_SERVICE_NAME,
  serviceType: 'Superset',
  connection: {
    config: {
      type: 'Superset',
      hostPort: 'http://localhost:8088',
      connection: {
        provider: 'ldap',
        username: 'admin',
        password: 'admin',
      },
      supportsMetadataExtraction: true,
    },
  },
};

export const PIPELINE_SERVICE_DETAILS = {
  name: PIPELINE_SERVICE_NAME,
  serviceType: 'Dagster',
  connection: {
    config: {
      type: 'Dagster',
      host: 'admin',
      token: 'admin',
      timeout: '1000',
      supportsMetadataExtraction: true,
    },
  },
};

export const ML_MODEL_SERVICE_DETAILS = {
  name: ML_MODEL_SERVICE_NAME,
  serviceType: 'Mlflow',
  connection: {
    config: {
      type: 'Mlflow',
      trackingUri: 'Tracking URI',
      registryUri: 'Registry URI',
      supportsMetadataExtraction: true,
    },
  },
};

export const STORAGE_SERVICE_DETAILS = {
  name: STORAGE_SERVICE_NAME,
  serviceType: 'S3',
  connection: {
    config: {
      type: 'S3',
      awsConfig: {
        awsAccessKeyId: 'admin',
        awsSecretAccessKey: 'key',
        awsRegion: 'us-east-2',
        assumeRoleSessionName: 'OpenMetadataSession',
      },
      supportsMetadataExtraction: true,
    },
  },
};

export const SEARCH_SERVICE_DETAILS = {
  name: SEARCH_SERVICE_NAME,
  serviceType: 'ElasticSearch',
  connection: {
    config: {
      type: 'ElasticSearch',
      hostPort: 'elasticsearch:9200',
      authType: {
        username: 'admin',
        password: 'admin',
      },
      connectionTimeoutSecs: 30,
      supportsMetadataExtraction: true,
    },
  },
};

export const DATABASE_DETAILS = {
  name: `cy-database-${uuid()}`,
  service: DATABASE_SERVICE_DETAILS.name,
};

export const SCHEMA_DETAILS = {
  name: `cy-database-schema-${uuid()}`,
  database: `${DATABASE_SERVICE_DETAILS.name}.${DATABASE_DETAILS.name}`,
};

export const TABLE_DETAILS = {
  name: `cy-table-${uuid()}`,
  description: 'description',
  columns: [
    {
      name: 'user_id',
      dataType: 'NUMERIC',
      dataTypeDisplay: 'numeric',
      description:
        'Unique identifier for the user of your Shopify POS or your Shopify admin.',
    },
    {
      name: 'shop_id',
      dataType: 'NUMERIC',
      dataTypeDisplay: 'numeric',
      description:
        'The ID of the store. This column is a foreign key reference to the shop_id column in the dim.shop table.',
    },
    {
      name: 'name',
      dataType: 'VARCHAR',
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: 'Name of the staff member.',
      children: [
        {
          name: 'first_name',
          dataType: 'VARCHAR',
          dataLength: 100,
          dataTypeDisplay: 'varchar',
          description: 'First name of the staff member.',
        },
        {
          name: 'last_name',
          dataType: 'VARCHAR',
          dataLength: 100,
          dataTypeDisplay: 'varchar',
        },
      ],
    },
    {
      name: 'email',
      dataType: 'VARCHAR',
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: 'Email address of the staff member.',
    },
  ],
  databaseSchema: `${DATABASE_SERVICE_DETAILS.name}.${DATABASE_DETAILS.name}.${SCHEMA_DETAILS.name}`,
};

export const STORED_PROCEDURE_DETAILS = {
  name: `cy-stored-procedure-${uuid()}`,
  databaseSchema: `${DATABASE_SERVICE_DETAILS.name}.${DATABASE_DETAILS.name}.${SCHEMA_DETAILS.name}`,
  storedProcedureCode: {
    code: 'CREATE OR REPLACE PROCEDURE output_message(message VARCHAR)\nRETURNS VARCHAR NOT NULL\nLANGUAGE SQL\nAS\n$$\nBEGIN\n  RETURN message;\nEND;\n$$\n;',
  },
};

const TOPIC_NAME = `cypress-topic-${uuid()}`;

export const TOPIC_DETAILS = {
  name: TOPIC_NAME,
  service: MESSAGING_SERVICE_DETAILS.name,
  messageSchema: {
    schemaText: `{"type":"object","required":["name","age","club_name"],"properties":{"name":{"type":"object","required":["first_name","last_name"],
    "properties":{"first_name":{"type":"string"},"last_name":{"type":"string"}}},"age":{"type":"integer"},"club_name":{"type":"string"}}}`,
    schemaType: 'JSON',
    schemaFields: [
      {
        name: 'default',
        dataType: 'RECORD',
        fullyQualifiedName: `${MESSAGING_SERVICE_DETAILS.name}.${TOPIC_NAME}.default`,
        tags: [],
        children: [
          {
            name: 'name',
            dataType: 'RECORD',
            fullyQualifiedName: `${MESSAGING_SERVICE_DETAILS.name}.${TOPIC_NAME}.default.name`,
            tags: [],
            children: [
              {
                name: 'first_name',
                dataType: 'STRING',
                description: 'Description for schema field first_name',
                fullyQualifiedName: `${MESSAGING_SERVICE_DETAILS.name}.${TOPIC_NAME}.default.name.first_name`,
                tags: [],
              },
              {
                name: 'last_name',
                dataType: 'STRING',
                fullyQualifiedName: `${MESSAGING_SERVICE_DETAILS.name}.${TOPIC_NAME}.default.name.last_name`,
                tags: [],
              },
            ],
          },
          {
            name: 'age',
            dataType: 'INT',
            fullyQualifiedName: `${MESSAGING_SERVICE_DETAILS.name}.${TOPIC_NAME}.default.age`,
            tags: [],
          },
          {
            name: 'club_name',
            dataType: 'STRING',
            fullyQualifiedName: `${MESSAGING_SERVICE_DETAILS.name}.${TOPIC_NAME}.default.club_name`,
            tags: [],
          },
        ],
      },
    ],
  },
  partitions: 128,
};

const DASHBOARD_NAME = `cypress-dashboard-${uuid()}`;
const DASHBOARD_DATA_MODEL_NAME = `cypress-dashboard-${uuid()}`;

export const DASHBOARD_DETAILS = {
  name: DASHBOARD_NAME,
  displayName: DASHBOARD_NAME,
  service: DASHBOARD_SERVICE_DETAILS.name,
};
export const DASHBOARD_DATA_MODEL_DETAILS = {
  name: DASHBOARD_DATA_MODEL_NAME,
  displayName: DASHBOARD_DATA_MODEL_NAME,
  service: DASHBOARD_SERVICE_DETAILS.name,
  columns: [],
  dataModelType: 'SupersetDataModel',
};

export const PIPELINE_DETAILS = {
  name: `cypress-pipeline-${uuid()}`,
  service: PIPELINE_SERVICE_DETAILS.name,
};

export const ML_MODEL_DETAILS = {
  name: `cypress-mlmodel-${uuid()}`,
  service: ML_MODEL_SERVICE_DETAILS.name,
  algorithm: 'Time Series',
};

export const CONTAINER_DETAILS = {
  name: `cypress-container-${uuid()}`,
  service: STORAGE_SERVICE_DETAILS.name,
};

export const SEARCH_INDEX_DETAILS = {
  name: `cypress-search-index-${uuid()}`,
  service: SEARCH_SERVICE_DETAILS.name,
  fields: [],
};

export const DATABASE_SERVICE = {
  service: DATABASE_SERVICE_DETAILS,
  database: DATABASE_DETAILS,
  schema: SCHEMA_DETAILS,
  tables: TABLE_DETAILS,
};
export const MESSAGING_SERVICE = {
  service: MESSAGING_SERVICE_DETAILS,
  entity: TOPIC_DETAILS,
  serviceType: SERVICE_CATEGORIES.MESSAGING_SERVICES,
  entityType: 'topics',
};
export const DASHBOARD_SERVICE = {
  service: DASHBOARD_SERVICE_DETAILS,
  entity: DASHBOARD_DETAILS,
  serviceType: SERVICE_CATEGORIES.DASHBOARD_SERVICES,
  entityType: 'dashboards',
};
export const PIPELINE_SERVICE = {
  service: PIPELINE_SERVICE_DETAILS,
  entity: PIPELINE_DETAILS,
  serviceType: SERVICE_CATEGORIES.PIPELINE_SERVICES,
  entityType: 'pipelines',
};
export const MLMODEL_SERVICE = {
  service: ML_MODEL_SERVICE_DETAILS,
  entity: ML_MODEL_DETAILS,
  serviceType: SERVICE_CATEGORIES.ML_MODEL_SERVICES,
  entityType: 'mlmodels',
};

export const STORAGE_SERVICE = {
  service: STORAGE_SERVICE_DETAILS,
  entity: CONTAINER_DETAILS,
  serviceType: SERVICE_CATEGORIES.STORAGE_SERVICES,
  entityType: 'containers',
};

export const SINGLE_LEVEL_SERVICE = [
  MESSAGING_SERVICE,
  DASHBOARD_SERVICE,
  PIPELINE_SERVICE,
  MLMODEL_SERVICE,
  STORAGE_SERVICE,
];
