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

import { TeamType } from 'generated/entity/teams/team';
import { TeamDetailsProp } from 'interface/teamsAndUsers.interface';

export const mockPush = jest.fn();

export const mockGroupTypeTeam = {
  id: 'dc95179f-f866-408c-a0e2-c1a2b9373cdd',
  teamType: TeamType.Group,
  name: 'TestTeam',
  fullyQualifiedName: 'TestTeam',
  displayName: 'TestTeam',
  description: '',
  version: 0.5,
  updatedAt: 1684299228689,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/teams/dc95179f-f866-408c-a0e2-c1a2b9373cdd',
  parents: [
    {
      id: 'e262825c-354a-47b5-96ce-aad501c01b00',
      type: 'team',
      name: 'Organization',
      fullyQualifiedName: 'Organization',
      description:
        'Organization under which all the other team hierarchy is created',
      displayName: 'Organization',
      deleted: false,
      href: 'http://localhost:8585/api/v1/teams/e262825c-354a-47b5-96ce-aad501c01b00',
    },
  ],
  users: [],
  childrenCount: 0,
  owns: [],
  isJoinable: true,
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [
      {
        name: 'deleted',
        oldValue: true,
        newValue: false,
      },
    ],
    fieldsDeleted: [],
    previousVersion: 0.4,
  },
  deleted: false,
  defaultRoles: [],
  inheritedRoles: [
    {
      id: '5ab8d61f-1ca3-4584-9aaf-bf241c33f664',
      type: 'role',
      name: 'DataConsumer',
      fullyQualifiedName: 'DataConsumer',
      description:
        'Users with Data Consumer role use different data assets for their day to day work.',
      displayName: 'Data Consumer',
      deleted: false,
      href: 'http://localhost:8585/api/v1/roles/5ab8d61f-1ca3-4584-9aaf-bf241c33f664',
    },
  ],
  policies: [],
};

export const mockBusinessUnitTypeTeam = {
  id: 'dc95179f-f866-408c-a0e2-c1a2b9373cdd',
  teamType: TeamType.BusinessUnit,
  name: 'TestTeam',
  fullyQualifiedName: 'TestTeam',
  displayName: 'TestTeam',
  description: '',
  version: 0.5,
  updatedAt: 1684299228689,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/teams/dc95179f-f866-408c-a0e2-c1a2b9373cdd',
  parents: [
    {
      id: 'e262825c-354a-47b5-96ce-aad501c01b00',
      type: 'team',
      name: 'Organization',
      fullyQualifiedName: 'Organization',
      description:
        'Organization under which all the other team hierarchy is created',
      displayName: 'Organization',
      deleted: false,
      href: 'http://localhost:8585/api/v1/teams/e262825c-354a-47b5-96ce-aad501c01b00',
    },
  ],
  users: [],
  childrenCount: 0,
  owns: [],
  isJoinable: true,
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [
      {
        name: 'deleted',
        oldValue: true,
        newValue: false,
      },
    ],
    fieldsDeleted: [],
    previousVersion: 0.4,
  },
  deleted: false,
  defaultRoles: [],
  inheritedRoles: [
    {
      id: '5ab8d61f-1ca3-4584-9aaf-bf241c33f664',
      type: 'role',
      name: 'DataConsumer',
      fullyQualifiedName: 'DataConsumer',
      description:
        'Users with Data Consumer role use different data assets for their day to day work.',
      displayName: 'Data Consumer',
      deleted: false,
      href: 'http://localhost:8585/api/v1/roles/5ab8d61f-1ca3-4584-9aaf-bf241c33f664',
    },
  ],
  policies: [],
};

