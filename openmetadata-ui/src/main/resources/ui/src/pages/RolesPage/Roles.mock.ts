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
