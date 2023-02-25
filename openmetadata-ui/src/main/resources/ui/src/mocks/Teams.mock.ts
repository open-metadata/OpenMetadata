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
/*  Copyright 2022 Collate
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

export const MOCK_CURRENT_TEAM = {
  childrenCount: 22,
  defaultRoles: [
    {
      deleted: false,
      description:
        'Users with Data Consumer role use different data assets for their day to day work.',
      displayName: 'Data Consumer',
      fullyQualifiedName: 'DataConsumer',
      href: 'http://sandbox-beta.open-metadata.org/api/v1/roles/1497b0cf-cb5f-42c2-8e13-3ab68b90bfa0',
      id: '1497b0cf-cb5f-42c2-8e13-3ab68b90bfa0',
      name: 'DataConsumer',
      type: 'role',
    },
  ],
  deleted: false,
  description:
    'Organization under which all the other team hierarchy is created',
  displayName: 'Organization',
  fullyQualifiedName: 'Organization',
  href: 'http://sandbox-beta.open-metadata.org/api/v1/teams/f9578f16-363a-4788-80fb-d05816c9e169',
  id: 'f9578f16-363a-4788-80fb-d05816c9e169',
  inheritedRoles: [],
  isJoinable: false,
  name: 'Organization',
  owns: [],
  parents: [],
  policies: [
    {
      deleted: false,
      description: 'Policy for all the users of an organization.',
      displayName: 'Organization Policy',
      fullyQualifiedName: 'OrganizationPolicy',
      href: 'http://sandbox-beta.open-metadata.org/api/v1/policies/09f4480c-ef57-4239-b2aa-c87053ad4f46',
      id: '09f4480c-ef57-4239-b2aa-c87053ad4f46',
      name: 'OrganizationPolicy',
      type: 'policy',
    },
  ],
  teamType: undefined,
  updatedAt: 1669719624263,
  updatedBy: 'ag939431',
  users: [],
  version: 2.4,
};

export const MOCK_TABLE_DATA = [
  {
    children: [
      {
        children: undefined,
        childrenCount: 0,
        defaultRoles: [],
        deleted: false,
        fullyQualifiedName: 'Applications',
        href: 'http://localhost:8585/api/v1/teams/eb4b1b74-d30e-4bfa-8409-dac15db3cc32',
        id: 'eb4b1b74-d30e-4bfa-8409-dac15db3cc32',
        inheritedRoles: [],
        isJoinable: true,
        key: 'Applications',
        name: 'Applications',
        owns: [],
        teamType: 'Group',
        updatedAt: 1670390160760,
        updatedBy: 'admin',
        userCount: 12,
        version: 0.1,
        type: 'BusinessUnit',
      },
      {
        children: undefined,
        childrenCount: 3,
        defaultRoles: [],
        deleted: false,
        fullyQualifiedName: 'Infrastructure',
        href: 'http://localhost:8585/api/v1/teams/c8cc8922-8917-4d33-94e3-d9d257dd8830',
        id: 'c8cc8922-8917-4d33-94e3-d9d257dd8830',
        inheritedRoles: [],
        isJoinable: true,
        key: 'Infrastructure',
        name: 'Infrastructure',
        owns: [],
        teamType: 'BusinessUnit',
        type: 'BusinessUnit',
        updatedAt: 1670390159742,
        updatedBy: 'admin',
        userCount: 20,
        version: 0.1,
      },
    ],
    childrenCount: 4,
    defaultRoles: [],
    deleted: false,
    fullyQualifiedName: 'Engineering',
    href: 'http://sandbox-beta.open-metadata.org/api/v1/teams/49d060a2-ad14-48a7-840a-836cd99aaffb',
    id: '49d060a2-ad14-48a7-840a-836cd99aaffb',
    inheritedRoles: [
      {
        deleted: false,
        description:
          'Users with Data Consumer role use different data assets for their day to day work.',
        displayName: 'Data Consumer',
        fullyQualifiedName: 'DataConsumer',
        href: 'http://sandbox-beta.open-metadata.org/api/v1/roles/1497b0cf-cb5f-42c2-8e13-3ab68b90bfa0',
        id: '1497b0cf-cb5f-42c2-8e13-3ab68b90bfa0',
        name: 'DataConsumer',
        type: 'role',
      },
    ],
    isJoinable: true,
    key: 'Engineering',
    name: 'Engineering',
    owns: [],
    teamType: undefined,
    updatedAt: 1670312015218,
    updatedBy: 'ingestion-bot',
    userCount: 50,
  },
  {
    children: [],
    childrenCount: 3,
    defaultRoles: [],
    deleted: false,
    fullyQualifiedName: 'Finance',
    href: 'http://sandbox-beta.open-metadata.org/api/v1/teams/b201a5b2-b0e8-461d-9fa1-cd5212d09eee',
    id: 'b201a5b2-b0e8-461d-9fa1-cd5212d09eee',
    inheritedRoles: [
      {
        deleted: false,
        description:
          'Users with Data Consumer role use different data assets for their day to day work.',
        displayName: 'Data Consumer',
        fullyQualifiedName: 'DataConsumer',
        href: 'http://sandbox-beta.open-metadata.org/api/v1/roles/1497b0cf-cb5f-42c2-8e13-3ab68b90bfa0',
        id: '1497b0cf-cb5f-42c2-8e13-3ab68b90bfa0',
        name: 'DataConsumer',
        type: 'role',
      },
    ],
    isJoinable: true,
    key: 'Finance',
    name: 'Finance',
    owns: [],
    teamType: undefined,
    updatedAt: 1670312016093,
    updatedBy: 'ingestion-bot',
    userCount: 2,
  },
  {
    children: [],
    childrenCount: 2,
    defaultRoles: [],
    deleted: false,
    fullyQualifiedName: 'Legal',
    href: 'http://sandbox-beta.open-metadata.org/api/v1/teams/e64afbd0-aab5-4aed-952d-c5a5b8ba06bb',
    id: 'e64afbd0-aab5-4aed-952d-c5a5b8ba06bb',
    inheritedRoles: [
      {
        deleted: false,
        description:
          'Users with Data Consumer role use different data assets for their day to day work.',
        displayName: 'Legal',
        fullyQualifiedName: 'Legal',
        href: 'http://sandbox-beta.open-metadata.org/api/v1/roles/1497b0cf-cb5f-42c2-8e13-3ab68b90bfa0',
        id: '1497b0cf-cb5f-42c2-8e13-3ab68b90bfa0',
        name: 'Legal',
        type: 'role',
      },
    ],
    isJoinable: true,
    key: 'Marketing',
    name: 'Marketing',
    owns: [],
    teamType: undefined,
    updatedAt: 1670312016516,
    updatedBy: 'ingestion-bot',
    userCount: 3,
  },
];