export const mockTeamDetailsV1Props: TeamDetailsProp = {
  assets: {
    data: [],
    total: 0,
    currPage: 1,
  },
  hasAccess: true,
  currentTeam: mockGroupTypeTeam,
  currentTeamUsers: [],
  teamUserPaging: {
    total: 0,
  },
  currentTeamUserPage: 1,
  teamUsersSearchText: '',
  isDescriptionEditable: false,
  isTeamMemberLoading: 0,
  childTeams: [],
  showDeletedTeam: false,
  parentTeams: [
    {
      id: 'e262825c-354a-47b5-96ce-aad501c01b00',
      teamType: TeamType.Organization,
      name: 'Organization',
      fullyQualifiedName: 'Organization',
      displayName: 'Organization',
      description:
        'Organization under which all the other team hierarchy is created',
      version: 0.1,
      updatedAt: 1684242178145,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/teams/e262825c-354a-47b5-96ce-aad501c01b00',
      parents: [],
      isJoinable: true,
      deleted: false,
    },
  ],
  onTeamExpand: jest.fn(),
  handleAddTeam: jest.fn(),
  updateTeamHandler: jest.fn(),
  onDescriptionUpdate: jest.fn(),
  descriptionHandler: jest.fn(),
  onShowDeletedTeamChange: jest.fn(),
  handleTeamUsersSearchAction: jest.fn(),
  handleCurrentUserPage: jest.fn(),
  teamUserPagingHandler: jest.fn(),
  handleJoinTeamClick: jest.fn(),
  handleLeaveTeamClick: jest.fn(),
  handleAddUser: jest.fn(),
  removeUserFromTeam: jest.fn(),
  afterDeleteAction: jest.fn(),
  onAssetsPaginate: jest.fn(),
};

