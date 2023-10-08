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
// eslint-disable-next-line spaced-comment
/// <reference types="cypress" />

import {
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import {
  createAndUpdateDescriptionTask,
  editAssignee,
  verifyTaskDetails,
} from '../../common/TaskUtils';
import { SEARCH_ENTITY_TABLE } from '../../constants/constants';

describe('Task flow should work', () => {
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

  const assignee = 'adam_rodriguez9';
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

    cy.get(`[data-testid="assignee-option-${assignee}"]`)
      .trigger('mouseover')
      .trigger('click');

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
        ? /#(\d+) UpdateTagfortags/
        : /#(\d+) RequestTagfortags/
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
    const value = SEARCH_ENTITY_TABLE.table_1;
    interceptURL('GET', `/api/v1/${value.entity}/name/*`, 'getEntityDetails');

    visitEntityDetailsPage(value.term, value.serviceName, value.entity);

    cy.get('[data-testid="request-description"]').click();

    cy.wait('@getEntityDetails').then((res) => {
      const entity = res.response.body;

      // create description task

      createAndUpdateDescriptionTask({
        ...value,
        term: entity.displayName ?? entity.name,
      });
    });
  });

  it('Task flow for table tags', () => {
    const value = SEARCH_ENTITY_TABLE.table_1;
    interceptURL('GET', `/api/v1/${value.entity}/name/*`, 'getEntityDetails');

    visitEntityDetailsPage(value.term, value.serviceName, value.entity);

    cy.get('[data-testid="request-entity-tags"]').click();

    cy.wait('@getEntityDetails').then((res) => {
      const entity = res.response.body;

      // create tag task
      createTagTask({
        ...value,
        term: entity.displayName ?? entity.name,
        tagCount: entity.tags.length ?? 0,
      });
    });
  });

  it('Cleanup', () => {
    const value = SEARCH_ENTITY_TABLE.table_1;
    interceptURL('GET', `/api/v1/${value.entity}/name/*`, 'getEntityDetails');

    visitEntityDetailsPage(value.term, value.serviceName, value.entity);

    cy.get(
      '[data-testid="entity-right-panel"] [data-testid="tags-container"] [data-testid="edit-button"]'
    ).click();
    cy.get('[data-testid="remove-tags"]').click();
    cy.get('[data-testid="saveAssociatedTag"]').click();
  });
});
