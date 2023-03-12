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
  interceptURL,
  login,
  verifyResponseStatusCode,
} from '../../common/common';
import { BASE_URL, LOGIN_ERROR_MESSAGE } from '../../constants/constants';

const CREDENTIALS = {
  firstName: 'Test',
  lastName: 'User',
  email: 'user@openmetadata.org',
  password: 'User@OMD123',
};
const invalidEmail = 'userTest@openmetadata.org';
const invalidPassword = 'testUsers@123';

describe('Login flow should work properly', () => {
  it('Signup and Login with signed up credentials', () => {
    interceptURL('GET', 'api/v1/system/config/auth', 'getLoginPage');
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
    cy.url().should('eq', `${BASE_URL}/signin`).and('contain', 'signin');

    // Login with the created user

    login(CREDENTIALS.email, CREDENTIALS.password);
    cy.goToHomePage(true);
    cy.url().should('eq', `${BASE_URL}/my-data`);

    // Verify user profile
    cy.get('[data-testid="avatar"]')
      .first()
      .should('be.visible')
      .trigger('mouseover')
      .click();

    cy.get('[data-testid="user-name"]')
      .should('be.visible')
      .invoke('text')
      .should('contain', `${CREDENTIALS.firstName}${CREDENTIALS.lastName}`);
    interceptURL('GET', 'api/v1/users/name/*', 'getUser');
    cy.get('[data-testid="user-name"]')
      .should('be.visible')
      .click({ force: true });
    verifyResponseStatusCode('@getUser', 200);
    cy.get('[data-testid="left-panel"]').should(
      'contain',
      `${CREDENTIALS.firstName}${CREDENTIALS.lastName}`
    );
  });

  it('Signin using invalid credentials', () => {
    // Login with invalid email
    login(invalidEmail, CREDENTIALS.password);
    cy.get('[data-testid="login-error-container"]')
      .should('be.visible')
      .invoke('text')
      .should('eq', LOGIN_ERROR_MESSAGE);

    // Login with invalid password
    login(CREDENTIALS.email, invalidPassword);
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
  });
});
