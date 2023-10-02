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
import { SERVICE_CATEGORIES } from './service.constants';

export const OWNER = 'Amber Green';
export const REVIEWER = 'Amanda York';
export const TIER = 'Tier1';

const DOMAIN_NAME = `cypress_version_test_domain-${uuid()}`;

const TABLE_NAME = `cypress_version_table-${uuid()}`;
const TOPIC_NAME = `cypress_version_topic-${uuid()}`;
const DASHBOARD_NAME = `cypress_version_dashboard-${uuid()}`;
const PIPELINE_NAME = `cypress_version_pipeline-${uuid()}`;
const ML_MODEL_NAME = `cypress_version_ml_model-${uuid()}`;
const CONTAINER_NAME = `cypress_version_container-${uuid()}`;
const SEARCH_INDEX_NAME = `cypress_version_search_index-${uuid()}`;
const STORED_PROCEDURE_NAME = `cypress_version_stored_procedure-${uuid()}`;
const DATA_MODEL_NAME = `cypress_version_data_model_${uuid()}`;

export const DOMAIN_CREATION_DETAILS = {
  name: DOMAIN_NAME,
  description: `Description for ${DOMAIN_NAME}`,
  domainType: 'Aggregate',
  experts: [],
};

const TABLE_DETAILS_FOR_VERSION_TEST = {
  name: TABLE_NAME,
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
  databaseSchema: 'sample_data.ecommerce_db.shopify',
};

export const TABLE_PATCH_PAYLOAD = [
  {
    op: 'add',
    path: '/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.SpecialCategory',
    },
  },
  {
    op: 'add',
    path: '/columns/2/children/1/description',
    value: 'Last name of the staff member.',
  },
  {
    op: 'remove',
    path: '/columns/2/children/0/description',
  },
  {
    op: 'add',
    path: '/columns/0/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.Personal',
    },
  },
  {
    op: 'add',
    path: '/columns/0/tags/1',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PII.Sensitive',
    },
  },
  {
    op: 'add',
    path: '/description',
    value: `Description for ${TABLE_NAME}`,
  },
];

const TOPIC_DETAILS_FOR_VERSION_TEST = {
  name: TOPIC_NAME,
  service: 'sample_kafka',
  messageSchema: {
    schemaText: `{"type":"object","required":["name","age","club_name"],"properties":{"name":{"type":"object","required":["first_name","last_name"],
    "properties":{"first_name":{"type":"string"},"last_name":{"type":"string"}}},"age":{"type":"integer"},"club_name":{"type":"string"}}}`,
    schemaType: 'JSON',
    schemaFields: [
      {
        name: 'default',
        dataType: 'RECORD',
        fullyQualifiedName: `sample_kafka.${TOPIC_NAME}.default`,
        tags: [],
        children: [
          {
            name: 'name',
            dataType: 'RECORD',
            fullyQualifiedName: `sample_kafka.${TOPIC_NAME}.default.name`,
            tags: [],
            children: [
              {
                name: 'first_name',
                dataType: 'STRING',
                description: 'Description for schema field first_name',
                fullyQualifiedName: `sample_kafka.${TOPIC_NAME}.default.name.first_name`,
                tags: [],
              },
              {
                name: 'last_name',
                dataType: 'STRING',
                fullyQualifiedName: `sample_kafka.${TOPIC_NAME}.default.name.last_name`,
                tags: [],
              },
            ],
          },
          {
            name: 'age',
            dataType: 'INT',
            fullyQualifiedName: `sample_kafka.${TOPIC_NAME}.default.age`,
            tags: [],
          },
          {
            name: 'club_name',
            dataType: 'STRING',
            fullyQualifiedName: `sample_kafka.${TOPIC_NAME}.default.club_name`,
            tags: [],
          },
        ],
      },
    ],
  },
  partitions: 128,
};

