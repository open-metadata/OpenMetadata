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
  customFormatDateTime,
  getEpochMillisForFutureDays,
} from '../../../src/utils/date-time/DateTimeUtils';
import {
  descriptionBox,
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
} from '../common';

export const addUser = (username: string, email: string) => {
  cy.get('[data-testid="email"]')
    .scrollIntoView()
    .should('exist')
    .should('be.visible')
    .type(email);
  cy.get('[data-testid="displayName"]')
    .should('exist')
    .should('be.visible')
    .type(username);
  cy.get(descriptionBox)
    .should('exist')
    .should('be.visible')
    .type('Adding user');
  interceptURL('GET', ' /api/v1/users/generateRandomPwd', 'generatePassword');
  cy.get('[data-testid="password-generator"]').should('be.visible').click();
  interceptURL('POST', ' /api/v1/users', 'add-user');
  verifyResponseStatusCode('@generatePassword', 200);
  cy.get('[data-testid="save-user"]').scrollIntoView().click();
  verifyResponseStatusCode('@add-user', 201);
};

export const softDeleteUser = (username: string) => {
  interceptURL('GET', '/api/v1/users?*', 'getUsers');

  verifyResponseStatusCode('@getUsers', 200);

  // Search the created user
  interceptURL(
    'GET',
    '/api/v1/search/query?q=**&from=0&size=*&index=*',
    'searchUser'
  );
  cy.get('[data-testid="searchbar"]').type(username);

  verifyResponseStatusCode('@searchUser', 200);

  // Click on delete button
  cy.get(':nth-child(4) > .ant-space > .ant-space-item > .ant-btn').click();
  // Soft deleting the user
  cy.get('[data-testid="soft-delete"]').click();
  cy.get('[data-testid="confirmation-text-input"]').type('DELETE');

  interceptURL(
    'DELETE',
    '/api/v1/users/*?hardDelete=false&recursive=false',
    'softdeleteUser'
  );
  interceptURL('GET', '/api/v1/users*', 'userDeleted');
  cy.get('[data-testid="confirm-button"]').click();
  verifyResponseStatusCode('@softdeleteUser', 200);
  verifyResponseStatusCode('@userDeleted', 200);

  toastNotification('User deleted successfully!');

  interceptURL('GET', '/api/v1/search/query*', 'searchUser');

  // Verifying the deleted user
  cy.get('[data-testid="searchbar"]').scrollIntoView().clear().type(username);

  verifyResponseStatusCode('@searchUser', 200);
};

export const restoreUser = (username: string, editedUserName: string) => {
  interceptURL('GET', '/api/v1/users?*', 'getUsers');

  verifyResponseStatusCode('@getUsers', 200);
  // Click on deleted user toggle
  cy.get('[data-testid="show-deleted"]').click();
  interceptURL('GET', '/api/v1/search/query*', 'searchUser');
  verifyResponseStatusCode('@getUsers', 200);

  cy.get('[data-testid="searchbar"]').type(username);

  verifyResponseStatusCode('@searchUser', 200);

  cy.get(`[data-testid="restore-user-btn-${username}"]`).click();
  cy.get('.ant-modal-body > p').should(
    'contain',
    `Are you sure you want to restore ${editedUserName}?`
  );
  interceptURL('PUT', '/api/v1/users', 'restoreUser');
  cy.get('.ant-modal-footer > .ant-btn-primary').click();
  verifyResponseStatusCode('@restoreUser', 200);
  toastNotification('User restored successfully');

  // Verifying the restored user
  cy.get('[data-testid="show-deleted"]').click();

  cy.get('[data-testid="searchbar"]').type(username);
  verifyResponseStatusCode('@searchUser', 200);
  cy.get(`[data-testid=${username}]`).should('exist');
};

export const deleteSoftDeletedUser = (username: string) => {
  interceptURL('GET', '/api/v1/users?*', 'getUsers');

  verifyResponseStatusCode('@getUsers', 200);
  interceptURL('GET', '/api/v1/search/query*', 'searchUser');
  cy.get('[data-testid="searchbar"]').type(username);
  verifyResponseStatusCode('@searchUser', 200);
  cy.get(':nth-child(4) > .ant-space > .ant-space-item > .ant-btn').click();
  cy.get('[data-testid="hard-delete"]').click();
  cy.get('[data-testid="confirmation-text-input"]').type('DELETE');
  interceptURL(
    'DELETE',
    'api/v1/users/*?hardDelete=true&recursive=false',
    'hardDeleteUser'
  );
  cy.get('[data-testid="confirm-button"]')
    .should('exist')
    .should('be.visible')
    .click();
  verifyResponseStatusCode('@hardDeleteUser', 200);

  toastNotification('User deleted successfully!');

  interceptURL(
    'GET',
    'api/v1/search/query?q=**&from=0&size=15&index=user_search_index',
    'searchUser'
  );

  cy.get('[data-testid="searchbar"]').type(username);
  verifyResponseStatusCode('@searchUser', 200);

  cy.get('[data-testid="search-error-placeholder"]').should('be.exist');
};
export const generateToken = () => {
  cy.get('[data-testid="no-token"]').should('be.visible');
  cy.get('[data-testid="auth-mechanism"] > span').click();
  cy.get('[data-testid="token-expiry"]').should('be.visible').click();
  cy.contains('1 hr').should('exist').should('be.visible').click();
  cy.get('[data-testid="token-expiry"]').should('be.visible');
  cy.get('[data-testid="save-edit"]').should('be.visible').click();
};

export const revokeToken = () => {
  cy.get('[data-testid="revoke-button"]').should('be.visible').click();
  cy.get('[data-testid="body-text"]').should(
    'contain',
    'Are you sure you want to revoke access for Personal Access Token?'
  );
  cy.get('[data-testid="save-button"]').click();
  cy.get('[data-testid="revoke-button"]').should('not.exist');
  Cypress.session.clearAllSavedSessions();
};

export const updateExpiration = (expiry: number) => {
  cy.get('[data-testid="dropdown-profile"]').click();
  cy.get('[data-testid="user-name"] > .ant-typography').click({
    force: true,
  });
  cy.get('[data-testid="access-token"] > .ant-space-item').click();
  cy.get('[data-testid="no-token"]').should('be.visible');
  cy.get('[data-testid="auth-mechanism"] > span').click();

  cy.get('[data-testid="token-expiry"]').click();
  cy.contains(`${expiry} days`).click();
  const expiryDate = customFormatDateTime(
    getEpochMillisForFutureDays(expiry),
    `ccc d'th' MMMM, yyyy`
  );
  cy.get('[data-testid="save-edit"]').click();
  cy.get('[data-testid="center-panel"]')
    .find('[data-testid="revoke-button"]')
    .should('be.visible');
  cy.get('[data-testid="token-expiry"]')
    .invoke('text')
    .should('contain', `Expires on ${expiryDate}`);
  cy.get('[data-testid="token-expiry"]').click();
  revokeToken();
};
