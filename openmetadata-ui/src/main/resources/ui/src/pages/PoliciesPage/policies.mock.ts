/* eslint-disable max-len */

export const POLICY_DATA = {
  id: '4b762714-8228-4a65-977c-86330c53ff5e',
  name: 'DataConsumerPolicy',
  fullyQualifiedName: 'DataConsumerPolicy',
  displayName: 'Data Consumer Policy',
  description:
    'Policy for Data Consumer to perform operations on metadata entities',
  href: 'http://localhost:8585/api/v1/policies/4b762714-8228-4a65-977c-86330c53ff5e',
  policyType: 'AccessControl',
  enabled: true,
  version: 0.2,
  updatedAt: 1661494134803,
  updatedBy: 'anonymous',
  changeDescription: {
    fieldsAdded: [
      {
        name: 'rules',
        newValue:
          '[{"name":"DataConsumerPolicy-EditRule","description":"Allow some of the edit operations on a resource for everyone.","effect":"allow","operations":["ViewAll","EditDescription","EditTags"],"resources":["all"],"condition":"isOwner()"}]',
      },
    ],
    fieldsUpdated: [],
    fieldsDeleted: [
      {
        name: 'rules',
        oldValue:
          '[{"name":"DataConsumerPolicy-EditRule","description":"Allow some of the edit operations on a resource for everyone.","effect":"allow","operations":["ViewAll","EditDescription","EditTags"],"resources":["all"]}]',
      },
    ],
    previousVersion: 0.1,
  },
  rules: [
    {
      name: 'DataConsumerPolicy-EditRule',
      effect: 'allow',
      condition: 'isOwner()',
      resources: ['all'],
      operations: ['ViewAll', 'EditDescription', 'EditTags'],
      description:
        'Allow some of the edit operations on a resource for everyone.',
    },
  ],
  teams: [],
  roles: [
    {
      id: 'a65a6133-501b-4d73-82b7-aa5b5182c67d',
      type: 'role',
      name: 'DataConsumer',
      fullyQualifiedName: 'DataConsumer',
      description:
        'Users with Data Consumer role use different data assets for their day to day work.',
      displayName: 'Data Consumer',
      deleted: false,
      href: 'http://localhost:8585/api/v1/roles/a65a6133-501b-4d73-82b7-aa5b5182c67d',
    },
  ],
  deleted: false,
};
