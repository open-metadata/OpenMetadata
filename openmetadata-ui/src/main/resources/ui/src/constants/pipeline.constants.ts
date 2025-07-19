/*
 *  Copyright 2022 Collate.
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

import {
  Pipeline,
  PipelineServiceType,
  StatusType,
} from '../generated/entity/data/pipeline';

export enum PIPELINE_TASK_TABS {
  LIST_VIEW = 'List',
  DAG_VIEW = 'Dag',
}

export enum PIPELINE_EXECUTION_TABS {
  LIST_VIEW = 'List',
  TREE_VIEW = 'Tree',
}

export const PIPELINE_INGESTION_RUN_STATUS = {
  queued: '#777777',
  success: '#07a35a',
  failed: '#e54937',
  running: '#276ef1',
  partialSuccess: '#439897',
  paused: '#FFBE0E',
};

export const PIPELINE_DUMMY_DATA: Pipeline = {
  id: '60670fe2-eb0a-41a2-a683-d32964e7e61b',
  name: 'dim_address_etl',
  displayName: 'dim_address etl',
  fullyQualifiedName: 'sample_airflow.dim_address_etl',
  description: 'dim_address ETL pipeline',
  dataProducts: [],
  version: 0.2,
  updatedAt: 1726204840178,
  updatedBy: 'ashish',
  tasks: [
    {
      name: 'dim_address_task',
      displayName: 'dim_address Task',
      fullyQualifiedName: 'sample_airflow.dim_address_etl.dim_address_task',
      description:
        'Airflow operator to perform ETL and generate dim_address table',
      downstreamTasks: ['assert_table_exists'],
      taskType: 'PrestoOperator',
      tags: [],
    },
    {
      name: 'assert_table_exists',
      displayName: 'Assert Table Exists',
      fullyQualifiedName: 'sample_airflow.dim_address_etl.assert_table_exists',
      description: 'Assert if a table exists',
      downstreamTasks: [],
      taskType: 'HiveOperator',
      tags: [],
    },
  ],
  pipelineStatus: {
    timestamp: 1723014798482,
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
  followers: [
    {
      id: 'e596a9cd-9ce1-4e12-aee1-b6f31926b0e8',
      type: 'user',
      name: 'ashish',
      fullyQualifiedName: 'ashish',
      description:
        '<p><code>data driven car</code></p><p><code>Hybrid Modal</code></p>',
      displayName: 'Ashish',
      deleted: false,
    },
  ],
  tags: [],
  owners: [],
  service: {
    id: 'f83c2b6e-0d09-4839-98df-5571cc17c829',
    type: 'pipelineService',
    name: 'sample_airflow',
    fullyQualifiedName: 'sample_airflow',
    displayName: 'sample_airflow',
    deleted: false,
  },
  serviceType: PipelineServiceType.Airflow,
  deleted: false,
  scheduleInterval: '5 * * * *',
  domains: [
    {
      id: '6b440596-144b-417b-b7ee-95cf0b0d7de4',
      type: 'domain',
      name: 'Version -1.6.2 Domain',
      fullyQualifiedName: '"Version -1.6.2 Domain"',
      description: '<p>Version -1.6.2 Domain</p>',
      displayName: 'Version -1.6.2 Domain',
      inherited: true,
    },
  ],
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
};
