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
import { DELETE_TERM } from '../../constants/constants';

const botName = `Bot-ct-test-${uuid()}`;
const botEmail = `${botName}@mail.com`;
const description = 'This is bot description';
const updatedDescription = 'This is updated bot description';
const updatedBotName = `updated-${botName}`;

const getCreatedBot = () => {
  interceptURL(
    'GET',
    `/api/v1/permissions/bot/name/${botName}`,
    'getCreatedBot'
  );
  //Click on created Bot name
  cy.get('.ant-table-cell').contains(botName).should('be.visible').click();
  verifyResponseStatusCode('@getCreatedBot', 200);
};

describe('Bots Page should work properly', () => {
  beforeEach(() => {
    cy.goToHomePage();

    cy.get('[data-testid="appbar-item-settings"]')
      .should('exist')
      .should('be.visible')
      .click();
    interceptURL(
      'GET',
      'api/v1/bots?limit=100&include=non-deleted',
      'getBotsPage'
    );
    cy.get('.ant-menu-title-content')
      .contains('Bots')
      .scrollIntoView()
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@getBotsPage', 200);
  });

  it('Create new Bot', () => {
    cy.get('[data-testid="add-bot"]')
      .should('exist')
      .should('be.visible')
      .as('addBotButton');
    cy.wait(500);
    //Click on add bot button
    cy.get('@addBotButton').click();
    //Enter email
    cy.get('[data-testid="email"]').should('exist').type(botEmail);
    //Enter display name
    cy.get('[data-testid="displayName"]').should('exist').type(botName);
    //Enter description
    cy.get(descriptionBox).type(description);
    interceptURL('POST', '/api/v1/bots', 'createBot');
    //Click on save button
    cy.get('[data-testid="save-user"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@createBot', 201);
    //Verify bot is getting added in the bots listing page
    cy.get('table').should('contain', botName).and('contain', description);
  });

  it('Update display name and description', () => {
    getCreatedBot();

    //Click on edit display name
    cy.get('[data-testid="edit-displayName"]')
      .should('exist')
      .should('be.visible')
      .click();
    //Enter new display name
    cy.get('[data-testid="displayName"]')
      .should('be.visible')
      .clear()
      .type(updatedBotName);
    //Save the updated display name
    interceptURL('PATCH', '/api/v1/users/*', 'updateBot');
    cy.get('[data-testid="save-displayName"]').should('be.visible').click();
    verifyResponseStatusCode('@updateBot', 200);
    //Verify the display name is updated on bot details page
    cy.get('[data-testid="container"]').should('contain', updatedBotName);
    //Click on edit description button
    cy.get('[data-testid="edit-description"]').should('be.visible').click();
    //Enter updated description and save
    cy.get(descriptionBox).clear().type(updatedDescription);
    cy.get('[data-testid="save"]').click();

    interceptURL('GET', '/api/v1/bots*', 'getBotsPage');
    cy.get('[data-testid="breadcrumb-link"]').first().click();
    verifyResponseStatusCode('@getBotsPage', 200);

    //Verify the updated name is displayed in the Bots listing page
    cy.get(`[data-testid="bot-link-${updatedBotName}"]`).should(
      'contain',
      updatedBotName
    );
    cy.get('[data-testid="markdown-parser"]').should(
      'contain',
      updatedDescription
    );
  });

  it('Delete created bot', () => {
    //Click on delete button
    cy.get(`[data-testid="bot-delete-${updatedBotName}"]`)
      .should('be.visible')
      .click();
    //Select permanent delete
    cy.get('[data-testid="hard-delete-option"]').should('be.visible').click();
    //Enter confirmation text
    cy.get('[data-testid="confirmation-text-input"]')
      .should('be.visible')
      .type(DELETE_TERM);
    interceptURL('DELETE', '/api/v1/bots/*', 'deleteBot');
    cy.get('[data-testid="confirm-button"]').should('be.visible').click();
    verifyResponseStatusCode('@deleteBot', 200);
    cy.get('[data-testid="container"]').should('not.contain', botName);
  });
});
