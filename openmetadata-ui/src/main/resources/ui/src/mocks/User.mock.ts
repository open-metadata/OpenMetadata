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

import { EntityType } from '../enums/entity.enum';
import { User } from '../generated/entity/teams/user';

const STR_9E8B7464_3F3E_4071_AF05_19BE142D75DB =
  '9e8b7464-3f3e-4071-af05-19be142d75db';
const ORGANIZATION_UNDER_WHICH_ALL_THE_OTHER_TEA =
  'Organization under which all the other team hierarchy is created';
const HTTP_LOCALHOST_8585_API_V1_TEAMS_9E8B7464 =
  'http://localhost:8585/api/v1/teams/9e8b7464-3f3e-4071-af05-19be142d75db';
const STR_0430976D_092A_46C9_90A8_61C6091A6F38 =
  '0430976d-092a-46c9-90a8-61c6091a6f38';
const HTTP_LOCALHOST_8585_API_V1_PERSONAS_043097 =
  'http://localhost:8585/api/v1/personas/0430976d-092a-46c9-90a8-61c6091a6f38';
const ED94FD7C_0974_4B87_9295_02B36C4C6BCD =
  'ed94fd7c-0974-4b87-9295-02b36c4c6bcd';
const USERS_WITH_DATA_CONSUMER_ROLE_USE_DIFFEREN =
  'Users with Data Consumer role use different data assets for their day to day work.';
const DATA_CONSUMER = 'Data Consumer';
const HTTP_LOCALHOST_8585_API_V1_ROLES_ED94FD7C =
  'http://localhost:8585/api/v1/roles/ed94fd7c-0974-4b87-9295-02b36c4c6bcd';

export const USER_DATA: User = {
  id: '7f196a28-c4fa-4579-b420-f828985e7861',
  name: 'admin',
  fullyQualifiedName: 'admin',
  description: '',
  displayName: '',
  version: 3.3,
  updatedAt: 1698655259882,
  updatedBy: 'admin',
  email: 'admin@openmetadata.org',
  href: 'http://localhost:8585/api/v1/users/7f196a28-c4fa-4579-b420-f828985e7861',
  isBot: false,
  isAdmin: true,
  teams: [
    {
      id: STR_9E8B7464_3F3E_4071_AF05_19BE142D75DB,
      type: 'team',
      name: 'Organization',
      fullyQualifiedName: 'Organization',
      description: ORGANIZATION_UNDER_WHICH_ALL_THE_OTHER_TEA,
      displayName: 'Organization',
      deleted: false,
      href: HTTP_LOCALHOST_8585_API_V1_TEAMS_9E8B7464,
    },
  ],
  personas: [
    {
      id: STR_0430976D_092A_46C9_90A8_61C6091A6F38,
      type: 'persona',
      name: 'Person-04',
      fullyQualifiedName: 'Person-04',
      description: 'Person-04',
      displayName: 'Person-04',
      href: HTTP_LOCALHOST_8585_API_V1_PERSONAS_043097,
    },
  ],
  defaultPersona: {
    description: 'Person-04',
    displayName: 'Person-04',
    fullyQualifiedName: 'Person-04',
    href: HTTP_LOCALHOST_8585_API_V1_PERSONAS_043097,
    id: STR_0430976D_092A_46C9_90A8_61C6091A6F38,
    name: 'Person-04',
    type: 'persona',
  },
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 3.2,
  },
  deleted: false,
  domains: [
    {
      id: '303ca53b-5050-4caa-9c4e-d4fdada76a53',
      type: EntityType.DOMAIN,
      name: 'Engineering',
      fullyQualifiedName: 'Engineering',
      description: 'description',
      inherited: true,
      href: 'http://localhost:8585/api/v1/domains/303ca53b-5050-4caa-9c4e-d4fdada76a53',
    },
  ],
  roles: [
    {
      id: ED94FD7C_0974_4B87_9295_02B36C4C6BCD,
      type: 'role',
      name: 'DataConsumer',
      fullyQualifiedName: 'DataConsumer',
      description: USERS_WITH_DATA_CONSUMER_ROLE_USE_DIFFEREN,
      displayName: DATA_CONSUMER,
      deleted: false,
      href: HTTP_LOCALHOST_8585_API_V1_ROLES_ED94FD7C,
    },
    {
      id: 'a24f61cc-be15-411a-aaf6-28a8c8029728',
      type: 'role',
      name: 'DataSteward',
      fullyQualifiedName: 'DataSteward',
      description: 'this is test description',
      displayName: 'Data Steward',
      deleted: false,
      href: 'http://localhost:8585/api/v1/roles/a24f61cc-be15-411a-aaf6-28a8c8029728',
    },
    {
      id: '257b6976-26c6-4397-b025-087b95e45788',
      type: 'role',
      name: 'IngestionBotRole',
      fullyQualifiedName: 'IngestionBotRole',
      description: 'Role corresponding to a Ingestion bot.',
      displayName: 'Ingestion bot role',
      deleted: false,
      href: 'http://localhost:8585/api/v1/roles/257b6976-26c6-4397-b025-087b95e45788',
    },
  ],
  inheritedRoles: [
    {
      id: ED94FD7C_0974_4B87_9295_02B36C4C6BCD,
      type: 'role',
      name: 'DataConsumer',
      fullyQualifiedName: 'DataConsumer',
      description: USERS_WITH_DATA_CONSUMER_ROLE_USE_DIFFEREN,
      displayName: DATA_CONSUMER,
      deleted: false,
      href: HTTP_LOCALHOST_8585_API_V1_ROLES_ED94FD7C,
    },
  ],
  isEmailVerified: true,
};

