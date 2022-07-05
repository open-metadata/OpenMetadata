export const mockGetRole = {
  data: [
    {
      id: 'c605dad7-a90b-4672-954b-37e9cae2eae9',
      name: 'DataConsumer',
      displayName: 'Data Consumer',
      description:
        'Users with Data Consumer role use different data assets for their day to day work.',
      version: 0.1,
      updatedAt: 1644389269714,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/roles/c605dad7-a90b-4672-954b-37e9cae2eae9',
      deleted: false,
      policies: [
        {
          id: 'noRule',
          type: 'policy',
          name: 'DataConsumerRoleAccessControlPolicy',
          description:
            'Policy for Data Consumer Role to perform operations on metadata entities',
          displayName: 'Data Consumer Role Access Control Policy',
          href: 'http://localhost:8585/api/v1/policies/8d6b23bd-400b-4537-a1f0-29acb4c6f366',
        },
      ],
      users: [],
    },
    {
      id: 'bff587a4-fcc4-4dd0-aae6-394bef7c3751',
      name: 'DataSteward',
      displayName: 'Data Steward',
      description:
        'Users with Data Steward role are responsible for ensuring correctness of metadata for data assets',
      version: 0.1,
      updatedAt: 1644389269724,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/roles/bff587a4-fcc4-4dd0-aae6-394bef7c3751',
      deleted: false,
      policies: [
        {
          id: 'withRule',
          type: 'policy',
          name: 'DataStewardRoleAccessControlPolicy',
          description:
            'Policy for Data Steward Role to perform operations on metadata entities',
          displayName: 'Data Steward Role Access Control Policy',
          href: 'http://localhost:8585/api/v1/policies/f1c8f8a3-6d76-4352-8686-376fc0c7f86f',
        },
      ],
      users: [
        {
          id: 'dbd39398-f25c-48f4-9bc3-a4687c2d324c',
          type: 'user',
          name: 'aaron_johnson0',
          displayName: 'Aaron Johnson',
          href: 'http://localhost:8585/api/v1/users/dbd39398-f25c-48f4-9bc3-a4687c2d324c',
        },
      ],
    },
  ],
  paging: {
    total: 2,
  },
};

export const mockGetPolicyNoRuleData = {
  id: '8d6b23bd-400b-4537-a1f0-29acb4c6f366',
  name: 'DataConsumerRoleAccessControlPolicy',
  fullyQualifiedName: 'DataConsumerRoleAccessControlPolicy',
  displayName: 'Data Consumer Role Access Control Policy',
  description:
    'Policy for Data Consumer Role to perform operations on metadata entities',
  href: 'http://localhost:8585/api/v1/policies/8d6b23bd-400b-4537-a1f0-29acb4c6f366',
  policyType: 'AccessControl',
  enabled: true,
  version: 0.1,
  updatedAt: 1644389269835,
  updatedBy: 'admin',
  rules: [],
  deleted: false,
};

export const mockGetPolicyWithRuleData = {
  id: 'f1c8f8a3-6d76-4352-8686-376fc0c7f86f',
  name: 'DataStewardRoleAccessControlPolicy',
  fullyQualifiedName: 'DataStewardRoleAccessControlPolicy',
  displayName: 'Data Steward Role Access Control Policy',
  description:
    'Policy for Data Steward Role to perform operations on metadata entities',
  href: 'http://localhost:8585/api/v1/policies/f1c8f8a3-6d76-4352-8686-376fc0c7f86f',
  policyType: 'AccessControl',
  enabled: true,
  version: 0.1,
  updatedAt: 1644389269821,
  updatedBy: 'admin',
  rules: [
    {
      name: 'DataStewardRoleAccessControlPolicy-editDescription',
      allow: true,
      enabled: true,
      priority: 1000,
      operation: 'EditDescription',
      userRoleAttr: 'DataSteward',
    },
    {
      name: 'DataStewardRoleAccessControlPolicy-editLineage',
      allow: true,
      enabled: true,
      priority: 1000,
      operation: 'EditLineage',
      userRoleAttr: 'DataSteward',
    },
    {
      name: 'DataStewardRoleAccessControlPolicy-editOwner',
      allow: true,
      enabled: true,
      priority: 1000,
      operation: 'EditOwner',
      userRoleAttr: 'DataSteward',
    },
    {
      name: 'DataStewardRoleAccessControlPolicy-editTags',
      allow: true,
      enabled: true,
      priority: 1000,
      operation: 'EditTags',
      userRoleAttr: 'DataSteward',
    },
  ],
  deleted: false,
};