export const TOPIC_PATCH_PAYLOAD = [
  {
    op: 'add',
    path: '/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.SpecialCategory',
    },
  },
  {
    op: 'add',
    path: '/messageSchema/schemaFields/0/children/0/children/1/description',
    value: 'Description for schema field last_name',
  },
  {
    op: 'remove',
    path: '/messageSchema/schemaFields/0/children/0/children/0/description',
  },
  {
    op: 'add',
    path: '/messageSchema/schemaFields/0/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.Personal',
    },
  },
  {
    op: 'add',
    path: '/messageSchema/schemaFields/0/tags/1',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PII.Sensitive',
    },
  },
  {
    op: 'add',
    path: '/description',
    value: `Description for ${TOPIC_NAME}`,
  },
];

const DASHBOARD_DETAILS_FOR_VERSION_TEST = {
  name: DASHBOARD_NAME,
  service: 'sample_superset',
};

const DASHBOARD_PATCH_PAYLOAD = [
  {
    op: 'add',
    path: '/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.SpecialCategory',
    },
  },
  {
    op: 'add',
    path: '/description',
    value: `Description for ${DASHBOARD_NAME}`,
  },
];

const PIPELINE_DETAILS_FOR_VERSION_TEST = {
  name: PIPELINE_NAME,
  tasks: [
    {
      name: 'cypress_task_1',
      displayName: 'cypress_task_1',
      fullyQualifiedName: `sample_airflow.${PIPELINE_NAME}.cypress_task_1`,
      sourceUrl:
        'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=assert_table_exists',
      downstreamTasks: [],
      taskType: 'SnowflakeOperator',
      tags: [],
    },
    {
      name: 'cypress_task_2',
      displayName: 'cypress_task_2',
      fullyQualifiedName: `sample_airflow.${PIPELINE_NAME}.cypress_task_2`,
      description: 'Description for task cypress_task_2',
      sourceUrl:
        'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=assert_table_exists',
      downstreamTasks: [],
      taskType: 'HiveOperator',
      tags: [],
    },
    {
      name: 'cypress_task_3',
      displayName: 'cypress_task_3',
      fullyQualifiedName: `sample_airflow.${PIPELINE_NAME}.cypress_task_3`,
      sourceUrl:
        'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=assert_table_exists',
      downstreamTasks: [],
      taskType: 'HiveOperator',
      tags: [],
    },
  ],
  service: 'sample_airflow',
};

const PIPELINE_PATCH_PAYLOAD = [
  {
    op: 'add',
    path: '/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.SpecialCategory',
    },
  },
  {
    op: 'add',
    path: '/tasks/2/description',
    value: 'Description for task cypress_task_3',
  },
  {
    op: 'remove',
    path: '/tasks/1/description',
  },
  {
    op: 'add',
    path: '/tasks/0/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.Personal',
    },
  },
  {
    op: 'add',
    path: '/tasks/0/tags/1',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PII.Sensitive',
    },
  },
  {
    op: 'add',
    path: '/description',
    value: `Description for ${PIPELINE_NAME}`,
  },
];

const ML_MODEL_DETAILS_FOR_VERSION_TEST = {
  name: ML_MODEL_NAME,
  algorithm: 'Neural Network',
  mlFeatures: [
    {
      name: 'feature_1',
      dataType: 'numerical',
      fullyQualifiedName: `mlflow_svc.${ML_MODEL_NAME}.feature_1`,
      featureSources: [],
      tags: [],
    },
    {
      name: 'feature_2',
      dataType: 'numerical',
      description: 'Description for mlFeature feature_2',
      fullyQualifiedName: `mlflow_svc.${ML_MODEL_NAME}.feature_2`,
      featureSources: [],
    },
    {
      name: 'feature_3',
      dataType: 'numerical',
      fullyQualifiedName: `mlflow_svc.${ML_MODEL_NAME}.feature_3`,
      featureSources: [],
    },
  ],
  tags: [],
  service: 'mlflow_svc',
};

const ML_MODEL_PATCH_PAYLOAD = [
  {
    op: 'add',
    path: '/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.SpecialCategory',
    },
  },
  {
    op: 'add',
    path: '/mlFeatures/2/description',
    value: 'Description for mlFeature feature_3',
  },
  {
    op: 'remove',
    path: '/mlFeatures/1/description',
  },
  {
    op: 'add',
    path: '/mlFeatures/0/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.Personal',
    },
  },
  {
    op: 'add',
    path: '/mlFeatures/0/tags/1',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PII.Sensitive',
    },
  },
  {
    op: 'add',
    path: '/description',
    value: `Description for ${ML_MODEL_NAME}`,
  },
];