export const USER_TEAMS = [
  {
    id: STR_9E8B7464_3F3E_4071_AF05_19BE142D75DB,
    type: 'team',
    name: 'Organization',
    fullyQualifiedName: 'Organization',
    description: ORGANIZATION_UNDER_WHICH_ALL_THE_OTHER_TEA,
    displayName: 'Organization',
    deleted: false,
    href: HTTP_LOCALHOST_8585_API_V1_TEAMS_9E8B7464,
  },

  {
    id: '9e8b7464-3f3e-4071-af05-19be142d75bc',
    type: 'team',
    name: 'Application',
    fullyQualifiedName: 'Application',
    description:
      'Application under which all the other team hierarchy is created',
    displayName: 'Application',
    deleted: false,
    href: 'http://localhost:8585/api/v1/teams/9e8b7464-3f3e-4071-af05-19be142d75bc',
  },
];

export const MOCK_USER_ROLE = [
  {
    id: '37a00e0b-383c-4451-b63f-0bad4c745abc',
    type: 'role',
    name: 'ApplicationBotRole',
    fullyQualifiedName: 'ApplicationBotRole',
    description: 'Role corresponding to a Application bot.',
    displayName: 'Application bot role',
    deleted: false,
    href: 'http://localhost:8585/api/v1/roles/37a00e0b-383c-4451-b63f-0bad4c745abc',
  },
  {
    id: 'afc5583c-e268-4f6c-a638-a876d04ebaa1',
    type: 'role',
    name: 'DataConsumer',
    fullyQualifiedName: 'DataConsumer',
    description: USERS_WITH_DATA_CONSUMER_ROLE_USE_DIFFEREN,
    displayName: DATA_CONSUMER,
    deleted: false,
    href: 'http://localhost:8585/api/v1/roles/afc5583c-e268-4f6c-a638-a876d04ebaa1',
  },
  {
    id: '013746ec-2159-496e-88f7-f7175a2af919',
    type: 'role',
    name: 'DataQualityBotRole',
    fullyQualifiedName: 'DataQualityBotRole',
    description: 'Role corresponding to a Data quality bot.',
    displayName: 'Data quality Bot role',
    deleted: false,
    href: 'http://localhost:8585/api/v1/roles/013746ec-2159-496e-88f7-f7175a2af919',
  },
  {
    id: 'dd72bae6-1835-4ba9-9532-aaa4b648d3e8',
    type: 'role',
    name: 'DataSteward',
    fullyQualifiedName: 'DataSteward',
    description:
      'Users with Data Steward role are responsible for ensuring correctness of metadata for data assets, thereby facilitating data governance principles within the organization.',
    displayName: 'Data Steward',
    deleted: false,
    href: 'http://localhost:8585/api/v1/roles/dd72bae6-1835-4ba9-9532-aaa4b648d3e8',
  },
  {
    id: '6b007040-1378-4de9-a8b0-f922fc9f4e25',
    type: 'role',
    name: 'IngestionBotRole',
    fullyQualifiedName: 'IngestionBotRole',
    description: 'Role corresponding to a Ingestion bot.',
    displayName: 'Ingestion bot role',
    deleted: false,
    href: 'http://localhost:8585/api/v1/roles/6b007040-1378-4de9-a8b0-f922fc9f4e25',
  },
  {
    id: '7f8de4ae-8b08-431c-9911-8a355aa2976e',
    type: 'role',
    name: 'ProfilerBotRole',
    fullyQualifiedName: 'ProfilerBotRole',
    description: 'Role corresponding to a Profiler bot.',
    displayName: 'Profiler bot role',
    deleted: false,
    href: 'http://localhost:8585/api/v1/roles/7f8de4ae-8b08-431c-9911-8a355aa2976e',
  },
  {
    id: '7082d70a-ddb2-42db-b639-3ec4c7884c52',
    type: 'role',
    name: 'QualityBotRole',
    fullyQualifiedName: 'QualityBotRole',
    description: 'Role corresponding to a Quality bot.',
    displayName: 'Quality bot role',
    deleted: false,
    href: 'http://localhost:8585/api/v1/roles/7082d70a-ddb2-42db-b639-3ec4c7884c52',
  },
  {
    id: 'admin',
    type: 'role',
    name: 'Admin',
  },
];

