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
/* eslint-disable max-len */

export const ROLES_LIST = [
  {
    id: '789005ee-ff13-4b58-9ec1-7c4172b40aac',
    name: 'DataConsumer',
    fullyQualifiedName: 'DataConsumer',
    displayName: 'Data Consumer',
    description:
      'Users with Data Consumer role use different data assets for their day to day work.',
    version: 0.1,
    updatedAt: 1661318305276,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/roles/789005ee-ff13-4b58-9ec1-7c4172b40aac',
    deleted: false,
    policies: [
      {
        id: '1ff8f95a-0fd7-4429-ba56-ea95ee582459',
        type: 'policy',
        name: 'DataConsumerPolicy',
        fullyQualifiedName: 'DataConsumerPolicy',
        description:
          'Policy for Data Consumer to perform operations on metadata entities',
        displayName: 'Data Consumer Policy',
        deleted: false,
        href: 'http://localhost:8585/api/v1/policies/1ff8f95a-0fd7-4429-ba56-ea95ee582459',
      },
    ],
    users: [],
    teams: [
      {
        id: 'c37cbb3b-1ee5-4f19-9af7-0d98d905eb6d',
        type: 'team',
        name: 'Organization',
        fullyQualifiedName: 'Organization',
        description:
          'Organization under which all the other team hierarchy is created',
        displayName: 'Organization',
        deleted: false,
        href: 'http://localhost:8585/api/v1/teams/c37cbb3b-1ee5-4f19-9af7-0d98d905eb6d',
      },
    ],
  },
  {
    id: '91379f25-d737-4b6e-833c-e87ace7bf84d',
    name: 'DataSteward',
    fullyQualifiedName: 'DataSteward',
    displayName: 'Data Steward',
    description:
      'Users with Data Steward role are responsible for ensuring correctness of metadata for data assets, thereby facilitating data governance principles within the organization.<br/>Data Stewards can update metadata for any entity.',
    version: 0.1,
    updatedAt: 1661318305346,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/roles/91379f25-d737-4b6e-833c-e87ace7bf84d',
    deleted: false,
    policies: [
      {
        id: 'b0327d82-521f-4381-9f17-98c11408446f',
        type: 'policy',
        name: 'DataStewardPolicy',
        fullyQualifiedName: 'DataStewardPolicy',
        description:
          'Policy for Data Steward Role to perform operations on metadata entities',
        displayName: 'Data Steward Policy',
        deleted: false,
        href: 'http://localhost:8585/api/v1/policies/b0327d82-521f-4381-9f17-98c11408446f',
      },
    ],
    users: [],
    teams: [],
  },
  {
    id: 'b7e3ee90-da58-4dd3-aca2-f7e1dca094b3',
    name: 'TestRole',
    fullyQualifiedName: 'TestRole',
    description: 'Description',
    version: 0.1,
    updatedAt: 1661419374263,
    updatedBy: 'anonymous',
    href: 'http://localhost:8585/api/v1/roles/b7e3ee90-da58-4dd3-aca2-f7e1dca094b3',
    deleted: false,
    policies: [
      {
        id: '1ff8f95a-0fd7-4429-ba56-ea95ee582459',
        type: 'policy',
        name: 'DataConsumerPolicy',
        fullyQualifiedName: 'DataConsumerPolicy',
        description:
          'Policy for Data Consumer to perform operations on metadata entities',
        displayName: 'Data Consumer Policy',
        deleted: false,
        href: 'http://localhost:8585/api/v1/policies/1ff8f95a-0fd7-4429-ba56-ea95ee582459',
      },
      {
        id: 'b0327d82-521f-4381-9f17-98c11408446f',
        type: 'policy',
        name: 'DataStewardPolicy',
        fullyQualifiedName: 'DataStewardPolicy',
        description:
          'Policy for Data Steward Role to perform operations on metadata entities',
        displayName: 'Data Steward Policy',
        deleted: false,
        href: 'http://localhost:8585/api/v1/policies/b0327d82-521f-4381-9f17-98c11408446f',
      },
      {
        id: '2a34e7ab-0edd-428f-8d91-e70033c3c204',
        type: 'policy',
        name: 'OrganizationPolicy',
        fullyQualifiedName: 'OrganizationPolicy',
        description: 'Policy for all the users of an organization.',
        displayName: 'Organization Policy',
        deleted: false,
        href: 'http://localhost:8585/api/v1/policies/2a34e7ab-0edd-428f-8d91-e70033c3c204',
      },
      {
        id: '9216e93f-72c4-4158-a75f-406d1c65d78f',
        type: 'policy',
        name: 'TeamOnlyPolicy',
        fullyQualifiedName: 'TeamOnlyPolicy',
        description:
          'Policy when attached to a team allows only users with in the team hierarchy to access the resources.',
        displayName: 'Team only access Policy',
        deleted: false,
        href: 'http://localhost:8585/api/v1/policies/9216e93f-72c4-4158-a75f-406d1c65d78f',
      },
    ],
    users: [],
    teams: [],
  },
];

