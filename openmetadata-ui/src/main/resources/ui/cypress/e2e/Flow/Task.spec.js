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
  });

  const assignee = 'admin';
  const secondAssignee = 'aaron_johnson0';

  const editAssignee = () => {
    interceptURL('PATCH', 'api/v1/feed/*', 'editAssignee');

    cy.get('[data-testid="edit-assignees"]').should('be.visible').click();

    cy.get('[data-testid="select-assignee"] > .ant-select-selector')
      .should('be.visible')
      .type(secondAssignee);
    // select value from dropdown
    verifyResponseStatusCode('@suggestApi', 200);

    cy.get('[data-testid="assignee-option"]')
      .eq(0)
      .should('be.visible')
      .trigger('mouseover')
      .trigger('click');

    cy.clickOutside();

    cy.get('[data-testid="inline-save-btn"]').should('be.visible').click();

    verifyResponseStatusCode('@editAssignee', 200);

    cy.get(`[data-testid="assignee-${assignee}"]`).should('be.visible');
  };

  const verifyTaskDetails = () => {
    cy.get('#task-panel').should('be.visible');
    cy.get('[data-testid="task-title"]')
      .invoke('text')
      .then((textContent) => {
        const regexPattern = /#(\d+) UpdateDescriptionfordescription/;
        const matches = textContent.match(regexPattern);

        expect(matches).to.not.be.null;
      });

    cy.get('[data-testid="owner-link"]').should('be.visible').contains('admin');

    cy.get(`[data-testid="assignee-${assignee}"]`).should('be.visible');
  };

  const createDescriptionTask = (value) => {
    // create description task
    interceptURL('POST', 'api/v1/feed', 'createTask');

    cy.get('#title')
      .should('be.visible')
      .should('have.value', `Update description for table ${value.term}`);

    cy.get('[data-testid="select-assignee"] > .ant-select-selector')
      .should('be.visible')
      .type(assignee);
    // select value from dropdown
    verifyResponseStatusCode('@suggestApi', 200);

    cy.get('[data-testid="assignee-option"]')
      .eq(0)
      .should('be.visible')
      .trigger('mouseover')
      .trigger('click');

    cy.clickOutside();

    cy.get(descriptionBox)
      .scrollIntoView()
      .should('be.visible')
      .clear()
      .type('Updated description');

    cy.get('button[type="submit"]').should('be.visible').click();
    verifyResponseStatusCode('@createTask', 201);
    toastNotification('Task created successfully.');

    // verify the task details
    verifyTaskDetails();

    // edit task assignees
    editAssignee();

    // Accept the description suggestion which is created
    cy.get('.ant-btn-compact-first-item').contains('Accept Suggestion').click();

    verifyResponseStatusCode('@taskResolve', 200);

    toastNotification('Task resolved successfully');

    verifyResponseStatusCode('@entityFeed', 200);
  };

  const createTask = (value) => {
    interceptURL('GET', '/api/v1/permissions/*/name/*', 'entityPermission');
    interceptURL('GET', '/api/v1/feed/count?entityLink=*', 'entityFeed');
    interceptURL('GET', `/api/v1/${value.entity}/name/*`, 'getEntityDetails');
    interceptURL('GET', '/api/v1/search/suggest?q=*', 'suggestApi');
    interceptURL('PUT', '/api/v1/feed/tasks/*/resolve', 'taskResolve');

    visitEntityDetailsPage(value.term, value.serviceName, value.entity);
    cy.get('[data-testid="request-description"]').should('be.visible').click();
    verifyResponseStatusCode('@getEntityDetails', 200);

    createDescriptionTask(value);
  };

  it('Task flow for table description', () => {
    createTask(SEARCH_ENTITY_TABLE.table_1);
  });
});
