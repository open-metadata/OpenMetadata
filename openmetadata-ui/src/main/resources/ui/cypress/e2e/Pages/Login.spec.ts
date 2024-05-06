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

import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import { getToken } from '../../common/Utils/LocalStorage';
import { performLogin } from '../../common/Utils/Login';
import { generateRandomUser } from '../../common/Utils/Owner';
import { BASE_URL, LOGIN_ERROR_MESSAGE } from '../../constants/constants';

const CREDENTIALS = generateRandomUser();
let userId = '';
const invalidEmail = 'userTest@openmetadata.org';
const invalidPassword = 'testUsers@123';

describe('Login flow should work properly', { tags: 'Settings' }, () => {
  after(() => {
    cy.login();

    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);
      cy.request({
        method: 'DELETE',
        url: `/api/v1/users/${userId}?hardDelete=true&recursive=false`,
        headers: { Authorization: `Bearer ${token}` },
      });
    });
  });

  it('Signup and Login with signed up credentials', () => {
    interceptURL('GET', 'api/v1/system/config/auth', 'getLoginPage');
    interceptURL('POST', '/api/v1/users/checkEmailInUse', 'createUser');
    cy.visit('/');
    verifyResponseStatusCode('@getLoginPage', 200);
    // Click on create account button
    cy.get('[data-testid="signup"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    // Enter first name
    cy.get('[id="firstName"]').should('be.visible').type(CREDENTIALS.firstName);
    cy.get('[id="firstName"]').should('have.value', CREDENTIALS.firstName);
    // Enter last name
    cy.get('[id="lastName"]').should('be.visible').type(CREDENTIALS.lastName);
    cy.get('[id="lastName"]').should('have.value', CREDENTIALS.lastName);
    // Enter email
    cy.get('[id="email"]').should('be.visible').type(CREDENTIALS.email);
    cy.get('[id="email"]').should('have.value', CREDENTIALS.email);
    // Enter password
    cy.get('[id="password"]').should('be.visible').type(CREDENTIALS.password);
    cy.get('[id="password"]')
      .should('have.attr', 'type')
      .should('eq', 'password');

    // Confirm password
    cy.get('[id="confirmPassword"]')
      .should('be.visible')
      .type(CREDENTIALS.password);
    // Click on create account button
    cy.get('.ant-btn').contains('Create Account').should('be.visible').click();
    verifyResponseStatusCode('@createUser', 200);
    cy.url().should('eq', `${BASE_URL}/signin`).and('contain', 'signin');

    // Login with the created user

    performLogin(CREDENTIALS.email, CREDENTIALS.password);
    cy.url().should('eq', `${BASE_URL}/my-data`);

    // Verify user profile
    cy.get('[data-testid="dropdown-profile"]').click();

    cy.get('[data-testid="user-name"]')
      .should('be.visible')
      .invoke('text')
      .should('contain', `${CREDENTIALS.firstName}${CREDENTIALS.lastName}`);
    interceptURL(
      'GET',
      '/api/v1/users/name/*?fields=profile*roles*teams*',
      'getUser'
    );
    cy.get('[data-testid="user-name"]')
      .should('be.visible')
      .click({ force: true });
    cy.wait('@getUser', { requestTimeout: 10000 }).then((response) => {
      userId = response.response?.body.id;
      cy.log('User ID:', response.response?.body.id);
    });
    cy.get(
      '[data-testid="user-profile"] [data-testid="user-profile-details"]'
    ).should('contain', `${CREDENTIALS.firstName}${CREDENTIALS.lastName}`);
  });

  it('Signin using invalid credentials', () => {
    // Login with invalid email
    performLogin(invalidEmail, CREDENTIALS.password);
    cy.get('[data-testid="login-error-container"]')
      .should('be.visible')
      .invoke('text')
      .should('eq', LOGIN_ERROR_MESSAGE);

    // Login with invalid password
    performLogin(CREDENTIALS.email, invalidPassword);
    cy.get('[data-testid="login-error-container"]')
      .should('be.visible')
      .invoke('text')
      .should('eq', LOGIN_ERROR_MESSAGE);
  });

  it('Forgot password and login with new password', () => {
    interceptURL('GET', 'api/v1/system/config/auth', 'getLoginPage');
    cy.visit('/');
    verifyResponseStatusCode('@getLoginPage', 200);
    // Click on Forgot button
    cy.get('[data-testid="forgot-password"]')
      .should('be.visible')
      .trigger('mouseover')
      .click();

    cy.url()
      .should('eq', `${BASE_URL}/forgot-password`)
      .and('contain', 'forgot-password');
    // Enter email
    cy.get('[id="email"]').should('be.visible').clear().type(CREDENTIALS.email);
    // Click on submit
    cy.get('.ant-btn').contains('Submit').click();
    cy.get('[data-testid="go-back-button"]').scrollIntoView().click();
  });
});