export const ROLES_LIST_WITH_PAGING = {
  data: ROLES_LIST,
  paging: {
    total: 3,
  },
};

export const ROLE_DATA = {
  id: '789005ee-ff13-4b58-9ec1-7c4172b40aac',
  name: 'DataConsumer',
  fullyQualifiedName: 'DataConsumer',
  displayName: 'Data Consumer',
  description:
    'Users with Data Consumer role use different data assets for their day to day work.',
  version: 0.1,
  updatedAt: 1661318305276,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/roles/789005ee-ff13-4b58-9ec1-7c4172b40aac',
  deleted: false,
  policies: [
    {
      id: '1ff8f95a-0fd7-4429-ba56-ea95ee582459',
      type: 'policy',
      name: 'DataConsumerPolicy',
      fullyQualifiedName: 'DataConsumerPolicy',
      description:
        'Policy for Data Consumer to perform operations on metadata entities',
      displayName: 'Data Consumer Policy',
      deleted: false,
      href: 'http://localhost:8585/api/v1/policies/1ff8f95a-0fd7-4429-ba56-ea95ee582459',
    },
  ],
  users: [],
  teams: [
    {
      id: 'c37cbb3b-1ee5-4f19-9af7-0d98d905eb6d',
      type: 'team',
      name: 'Organization',
      fullyQualifiedName: 'Organization',
      description:
        'Organization under which all the other team hierarchy is created',
      displayName: 'Organization',
      deleted: false,
      href: 'http://localhost:8585/api/v1/teams/c37cbb3b-1ee5-4f19-9af7-0d98d905eb6d',
    },
  ],
};

