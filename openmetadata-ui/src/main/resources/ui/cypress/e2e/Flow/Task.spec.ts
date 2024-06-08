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

import {
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
} from '../../common/common';
import {
  createEntityTable,
  deleteUserEntity,
  hardDeleteService,
} from '../../common/EntityUtils';
import {
  createAndUpdateDescriptionTask,
  createDescriptionTask,
  editAssignee,
  verifyTaskDetails,
} from '../../common/TaskUtils';
import { visitEntityDetailsPage } from '../../common/Utils/Entity';
import { getToken } from '../../common/Utils/LocalStorage';
import { addOwner } from '../../common/Utils/Owner';
import { uuid } from '../../constants/constants';
import { EntityType } from '../../constants/Entity.interface';
import {
  DATABASE_SERVICE,
  USER_DETAILS,
  USER_NAME,
} from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';

const ENTITY_TABLE = {
  term: DATABASE_SERVICE.entity.name,
  displayName: DATABASE_SERVICE.entity.name,
  entity: EntityType.Table,
  serviceName: DATABASE_SERVICE.service.name,
  schemaName: DATABASE_SERVICE.schema.name,
  entityType: 'Table',
};

const POLICY_DETAILS = {
  name: `cy-data-viewAll-policy-${uuid()}`,
  rules: [
    {
      name: 'viewRuleAllowed',
      resources: ['All'],
      operations: ['ViewAll'],
      effect: 'allow',
    },
    {
      effect: 'deny',
      name: 'editNotAllowed',
      operations: ['EditAll'],
      resources: ['All'],
    },
  ],
};
const ROLE_DETAILS = {
  name: `cy-data-viewAll-role-${uuid()}`,
  policies: [POLICY_DETAILS.name],
};

const TEAM_DETAILS = {
  name: 'viewAllTeam',
  displayName: 'viewAllTeam',
  teamType: 'Group',
};

