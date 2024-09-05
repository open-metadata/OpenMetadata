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
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
} from '../common';

export const checkNoPermissionPlaceholder = (permission = false) => {
  cy.get('[data-testid="permission-error-placeholder"]').should(
    permission ? 'not.be.visible' : 'be.visible'
  );
  if (!permission) {
    cy.get('[data-testid="permission-error-placeholder"]').should(
      'contain',
      'You don’t have access, please check with the admin to get permissions'
    );
  }
};

export const permanentDeleteUser = (username: string, displayName: string) => {
  interceptURL('GET', '/api/v1/users?*', 'getUsers');
  interceptURL('GET', '/api/v1/users/name/*', 'getUser');
  verifyResponseStatusCode('@getUsers', 200);
  verifyResponseStatusCode('@getUser', 200);
  cy.get('[data-testid="loader"]').should('not.exist');
  interceptURL('GET', '/api/v1/search/query*', 'searchUser');
  cy.get('[data-testid="searchbar"]').type(username);
  verifyResponseStatusCode('@searchUser', 200);
  cy.get(`[data-testid="delete-user-btn-${username}"]`).click();
  cy.get('[data-testid="hard-delete"]').click();
  cy.get('[data-testid="confirmation-text-input"]').type('DELETE');
  interceptURL(
    'DELETE',
    'api/v1/users/*?hardDelete=true&recursive=false',
    'hardDeleteUser'
  );
  cy.get('[data-testid="confirm-button"]').click();
  verifyResponseStatusCode('@hardDeleteUser', 200);

  toastNotification(`"${displayName}" deleted successfully!`);

  interceptURL(
    'GET',
    'api/v1/search/query?q=**&from=0&size=15&index=user_search_index',
    'searchUser'
  );

  cy.get('[data-testid="searchbar"]').type(username);
  verifyResponseStatusCode('@searchUser', 200);

  cy.get('[data-testid="search-error-placeholder"]').should('be.exist');
};

export const restoreUser = (username: string, editedUserName: string) => {
  interceptURL('GET', '/api/v1/users?*', 'getUsers');

  verifyResponseStatusCode('@getUsers', 200);

  cy.get('[data-testid="loader"]').should('not.exist');
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
  interceptURL('PUT', '/api/v1/users/restore', 'restoreUser');
  cy.get('.ant-modal-footer > .ant-btn-primary').click();
  verifyResponseStatusCode('@restoreUser', 200);
  toastNotification('User restored successfully');
};

export const softDeleteUser = (username: string, displayName: string) => {
  cy.get('[data-testid="loader"]').should('not.exist');
  // Search the created user
  interceptURL(
    'GET',
    '/api/v1/search/query?q=**&from=0&size=*&index=*',
    'searchUser'
  );
  cy.get('[data-testid="searchbar"]').type(username);

  verifyResponseStatusCode('@searchUser', 200);

  // Click on delete button
  cy.get(`[data-testid="delete-user-btn-${username}"]`).click();
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

  toastNotification(`"${displayName}" deleted successfully!`);

  interceptURL('GET', '/api/v1/search/query*', 'searchUser');

  // Verifying the deleted user
  cy.get('[data-testid="searchbar"]').scrollIntoView().clear().type(username);

  verifyResponseStatusCode('@searchUser', 200);
};