export const POLICY_LIST_WITH_PAGING = {
  data: [
    {
      id: '1ff8f95a-0fd7-4429-ba56-ea95ee582459',
      name: 'DataConsumerPolicy',
      fullyQualifiedName: 'DataConsumerPolicy',
      displayName: 'Data Consumer Policy',
      description:
        'Policy for Data Consumer to perform operations on metadata entities',
      href: 'http://localhost:8585/api/v1/policies/1ff8f95a-0fd7-4429-ba56-ea95ee582459',
      enabled: true,
      version: 0.1,
      updatedAt: 1661318304992,
      updatedBy: 'admin',
      rules: [
        {
          name: 'DataConsumerPolicy-EditRule',
          effect: 'allow',
          resources: ['all'],
          operations: ['ViewAll', 'EditDescription', 'EditTags'],
          description:
            'Allow some of the edit operations on a resource for everyone.',
        },
      ],
      deleted: false,
    },
    {
      id: 'b0327d82-521f-4381-9f17-98c11408446f',
      name: 'DataStewardPolicy',
      fullyQualifiedName: 'DataStewardPolicy',
      displayName: 'Data Steward Policy',
      description:
        'Policy for Data Steward Role to perform operations on metadata entities',
      href: 'http://localhost:8585/api/v1/policies/b0327d82-521f-4381-9f17-98c11408446f',
      enabled: true,
      version: 0.1,
      updatedAt: 1661318304972,
      updatedBy: 'admin',
      rules: [
        {
          name: 'DataStewardPolicy-EditRule',
          effect: 'allow',
          resources: ['all'],
          operations: [
            'ViewAll',
            'EditDescription',
            'EditDisplayName',
            'EditLineage',
            'EditOwner',
            'EditTags',
          ],
        },
      ],
      deleted: false,
    },
    {
      id: '2a34e7ab-0edd-428f-8d91-e70033c3c204',
      name: 'OrganizationPolicy',
      fullyQualifiedName: 'OrganizationPolicy',
      displayName: 'Organization Policy',
      description: 'Policy for all the users of an organization.',
      href: 'http://localhost:8585/api/v1/policies/2a34e7ab-0edd-428f-8d91-e70033c3c204',
      enabled: true,
      version: 0.1,
      updatedAt: 1661318304689,
      updatedBy: 'admin',
      rules: [
        {
          name: 'OrganizationPolicy-Owner-Rule',
          effect: 'allow',
          condition: 'isOwner()',
          resources: ['all'],
          operations: ['All'],
          description: 'Allow all the operations on an entity for the owner.',
        },
        {
          name: 'OrganizationPolicy-NoOwner-Rule',
          effect: 'allow',
          condition: 'noOwner()',
          resources: ['all'],
          operations: ['EditOwner'],
          description:
            'Allow any one to set the owner of an entity that has no owner set.',
        },
      ],
      deleted: false,
    },
    {
      id: '9216e93f-72c4-4158-a75f-406d1c65d78f',
      name: 'TeamOnlyPolicy',
      fullyQualifiedName: 'TeamOnlyPolicy',
      displayName: 'Team only access Policy',
      description:
        'Policy when attached to a team allows only users with in the team hierarchy to access the resources.',
      href: 'http://localhost:8585/api/v1/policies/9216e93f-72c4-4158-a75f-406d1c65d78f',
      enabled: true,
      version: 0.8,
      updatedAt: 1661439183482,
      updatedBy: 'anonymous',
      changeDescription: {
        fieldsAdded: [],
        fieldsUpdated: [],
        fieldsDeleted: [
          {
            name: 'rules',
            oldValue:
              '[{"name":"OrganizationPolicy-Owner-Rule2","description":"description","effect":"allow","operations":["EditAll"],"resources":["bot"],"condition":"!isOwner"}]',
          },
        ],
        previousVersion: 0.7,
      },
      rules: [
        {
          name: 'TeamOnlyPolicy-Rule',
          effect: 'deny',
          condition:
            "matchAllTags('PersonalData.Personal', 'Tier.Tier1', 'Business Glossary.Clothing') || isOwner()",
          resources: [
            'chart',
            'dashboard',
            'dashboardService',
            'database',
            'databaseSchema',
            'databaseService',
            'events',
            'feed',
            'glossary',
            'glossaryTerm',
            'ingestionPipeline',
            'location',
            'messagingService',
            'metrics',
            'mlmodel',
            'mlmodelService',
            'pipeline',
            'pipelineService',
            'policy',
            'report',
            'role',
            'storageService',
            'table',
            'tag',
            'classification',
            'team',
            'testCase',
            'testDefinition',
            'testSuite',
            'topic',
            'type',
            'user',
            'webhook',
          ],
          operations: [
            'Delete',
            'ViewAll',
            'ViewUsage',
            'ViewTests',
            'ViewQueries',
            'ViewDataProfile',
            'ViewSampleData',
            'EditAll',
            'EditDescription',
            'EditDisplayName',
            'EditTags',
            'EditOwner',
            'EditTier',
            'EditCustomFields',
            'EditLineage',
            'EditReviewers',
            'EditTests',
            'EditQueries',
            'EditDataProfile',
            'EditSampleData',
            'EditUsers',
          ],
          description:
            'Deny all the operations on all the resources for all outside the team hierarchy..',
        },
        {
          name: 'TestRule-With-Condition',
          effect: 'allow',
          condition: '!isOwner()',
          resources: ['all'],
          operations: ['All'],
          description: 'TestRule-With-Condition',
        },
        {
          name: 'TestRule-With-Condition1',
          effect: 'allow',
          condition: 'isOwner()',
          resources: ['all'],
          operations: ['All'],
          description: 'Description.',
        },
      ],
      deleted: false,
    },
  ],
  paging: {
    total: 4,
  },
};
