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

export const OWNER = 'Amber Green';
export const TIER = 'Tier1';

const TABLE_DETAILS_FOR_VERSION_TEST = {
  name: 'cypress_version_test_table',
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
    value: 'Description for cypress_version_test_table',
  },
];

const TOPIC_DETAILS_FOR_VERSION_TEST = {
  name: 'cypress_version_test_topic',
  service: 'sample_kafka',
  messageSchema: {
    schemaText: `{"type":"object","required":["name","age","club_name"],"properties":{"name":{"type":"object","required":["first_name","last_name"],
    "properties":{"first_name":{"type":"string"},"last_name":{"type":"string"}}},"age":{"type":"integer"},"club_name":{"type":"string"}}}`,
    schemaType: 'JSON',
    schemaFields: [
      {
        name: 'default',
        dataType: 'RECORD',
        fullyQualifiedName: 'sample_kafka.cypress_version_test_topic.default',
        tags: [],
        children: [
          {
            name: 'name',
            dataType: 'RECORD',
            fullyQualifiedName:
              'sample_kafka.cypress_version_test_topic.default.name',
            tags: [],
            children: [
              {
                name: 'first_name',
                dataType: 'STRING',
                description: 'Description for schema field first_name',
                fullyQualifiedName:
                  'sample_kafka.cypress_version_test_topic.default.name.first_name',
                tags: [],
              },
              {
                name: 'last_name',
                dataType: 'STRING',
                fullyQualifiedName:
                  'sample_kafka.cypress_version_test_topic.default.name.last_name',
                tags: [],
              },
            ],
          },
          {
            name: 'age',
            dataType: 'INT',
            fullyQualifiedName:
              'sample_kafka.cypress_version_test_topic.default.age',
            tags: [],
          },
          {
            name: 'club_name',
            dataType: 'STRING',
            fullyQualifiedName:
              'sample_kafka.cypress_version_test_topic.default.club_name',
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
    value: 'Description for cypress_version_test_topic',
  },
];

const DASHBOARD_DETAILS_FOR_VERSION_TEST = {
  name: 'cypress_version_test_dashboard',
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
    value: 'Description for cypress_version_test_dashboard',
  },
];

const PIPELINE_DETAILS_FOR_VERSION_TEST = {
  name: 'cypress_version_test_pipeline',
  tasks: [
    {
      name: 'cypress_task_1',
      displayName: 'cypress_task_1',
      fullyQualifiedName:
        'sample_airflow.cypress_version_test_pipeline.cypress_task_1',
      sourceUrl:
        'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=assert_table_exists',
      downstreamTasks: [],
      taskType: 'SnowflakeOperator',
      tags: [],
    },
    {
      name: 'cypress_task_2',
      displayName: 'cypress_task_2',
      fullyQualifiedName:
        'sample_airflow.cypress_version_test_pipeline.cypress_task_2',
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
      fullyQualifiedName:
        'sample_airflow.cypress_version_test_pipeline.cypress_task_3',
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
    value: 'Description for cypress_version_test_pipeline',
  },
];

const ML_MODEL_DETAILS_FOR_VERSION_TEST = {
  name: 'cypress_version_test_ml_model',
  algorithm: 'Neural Network',
  mlFeatures: [
    {
      name: 'feature_1',
      dataType: 'numerical',
      fullyQualifiedName: 'mlflow_svc.cypress_version_test_ml_model.feature_1',
      featureSources: [],
      tags: [],
    },
    {
      name: 'feature_2',
      dataType: 'numerical',
      description: 'Description for mlFeature feature_2',
      fullyQualifiedName: 'mlflow_svc.cypress_version_test_ml_model.feature_2',
      featureSources: [],
    },
    {
      name: 'feature_3',
      dataType: 'numerical',
      fullyQualifiedName: 'mlflow_svc.cypress_version_test_ml_model.feature_3',
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
    value: 'Description for cypress_version_test_ml_model',
  },
];

const CONTAINER_DETAILS_FOR_VERSION_TEST = {
  name: 'cypress_version_test_container',
  service: 's3_storage_sample',
  dataModel: {
    isPartitioned: false,
    columns: [
      {
        name: 'column_1',
        dataType: 'NUMERIC',
        dataTypeDisplay: 'numeric',
        fullyQualifiedName:
          's3_storage_sample.departments.finance.cypress_version_test_container.column_1',
        tags: [],
        ordinalPosition: 1,
      },
      {
        name: 'column_2',
        dataType: 'BOOLEAN',
        dataTypeDisplay: 'boolean',
        description: 'Description for column column_2',
        fullyQualifiedName:
          's3_storage_sample.departments.finance.cypress_version_test_container.column_2',
        tags: [],
        ordinalPosition: 2,
      },
      {
        name: 'column_3',
        dataType: 'BOOLEAN',
        dataTypeDisplay: 'boolean',
        fullyQualifiedName:
          's3_storage_sample.departments.finance.cypress_version_test_container.column_3',
        tags: [],
        ordinalPosition: 3,
      },
      {
        name: 'column_4',
        dataType: 'NUMERIC',
        dataTypeDisplay: 'numeric',
        fullyQualifiedName:
          's3_storage_sample.departments.finance.cypress_version_test_container.column_4',
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
    value: 'Description for cypress_version_test_container',
  },
];

export const ENTITY_DETAILS_FOR_VERSION_TEST = {
  Table: {
    name: 'cypress_version_test_table',
    term: 'cypress_version_test_table',
    serviceName: 'sample_data',
    entity: 'tables',
    entityCreationDetails: TABLE_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: TABLE_PATCH_PAYLOAD,
    isChildrenExist: true,
    childSelector: 'data-row-key',
    entityAddedDescription: 'Description for cypress_version_test_table',
    updatedTagEntityChildName: 'user_id',
    entityChildRemovedDescription: 'First name of the staff member.',
    entityChildAddedDescription: 'Last name of the staff member.',
  },
  Topic: {
    name: 'cypress_version_test_topic',
    term: 'cypress_version_test_topic',
    serviceName: 'sample_kafka',
    entity: 'topics',
    entityCreationDetails: TOPIC_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: TOPIC_PATCH_PAYLOAD,
    isChildrenExist: true,
    childSelector: 'data-row-key',
    entityAddedDescription: 'Description for cypress_version_test_topic',
    updatedTagEntityChildName: 'default',
    entityChildRemovedDescription: 'Description for schema field first_name',
    entityChildAddedDescription: 'Description for schema field last_name',
  },
  // TODO - Remove the comment after this issue is resolved https://github.com/open-metadata/OpenMetadata/issues/12924
  // Dashboard: {
  //   name: 'cypress_version_test_dashboard',
  //   term: 'cypress_version_test_dashboard',
  //   serviceName: 'sample_superset',
  //   entity: 'dashboards',
  //   entityCreationDetails: DASHBOARD_DETAILS_FOR_VERSION_TEST,
  //   entityPatchPayload: DASHBOARD_PATCH_PAYLOAD,
  //   isChildrenExist: false,
  //   entityAddedDescription: 'Description for cypress_version_test_dashboard',
  // },
  Pipeline: {
    name: 'cypress_version_test_pipeline',
    term: 'cypress_version_test_pipeline',
    serviceName: 'sample_airflow',
    entity: 'pipelines',
    entityCreationDetails: PIPELINE_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: PIPELINE_PATCH_PAYLOAD,
    isChildrenExist: true,
    childSelector: 'data-row-key',
    entityAddedDescription: 'Description for cypress_version_test_pipeline',
    updatedTagEntityChildName: 'cypress_task_1',
    entityChildRemovedDescription: 'Description for task cypress_task_2',
    entityChildAddedDescription: 'Description for task cypress_task_3',
  },
  'ML Model': {
    name: 'cypress_version_test_ml_model',
    term: 'cypress_version_test_ml_model',
    serviceName: 'mlflow_svc',
    entity: 'mlmodels',
    entityCreationDetails: ML_MODEL_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: ML_MODEL_PATCH_PAYLOAD,
    isChildrenExist: true,
    childSelector: 'data-testid',
    entityAddedDescription: 'Description for cypress_version_test_ml_model',
    updatedTagEntityChildName: 'feature-card-feature_1',
    entityChildRemovedDescription: 'Description for mlFeature feature_2',
    entityChildAddedDescription: 'Description for mlFeature feature_3',
  },
  Container: {
    name: 'cypress_version_test_container',
    term: 'cypress_version_test_container',
    serviceName: 's3_storage_sample',
    entity: 'containers',
    entityCreationDetails: CONTAINER_DETAILS_FOR_VERSION_TEST,
    entityPatchPayload: CONTAINER_PATCH_PAYLOAD,
    isChildrenExist: true,
    childSelector: 'data-row-key',
    entityAddedDescription: 'Description for cypress_version_test_container',
    updatedTagEntityChildName: 'column_1',
    entityChildRemovedDescription: 'Description for column column_2',
    entityChildAddedDescription: 'Description for column column_3',
  },
};

export const DATA_MODEL_DETAILS_FOR_VERSION_TEST = {
  name: 'cypress_version_test_data_model',
  service: 'sample_looker',
  dataModelType: 'LookMlExplore',
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
    value: 'Description for cypress_version_test_data_model',
  },
];

export const DATA_MODEL_DETAILS = {
  name: 'cypress_version_test_data_model',
  entity: 'containers',
  entityAddedDescription: 'Description for cypress_version_test_data_model',
  updatedTagEntityChildName: 'column_1',
  entityChildRemovedDescription: 'Description for column column_2',
  entityChildAddedDescription: 'Description for column column_3',
};
