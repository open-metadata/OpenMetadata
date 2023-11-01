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

import { User } from '../generated/entity/teams/user';

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
      id: '9e8b7464-3f3e-4071-af05-19be142d75db',
      type: 'team',
      name: 'Organization',
      fullyQualifiedName: 'Organization',
      description:
        'Organization under which all the other team hierarchy is created',
      displayName: 'Organization',
      deleted: false,
      href: 'http://localhost:8585/api/v1/teams/9e8b7464-3f3e-4071-af05-19be142d75db',
    },
  ],
  personas: [
    {
      id: '0430976d-092a-46c9-90a8-61c6091a6f38',
      type: 'persona',
      name: 'Person-04',
      fullyQualifiedName: 'Person-04',
      description: 'Person-04',
      displayName: 'Person-04',
      href: 'http://localhost:8585/api/v1/personas/0430976d-092a-46c9-90a8-61c6091a6f38',
    },
  ],
  defaultPersona: {
    description: 'Person-04',
    displayName: 'Person-04',
    fullyQualifiedName: 'Person-04',
    href: 'http://localhost:8585/api/v1/personas/0430976d-092a-46c9-90a8-61c6091a6f38',
    id: '0430976d-092a-46c9-90a8-61c6091a6f38',
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
  roles: [
    {
      id: 'ed94fd7c-0974-4b87-9295-02b36c4c6bcd',
      type: 'role',
      name: 'DataConsumer',
      fullyQualifiedName: 'DataConsumer',
      description:
        'Users with Data Consumer role use different data assets for their day to day work.',
      displayName: 'Data Consumer',
      deleted: false,
      href: 'http://localhost:8585/api/v1/roles/ed94fd7c-0974-4b87-9295-02b36c4c6bcd',
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
      id: 'ed94fd7c-0974-4b87-9295-02b36c4c6bcd',
      type: 'role',
      name: 'DataConsumer',
      fullyQualifiedName: 'DataConsumer',
      description:
        'Users with Data Consumer role use different data assets for their day to day work.',
      displayName: 'Data Consumer',
      deleted: false,
      href: 'http://localhost:8585/api/v1/roles/ed94fd7c-0974-4b87-9295-02b36c4c6bcd',
    },
  ],
  isEmailVerified: true,
};

export const USER_TEAMS = [
  {
    id: '9e8b7464-3f3e-4071-af05-19be142d75db',
    type: 'team',
    name: 'Organization',
    fullyQualifiedName: 'Organization',
    description:
      'Organization under which all the other team hierarchy is created',
    displayName: 'Organization',
    deleted: false,
    href: 'http://localhost:8585/api/v1/teams/9e8b7464-3f3e-4071-af05-19be142d75db',
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