describe('Task flow should work', { tags: 'DataAssets' }, () => {
  const data = {
    user: { id: '' },
    policy: { id: '' },
    role: { id: '' },
    team: { id: '' },
  };

  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((storageData) => {
      const token = getToken(storageData);

      createEntityTable({
        token,
        ...DATABASE_SERVICE,
        tables: [DATABASE_SERVICE.entity],
      });

      // Create ViewAll Policy
      cy.request({
        method: 'POST',
        url: `/api/v1/policies`,
        headers: { Authorization: `Bearer ${token}` },
        body: POLICY_DETAILS,
      }).then((policyResponse) => {
        data.policy = policyResponse.body;

        // Create ViewAll Role
        cy.request({
          method: 'POST',
          url: `/api/v1/roles`,
          headers: { Authorization: `Bearer ${token}` },
          body: ROLE_DETAILS,
        }).then((roleResponse) => {
          data.role = roleResponse.body;

          // Create a new user
          cy.request({
            method: 'POST',
            url: `/api/v1/users/signup`,
            headers: { Authorization: `Bearer ${token}` },
            body: USER_DETAILS,
          }).then((userResponse) => {
            data.user = userResponse.body;

            // create team
            cy.request({
              method: 'GET',
              url: `/api/v1/teams/name/Organization`,
              headers: { Authorization: `Bearer ${token}` },
            }).then((teamResponse) => {
              cy.request({
                method: 'POST',
                url: `/api/v1/teams`,
                headers: { Authorization: `Bearer ${token}` },
                body: {
                  ...TEAM_DETAILS,
                  parents: [teamResponse.body.id],
                  users: [userResponse.body.id],
                  defaultRoles: [roleResponse.body.id],
                },
              }).then((teamResponse) => {
                data.team = teamResponse.body;
              });
            });
          });
        });
      });
    });
  });

  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((storageData) => {
      const token = getToken(storageData);

      hardDeleteService({
        token,
        serviceFqn: ENTITY_TABLE.serviceName,
        serviceType: SERVICE_CATEGORIES.DATABASE_SERVICES,
      });

      // Clean up for the created data
      deleteUserEntity({ token, id: data.user.id });

      cy.request({
        method: 'DELETE',
        url: `/api/v1/teams/${data.team.id}?hardDelete=true&recursive=true`,
        headers: { Authorization: `Bearer ${token}` },
      });

      cy.request({
        method: 'DELETE',
        url: `/api/v1/policies/${data.policy.id}?hardDelete=true&recursive=true`,
        headers: { Authorization: `Bearer ${token}` },
      });

      cy.request({
        method: 'DELETE',
        url: `/api/v1/roles/${data.role.id}?hardDelete=true&recursive=true`,
        headers: { Authorization: `Bearer ${token}` },
      });
    });
  });

  beforeEach(() => {
    cy.login();
    interceptURL('GET', '/api/v1/permissions/*/name/*', 'entityPermission');
    interceptURL('GET', '/api/v1/feed/count?entityLink=*', 'entityFeed');
    interceptURL('GET', '/api/v1/search/suggest?q=*', 'suggestApi');
    interceptURL('PUT', '/api/v1/feed/tasks/*/resolve', 'taskResolve');
    interceptURL(
      'GET',
      `/api/v1/search/query?q=*%20AND%20disabled:false&index=tag_search_index*`,
      'suggestTag'
    );
  });

  const assignee = 'adam.matthews2';
  const tag = 'Personal';

  const createTagTask = (value) => {
    interceptURL('POST', 'api/v1/feed', 'createTask');

    cy.get('#title').should(
      'have.value',
      value.tagCount > 0
        ? `Update tags for table ${value.term}`
        : `Request tags for table ${value.term}`
    );

    cy.get('[data-testid="select-assignee"] > .ant-select-selector').type(
      assignee
    );
    // select value from dropdown
    verifyResponseStatusCode('@suggestApi', 200);

    cy.get(`[data-testid="${assignee}"]`).trigger('mouseover').trigger('click');

    cy.clickOutside();
    if (value.tagCount > 0) {
      cy.get('[data-testid="tag-selector"]')
        .find('[data-testid="remove-tags"]')
        .each(($btn) => {
          cy.wrap($btn).click();
        });
    }
    cy.get('[data-testid="tag-selector"]').click().type(tag);

    verifyResponseStatusCode('@suggestTag', 200);
    cy.get('[data-testid="tag-PersonalData.Personal"]').click();

    cy.get('[data-testid="tags-label"]').click();

    cy.get('button[type="submit"]').click();
    verifyResponseStatusCode('@createTask', 201);
    toastNotification('Task created successfully.');

    // verify the task details
    verifyTaskDetails(
      value.tagCount > 0
        ? /#(\d+) Request to update tags for/
        : /#(\d+) Request tags for/
    );

    // edit task assignees
    editAssignee();

    // Accept the description suggestion which is created
    cy.get('.ant-btn-compact-first-item').contains('Accept Suggestion').click();

    verifyResponseStatusCode('@taskResolve', 200);

    toastNotification('Task resolved successfully');

    verifyResponseStatusCode('@entityFeed', 200);
  };

  it('Task flow for table description', () => {
    interceptURL(
      'GET',
      `/api/v1/${ENTITY_TABLE.entity}/name/*`,
      'getEntityDetails'
    );

    visitEntityDetailsPage({
      term: ENTITY_TABLE.term,
      serviceName: ENTITY_TABLE.serviceName,
      entity: ENTITY_TABLE.entity,
    });

    cy.get('[data-testid="request-description"]').click();

    cy.wait('@getEntityDetails').then((res) => {
      const entity = res.response.body;

      // create description task

      createAndUpdateDescriptionTask({
        ...ENTITY_TABLE,
        term: entity.displayName ?? entity.name,
      });
    });
  });

  it('Task flow for table tags', () => {
    interceptURL(
      'GET',
      `/api/v1/${ENTITY_TABLE.entity}/name/*`,
      'getEntityDetails'
    );

    visitEntityDetailsPage({
      term: ENTITY_TABLE.term,
      serviceName: ENTITY_TABLE.serviceName,
      entity: ENTITY_TABLE.entity,
    });

    cy.get('[data-testid="request-entity-tags"]').click();

    cy.wait('@getEntityDetails').then((res) => {
      const entity = res.response.body;

      // create tag task
      createTagTask({
        ...ENTITY_TABLE,
        term: entity.displayName ?? entity.name,
        tagCount: entity.tags.length ?? 0,
      });
    });
  });

  it('Assignee field should not be disabled for owned entity tasks', () => {
    interceptURL(
      'GET',
      `/api/v1/${ENTITY_TABLE.entity}/name/*`,
      'getEntityDetails'
    );

    visitEntityDetailsPage({
      term: ENTITY_TABLE.term,
      serviceName: ENTITY_TABLE.serviceName,
      entity: ENTITY_TABLE.entity,
    });

    addOwner('Adam Rodriguez');

    cy.get('[data-testid="request-description"]').click();

    cy.wait('@getEntityDetails').then((res) => {
      const entity = res.response.body;

      createDescriptionTask({
        ...ENTITY_TABLE,
        assignee: USER_NAME,
        term: entity.displayName ?? entity.name,
      });
    });
  });

  it(`should throw error for not having edit permission for viewAll user`, () => {
    // logout for the admin user
    cy.logout();

    // login to viewAll user
    cy.login(USER_DETAILS.email, USER_DETAILS.password);

    interceptURL(
      'GET',
      `/api/v1/${ENTITY_TABLE.entity}/name/*`,
      'getEntityDetails'
    );

    visitEntityDetailsPage({
      term: ENTITY_TABLE.term,
      serviceName: ENTITY_TABLE.serviceName,
      entity: ENTITY_TABLE.entity,
    });

    interceptURL(
      'GET',
      '/api/v1/feed?entityLink=*type=Conversation*',
      'entityFeed'
    );
    interceptURL('GET', '/api/v1/feed?entityLink=*type=Task*', 'taskFeed');
    cy.get('[data-testid="activity_feed"]').click();
    verifyResponseStatusCode('@entityFeed', 200);

    cy.get('[data-menu-id*="tasks"]').click();
    verifyResponseStatusCode('@taskFeed', 200);

    // verify the task details
    verifyTaskDetails(/#(\d+) Request to update description for/, USER_NAME);

    cy.get(`[data-testid="${USER_NAME}"]`).should('be.visible');

    // Accept the description suggestion which is created
    cy.get('.ant-btn-compact-first-item').contains('Accept Suggestion').click();

    verifyResponseStatusCode('@taskResolve', 403);

    toastNotification(
      `Principal: CatalogPrincipal{name='${USER_NAME}'} operation EditDescription denied by role ${ROLE_DETAILS.name}, policy ${POLICY_DETAILS.name}, rule editNotAllowed`
    );
  });
});