const CONTAINER_DETAILS_FOR_VERSION_TEST = {
  name: CONTAINER_NAME,
  service: 's3_storage_sample',
  dataModel: {
    isPartitioned: false,
    columns: [
      {
        name: 'column_1',
        dataType: 'NUMERIC',
        dataTypeDisplay: 'numeric',
        fullyQualifiedName: `s3_storage_sample.departments.finance.${CONTAINER_NAME}.column_1`,
        tags: [],
        ordinalPosition: 1,
      },
      {
        name: 'column_2',
        dataType: 'BOOLEAN',
        dataTypeDisplay: 'boolean',
        description: 'Description for column column_2',
        fullyQualifiedName: `s3_storage_sample.departments.finance.${CONTAINER_NAME}.column_2`,
        tags: [],
        ordinalPosition: 2,
      },
      {
        name: 'column_3',
        dataType: 'BOOLEAN',
        dataTypeDisplay: 'boolean',
        fullyQualifiedName: `s3_storage_sample.departments.finance.${CONTAINER_NAME}.column_3`,
        tags: [],
        ordinalPosition: 3,
      },
      {
        name: 'column_4',
        dataType: 'NUMERIC',
        dataTypeDisplay: 'numeric',
        fullyQualifiedName: `s3_storage_sample.departments.finance.${CONTAINER_NAME}.column_4`,
        tags: [],
        ordinalPosition: 4,
      },
    ],
  },
  tags: [],
};

const CONTAINER_PATCH_PAYLOAD = [
  {
    op: 'add',
    path: '/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.SpecialCategory',
    },
  },
  {
    op: 'add',
    path: '/dataModel/columns/2/description',
    value: 'Description for column column_3',
  },
  {
    op: 'remove',
    path: '/dataModel/columns/1/description',
  },
  {
    op: 'add',
    path: '/dataModel/columns/0/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.Personal',
    },
  },
  {
    op: 'add',
    path: '/dataModel/columns/0/tags/1',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PII.Sensitive',
    },
  },
  {
    op: 'add',
    path: '/description',
    value: `Description for ${CONTAINER_NAME}`,
  },
];

const SEARCH_INDEX_DETAILS_FOR_VERSION_TEST = {
  name: SEARCH_INDEX_NAME,
  service: 'elasticsearch_sample',
  fields: [
    {
      name: 'name',
      dataType: 'TEXT',
      dataTypeDisplay: 'text',
      fullyQualifiedName: `elasticsearch_sample.${SEARCH_INDEX_NAME}.name`,
      tags: [],
    },
    {
      name: 'displayName',
      dataType: 'TEXT',
      dataTypeDisplay: 'text',
      description: 'Description for field displayName',
      fullyQualifiedName: `elasticsearch_sample.${SEARCH_INDEX_NAME}.displayName`,
      tags: [],
    },
    {
      name: 'description',
      dataType: 'TEXT',
      dataTypeDisplay: 'text',
      fullyQualifiedName: `elasticsearch_sample.${SEARCH_INDEX_NAME}.description`,
      tags: [],
    },
    {
      name: 'columns',
      dataType: 'NESTED',
      dataTypeDisplay: 'nested',
      fullyQualifiedName: `elasticsearch_sample.${SEARCH_INDEX_NAME}.columns`,
      tags: [],
      children: [
        {
          name: 'name',
          dataType: 'TEXT',
          dataTypeDisplay: 'text',
          fullyQualifiedName: `elasticsearch_sample.${SEARCH_INDEX_NAME}.columns.name`,
          tags: [],
        },
        {
          name: 'displayName',
          dataType: 'TEXT',
          dataTypeDisplay: 'text',
          fullyQualifiedName: `elasticsearch_sample.${SEARCH_INDEX_NAME}.columns.displayName`,
          tags: [],
        },
        {
          name: 'description',
          dataType: 'TEXT',
          dataTypeDisplay: 'text',
          fullyQualifiedName: `elasticsearch_sample.${SEARCH_INDEX_NAME}.columns.description`,
          tags: [],
        },
      ],
    },
    {
      name: 'databaseSchema',
      dataType: 'TEXT',
      dataTypeDisplay: 'text',
      description: 'Database Schema that this table belongs to.',
      fullyQualifiedName: `elasticsearch_sample.${SEARCH_INDEX_NAME}.databaseSchema`,
      tags: [],
    },
  ],
  tags: [],
};