export const UPDATED_USER_DATA = {
  changeDescription: {
    fieldsAdded: [],
    fieldsDeleted: [],
    fieldsUpdated: [],
    previousVersion: 3.2,
  },
  defaultPersona: {
    description: 'Person-04',
    displayName: 'Person-04',
    fullyQualifiedName: 'Person-04',
    href: HTTP_LOCALHOST_8585_API_V1_PERSONAS_043097,
    id: STR_0430976D_092A_46C9_90A8_61C6091A6F38,
    name: 'Person-04',
    type: 'persona',
  },
  deleted: false,
  description: '',
  displayName: '',
  domains: [
    {
      description: 'description',
      fullyQualifiedName: 'Engineering',
      href: 'http://localhost:8585/api/v1/domains/303ca53b-5050-4caa-9c4e-d4fdada76a53',
      id: '303ca53b-5050-4caa-9c4e-d4fdada76a53',
      inherited: true,
      name: 'Engineering',
      type: 'domain',
    },
  ],
  email: 'admin@openmetadata.org',
  fullyQualifiedName: 'admin',
  href: 'http://localhost:8585/api/v1/users/7f196a28-c4fa-4579-b420-f828985e7861',
  id: '7f196a28-c4fa-4579-b420-f828985e7861',
  inheritedRoles: [
    {
      deleted: false,
      description: USERS_WITH_DATA_CONSUMER_ROLE_USE_DIFFEREN,
      displayName: DATA_CONSUMER,
      fullyQualifiedName: 'DataConsumer',
      href: HTTP_LOCALHOST_8585_API_V1_ROLES_ED94FD7C,
      id: ED94FD7C_0974_4B87_9295_02B36C4C6BCD,
      name: 'DataConsumer',
      type: 'role',
    },
  ],
  isAdmin: false,
  isBot: false,
  isEmailVerified: true,
  name: 'admin',
  personas: [
    {
      description: 'Person-04',
      displayName: 'Person-04',
      fullyQualifiedName: 'Person-04',
      href: HTTP_LOCALHOST_8585_API_V1_PERSONAS_043097,
      id: STR_0430976D_092A_46C9_90A8_61C6091A6F38,
      name: 'Person-04',
      type: 'persona',
    },
  ],
  roles: [
    {
      id: '7f8de4ae-8b08-431c-9911-8a355aa2976e',
      name: 'ProfilerBotRole',
      type: 'role',
    },
  ],
  teams: [
    {
      deleted: false,
      description: ORGANIZATION_UNDER_WHICH_ALL_THE_OTHER_TEA,
      displayName: 'Organization',
      fullyQualifiedName: 'Organization',
      href: HTTP_LOCALHOST_8585_API_V1_TEAMS_9E8B7464,
      id: STR_9E8B7464_3F3E_4071_AF05_19BE142D75DB,
      name: 'Organization',
      type: 'team',
    },
  ],
  updatedAt: 1698655259882,
  updatedBy: 'admin',
  version: 3.3,
};
