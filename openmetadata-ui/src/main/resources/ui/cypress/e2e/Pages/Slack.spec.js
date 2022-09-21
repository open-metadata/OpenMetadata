/*
 *  Copyright 2021 Collate
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
import { descriptionBox, interceptURL, uuid, verifyResponseStatusCode } from '../../common/common';

const slackName = `Slack-ct-test-${uuid()}`;
const updatedDescription = 'This is updated slack description';
const endpointURL = 'http://localhost:8585';

describe('Slack Page', () => {
  beforeEach(() => {
    cy.goToHomePage();

    cy.get('[data-testid="appbar-item-settings"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('.ant-menu-title-content')
      .contains('Slack')
      .scrollIntoView()
      .should('be.visible')
      .click();
  });

  it('Add slack', () => {
    interceptURL('GET', '/api/v1/settings/bootstrappedFilters', 'addSlack');
    cy.get('[data-testid="add-webhook-button"]')
      .should('exist')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@addSlack', 200);
    cy.get('[data-testid="name"]').should('exist').type(slackName);
    cy.get(descriptionBox).should('exist').type('This is slack description');
    cy.get('[data-testid="endpoint-url"]')
      .should('exist')
      .type('http://localhost:8585/add-webhook/slack');

    interceptURL('POST', 'api/v1/webhook', 'createWebhook');
    cy.get('[data-testid="save-webhook"]')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@createWebhook', 201);
    cy.get('[data-testid="webhook-link"]')
      .should('be.visible')
      .should('exist')
      .should('contain', slackName);
  });

  it('Edit Slack description', () => {
    interceptURL('GET', `/api/v1/webhook/name/${slackName}`, 'editSlack');
    cy.get(`[data-testid="edit-action-${slackName}"]`)
      .should('exist')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@editSlack', 200);
    cy.get(descriptionBox).clear().type(updatedDescription);
    cy.get('[data-testid="endpoint-url"]').clear().type(endpointURL);
    interceptURL('PUT', '/api/v1/webhook', 'updateDescription');
    cy.get('[data-testid="save-webhook"]')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@updateDescription', 200);
    cy.get('[data-testid="viewer-container"]').should(
      'contain',
      updatedDescription
    );
  });

  it('Delete Slack', () => {
    cy.get(`[data-testid="delete-action-${slackName}"]`)
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .click();

    interceptURL('DELETE', '/api/v1/webhook/*', 'deleteSlack');
    cy.get('[data-testid="save-button"]')
      .should('exist')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@deleteSlack', 200);
    cy.get('table').should('not.contain', slackName);
  });
});