const SEARCH_INDEX_PATCH_PAYLOAD = [
  {
    op: 'add',
    path: '/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.SpecialCategory',
    },
  },
  {
    op: 'add',
    path: '/fields/2/description',
    value: 'Description for field description',
  },
  {
    op: 'remove',
    path: '/fields/1/description',
  },
  {
    op: 'add',
    path: '/fields/0/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.Personal',
    },
  },
  {
    op: 'add',
    path: '/fields/0/tags/1',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PII.Sensitive',
    },
  },
  {
    op: 'add',
    path: '/description',
    value: `Description for ${SEARCH_INDEX_NAME}`,
  },
];

const STORED_PROCEDURE_DETAILS_FOR_VERSION_TEST = {
  name: STORED_PROCEDURE_NAME,
  databaseSchema: 'sample_data.ecommerce_db.shopify',
  storedProcedureCode: {
    langauge: 'SQL',
    code: 'CREATE OR REPLACE PROCEDURE output_message(message VARCHAR)\nRETURNS VARCHAR NOT NULL\nLANGUAGE SQL\nAS\n$$\nBEGIN\n  RETURN message;\nEND;\n$$\n;',
  },
  tags: [],
};

const STORED_PROCEDURE_PATCH_PAYLOAD = [
  {
    op: 'add',
    path: '/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.SpecialCategory',
    },
  },
  {
    op: 'add',
    path: '/description',
    value: `Description for ${STORED_PROCEDURE_NAME}`,
  },
];

export const DATA_MODEL_DETAILS_FOR_VERSION_TEST = {
  name: DATA_MODEL_NAME,
  service: 'sample_looker',
  dataModelType: 'LookMlExplore',
  tags: [],
  columns: [
    {
      name: 'column_1',
      dataType: 'VARCHAR',
      dataLength: 256,
      dataTypeDisplay: 'varchar',
      fullyQualifiedName:
        'sample_looker.model.cypress_version_test_data_model.column_1',
      tags: [],
      ordinalPosition: 1,
    },
    {
      name: 'column_2',
      dataType: 'NUMERIC',
      dataTypeDisplay: 'numeric',
      description: 'Description for column column_2',
      fullyQualifiedName:
        'sample_looker.model.cypress_version_test_data_model.column_2',
      tags: [],
      ordinalPosition: 2,
    },
    {
      name: 'column_3',
      dataType: 'NUMERIC',
      dataTypeDisplay: 'numeric',
      fullyQualifiedName:
        'sample_looker.model.cypress_version_test_data_model.column_3',
      tags: [],
      ordinalPosition: 3,
    },
  ],
};

export const DATA_MODEL_PATCH_PAYLOAD = [
  {
    op: 'add',
    path: '/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.SpecialCategory',
    },
  },
  {
    op: 'add',
    path: '/columns/2/description',
    value: 'Description for column column_3',
  },
  {
    op: 'remove',
    path: '/columns/1/description',
  },
  {
    op: 'add',
    path: '/columns/0/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.Personal',
    },
  },
  {
    op: 'add',
    path: '/columns/0/tags/1',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PII.Sensitive',
    },
  },
  {
    op: 'add',
    path: '/description',
    value: `Description for ${DATA_MODEL_NAME}`,
  },
];

