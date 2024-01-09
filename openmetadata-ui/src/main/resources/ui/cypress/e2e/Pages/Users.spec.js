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
// eslint-disable-next-line spaced-comment
/// <reference types="cypress" />
import {
  customFormatDateTime,
  getEpochMillisForFutureDays,
} from '../../../src/utils/date-time/DateTimeUtils';
import {
  addUser,
  deleteSoftDeletedUser,
  interceptURL,
  restoreUser,
  softDeleteUser,
  uuid,
  verifyResponseStatusCode,
} from '../../common/common';

const userName = `Usercttest${uuid()}`;
const userEmail = `${userName}@gmail.com`;

const adminName = `Admincttest${uuid()}`;
const adminEmail = `${adminName}@gmail.com`;

const searchBotText = 'bot';

const expirationTime = {
  oneday: '1',
  sevendays: '7',
  onemonth: '30',
  twomonths: '60',
  threemonths: '90',
};

const revokeToken = () => {
  // Click on revoke button
  cy.get('[data-testid="revoke-button"]').should('be.visible').click();
  // Verify the revoke text
  cy.get('[data-testid="body-text"]').should(
    'contain',
    'Are you sure you want to revoke access for Personal Access Token?'
  );
  // Click on confirm button
  cy.get('[data-testid="save-button"]').click();
  // Verify the revoke is successful
  cy.get('[data-testid="revoke-button"]').should('not.exist');
};

describe('Users flow should work properly', () => {
  beforeEach(() => {
    cy.login();

    cy.get('[data-testid="app-bar-item-settings"]')
      .should('exist')
      .should('be.visible')
      .click();
    cy.sidebarHoverOutside();
    interceptURL('GET', '/api/v1/users?*', 'getUsers');
    cy.get('[data-testid="settings-left-panel"]').contains('Users').click();
  });

  it('Add new User', () => {
    // Clicking on Add user button
    cy.get('[data-testid="add-user"]').click();

    addUser(userName, userEmail);
    verifyResponseStatusCode('@getUsers', 200);
  });

  it('Soft delete user', () => {
    softDeleteUser(userName);
  });

  it('Restore soft deleted user', () => {
    restoreUser(userName);
  });

  it('Permanently Delete Soft Deleted User', () => {
    softDeleteUser(userName);
    deleteSoftDeletedUser(userName);
  });

  it('Search for bot user', () => {
    interceptURL(
      'GET',
      `/api/v1/search/query?q=*${searchBotText}***isBot:false&from=0&size=25&index=user_search_index`,
      'searchUser'
    );
    cy.get('[data-testid="searchbar"]')
      .should('exist')
      .should('be.visible')
      .type(searchBotText);

    verifyResponseStatusCode('@searchUser', 200);
  });
});

describe('Admin flow should work properly', () => {
  beforeEach(() => {
    cy.login();

    cy.get('[data-testid="app-bar-item-settings"]')
      .should('exist')
      .should('be.visible')
      .click();
    cy.sidebarHoverOutside();
    interceptURL('GET', '/api/v1/users?*isAdmin=true*', 'getAdmins');
    cy.get('.ant-menu-title-content')
      .contains('Admins')
      .should('exist')
      .should('be.visible')
      .click();
  });

  it('Add admin user', () => {
    // Clicking on add user button
    cy.get('[data-testid="add-user"]').click();

    // Setting the user to admin before adding user
    cy.get('[data-testid="admin"]')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .click();

    addUser(adminName, adminEmail);
    verifyResponseStatusCode('@getAdmins', 200);

    // Validate if user is added in the User tab
    interceptURL(
      'GET',
      '/api/v1/search/query?q=**&from=0&size=*&index=*',
      'searchUser'
    );
    cy.get('[data-testid="searchbar"]')
      .should('exist')
      .should('be.visible')
      .type(adminName);
    verifyResponseStatusCode('@searchUser', 200);
    cy.get('.ant-table-tbody ').should('contain', adminName);
  });

  it('Soft delete admin', () => {
    softDeleteUser(adminName, true);
  });

  it('Restore soft deleted admin', () => {
    restoreUser(adminName);
  });

  it('Permanently Delete Soft Deleted admin', () => {
    softDeleteUser(adminName, true);
    deleteSoftDeletedUser(adminName);
  });

  describe('Personal Access Token flow should work properly', () => {
    beforeEach(() => {
      cy.login();
    });

    it('Token should be generated and revoked', function () {
      // Enter profile section
      cy.get('.username').click();
      cy.get('[data-testid="user-name"] > .ant-typography').click();
      cy.get('[data-testid="access-token"] > .ant-space-item').click();
      cy.get('[data-testid="access-token"] > .ant-space-item').should(
        'be.visible'
      );

      // generate token
      cy.get('[data-testid="no-token"]').should('be.visible');
      cy.get('[data-testid="auth-mechanism"] > span').click();
      cy.get('[data-testid="token-expiry"]').should('be.visible').click();
      cy.contains('1 hr').should('exist').should('be.visible').click();
      cy.get('[data-testid="token-expiry"]').should('be.visible');
      cy.get('[data-testid="save-edit"]').should('be.visible').click();

      // revoke token
      cy.get('[data-testid="revoke-button"] > span').should('be.visible');
      cy.get('[data-testid="revoke-button"] > span').click();
      cy.get('[data-testid="save-button"] > span').click();
      cy.get(':nth-child(1) > .ant-row > .ant-form-item-label > label').should(
        'be.visible'
      );
    });

    Object.values(expirationTime).forEach((expiry) => {
      it(`Update token expiration for ${expiry} days`, () => {
        cy.get('.username').click();
        cy.get('[data-testid="user-name"] > .ant-typography').click();
        cy.get('[data-testid="access-token"] > .ant-space-item').click();
        cy.get('[data-testid="access-token"] > .ant-space-item').should(
          'be.visible'
        );
        cy.get('[data-testid="no-token"]').should('be.visible');
        cy.get('[data-testid="auth-mechanism"] > span').click();

        cy.get('[data-testid="token-expiry"]').click();
        // Select the expiration period
        cy.contains(`${expiry} days`).click();
        // Save the updated date
        const expiryDate = customFormatDateTime(
          getEpochMillisForFutureDays(expiry),
          `ccc d'th' MMMM, yyyy`
        );
        cy.get('[data-testid="save-edit"]').click();
        cy.get('[data-testid="center-panel"]')
          .find('[data-testid="revoke-button"]')
          .should('be.visible');
        // Verify the expiry time
        cy.get('[data-testid="token-expiry"]')
          .invoke('text')
          .should('contain', `Expires on ${expiryDate}`);
        cy.get('[data-testid="token-expiry"]').click();
        revokeToken();
      });
    });
  });
});
