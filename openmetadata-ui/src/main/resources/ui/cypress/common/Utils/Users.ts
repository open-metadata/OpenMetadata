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

export const addUser = ({
  name,
  email,
  password,
  role,
}: {
  name: string;
  email: string;
  password: string;
  role: string;
}) => {
  cy.get('[data-testid="add-user"]').click();

  cy.get('[data-testid="email"]')
    .scrollIntoView()
    .should('exist')
    .should('be.visible')
    .type(email);
  cy.get('[data-testid="displayName"]')
    .should('exist')
    .should('be.visible')
    .type(name);
  cy.get(descriptionBox)
    .should('exist')
    .should('be.visible')
    .type('Adding user');
  cy.get(':nth-child(2) > .ant-radio > .ant-radio-input').click();
  cy.get('#password').type(password);
  cy.get('#confirmPassword').type(password);
  cy.get('[data-testid="roles-dropdown"] > .ant-select-selector')
    .click()
    .type(role);
  cy.get('.ant-select-item-option-content').click();
  cy.get('[data-testid="roles-dropdown"] > .ant-select-selector').click();
  interceptURL('POST', ' /api/v1/users', 'add-user');
  cy.get('[data-testid="save-user"]').scrollIntoView().click();
  verifyResponseStatusCode('@add-user', 201);
  interceptURL('GET', '/api/v1/users?*', 'getUsers');

  verifyResponseStatusCode('@getUsers', 200);
};

export const visitProfileSection = () => {
  interceptURL('GET', '/api/v1/users?*', 'getUsers');
  verifyResponseStatusCode('@getUsers', 200);
  cy.get('[data-testid="dropdown-profile"]').click({ force: true });
  cy.get('[data-testid="user-name"] > .ant-typography').click({
    force: true,
  });
  cy.get('[data-testid="access-token"] > .ant-space-item').click();
};
export const softDeleteUser = (username: string) => {
  // Search the created user
  interceptURL(
    'GET',
    '/api/v1/search/query?q=**&from=0&size=*&index=*',
    'searchUser'
  );
  cy.get('[data-testid="searchbar"]').type(username);

  verifyResponseStatusCode('@searchUser', 200);

  // Click on delete button
  cy.get(`[data-testid="delete-user-btn-${username}"]`);
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
};

