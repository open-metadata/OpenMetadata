/*
 *  Copyright 2021 Collate
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

export const mockTeams = [
  {
    id: '8754b53f-15cd-4d9a-af52-bdb3a2abff61',
    name: 'Cloud_Infra',
    fullyQualifiedName: 'Cloud_Infra',
    displayName: 'Cloud_Infra',
    description: 'This is Cloud_Infra description.',
    version: 0.3,
    updatedAt: 1653388025589,
    updatedBy: 'anonymous',
    href: 'http://localhost:8585/api/v1/teams/8754b53f-15cd-4d9a-af52-bdb3a2abff61',
    users: [],
  },
  {
    id: '8754b53f-15cd-4d9a-af52-bdb3a2abffss',
    name: 'Customer_Support',
    fullyQualifiedName: 'Customer_Support',
    displayName: 'Customer_Support',
    description: 'This is Customer_Support description.',
    version: 0.3,
    updatedAt: 1653388025589,
    updatedBy: 'anonymous',
    href: 'test',
    users: [],
  },
];

export const MOCK_USER = [
  {
    id: '011bdb24-90a7-4a97-ba66-24002adb2b12',
    type: 'user',
    name: 'aaron_johnson0',
    fullyQualifiedName: 'aaron_johnson0',
    displayName: 'Aaron Johnson',
    deleted: false,
    href: 'http://localhost:8585/api/v1/users/011bdb24-90a7-4a97-ba66-24002adb2b12',
  },
  {
    id: '2a31e452-2061-4517-af35-0ace16161cde',
    type: 'user',
    name: 'aaron_singh2',
    fullyQualifiedName: 'aaron_singh2',
    displayName: 'Aaron Singh',
    deleted: false,
    href: 'http://localhost:8585/api/v1/users/2a31e452-2061-4517-af35-0ace16161cde',
  },
];

export const MOCK_CURRENT_TEAM_1 = {
  id: '0ccba9c2-bb41-4e8d-9add-7af8bdd8d6b8',
  name: 'Cloud_Infra',
  fullyQualifiedName: 'Cloud_Infra',
  displayName: 'Cloud_Infra',
  description: 'This is Cloud_Infra description.',
  version: 0.3,
  updatedAt: 1653410822537,
  updatedBy: 'anonymous',
  href: 'http://localhost:8585/api/v1/teams/0ccba9c2-bb41-4e8d-9add-7af8bdd8d6b8',
  isJoinable: true,
  changeDescription: {
    fieldsAdded: [
      {
        name: 'owner',
        newValue:
          '{"id":"9fcf9550-1571-4f79-8016-ba81a8c4a2f4","type":"user","name":"aaron_johnson0","fullyQualifiedName":"aaron_johnson0","displayName":"Aaron Johnson","deleted":false}',
      },
    ],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 0.2,
  },
  deleted: false,
  defaultRoles: [
    {
      id: 'fb41f804-e266-4a8e-8f3a-022c72c70033',
      type: 'role',
      name: 'DataConsumer',
      fullyQualifiedName: 'DataConsumer',
      description:
        'Users with Data Consumer role use different data assets for their day to day work.',
      displayName: 'Data Consumer',
      deleted: false,
      href: 'http://localhost:8585/api/v1/roles/fb41f804-e266-4a8e-8f3a-022c72c70033',
    },
  ],
};