export const ENTITY_DETAILS_FOR_VERSION_TEST = {
  Table: {
    name: TABLE_NAME,
    serviceName: 'sample_data',
    entity: 'tables',
    entityCreationDetails: TABLE_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: TABLE_PATCH_PAYLOAD,
    isChildrenExist: true,
    childSelector: 'data-row-key',
    entityAddedDescription: `Description for ${TABLE_NAME}`,
    updatedTagEntityChildName: 'user_id',
    entityChildRemovedDescription: 'First name of the staff member.',
    entityChildAddedDescription: 'Last name of the staff member.',
  },
  Topic: {
    name: TOPIC_NAME,
    serviceName: 'sample_kafka',
    entity: 'topics',
    entityCreationDetails: TOPIC_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: TOPIC_PATCH_PAYLOAD,
    isChildrenExist: true,
    childSelector: 'data-row-key',
    entityAddedDescription: `Description for ${TOPIC_NAME}`,
    updatedTagEntityChildName: 'default',
    entityChildRemovedDescription: 'Description for schema field first_name',
    entityChildAddedDescription: 'Description for schema field last_name',
  },
  // TODO - Remove the comment after this issue is resolved https://github.com/open-metadata/OpenMetadata/issues/12924
  // Dashboard: {
  //   name: DASHBOARD_NAME,
  //   serviceName: 'sample_superset',
  //   entity: 'dashboards',
  //   entityCreationDetails: DASHBOARD_DETAILS_FOR_VERSION_TEST,
  //   entityPatchPayload: DASHBOARD_PATCH_PAYLOAD,
  //   isChildrenExist: false,
  //   entityAddedDescription: `Description for ${DASHBOARD_NAME}`,
  // },
  Pipeline: {
    name: PIPELINE_NAME,
    serviceName: 'sample_airflow',
    entity: 'pipelines',
    entityCreationDetails: PIPELINE_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: PIPELINE_PATCH_PAYLOAD,
    isChildrenExist: true,
    childSelector: 'data-row-key',
    entityAddedDescription: `Description for ${PIPELINE_NAME}`,
    updatedTagEntityChildName: 'cypress_task_1',
    entityChildRemovedDescription: 'Description for task cypress_task_2',
    entityChildAddedDescription: 'Description for task cypress_task_3',
  },
  'ML Model': {
    name: ML_MODEL_NAME,
    serviceName: 'mlflow_svc',
    entity: 'mlmodels',
    entityCreationDetails: ML_MODEL_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: ML_MODEL_PATCH_PAYLOAD,
    isChildrenExist: true,
    childSelector: 'data-testid',
    entityAddedDescription: `Description for ${ML_MODEL_NAME}`,
    updatedTagEntityChildName: 'feature-card-feature_1',
    entityChildRemovedDescription: 'Description for mlFeature feature_2',
    entityChildAddedDescription: 'Description for mlFeature feature_3',
  },
  Container: {
    name: CONTAINER_NAME,
    serviceName: 's3_storage_sample',
    entity: 'containers',
    entityCreationDetails: CONTAINER_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: CONTAINER_PATCH_PAYLOAD,
    isChildrenExist: true,
    childSelector: 'data-row-key',
    entityAddedDescription: `Description for ${CONTAINER_NAME}`,
    updatedTagEntityChildName: 'column_1',
    entityChildRemovedDescription: 'Description for column column_2',
    entityChildAddedDescription: 'Description for column column_3',
  },
  'Search Index': {
    name: SEARCH_INDEX_NAME,
    serviceName: 'elasticsearch_sample',
    entity: 'searchIndexes',
    entityCreationDetails: SEARCH_INDEX_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: SEARCH_INDEX_PATCH_PAYLOAD,
    isChildrenExist: true,
    childSelector: 'data-row-key',
    entityAddedDescription: `Description for ${SEARCH_INDEX_NAME}`,
    updatedTagEntityChildName: 'name',
    entityChildRemovedDescription: 'Description for field displayName',
    entityChildAddedDescription: 'Description for field description',
  },
  'Stored Procedure': {
    name: STORED_PROCEDURE_NAME,
    serviceName: 'sample_data',
    entity: 'storedProcedures',
    entityCreationDetails: STORED_PROCEDURE_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: STORED_PROCEDURE_PATCH_PAYLOAD,
    isChildrenExist: false,
    childSelector: 'data-row-key',
    entityAddedDescription: `Description for ${STORED_PROCEDURE_NAME}`,
    updatedTagEntityChildName: '',
    entityChildRemovedDescription: '',
    entityChildAddedDescription: '',
  },
};

