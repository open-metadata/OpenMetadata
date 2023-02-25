/*
 *  Copyright 2022 Collate.
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
import { getExpiryDateTimeFromDate } from '../../../src/utils/TimeUtils.ts';
import {
  descriptionBox,
  interceptURL,
  uuid,
  verifyResponseStatusCode,
} from '../../common/common';
import { DELETE_TERM } from '../../constants/constants';

const botName = `Bot-ct-test-${uuid()}`;
const botEmail = `${botName}@mail.com`;
const description = 'This is bot description';
const updatedDescription = 'This is updated bot description';
const updatedBotName = `updated-${botName}`;
const unlimitedExpiryTime = 'This token has no expiration date.';
const JWTToken = 'OpenMetadata JWT';

const expirationTime = {
  oneday: '1',
  sevendays: '7',
  onemonth: '30',
  twomonths: '60',
  threemonths: '90',
};
const getCreatedBot = () => {
  interceptURL('GET', `/api/v1/bots/name/${botName}`, 'getCreatedBot');
  // Click on created Bot name
  cy.get(`[data-testid="bot-link-${botName}"]`)
    .should('exist')
    .should('be.visible')
    .click();
  verifyResponseStatusCode('@getCreatedBot', 200);
};

const revokeToken = () => {
  // Click on revoke button
  cy.get('[data-testid="revoke-button"]')
    .should('contain', 'Revoke token')
    .should('be.visible')
    .click();
  // Verify the revoke text
  cy.get('[data-testid="body-text"]').should(
    'contain',
    'Are you sure you want to revoke access for JWT token?'
  );
  // Click on confirm button
  cy.get('[data-testid="save-button"]')
    .should('exist')
    .should('be.visible')
    .click();
  // Verify the revoke is successful
  cy.get('[data-testid="revoke-button"]').should('not.exist');
  cy.get('[data-testid="auth-mechanism"]')
    .should('be.visible')
    .invoke('text')
    .should('eq', 'OpenMetadata JWT');
  cy.get('[data-testid="token-expiry"]').should('exist').should('be.visible');
  cy.get('[data-testid="save-edit"]').should('exist').should('be.visible');
};

describe('Bots Page should work properly', () => {
  beforeEach(() => {
    cy.login();
    cy.get('[data-testid="appbar-item-settings"]')
      .should('exist')
      .should('be.visible')
      .click();
    interceptURL(
      'GET',
      'api/v1/bots?limit=100&include=non-deleted',
      'getBotsList'
    );
    cy.get('[data-testid="settings-left-panel"]')
      .contains('Bots')
      .scrollIntoView()
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@getBotsList', 200);
  });

  it('Verify ingestion bot delete button is always disabled', () => {
    cy.get('[data-testid="bot-delete-ingestion-bot"]')
      .should('exist')
      .should('be.disabled');
  });

  it('Create new Bot', () => {
    cy.get('[data-testid="add-bot"]')
      .should('exist')
      .should('be.visible')
      .as('addBotButton');
    cy.wait(500);
    // Click on add bot button
    cy.get('@addBotButton').click();
    // Enter email
    cy.get('[data-testid="email"]').should('exist').type(botEmail);
    // Enter display name
    cy.get('[data-testid="displayName"]').should('exist').type(botName);
    // Select token type
    cy.get('[data-testid="auth-mechanism"]').should('be.visible').click();
    cy.contains(JWTToken).should('exist').should('be.visible').click();
    // Select expiry time
    cy.get('[data-testid="token-expiry"]').should('be.visible').click();
    cy.contains('1 hr').should('exist').should('be.visible').click();
    // Enter description
    cy.get(descriptionBox).type(description);
    // Click on save button
    cy.wait(1000);
    interceptURL('PUT', '/api/v1/bots', 'createBot');
    cy.get('[data-testid="save-user"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@createBot', 201);
    verifyResponseStatusCode('@getBotsList', 200);
    // Verify bot is getting added in the bots listing page
    cy.get('table').should('contain', botName).and('contain', description);

    getCreatedBot();
    cy.get('[data-testid="revoke-button"]')
      .should('be.visible')
      .should('contain', 'Revoke token');

    cy.get('[data-testid="center-panel"]')
      .should('be.visible')
      .should('contain', `${JWTToken} Token`);
    // Verify expiration time
    cy.get('[data-testid="token-expiry"]').should('be.visible');
  });

  Object.values(expirationTime).forEach((expiry) => {
    it(`Update token expiration for ${expiry} days`, () => {
      getCreatedBot();

      revokeToken();
      // Click on token expiry dropdown
      cy.get('[data-testid="token-expiry"]').should('be.visible').click();
      // Select the expiration period
      cy.contains(`${expiry} days`)
        .should('exist')
        .should('be.visible')
        .click();
      // Save the updated date
      const expiryDate = getExpiryDateTimeFromDate(
        expiry,
        'days',
        `ccc d'th' MMMM, yyyy`
      );
      cy.get('[data-testid="save-edit"]').should('be.visible').click();
      cy.get('[data-testid="center-panel"]')
        .find('[data-testid="revoke-button"]')
        .should('be.visible');
      // Verify the expiry time
      cy.get('[data-testid="token-expiry"]')
        .should('be.visible')
        .invoke('text')
        .should('contain', `Expires on ${expiryDate}`);
    });
  });

  it('Update token expiration for unlimited days', () => {
    getCreatedBot();
    revokeToken();
    // Click on expiry token dropdown
    cy.get('[data-testid="token-expiry"]')
      .should('exist')
      .should('be.visible')
      .click();
    // Select unlimited days
    cy.contains('Unlimited days').should('exist').should('be.visible').click();
    // Save the selected changes
    cy.get('[data-testid="save-edit"]')
      .should('exist')
      .should('be.visible')
      .click();
    // Verify the updated expiry time
    cy.get('[data-testid="center-panel"]')
      .find('[data-testid="revoke-button"]')
      .should('be.visible');
    // Verify the expiry time
    cy.get('[data-testid="token-expiry"]')
      .should('be.visible')
      .invoke('text')
      .should('contain', `${unlimitedExpiryTime}`);
  });

  it('Update display name and description', () => {
    getCreatedBot();

    // Click on edit display name
    cy.get('[data-testid="edit-displayName"]')
      .should('exist')
      .should('be.visible')
      .click();
    // Enter new display name
    cy.get('[data-testid="displayName"]')
      .should('be.visible')
      .clear()
      .type(updatedBotName);
    // Save the updated display name

    cy.get('[data-testid="save-displayName"]').should('be.visible').click();

    // Verify the display name is updated on bot details page
    cy.get('[data-testid="container"]').should('contain', updatedBotName);
    cy.wait(1000);
    // Click on edit description button
    cy.get('[data-testid="edit-description"]').should('be.visible').click();
    // Enter updated description and save
    cy.get(descriptionBox).clear().type(updatedDescription);
    cy.get('[data-testid="save"]').click();

    interceptURL('GET', '/api/v1/bots*', 'getBotsPage');
    cy.get('[data-testid="breadcrumb-link"]').first().click();
    verifyResponseStatusCode('@getBotsPage', 200);

    // Verify the updated name is displayed in the Bots listing page
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
    // Click on delete button
    cy.get(`[data-testid="bot-delete-${updatedBotName}"]`)
      .should('be.visible')
      .click();
    // Select permanent delete
    cy.get('[data-testid="hard-delete-option"]').should('be.visible').click();
    // Enter confirmation text
    cy.get('[data-testid="confirmation-text-input"]')
      .should('be.visible')
      .type(DELETE_TERM);
    interceptURL('DELETE', '/api/v1/bots/*', 'deleteBot');
    cy.get('[data-testid="confirm-button"]').should('be.visible').click();
    verifyResponseStatusCode('@deleteBot', 200);
    cy.get('[data-testid="container"]').should('not.contain', botName);
  });
});
