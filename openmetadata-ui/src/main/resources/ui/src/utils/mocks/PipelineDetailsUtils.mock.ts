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

import {
  LabelType,
  Pipeline,
  State,
  TagSource,
} from 'generated/entity/data/pipeline';

export const mockPipelineDetails: Pipeline = {
  id: '411e4e5e-b6d0-4fc9-bd82-ebe479f68249',
  name: 'dim_address_etl',
  displayName: 'dim_address etl',
  fullyQualifiedName: 'sample_airflow.dim_address_etl',
  tasks: [
    {
      name: 'dim_address_task',
      displayName: 'dim_address Task',
      tags: [
        {
          tagFQN: 'PII.Sensitive',
          source: TagSource.Tag,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
        {
          tagFQN: 'TagClass.tag1',
          source: TagSource.Tag,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
        {
          tagFQN: 'PersonalData.Personal',
          source: TagSource.Tag,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ],
    },
    {
      name: 'assert_table_exists',
      displayName: 'Assert Table Exists',
    },
  ],
  service: {
    id: 'cbdc2874-0984-42fb-9469-bfa4e6a3d4e8',
    type: 'pipelineService',
    name: 'sample_airflow',
    fullyQualifiedName: 'sample_airflow',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/pipelineServices/cbdc2874-0984-42fb-9469-bfa4e6a3d4e8',
  },
};

export const mockSortedPipelineDetails: Pipeline = {
  id: '411e4e5e-b6d0-4fc9-bd82-ebe479f68249',
  name: 'dim_address_etl',
  displayName: 'dim_address etl',
  fullyQualifiedName: 'sample_airflow.dim_address_etl',
  tasks: [
    {
      name: 'dim_address_task',
      displayName: 'dim_address Task',
      tags: [
        {
          tagFQN: 'PersonalData.Personal',
          source: TagSource.Tag,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
        {
          tagFQN: 'PII.Sensitive',
          source: TagSource.Tag,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
        {
          tagFQN: 'TagClass.tag1',
          source: TagSource.Tag,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ],
    },
    {
      name: 'assert_table_exists',
      displayName: 'Assert Table Exists',
    },
  ],
  service: {
    id: 'cbdc2874-0984-42fb-9469-bfa4e6a3d4e8',
    type: 'pipelineService',
    name: 'sample_airflow',
    fullyQualifiedName: 'sample_airflow',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/pipelineServices/cbdc2874-0984-42fb-9469-bfa4e6a3d4e8',
  },
};

export const mockPipelineDetailsWithoutTaskTags: Pipeline = {
  id: '411e4e5e-b6d0-4fc9-bd82-ebe479f68249',
  name: 'dim_address_etl',
  displayName: 'dim_address etl',
  fullyQualifiedName: 'sample_airflow.dim_address_etl',
  tasks: [
    {
      name: 'dim_address_task',
      displayName: 'dim_address Task',
    },
    {
      name: 'assert_table_exists',
      displayName: 'Assert Table Exists',
    },
  ],
  service: {
    id: 'cbdc2874-0984-42fb-9469-bfa4e6a3d4e8',
    type: 'pipelineService',
    name: 'sample_airflow',
    fullyQualifiedName: 'sample_airflow',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/pipelineServices/cbdc2874-0984-42fb-9469-bfa4e6a3d4e8',
  },
};
