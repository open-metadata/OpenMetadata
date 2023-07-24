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
  descriptionBox,
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
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
      `/api/v1/search/query?q=*%20AND%20disabled%3Afalse&index=tag_search_index*`,
      'suggestTag'
    );
  });

  const assignee = 'admin';
  const secondAssignee = 'aaron_johnson0';
  const tag = 'Personal';

  const editAssignee = () => {
    interceptURL('PATCH', 'api/v1/feed/*', 'editAssignee');

    cy.get('[data-testid="edit-assignees"]').click();

    cy.get('[data-testid="select-assignee"] > .ant-select-selector').type(
      secondAssignee
    );
    // select value from dropdown
    verifyResponseStatusCode('@suggestApi', 200);

    cy.get(`[data-testid="assignee-option-${secondAssignee}"]`)
      .should('be.visible')
      .trigger('mouseover')
      .trigger('click');

    cy.clickOutside();

    cy.get('[data-testid="inline-save-btn"]').click();

    verifyResponseStatusCode('@editAssignee', 200);

    cy.get(`[data-testid="assignee-${assignee}"]`).should('be.visible');
  };

  const verifyTaskDetails = (regexPattern) => {
    cy.get('#task-panel').should('be.visible');
    cy.get('[data-testid="task-title"]')
      .invoke('text')
      .then((textContent) => {
        const matches = textContent.match(regexPattern);

        expect(matches).to.not.be.null;
      });

    cy.get('[data-testid="owner-link"]').contains(assignee);

    cy.get(`[data-testid="assignee-${assignee}"]`).should('be.visible');
  };

  const createDescriptionTask = (value) => {
    interceptURL('POST', 'api/v1/feed', 'createTask');

    cy.get('#title').should(
      'have.value',
      `Update description for table ${value.term}`
    );

    cy.get('[data-testid="select-assignee"] > .ant-select-selector').type(
      assignee
    );
    // select value from dropdown
    verifyResponseStatusCode('@suggestApi', 200);

    cy.get(`[data-testid="assignee-option-${assignee}"]`)
      .should('be.visible')
      .trigger('mouseover')
      .trigger('click');

    cy.clickOutside();

    cy.get(descriptionBox).scrollIntoView().clear().type('Updated description');

    cy.get('button[type="submit"]').click();
    verifyResponseStatusCode('@createTask', 201);
    toastNotification('Task created successfully.');

    // verify the task details
    verifyTaskDetails(/#(\d+) UpdateDescriptionfordescription/);

    // edit task assignees
    editAssignee();

    // Accept the description suggestion which is created
    cy.get('.ant-btn-compact-first-item').contains('Accept Suggestion').click();

    verifyResponseStatusCode('@taskResolve', 200);

    toastNotification('Task resolved successfully');

    verifyResponseStatusCode('@entityFeed', 200);
  };

  const createTagTask = (value) => {
    interceptURL('POST', 'api/v1/feed', 'createTask');

    cy.get('#title').should(
      'have.value',
      `Request tags for table ${value.term}`
    );

    cy.get('[data-testid="select-assignee"] > .ant-select-selector').type(
      assignee
    );
    // select value from dropdown
    verifyResponseStatusCode('@suggestApi', 200);

    cy.get(`[data-testid="assignee-option-${assignee}"]`)
      .should('be.visible')
      .trigger('mouseover')
      .trigger('click');

    cy.clickOutside();

    cy.get('[data-testid="tag-selector"]').click().type(tag);

    verifyResponseStatusCode('@suggestTag', 200);
    cy.get('[data-testid="tag-PersonalData.Personal"]').click();

    cy.get('[data-testid="tags-label"]').click();

    cy.get('button[type="submit"]').click();
    verifyResponseStatusCode('@createTask', 201);
    toastNotification('Task created successfully.');

    // verify the task details
    verifyTaskDetails(/#(\d+) RequestTagfortags/);

    // edit task assignees
    editAssignee();

    // Accept the description suggestion which is created
    cy.get('.ant-btn-compact-first-item').contains('Accept Suggestion').click();

    verifyResponseStatusCode('@taskResolve', 200);

    toastNotification('Task resolved successfully');

    verifyResponseStatusCode('@entityFeed', 200);

    cy.get('.toastui-editor-contents > p').contains(
      'Resolved the Task with Tag(s) - PersonalData.Personal'
    );
  };

  it('Task flow for table description', () => {
    const value = SEARCH_ENTITY_TABLE.table_1;
    interceptURL('GET', `/api/v1/${value.entity}/name/*`, 'getEntityDetails');

    visitEntityDetailsPage(value.term, value.serviceName, value.entity);

    cy.get('[data-testid="request-description"]').click();

    verifyResponseStatusCode('@getEntityDetails', 200);

    // create description task
    createDescriptionTask(value);
  });

  it('Task flow for table tags', () => {
    const value = SEARCH_ENTITY_TABLE.table_1;
    interceptURL('GET', `/api/v1/${value.entity}/name/*`, 'getEntityDetails');

    visitEntityDetailsPage(value.term, value.serviceName, value.entity);

    cy.get('[data-testid="request-entity-tags"]').click();

    verifyResponseStatusCode('@getEntityDetails', 200);

    // create tag task
    createTagTask(value);
  });
});