export const DATA_MODEL_DETAILS = {
  name: DATA_MODEL_NAME,
  entity: 'containers',
  entityAddedDescription: `Description for ${DATA_MODEL_NAME}`,
  updatedTagEntityChildName: 'column_1',
  entityChildRemovedDescription: 'Description for column column_2',
  entityChildAddedDescription: 'Description for column column_3',
};

const DATABASE_SERVICE_NAME = `0-cy-database-service-${uuid()}`;
const MESSAGING_SERVICE_NAME = `0-cy-messaging-service-${uuid()}`;
const DASHBOARD_SERVICE_NAME = `0-cy-dashboard-service-${uuid()}`;
const PIPELINE_SERVICE_NAME = `0-cy-pipeline-service-${uuid()}`;
const ML_MODEL_SERVICE_NAME = `0-cy-ml-model-service-${uuid()}`;
const STORAGE_SERVICE_NAME = `0-cy-storage-service-${uuid()}`;
const SEARCH_SERVICE_NAME = `0-cy-search-service-${uuid()}`;

const DATABASE_SERVICE_DETAILS_FOR_VERSION_TEST = {
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

const MESSAGING_SERVICE_DETAILS_FOR_VERSION_TEST = {
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
const DASHBOARD_SERVICE_DETAILS_FOR_VERSION_TEST = {
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

const PIPELINE_SERVICE_DETAILS_FOR_VERSION_TEST = {
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

const ML_MODEL_SERVICE_DETAILS_FOR_VERSION_TEST = {
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

const STORAGE_SERVICE_DETAILS_FOR_VERSION_TEST = {
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

const SEARCH_SERVICE_DETAILS_FOR_VERSION_TEST = {
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

export const COMMON_UPDATED_DESCRIPTION = 'Description for newly added service';

export const COMMON_PATCH_PAYLOAD = [
  {
    op: 'add',
    path: '/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.SpecialCategory',
    },
  },
  {
    op: 'add',
    path: '/tags/1',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PII.Sensitive',
    },
  },
  {
    op: 'add',
    path: '/description',
    value: COMMON_UPDATED_DESCRIPTION,
  },
];

export const SERVICE_DETAILS_FOR_VERSION_TEST = {
  Database: {
    serviceName: DATABASE_SERVICE_NAME,
    serviceCategory: SERVICE_CATEGORIES.DATABASE_SERVICES,
    entityCreationDetails: DATABASE_SERVICE_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: COMMON_PATCH_PAYLOAD,
    settingsMenuId: 'services.databases',
  },
  Messaging: {
    serviceName: MESSAGING_SERVICE_NAME,
    serviceCategory: SERVICE_CATEGORIES.MESSAGING_SERVICES,
    entityCreationDetails: MESSAGING_SERVICE_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: COMMON_PATCH_PAYLOAD,
    settingsMenuId: 'services.messaging',
  },
  Dashboard: {
    serviceName: DASHBOARD_SERVICE_NAME,
    serviceCategory: SERVICE_CATEGORIES.DASHBOARD_SERVICES,
    entityCreationDetails: DASHBOARD_SERVICE_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: COMMON_PATCH_PAYLOAD,
    settingsMenuId: 'services.dashboards',
  },
  Pipeline: {
    serviceName: PIPELINE_SERVICE_NAME,
    serviceCategory: SERVICE_CATEGORIES.PIPELINE_SERVICES,
    entityCreationDetails: PIPELINE_SERVICE_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: COMMON_PATCH_PAYLOAD,
    settingsMenuId: 'services.pipelines',
  },
  'ML Model': {
    serviceName: ML_MODEL_SERVICE_NAME,
    serviceCategory: SERVICE_CATEGORIES.ML_MODEL_SERVICES,
    entityCreationDetails: ML_MODEL_SERVICE_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: COMMON_PATCH_PAYLOAD,
    settingsMenuId: 'services.mlModels',
  },
  Storage: {
    serviceName: STORAGE_SERVICE_NAME,
    serviceCategory: SERVICE_CATEGORIES.STORAGE_SERVICES,
    entityCreationDetails: STORAGE_SERVICE_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: COMMON_PATCH_PAYLOAD,
    settingsMenuId: 'services.storages',
  },
  Search: {
    serviceName: SEARCH_SERVICE_NAME,
    serviceCategory: SERVICE_CATEGORIES.SEARCH_SERVICES,
    entityCreationDetails: SEARCH_SERVICE_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: COMMON_PATCH_PAYLOAD,
    settingsMenuId: 'services.search',
  },
};

export const DATABASE_DETAILS_FOR_VERSION_TEST = {
  name: `0-cy-database-${uuid()}`,
  service: DATABASE_SERVICE_NAME,
};

export const DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST = {
  name: `0-cy-database-schema-${uuid()}`,
  database: `${DATABASE_SERVICE_NAME}.${DATABASE_DETAILS_FOR_VERSION_TEST.name}`,
};

export const NEW_CLASSIFICATION_FOR_VERSION_TEST_NAME = `cy-version-classification-${uuid()}`;
export const NEW_SYSTEM_CLASSIFICATION_FOR_VERSION_TEST_NAME = `cy-version-classification-${uuid()}`;

export const NEW_CLASSIFICATION_FOR_VERSION_TEST = {
  name: NEW_CLASSIFICATION_FOR_VERSION_TEST_NAME,
  displayName: NEW_CLASSIFICATION_FOR_VERSION_TEST_NAME,
  provider: 'system',
  description: ``,
};

export const NEW_CLASSIFICATION_PATCH_PAYLOAD = [
  {
    op: 'add',
    path: '/description',
    value: COMMON_UPDATED_DESCRIPTION,
  },
  {
    op: 'replace',
    path: '/mutuallyExclusive',
    value: true,
  },
];

export const GLOSSARY_NAME_FOR_VERSION_TEST = `cy-glossary-version-${uuid()}`;
export const GLOSSARY_TERM_NAME_FOR_VERSION_TEST1 = `cy-glossary-term-version-${uuid()}`;
export const GLOSSARY_TERM_NAME_FOR_VERSION_TEST2 = `cy-glossary-term-version-${uuid()}`;

export const GLOSSARY_FOR_VERSION_TEST = {
  name: GLOSSARY_NAME_FOR_VERSION_TEST,
  displayName: GLOSSARY_NAME_FOR_VERSION_TEST,
  description: '',
};

export const GLOSSARY_TERM_FOR_VERSION_TEST1 = {
  name: GLOSSARY_TERM_NAME_FOR_VERSION_TEST1,
  displayName: GLOSSARY_TERM_NAME_FOR_VERSION_TEST1,
  glossary: GLOSSARY_NAME_FOR_VERSION_TEST,
  description: '',
};

export const GLOSSARY_TERM_FOR_VERSION_TEST2 = {
  name: GLOSSARY_TERM_NAME_FOR_VERSION_TEST2,
  displayName: GLOSSARY_TERM_NAME_FOR_VERSION_TEST2,
  glossary: GLOSSARY_NAME_FOR_VERSION_TEST,
  description: '',
};

export const GLOSSARY_PATCH_PAYLOAD = [
  {
    op: 'add',
    path: '/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.SpecialCategory',
    },
  },
  {
    op: 'add',
    path: '/tags/1',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PII.Sensitive',
    },
  },
  {
    op: 'replace',
    path: '/description',
    value: COMMON_UPDATED_DESCRIPTION,
  },
];

export const GLOSSARY_TERM_PATCH_PAYLOAD2 = [
  {
    op: 'add',
    path: '/synonyms/0',
    value: 'test-synonym',
  },
  {
    op: 'add',
    path: '/references/0',
    value: {
      name: 'reference1',
      endpoint: 'https://example.com',
    },
  },
  {
    op: 'add',
    path: '/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.SpecialCategory',
    },
  },
  {
    op: 'add',
    path: '/tags/1',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PII.Sensitive',
    },
  },
  {
    op: 'replace',
    path: '/description',
    value: COMMON_UPDATED_DESCRIPTION,
  },
];
