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

import { isArray } from 'lodash';
import {
  DASHBOARD_SERVICE_DETAILS,
  DATABASE_DETAILS,
  DATABASE_SERVICE_DETAILS,
  ES_RESERVED_CHARACTERS,
  MESSAGING_SERVICE_DETAILS,
  ML_MODEL_SERVICE_DETAILS,
  PIPELINE_SERVICE_DETAILS,
  SCHEMA_DETAILS,
  STORAGE_SERVICE_DETAILS,
} from '../constants/EntityConstant';
import { uuid } from './common';

type ColumnType = {
  name: string;
  description: string;
  dataType: string;
  dataTypeDisplay: string;
};

/**
 * create full hierarchy of database service (service > database > schema > tables)
 */
export const createEntityTable = ({
  service,
  database,
  schema,
  tables,
  token,
}) => {
  const createdEntityIds = {
    databaseId: undefined,
    databaseSchemaId: undefined,
  };

  // Create service
  cy.request({
    method: 'POST',
    url: `/api/v1/services/databaseServices`,
    headers: { Authorization: `Bearer ${token}` },
    body: service,
  }).then((response) => {
    expect(response.status).to.eq(201);
  });

  // Create Database
  cy.request({
    method: 'POST',
    url: `/api/v1/databases`,
    headers: { Authorization: `Bearer ${token}` },
    body: database,
  }).then((response) => {
    expect(response.status).to.eq(201);

    createdEntityIds.databaseId = response.body.id;
  });

  // Create Database Schema
  const schemaData = isArray(schema) ? schema : [schema];
  schemaData.map((schema) => {
    cy.request({
      method: 'POST',
      url: `/api/v1/databaseSchemas`,
      headers: { Authorization: `Bearer ${token}` },
      body: schema,
    }).then((response) => {
      expect(response.status).to.eq(201);

      createdEntityIds.databaseSchemaId = response.body.id;
    });
  });

  tables.forEach((body) => {
    cy.request({
      method: 'POST',
      url: `/api/v1/tables`,
      headers: { Authorization: `Bearer ${token}` },
      body,
    }).then((response) => {
      expect(response.status).to.eq(201);
    });
  });

  return createdEntityIds;
};

/**
 * Create single level service like messaging, pipeline, mlmodel etc.
 */
export const createSingleLevelEntity = ({
  service,
  entity,
  serviceType,
  entityType,
  token,
}) => {
  // Create service
  cy.request({
    method: 'POST',
    url: `/api/v1/services/${serviceType}`,
    headers: { Authorization: `Bearer ${token}` },
    body: service,
  }).then((response) => {
    expect(response.status).to.eq(201);
  });

  (Array.isArray(entity) ? entity : [entity]).forEach((body) => {
    cy.request({
      method: 'POST',
      url: `/api/v1/${entityType}`,
      headers: { Authorization: `Bearer ${token}` },
      body,
    }).then((response) => {
      expect(response.status).to.eq(201);
    });
  });
};

/**
 * Delete full hierarchy of any service
 */