export const permanentDeleteUser = (username: string) => {
  interceptURL('GET', '/api/v1/users?*', 'getUsers');
  interceptURL('GET', '/api/v1/users/name/*', 'getUser');
  verifyResponseStatusCode('@getUsers', 200);
  verifyResponseStatusCode('@getUser', 200);
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
export const visitUserListPage = () => {
  cy.get('[data-testid="app-bar-item-settings"]')
    .should('exist')
    .should('be.visible')
    .click();
  interceptURL('GET', '/api/v1/users?*', 'getUsers');
  cy.get('[data-testid="settings-left-panel"]').contains('Users').click();
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

export const editDisplayName = (editedUserName: string) => {
  cy.get('[data-testid="edit-displayName"]').should('be.visible');
  cy.get('[data-testid="edit-displayName"]').click();
  cy.get('[data-testid="displayName"]').clear();
  cy.get('[data-testid="displayName"]').type(editedUserName);
  interceptURL('PATCH', '/api/v1/users/*', 'updateName');
  cy.get('[data-testid="inline-save-btn"]').click();
  cy.get('[data-testid="edit-displayName"]').scrollIntoView();
  cy.get('[data-testid="user-name"]').should('contain', editedUserName);
};

export const editDescription = (updatedDescription: string) => {
  cy.get('[data-testid="edit-description"]').click();
  cy.get(descriptionBox).clear().type(updatedDescription);
  interceptURL('PATCH', '/api/v1/users/*', 'patchDescription');
  cy.get('[data-testid="save"]').should('be.visible').click();
  verifyResponseStatusCode('@patchDescription', 200);
  cy.get('.ant-collapse-expand-icon > .anticon > svg').scrollIntoView();
  cy.get('.ant-collapse-expand-icon > .anticon > svg').click();
  cy.get(
    ':nth-child(2) > :nth-child(1) > [data-testid="viewer-container"] > [data-testid="markdown-parser"] > :nth-child(1) > .toastui-editor-contents > p'
  ).should('contain', updatedDescription);
};

export const editTeams = (teamName: string) => {
  cy.get('[data-testid="edit-teams-button"]').click();
  cy.get('.ant-select-selection-item-remove > .anticon').click();
  cy.get('[data-testid="team-select"]').click();
  cy.get('[data-testid="team-select"]').type(teamName);
  cy.get('.filter-node > .ant-select-tree-node-content-wrapper').click();
  cy.get('[data-testid="inline-save-btn"]').click({ timeout: 10000 });
  cy.get('.ant-collapse-expand-icon > .anticon > svg').scrollIntoView();
  cy.get(`[data-testid="${teamName}"]`).should('exist').and('be.visible');
};

export const handleUserUpdateDetails = (
  editedUserName: string,
  updatedDescription: string
) => {
  cy.get('[data-testid="dropdown-profile"]').click({ force: true });
  cy.get('[data-testid="user-name"] > .ant-typography').click({
    force: true,
  });
  // edit displayName
  editDisplayName(editedUserName);
  // edit description
  cy.wait(500);
  cy.get('.ant-collapse-expand-icon > .anticon > svg').scrollIntoView();
  cy.get('.ant-collapse-expand-icon > .anticon > svg').click();
  editDescription(updatedDescription);

  cy.get('.ant-collapse-expand-icon > .anticon > svg').scrollIntoView();
  cy.get('.ant-collapse-expand-icon > .anticon > svg').click();
};

export const handleAdminUpdateDetails = (
  editedUserName: string,
  updatedDescription: string,
  teamName: string,
  role?: string
) => {
  // edit displayName
  cy.get('[data-testid="dropdown-profile"]').click({ force: true });
  cy.get('[data-testid="user-name"] > .ant-typography').click({
    force: true,
  });
  editDisplayName(editedUserName);

  // edit teams
  cy.get('.ant-collapse-expand-icon > .anticon > svg').scrollIntoView();
  cy.get('.ant-collapse-expand-icon > .anticon > svg').click();
  editTeams(teamName);

  // edit description
  cy.wait(500);
  cy.get('.ant-collapse-expand-icon > .anticon > svg').scrollIntoView();
  cy.get('.ant-collapse-expand-icon > .anticon > svg').click();
  editDescription(updatedDescription);

  // edit roles
  cy.get(`[data-testid="chip-container"]`).should('contain', role);
};

export const updateDetails = ({
  updatedDisplayName,
  updatedDescription,
  isAdmin,
  teamName,
  role,
}: {
  email: string;
  password: string;
  updatedDisplayName: string;
  updatedDescription: string;
  teamName: string;
  isAdmin?: boolean;
  role?: string;
}) => {
  isAdmin
    ? handleAdminUpdateDetails(
        updatedDisplayName,
        updatedDescription,
        teamName,
        role
      )
    : handleUserUpdateDetails(updatedDisplayName, updatedDescription);
};

export const resetPassword = (password: string, newPassword: string) => {
  cy.get('[data-testid="dropdown-profile"]').click({ force: true });
  cy.get('[data-testid="user-name"] > .ant-typography').click({
    force: true,
  });
  cy.clickOutside();
  cy.get('[data-testid="change-password-button"]').click();
  cy.get('.ant-modal-wrap').should('be.visible');
  cy.get('[data-testid="input-oldPassword"]').clear().type(password);
  cy.get('[data-testid="input-newPassword"]').clear().type(newPassword);
  cy.get('[data-testid="input-confirm-newPassword"]').clear().type(newPassword);
  interceptURL('PUT', '/api/v1/users/changePassword', 'changePassword');
  cy.get('.ant-modal-footer > .ant-btn-primary')
    .contains('Update Password')
    .click();
  verifyResponseStatusCode('@changePassword', 200);
  toastNotification('Password updated successfully.');
};

export const editRole = (username: string, role: string) => {
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
  cy.get(`[data-testid=${username}]`).click();
  cy.get('.ant-collapse-expand-icon > .anticon > svg').scrollIntoView();
  cy.get('.ant-collapse-expand-icon > .anticon > svg').click();
  cy.get('[data-testid="edit-roles-button"]').click();
  cy.get('.ant-select-selection-item-remove > .anticon').click();
  cy.get('[data-testid="inline-edit-container"] #select-role')
    .click()
    .type(role);
  cy.get('.ant-select-item-option-content').contains(role).click();
  interceptURL('PATCH', `/api/v1/users/*`, 'updateRole');
  cy.get('[data-testid="inline-save-btn"]').click();
  verifyResponseStatusCode('@updateRole', 200);
  cy.get('.ant-collapse-expand-icon > .anticon > svg').scrollIntoView();
  cy.get(`[data-testid=chip-container]`).should('contain', role);
};
