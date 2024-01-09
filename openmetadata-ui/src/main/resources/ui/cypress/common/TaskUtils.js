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
  descriptionBox,
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
} from './common';

const owner = 'admin';
const assignee = 'Adam Matthews';
const secondAssignee = 'Aaron Johnson';

export const verifyTaskDetails = (regexPattern) => {
  cy.get('#task-panel').should('be.visible');
  cy.get('[data-testid="task-title"]')
    .invoke('text')
    .then((textContent) => {
      const matches = textContent.match(regexPattern);

      expect(matches).to.not.be.null;
    });

  cy.get('[data-testid="owner-link"]').should('contain', owner);

  cy.get(`[data-testid="${assignee}"]`).should('be.visible');
};

export const editAssignee = () => {
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

  cy.get(`[data-testid="${assignee}"]`).should('be.visible');
};

export const createDescriptionTask = (value, assigneeDisabled) => {
  interceptURL('POST', 'api/v1/feed', 'createTask');

  cy.get('#title').should(
    'have.value',
    `Update description for table ${value.term}`
  );

  if (assigneeDisabled) {
    cy.get('[data-testid="select-assignee"] > .ant-select-selector').contains(
      value.assignee
    );

    cy.get(
      '[data-testid="select-assignee"] > .ant-select-selector input'
    ).should('be.disabled');
  } else {
    cy.get('[data-testid="select-assignee"] > .ant-select-selector').type(
      value.assignee ?? assignee
    );
    // select value from dropdown
    verifyResponseStatusCode('@suggestApi', 200);

    cy.get(`[data-testid="assignee-option-${value.assignee ?? assignee}"]`)
      .should('be.visible')
      .trigger('mouseover')
      .trigger('click');
    cy.clickOutside();
  }

  cy.get(descriptionBox).scrollIntoView().clear().type('Updated description');

  cy.get('button[type="submit"]').click();
  verifyResponseStatusCode('@createTask', 201);
  toastNotification('Task created successfully.');
};

export const createAndUpdateDescriptionTask = (value) => {
  createDescriptionTask(value);

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