export const hardDeleteService = ({ serviceFqn, token, serviceType }) => {
  cy.request({
    method: 'GET',
    url: `/api/v1/services/${serviceType}/name/${serviceFqn}?include=all`,
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => {
    cy.request({
      method: 'DELETE',
      url: `/api/v1/services/${serviceType}/${response.body.id}?hardDelete=true&recursive=true`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
};

export const generateRandomTable = (data?: {
  tableName?: string;
  columns?: ColumnType[];
  databaseSchema?: string;
}) => {
  const id = uuid();
  const name = data?.tableName ?? `cypress-table-${id}`;

  const table = {
    name,
    description: `cypress-table-description-${id}`,
    displayName: name,
    columns: [
      ...(data?.columns ?? []),
      {
        name: `cypress-column-${id}`,
        description: `cypress-column-description-${id}`,
        dataType: 'NUMERIC',
        dataTypeDisplay: 'numeric',
      },
    ],
    databaseSchema:
      data?.databaseSchema ??
      `${DATABASE_SERVICE_DETAILS.name}.${DATABASE_DETAILS.name}.${SCHEMA_DETAILS.name}`,
  };

  return table;
};

export const generateRandomTopic = () => {
  const topicName = `cypress-topic-${uuid()}`;
  const topicDetails = {
    name: topicName,
    service: MESSAGING_SERVICE_DETAILS.name,
    messageSchema: {
      schemaText: `{"type":"object","required":["name","age","club_name"],"properties":{"name":{"type":"object","required":["first_name","last_name"],
    "properties":{"first_name":{"type":"string"},"last_name":{"type":"string"}}},"age":{"type":"integer"},"club_name":{"type":"string"}}}`,
      schemaType: 'JSON',
      schemaFields: [
        {
          name: 'default',
          dataType: 'RECORD',
          fullyQualifiedName: `${MESSAGING_SERVICE_DETAILS.name}.${topicName}.default`,
          tags: [],
          children: [
            {
              name: 'name',
              dataType: 'RECORD',
              fullyQualifiedName: `${MESSAGING_SERVICE_DETAILS.name}.${topicName}.default.name`,
              tags: [],
              children: [
                {
                  name: 'first_name',
                  dataType: 'STRING',
                  description: 'Description for schema field first_name',
                  fullyQualifiedName: `${MESSAGING_SERVICE_DETAILS.name}.${topicName}.default.name.first_name`,
                  tags: [],
                },
                {
                  name: 'last_name',
                  dataType: 'STRING',
                  fullyQualifiedName: `${MESSAGING_SERVICE_DETAILS.name}.${topicName}.default.name.last_name`,
                  tags: [],
                },
              ],
            },
            {
              name: 'age',
              dataType: 'INT',
              fullyQualifiedName: `${MESSAGING_SERVICE_DETAILS.name}.${topicName}.default.age`,
              tags: [],
            },
            {
              name: 'club_name',
              dataType: 'STRING',
              fullyQualifiedName: `${MESSAGING_SERVICE_DETAILS.name}.${topicName}.default.club_name`,
              tags: [],
            },
          ],
        },
      ],
    },
    partitions: 128,
  };

  return topicDetails;
};

export const generateRandomDashboard = () => {
  const dashboardName = `cypress-dashboard-${uuid()}`;

  const dashboardDetails = {
    name: dashboardName,
    displayName: dashboardName,
    service: DASHBOARD_SERVICE_DETAILS.name,
  };

  return dashboardDetails;
};

export const generateRandomPipeline = () => {
  return {
    name: `cypress-pipeline-${uuid()}`,
    service: PIPELINE_SERVICE_DETAILS.name,
    tasks: [{ name: 'snowflake_task' }],
  };
};

export const generateRandomMLModel = () => {
  return {
    name: `cypress-mlmodel-${uuid()}`,
    service: ML_MODEL_SERVICE_DETAILS.name,
    algorithm: 'Time Series',
    mlFeatures: [
      {
        name: 'sales',
        dataType: 'numerical',
        description: 'Sales amount',
      },
    ],
  };
};

export const generateRandomContainer = () => {
  return {
    name: `cypress-container-${uuid()}`,
    service: STORAGE_SERVICE_DETAILS.name,
  };
};

/**
 * get Table by name and create query in the table
 */
export const createQueryByTableName = (token, table) => {
  cy.request({
    method: 'GET',
    url: `/api/v1/tables/name/${table.databaseSchema}.${table.name}`,
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => {
    cy.request({
      method: 'POST',
      url: `/api/v1/queries`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        query: 'SELECT * FROM SALES',
        description: 'this is query description',
        queryUsedIn: [
          {
            id: response.body.id,
            type: 'table',
          },
        ],
        duration: 6199,
        queryDate: 1700225667191,
        service: DATABASE_SERVICE_DETAILS.name,
      },
    }).then((response) => {
      expect(response.status).to.eq(201);
    });
  });
};

/**
 * Create a new user
 */
export const createUserEntity = ({ token, user }) => {
  cy.request({
    method: 'POST',
    url: `/api/v1/users/signup`,
    headers: { Authorization: `Bearer ${token}` },
    body: user,
  }).then((response) => {
    user.id = response.body.id;
  });
};

/**
 * Delete a user by id
 */
export const deleteUserEntity = ({ token, id }) => {
  cy.request({
    method: 'DELETE',
    url: `/api/v1/users/${id}?hardDelete=true&recursive=false`,
    headers: { Authorization: `Bearer ${token}` },
  });
};

/**
 * Delete any entity by id
 */
export const deleteEntityById = ({ entityType, token, entityFqn }) => {
  cy.request({
    method: 'GET',
    url: `/api/v1/${entityType}/name/${entityFqn}`,
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => {
    cy.request({
      method: 'DELETE',
      url: `/api/v1/${entityType}/${response.body.id}?hardDelete=true&recursive=true`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
};

export const getTableDetails = (tableName: string, schemaFQN: string) => ({
  name: tableName,
  description: 'description',
  columns: [
    {
      name: `cy-user_id-${uuid()}`,
      dataType: 'NUMERIC',
      dataTypeDisplay: 'numeric',
      description:
        'Unique identifier for the user of your Shopify POS or your Shopify admin.',
    },
    {
      name: `cy-shop_id-${uuid()}`,
      dataType: 'NUMERIC',
      dataTypeDisplay: 'numeric',
      description:
        'The ID of the store. This column is a foreign key reference to the shop_id column in the dim.shop table.',
    },
    {
      name: `cy-name-${uuid()}`,
      dataType: 'VARCHAR',
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: 'Name of the staff member.',
      children: [
        {
          name: `cy-first_name-${uuid()}`,
          dataType: 'VARCHAR',
          dataLength: 100,
          dataTypeDisplay: 'varchar',
          description: 'First name of the staff member.',
        },
        {
          name: `cy-last_name-${uuid()}`,
          dataType: 'VARCHAR',
          dataLength: 100,
          dataTypeDisplay: 'varchar',
        },
      ],
    },
    {
      name: `cy-email-${uuid()}`,
      dataType: 'VARCHAR',
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: 'Email address of the staff member.',
    },
  ],
  databaseSchema: schemaFQN,
});

export const getTableCreationDetails = () => {
  const DATABASE_SERVICE_NAME = `cy-database-service-${uuid()}`;
  const DATABASE_NAME = `cy-database-${uuid()}`;
  const SCHEMA_NAME = `cy-database-schema-${uuid()}`;
  const TABLE_1_NAME = `cy-table-1-${uuid()}`;
  const TABLE_2_NAME = `cy-table-2-${uuid()}`;
  const TABLE_3_NAME = `cy-table-3-${uuid()}`;

  const service = {
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
  const database = {
    name: DATABASE_NAME,
    service: DATABASE_SERVICE_NAME,
  };

  const schema = {
    name: SCHEMA_NAME,
    database: `${DATABASE_SERVICE_NAME}.${DATABASE_NAME}`,
  };

  const table1 = getTableDetails(
    TABLE_1_NAME,
    `${DATABASE_SERVICE_NAME}.${DATABASE_NAME}.${SCHEMA_NAME}`
  );
  const table2 = getTableDetails(
    TABLE_2_NAME,
    `${DATABASE_SERVICE_NAME}.${DATABASE_NAME}.${SCHEMA_NAME}`
  );
  const table3 = getTableDetails(
    TABLE_3_NAME,
    `${DATABASE_SERVICE_NAME}.${DATABASE_NAME}.${SCHEMA_NAME}`
  );

  return {
    service,
    database,
    schema,
    tables: [table1, table2, table3],
  };
};

export const getUserCreationDetails = () => {
  const userName = `user${uuid()}`;

  return {
    userName,
    user: {
      firstName: `first-name-${uuid()}`,
      lastName: `last-name-${uuid()}`,
      email: `${userName}@example.com`,
      password: 'User@OMD123',
    },
  };
};

export const escapeESReservedCharacters = (text?: string) => {
  const reUnescapedHtml = /[\\[\]#+=&|><!(){}^"~*?:/-]/g;
  const reHasUnescapedHtml = RegExp(reUnescapedHtml.source);

  const getReplacedChar = (char: string) => {
    return ES_RESERVED_CHARACTERS[char] ?? char;
  };

  return text && reHasUnescapedHtml.test(text)
    ? text.replace(reUnescapedHtml, getReplacedChar)
    : text ?? '';
};