export const mockTeamSuggestions = {
  data: {
    suggest: {
      'metadata-suggest': [
        {
          text: 'a',
          offset: 0,
          length: 1,
          options: [
            {
              text: 'Accounting',
              _index: 'team_search_index',
              _type: '_doc',
              _id: '4aa777af-d017-42ec-9552-fe776c3ea4f2',
              _score: 20,
              _source: {
                id: '4aa777af-d017-42ec-9552-fe776c3ea4f2',
                teamType: 'Group',
                name: 'Accounting',
                fullyQualifiedName: 'Accounting',
                displayName: 'Accounting',
                version: 0.1,
                updatedAt: 1684234020398,
                updatedBy: 'admin',
                parents: [
                  {
                    id: 'fb6fb899-984c-4229-9b98-23ff7998e1b6',
                    type: 'team',
                    name: 'Finance',
                    fullyQualifiedName: 'Finance',
                    deleted: false,
                  },
                ],
                users: [
                  {
                    id: '9d2693c5-dfa6-43e6-9289-bb3850fc6b02',
                    type: 'user',
                    name: 'amanda_york8',
                    fullyQualifiedName: 'amanda_york8',
                    displayName: 'Amanda York',
                    deleted: false,
                  },
                  {
                    id: '71d6fcb1-1e1b-4b02-b300-1a99ede91d90',
                    type: 'user',
                    name: 'andrew_jennings3',
                    fullyQualifiedName: 'andrew_jennings3',
                    displayName: 'Andrew Jennings',
                    deleted: false,
                  },
                ],
                isJoinable: true,
                deleted: false,
                defaultRoles: [],
                inheritedRoles: [
                  {
                    id: '482dc26e-b00a-4a4b-ad02-4267aaae6483',
                    type: 'role',
                    name: 'DataConsumer',
                    fullyQualifiedName: 'DataConsumer',
                    description:
                      'Users with Data Consumer role use different data assets for their day to day work.',
                    displayName: 'Data Consumer',
                    deleted: false,
                    href: 'http://localhost:8585/api/v1/roles/482dc26e-b00a-4a4b-ad02-4267aaae6483',
                  },
                ],

                entityType: 'team',
              },
              contexts: {
                deleted: ['false'],
              },
            },
            {
              text: 'Applications',
              _index: 'team_search_index',
              _type: '_doc',
              _id: '33eb111f-7d78-4e8d-a306-127cd1c266a3',
              _score: 20,
              _source: {
                id: '33eb111f-7d78-4e8d-a306-127cd1c266a3',
                teamType: 'Group',
                name: 'Applications',
                fullyQualifiedName: 'Applications',
                displayName: 'Applications',
                version: 0.1,
                updatedAt: 1684234020285,
                updatedBy: 'admin',
                parents: [
                  {
                    id: '51430667-9534-4197-8a77-858d8aefefde',
                    type: 'team',
                    name: 'Engineering',
                    fullyQualifiedName: 'Engineering',
                    deleted: false,
                  },
                ],
                users: [
                  {
                    id: '2ddde8d1-24c4-4396-9877-c82c23a38219',
                    type: 'user',
                    name: 'angel_smith0',
                    fullyQualifiedName: 'angel_smith0',
                    displayName: 'Angel Smith',
                    deleted: false,
                  },
                  {
                    id: '3c9e411b-2748-4424-bd4f-d24abb77ce89',
                    type: 'user',
                    name: 'angela_kidd0',
                    fullyQualifiedName: 'angela_kidd0',
                    displayName: 'Angela Kidd',
                    deleted: false,
                  },
                ],
                isJoinable: true,
                deleted: false,
                defaultRoles: [],
                inheritedRoles: [
                  {
                    id: '482dc26e-b00a-4a4b-ad02-4267aaae6483',
                    type: 'role',
                    name: 'DataConsumer',
                    fullyQualifiedName: 'DataConsumer',
                    description:
                      'Users with Data Consumer role use different data assets for their day to day work.',
                    displayName: 'Data Consumer',
                    deleted: false,
                    href: 'http://localhost:8585/api/v1/roles/482dc26e-b00a-4a4b-ad02-4267aaae6483',
                  },
                ],
                suggest: [
                  {
                    input: 'Applications',
                    weight: 5,
                  },
                  {
                    input: 'Applications',
                    weight: 10,
                  },
                ],
                entityType: 'team',
              },
              contexts: {
                deleted: ['false'],
              },
            },
          ],
        },
      ],
    },
  },
  status: 200,
  statusText: 'OK',
  headers: {
    connection: 'close',
    'content-encoding': 'gzip',
    'content-type': 'application/json',
    date: 'Wed, 17 May 2023 04:51:35 GMT',
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'transfer-encoding': 'chunked',
    vary: 'Accept-Encoding',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'x-powered-by': 'Express',
    'x-xss-protection': '1; mode=block',
  },
  config: {
    transitional: {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false,
    },
    transformRequest: [null],
    transformResponse: [null],
    timeout: 0,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    maxBodyLength: -1,
    headers: {
      Accept: 'application/json, text/plain, */*',
      Authorization:
        'Bearer eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJhbGc',
    },
    baseURL: '/api/v1',
    params: {
      q: 'a',
      index: 'team_search_index',
    },
    method: 'get',
    url: '/search/suggest',
  },
  request: {},
};

export const mockRestoreTeam = {
  id: 'dc95179f-f866-408c-a0e2-c1a2b9373cdd',
  teamType: 'Group',
  name: 'TestTeam',
  fullyQualifiedName: 'TestTeam',
  displayName: 'TestTeam',
  description: '',
  version: 0.5,
  updatedAt: 1684299228689,
  updatedBy: 'admin',
  parents: [
    {
      id: 'e262825c-354a-47b5-96ce-aad501c01b00',
      type: 'team',
      name: 'Organization',
      fullyQualifiedName: 'Organization',
      description:
        'Organization under which all the other team hierarchy is created',
      displayName: 'Organization',
      deleted: false,
      href: 'http://localhost:8585/api/v1/teams/e262825c-354a-47b5-96ce-aad501c01b00',
    },
  ],
  children: [],
  users: [],
  isJoinable: true,
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [
      {
        name: 'deleted',
        oldValue: true,
        newValue: false,
      },
    ],
    fieldsDeleted: [],
    previousVersion: 0.4,
  },
  deleted: false,
  defaultRoles: [],
  policies: [],
};
