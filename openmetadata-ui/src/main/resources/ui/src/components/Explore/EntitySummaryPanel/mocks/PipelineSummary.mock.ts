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

import { Pipeline } from '../../../../generated/entity/data/pipeline';

export const mockPipelineEntityDetails: Pipeline = {
  id: 'b35f7a53-16a9-4ed1-9223-801c3d75674f',
  name: 'dim_address_etl',
  displayName: 'dim_address etl',
  fullyQualifiedName: 'sample_airflow.dim_address_etl',
  description: 'dim_address ETL pipeline',
  version: 0.1,
  updatedAt: 1672627829327,
  updatedBy: 'admin',
  pipelineUrl: 'http://localhost:8080/tree?dag_id=dim_address_etl',
  tasks: [
    {
      name: 'dim_address_task',
      displayName: 'dim_address Task',
      description:
        'Airflow operator to perform ETL and generate dim_address table',
      taskUrl:
        'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=dim_address_task',
      downstreamTasks: ['assert_table_exists'],
      taskType: 'PrestoOperator',
    },
    {
      name: 'assert_table_exists',
      displayName: 'Assert Table Exists',
      description: 'Assert if a table exists',
      taskUrl:
        'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=assert_table_exists',
      downstreamTasks: [],
      taskType: 'HiveOperator',
    },
  ],
  deleted: false,
  href: 'http://openmetadata-server:8585/api/v1/pipelines/b35f7a53-16a9-4ed1-9223-801c3d75674f',
  followers: [],
  tags: [],
  service: {
    id: 'd1c5f7b4-dc61-4336-a4b1-a27e0b97d791',
    type: 'pipelineService',
    name: 'sample_airflow',
    fullyQualifiedName: 'sample_airflow',
    deleted: false,
    href: 'http://openmetadata-server:8585/api/v1/services/pipelineServices/d1c5f7b4-dc61-4336-a4b1-a27e0b97d791',
  },
};
