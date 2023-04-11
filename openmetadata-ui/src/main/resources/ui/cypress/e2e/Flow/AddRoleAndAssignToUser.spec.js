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

import {
  descriptionBox,
  interceptURL,
  uuid,
  verifyResponseStatusCode,
} from '../../common/common';
import { BASE_URL } from '../../constants/constants';

const roleName = `Role-test-${uuid()}`;
const userName = `usercttest${uuid()}`;
const userEmail = `${userName}@gmail.com`;

describe('Test Add role and assign it to the user', () => {
  beforeEach(() => {
    cy.login();
    interceptURL('GET', '*api/v1/roles*', 'getRoles');
    interceptURL('GET', '/api/v1/users?*', 'usersPage');
    cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();
  });

  it('Create role', () => {
    cy.get('[data-menu-id*="roles"]').should('be.visible').click();
    verifyResponseStatusCode('@getRoles', 200);

    cy.get('[data-testid="add-role"]')
      .contains('Add Role')
      .should('be.visible')
      .click();

    // Asserting navigation
    cy.get('[data-testid="inactive-link"]')
      .should('contain', 'Add New Role')
      .should('be.visible');
    // Entering name
    cy.get('#name').should('be.visible').type(roleName);
    // Entering descrription
    cy.get(descriptionBox).type('description');
    // Select the policies
    cy.get('[data-testid="policies"]').should('be.visible').click();

    cy.get('[title="Data Consumer Policy"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('[title="Data Steward Policy"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    // Save the role
    cy.get('[data-testid="submit-btn"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    // Verify the role is added successfully
    cy.url().should('eq', `${BASE_URL}/settings/access/roles/${roleName}`);
    cy.get('[data-testid="inactive-link"]').should('contain', roleName);

    // Verify added description
    cy.get('[data-testid="description"] > [data-testid="viewer-container"]')
      .should('be.visible')
      .should('contain', 'description');
  });

  it('Create new user and assign new role to him', () => {
    // Create user and assign newly created role to the user
    cy.get('[data-menu-id*="users"]').should('be.visible').click();
    verifyResponseStatusCode('@usersPage', 200);

    cy.get('[data-testid="add-user"]').contains('Add User').click();

    cy.get('[data-testid="email"]')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .type(userEmail);

    cy.get('[data-testid="displayName"]')
      .should('exist')
      .should('be.visible')
      .type(userName);

    cy.get(descriptionBox)
      .should('exist')
      .should('be.visible')
      .type('Adding user');

    interceptURL('GET', '/api/v1/users/generateRandomPwd', 'generatePassword');
    cy.get('[data-testid="password-generator"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@generatePassword', 200);

    cy.get(`[id="menu-button-Roles"]`)
      .should('exist')
      .should('be.visible')
      .click();

    cy.get(`[data-testid="${roleName}"]`)
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('[data-testid="roles-dropdown"]').click();
    cy.get('[data-testid="save-user"]').scrollIntoView().click();
  });

  it('Verify assigned role to new user', () => {
    cy.get('[data-menu-id*="users"]').should('be.visible').click();
    verifyResponseStatusCode('@usersPage', 200);

    interceptURL(
      'GET',
      '/api/v1/search/query?q=**&from=0&size=*&index=*',
      'searchUser'
    );
    interceptURL('GET', '/api/v1/users/*', 'userDetailsPage');
    cy.get('[data-testid="searchbar"]')
      .should('exist')
      .should('be.visible')
      .type(userName);
    verifyResponseStatusCode('@searchUser', 200);

    cy.get(`[data-testid="${userName}"]`).should('be.visible').click();
    verifyResponseStatusCode('@userDetailsPage', 200);

    cy.get('[data-testid="left-panel"]')
      .should('be.visible')
      .should('contain', roleName);
  });
});
