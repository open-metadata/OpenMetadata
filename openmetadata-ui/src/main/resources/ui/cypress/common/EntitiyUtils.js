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
// / <reference types="cypress" />

export const getDatabaseServiceCreationDetails = ({ name }) => ({
  name,
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
});

export const getMessagingServiceCreationDetails = ({ name }) => ({
  name,
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
});

export const getDashboardServiceCreationDetails = ({ name }) => ({
  name,
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
});

export const getPipelineServiceCreationDetails = ({ name }) => ({
  name,
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
});

export const getMlModelServiceCreationDetails = ({ name }) => ({
  name,
  serviceType: 'Mlflow',
  connection: {
    config: {
      type: 'Mlflow',
      trackingUri: 'Tracking URI',
      registryUri: 'Registry URI',
      supportsMetadataExtraction: true,
    },
  },
});

export const getStorageServiceCreationDetails = ({ name }) => ({
  name,
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
});

export const getSearchServiceCreationDetails = ({ name }) => ({
  name,
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
});

export const getDatabaseCreationDetails = ({ name, serviceFQN }) => ({
  name,
  service: serviceFQN,
});

export const getDatabaseSchemaCreationDetails = ({ name, databaseFQN }) => ({
  name,
  database: databaseFQN,
});

export const getTableCreationDetails = ({
  name,
  description,
  databaseSchemaFQN,
}) => ({
  name,
  description: description ?? 'description',
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
  databaseSchema: databaseSchemaFQN,
});

export const getStoredProcedureCreationDetails = ({
  name,
  databaseSchemaFQN,
}) => ({
  name,
  databaseSchema: databaseSchemaFQN,
  storedProcedureCode: {
    code: 'CREATE OR REPLACE PROCEDURE output_message(message VARCHAR)\nRETURNS VARCHAR NOT NULL\nLANGUAGE SQL\nAS\n$$\nBEGIN\n  RETURN message;\nEND;\n$$\n;',
  },
});

export const getTopicCreationDetails = ({ name, serviceFQN }) => ({
  name,
  service: serviceFQN,
  messageSchema: {
    schemaText: `{"type":"object","required":["name","age","club_name"],"properties":{"name":{"type":"object","required":["first_name","last_name"],
      "properties":{"first_name":{"type":"string"},"last_name":{"type":"string"}}},"age":{"type":"integer"},"club_name":{"type":"string"}}}`,
    schemaType: 'JSON',
    schemaFields: [
      {
        name: 'default',
        dataType: 'RECORD',
        fullyQualifiedName: `${serviceFQN}.${name}.default`,
        tags: [],
        children: [
          {
            name: 'name',
            dataType: 'RECORD',
            fullyQualifiedName: `${serviceFQN}.${name}.default.name`,
            tags: [],
            children: [
              {
                name: 'first_name',
                dataType: 'STRING',
                description: 'Description for schema field first_name',
                fullyQualifiedName: `${serviceFQN}.${name}.default.name.first_name`,
                tags: [],
              },
              {
                name: 'last_name',
                dataType: 'STRING',
                fullyQualifiedName: `${serviceFQN}.${name}.default.name.last_name`,
                tags: [],
              },
            ],
          },
          {
            name: 'age',
            dataType: 'INT',
            fullyQualifiedName: `${serviceFQN}.${name}.default.age`,
            tags: [],
          },
          {
            name: 'club_name',
            dataType: 'STRING',
            fullyQualifiedName: `${serviceFQN}.${name}.default.club_name`,
            tags: [],
          },
        ],
      },
    ],
  },
  partitions: 128,
});

export const getDashboardCreationDetails = ({
  name,
  displayName,
  serviceFQN,
}) => ({
  name,
  displayName,
  service: serviceFQN,
});

export const getDashboardDataModelCreationDetails = ({
  name,
  displayName,
  serviceFQN,
  dataModelType,
  columns,
}) => ({
  name,
  displayName,
  service: serviceFQN,
  columns: columns ?? [],
  dataModelType: dataModelType ?? 'SupersetDataModel',
});

export const getPipelineCreationDetails = ({ name, serviceFQN }) => ({
  name,
  service: serviceFQN,
});

export const getMlModelCreationDetails = ({ name, algorithm, serviceFQN }) => ({
  name,
  service: serviceFQN,
  algorithm: algorithm ?? 'Time Series',
});

export const getContainerCreationDetails = ({ name, serviceFQN }) => ({
  name,
  service: serviceFQN,
});

export const getSearchIndexCreationDetails = ({
  name,
  serviceFQN,
  fields,
}) => ({
  name,
  service: serviceFQN,
  fields: fields ?? [],
});
