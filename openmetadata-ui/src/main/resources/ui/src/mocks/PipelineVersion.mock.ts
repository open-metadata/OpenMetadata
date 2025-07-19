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

import { PipelineVersionProp } from '../components/Pipeline/PipelineVersion/PipelineVersion.interface';
import {
  PipelineServiceType,
  StatusType,
} from '../generated/entity/data/pipeline';
import { ENTITY_PERMISSIONS } from '../mocks/Permissions.mock';
import {
  mockBackHandler,
  mockDomain,
  mockOwner,
  mockTier,
  mockVersionHandler,
  mockVersionList,
} from '../mocks/VersionCommon.mock';

const mockDescriptionChangeDiff = {
  fieldsAdded: [],
  fieldsUpdated: [
    {
      name: 'tasks.snowflake_task.description',
      oldValue: 'Airflow operator to perform ETL on snowflake tables',
      newValue: 'Airflow operator to perform ETL on snowflake tables open',
    },
  ],
  fieldsDeleted: [],
  previousVersion: 0.1,
};

const mockColumnChangeDiff = {
  fieldsAdded: [
    {
      name: 'tasks.snowflake_task.tags',
      newValue:
        '[{"tagFQN":"PII.Sensitive","source":"Classification","labelType":"Manual","state":"Confirmed"}]',
    },
  ],
  fieldsUpdated: [],
  fieldsDeleted: [],
  previousVersion: 0.3,
};

export const mockPipelineData = {
  id: 'ea7d9b49-ef81-44a5-ac0d-cbe3d66e0a52',
  name: 'snowflake_etl',
  displayName: 'Snowflake ETL',
  fullyQualifiedName: 'sample_airflow.snowflake_etl',
  description: 'Snowflake ETL pipeline',
  version: 0.2,
  updatedAt: 1688625607758,
  updatedBy: 'admin',
  sourceUrl: 'http://localhost:8080/tree?dag_id=snowflake_etl',
  tasks: [
    {
      name: 'snowflake_task',
      fullyQualifiedName: 'sample_airflow.snowflake_etl.snowflake_task',
      sourceUrl:
        'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=assert_table_exists',
      downstreamTasks: ['assert_table_exists'],
      taskType: 'SnowflakeOperator',
      tags: [],
    },
    {
      name: 'assert_table_exists',
      displayName: 'Assert Table Exists',
      fullyQualifiedName: 'sample_airflow.snowflake_etl.assert_table_exists',
      description: 'Assert if a table exists',
      sourceUrl:
        'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=assert_table_exists',
      downstreamTasks: [],
      taskType: 'HiveOperator',
      tags: [],
    },
  ],
  followers: [],
  tags: [],
  service: {
    id: '53675b50-8121-4358-b590-8540ef70f2dd',
    type: 'pipelineService',
    name: 'sample_airflow',
    fullyQualifiedName: 'sample_airflow',
    deleted: false,
  },
  serviceType: PipelineServiceType.Airflow,
  changeDescription: mockDescriptionChangeDiff,
  deleted: false,
};

export const pipelineVersionMockProps: PipelineVersionProp = {
  version: '0.3',
  currentVersionData: mockPipelineData,
  isVersionLoading: false,
  owners: mockOwner,
  domains: [mockDomain],
  dataProducts: [],
  tier: mockTier,
  slashedPipelineName: [],
  versionList: mockVersionList,
  deleted: false,
  backHandler: mockBackHandler,
  versionHandler: mockVersionHandler,
  entityPermissions: ENTITY_PERMISSIONS,
};

const mockColumnDiffPipelineData = {
  ...mockPipelineData,
  changeDescription: mockColumnChangeDiff,
};

export const mockColumnDiffPipelineVersionMockProps = {
  ...pipelineVersionMockProps,
  currentVersionData: mockColumnDiffPipelineData,
};

export const EXECUTION_LIST_MOCK = [
  {
    timestamp: 1697265270340,
    executionStatus: StatusType.Pending,
    taskStatus: [
      {
        name: 'dim_address_task',
        executionStatus: StatusType.Pending,
      },
      {
        name: 'assert_table_exists',
        executionStatus: StatusType.Pending,
      },
    ],
  },
  {
    timestamp: 1697265270200,
    executionStatus: StatusType.Pending,
    taskStatus: [
      {
        name: 'dim_address_task',
        executionStatus: StatusType.Failed,
      },
      {
        name: 'assert_table_exists',
        executionStatus: StatusType.Pending,
      },
    ],
  },
  {
    timestamp: 1697265269958,
    executionStatus: StatusType.Pending,
    taskStatus: [
      {
        name: 'dim_address_task',
        executionStatus: StatusType.Pending,
      },
      {
        name: 'assert_table_exists',
        executionStatus: StatusType.Successful,
      },
    ],
  },
  {
    timestamp: 1697265269825,
    executionStatus: StatusType.Failed,
    taskStatus: [
      {
        name: 'dim_address_task',
        executionStatus: StatusType.Failed,
      },
      {
        name: 'assert_table_exists',
        executionStatus: StatusType.Successful,
      },
    ],
  },
  {
    timestamp: 1697265269683,
    executionStatus: StatusType.Failed,
    taskStatus: [
      {
        name: 'dim_address_task',
        executionStatus: StatusType.Successful,
      },
      {
        name: 'assert_table_exists',
        executionStatus: StatusType.Failed,
      },
    ],
  },
  {
    timestamp: 1697265269509,
    executionStatus: StatusType.Successful,
    taskStatus: [
      {
        name: 'dim_address_task',
        executionStatus: StatusType.Successful,
      },
      {
        name: 'assert_table_exists',
        executionStatus: StatusType.Successful,
      },
    ],
  },
  {
    timestamp: 1697265269363,
    executionStatus: StatusType.Failed,
    taskStatus: [
      {
        name: 'dim_address_task',
        executionStatus: StatusType.Failed,
      },
      {
        name: 'assert_table_exists',
        executionStatus: StatusType.Failed,
      },
    ],
  },
];
