/*
 *  Copyright 2024 Collate.
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
  interceptURL,
  login,
  uuid,
  verifyResponseStatusCode,
} from '../../common/common';
import UsersTestClass from '../../common/Entities/UserClass';
import { hardDeleteService } from '../../common/EntityUtils';
import {
  createEntityTableViaREST,
  visitEntityDetailsPage,
} from '../../common/Utils/Entity';
import { EntityType } from '../../constants/Entity.interface';
import { DATABASE_SERVICE, USER_DETAILS } from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';

type RoleType = {
  name: string;
  policies: string[];
  id?: string;
};
type PolicyType = {
  name: string;
  rules: {
    name: string;
    resources: string[];
    operations: string[];
    effect: string;
  }[];
  id?: string;
};
type OrganizationTeamType = {
  id: string;
  policies: {
    id: string;
    type: string;
  }[];
  defaultRoles: {
    id: string;
    type: string;
  }[];
};
const entity = new UsersTestClass();
const policy: PolicyType = {
  name: `cy-permission-policy-${uuid()}`,
  rules: [
    {
      name: `cy-permission-rule-${uuid()}`,
      resources: ['All'],
      operations: ['ViewBasic'],
      effect: 'allow',
    },
  ],
};

const role: RoleType = {
  name: `cy-permission-role-${uuid()}`,
  policies: [policy.name],
};
const tableFqn = `${DATABASE_SERVICE.entity.databaseSchema}.${DATABASE_SERVICE.entity.name}`;
const testSuite = {
  name: `${tableFqn}.testSuite`,
  executableEntityReference: tableFqn,
};
const testCase = {
  name: `user_tokens_table_column_name_to_exist_${uuid()}`,
  entityLink: `<#E::table::${testSuite.executableEntityReference}>`,
  parameterValues: [{ name: 'columnName', value: 'id' }],
  testDefinition: 'tableColumnNameToExist',
  description: 'test case description',
  testSuite: testSuite.name,
};

let organizationTeam = {} as OrganizationTeamType;
let userId = '';

const viewPermissions = [
  {
    title: 'ViewBasic, ViewSampleData & ViewQueries permission',
    data: {
      patch: [
        { op: 'add', path: '/rules/0/operations/1', value: 'ViewSampleData' },
        { op: 'add', path: '/rules/0/operations/2', value: 'ViewQueries' },
      ],
      permission: { viewSampleData: true, viewQueries: true },
    },
  },
  {
    title: 'ViewBasic, ViewSampleData, ViewQueries & ViewTests permission',
    data: {
      patch: [{ op: 'add', path: '/rules/0/operations/3', value: 'ViewTests' }],
      permission: {
        viewSampleData: true,
        viewQueries: true,
        viewTests: true,
      },
    },
  },
  {
    title: 'EditDisplayName permission',
    data: {
      patch: [
        { op: 'add', path: '/rules/0/operations/4', value: 'EditDisplayName' },
      ],
      permission: {
        viewSampleData: true,
        viewQueries: true,
        viewTests: true,
        editDisplayName: true,
      },
    },
  },
];

const createViewBasicRoleViaREST = ({ token }) => {
  cy.request({
    method: 'POST',
    url: `/api/v1/policies`,
    headers: { Authorization: `Bearer ${token}` },
    body: policy,
  }).then((response) => {
    policy.id = response.body.id;
    cy.request({
      method: 'POST',
      url: `/api/v1/roles`,
      headers: { Authorization: `Bearer ${token}` },
      body: role,
    }).then((roleResponse) => {
      role.id = roleResponse.body.id;
      cy.request({
        method: 'GET',
        url: `/api/v1/teams/name/Organization?fields=defaultRoles,policies`,
        headers: { Authorization: `Bearer ${token}` },
      }).then((orgResponse) => {
        organizationTeam = orgResponse.body;
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${orgResponse.body.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json-patch+json',
          },
          body: [
            {
              op: 'replace',
              path: '/policies/0',
              value: {
                id: response.body.id,
                type: 'policy',
              },
            },
            {
              op: 'replace',
              path: '/defaultRoles/0',
              value: {
                id: roleResponse.body.id,
                type: 'role',
              },
            },
          ],
        });
      });
    });
  });
};

const preRequisite = () => {
  cy.login();
  cy.getAllLocalStorage().then((data) => {
    const token = Object.values(data)[0].oidcIdToken;
    createViewBasicRoleViaREST({
      token,
    });
    cy.request({
      method: 'POST',
      url: `/api/v1/users/signup`,
      headers: { Authorization: `Bearer ${token}` },
      body: USER_DETAILS,
    }).then((response) => {
      userId = response.body.id;
    });
    createEntityTableViaREST({
      token,
      ...DATABASE_SERVICE,
      tables: [],
    });
    cy.request({
      method: 'POST',
      url: `/api/v1/tables`,
      headers: { Authorization: `Bearer ${token}` },
      body: DATABASE_SERVICE.entity,
    }).then((response) => {
      cy.request({
        method: 'POST',
        url: `/api/v1/queries`,
        headers: { Authorization: `Bearer ${token}` },
        body: {
          query: `select * from dim_address_${uuid()}`,
          queryUsedIn: [{ id: response.body.id, type: 'table' }],
          queryDate: Date.now(),
          service: 'sample_data',
        },
      });
      cy.request({
        method: 'POST',
        url: `/api/v1/dataQuality/testSuites/executable`,
        headers: { Authorization: `Bearer ${token}` },
        body: testSuite,
      }).then(() => {
        cy.request({
          method: 'POST',
          url: `/api/v1/dataQuality/testCases`,
          headers: { Authorization: `Bearer ${token}` },
          body: testCase,
        });
      });
    });
  });
  cy.logout();
};

const cleanUp = () => {
  cy.login();
  cy.getAllLocalStorage().then((data) => {
    const token = Object.values(data)[0].oidcIdToken;
    hardDeleteService({
      token,
      serviceFqn: DATABASE_SERVICE.service.name,
      serviceType: SERVICE_CATEGORIES.DATABASE_SERVICES,
    });
    cy.request({
      method: 'DELETE',
      url: `/api/v1/roles/${role.id}?hardDelete=true&recursive=false`,
      headers: { Authorization: `Bearer ${token}` },
    });
    cy.request({
      method: 'DELETE',
      url: `/api/v1/policies/${policy.id}?hardDelete=true&recursive=false`,
      headers: { Authorization: `Bearer ${token}` },
    });

    cy.request({
      method: 'PATCH',
      url: `/api/v1/teams/${organizationTeam.id}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json-patch+json',
      },
      body: [
        {
          op: 'add',
          path: '/policies/0',
          value: {
            id: organizationTeam.policies[0].id,
            type: 'policy',
          },
        },

        {
          op: 'add',
          path: '/defaultRoles/0',
          value: {
            id: organizationTeam.defaultRoles[0].id,
            type: 'role',
          },
        },
      ],
    });
    // Delete created user
    cy.request({
      method: 'DELETE',
      url: `/api/v1/users/${userId}?hardDelete=true&recursive=false`,
      headers: { Authorization: `Bearer ${token}` },
    });
  });
};

const checkPermission = (permission?: {
  viewSampleData?: boolean;
  viewQueries?: boolean;
  viewTests?: boolean;
  editDisplayName?: boolean;
}) => {
  login(USER_DETAILS.email, USER_DETAILS.password);
  visitEntityDetailsPage({
    term: DATABASE_SERVICE.entity.name,
    serviceName: DATABASE_SERVICE.service.name,
    entity: EntityType.Table,
  });
  entity.viewPermissions(permission);
  cy.logout();
};
const updatePolicy = (
  patch: { op: string; path: string; value: unknown }[]
) => {
  cy.login();
  cy.getAllLocalStorage().then((data) => {
    const token = Object.values(data)[0].oidcIdToken;
    cy.request({
      method: 'PATCH',
      url: `/api/v1/policies/${policy.id}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json-patch+json',
      },
      body: patch,
    });
  });
  cy.logout();
  cy.reload();
};

describe('Permissions', { tags: 'Settings' }, () => {
  before(preRequisite);
  after(cleanUp);

  it('ViewBasic permission', () => {
    checkPermission();
  });

  viewPermissions.forEach((permissionData) => {
    it(`check ${permissionData.title}`, () => {
      updatePolicy(permissionData.data.patch);
      checkPermission(permissionData.data.permission);
    });
  });

  it('EditQuery permission', () => {
    updatePolicy([
      {
        op: 'add',
        path: '/rules/1',
        value: {
          name: `cy-edit-query-rule-${uuid()}`,
          resources: ['query'],
          operations: ['ViewAll', 'EditAll'],
          effect: 'allow',
        },
      },
      { op: 'add', path: '/rules/0/operations/5', value: 'EditQueries' },
    ]);

    login(USER_DETAILS.email, USER_DETAILS.password);
    visitEntityDetailsPage({
      term: DATABASE_SERVICE.entity.name,
      serviceName: DATABASE_SERVICE.service.name,
      entity: EntityType.Table,
    });
    interceptURL('GET', '/api/v1/queries?*', 'getQueries');
    cy.get('[data-testid="table_queries"]').click();
    verifyResponseStatusCode('@getQueries', 200);
    cy.get('[data-testid="query-btn"]').click();
    cy.get('[data-menu-id*="edit-query"]').click();
    interceptURL('PATCH', '/api/v1/queries/*', 'updateQuery');
    cy.get('.CodeMirror-line').click().type('updated');
    cy.get('[data-testid="save-query-btn"]').click();
    verifyResponseStatusCode('@updateQuery', 200);
    cy.logout();
  });

  it('EditTest permission', () => {
    updatePolicy([
      { op: 'add', path: '/rules/1/operations/6', value: 'EditTests' },
      {
        op: 'add',
        path: '/rules/2',
        value: {
          name: `cy-edit-test-case-rule-${uuid()}`,
          resources: ['testCase'],
          operations: ['ViewAll', 'EditAll'],
          effect: 'allow',
        },
      },
    ]);

    login(USER_DETAILS.email, USER_DETAILS.password);
    visitEntityDetailsPage({
      term: DATABASE_SERVICE.entity.name,
      serviceName: DATABASE_SERVICE.service.name,
      entity: EntityType.Table,
    });
    interceptURL('GET', '/api/v1/dataQuality/testCases?fields=*', 'testCase');
    cy.get('[data-testid="profiler"]').click();
    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Data Quality')
      .click();
    verifyResponseStatusCode('@testCase', 200);
    cy.get(`[data-testid="edit-${testCase.name}"]`).click();
    cy.get('#tableTestForm_params_columnName')
      .scrollIntoView()
      .clear()
      .type('test');
    interceptURL('PATCH', '/api/v1/dataQuality/testCases/*', 'updateTest');
    cy.get('.ant-modal-footer').contains('Submit').click();
    verifyResponseStatusCode('@updateTest', 200);
  });
});
