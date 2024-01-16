/*
 *  Copyright 2023 Collate.
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
describe('template spec', () => {
  beforeEach(() => {
    cy.login();

    cy.sidebarClick('app-bar-item-settings');

    cy.get('[data-testid="settings-left-panel"]')
      .contains('Login Configuration')
      .scrollIntoView()
      .click();
  });

  /* ==== Test Created with Cypress Studio ==== */
  it('update login configuration should work', function () {
    /* ==== Generated with Cypress Studio ==== */
    cy.get('[data-testid="edit-button"]').click();
    cy.get('[data-testid="jwtTokenExpiryTime"]').clear('3600');
    cy.get('[data-testid="jwtTokenExpiryTime"]').type('5000');
    cy.get('[data-testid="accessBlockTime"]').clear('600');
    cy.get('[data-testid="accessBlockTime"]').type('500');
    cy.get('[data-testid="maxLoginFailAttempts"]').clear('3');
    cy.get('[data-testid="maxLoginFailAttempts"]').type('5');
    cy.get('[data-testid="save-button"] > span').click();
    cy.get('[data-testid="max-login-fail-attampts"]').should('have.text', '5');
    cy.get('[data-testid="access-block-time"]').should('have.text', '500');
    cy.get('[data-testid="jwt-token-expiry-time"]').should(
      'have.text',
      '5000 Milliseconds'
    );
    /* ==== End Cypress Studio ==== */
  });

  /* ==== Test Created with Cypress Studio ==== */
  it('reset login configuration', function () {
    /* ==== Generated with Cypress Studio ==== */
    cy.get('[data-testid="edit-button"] > :nth-child(2)').click();
    cy.get('[data-testid="maxLoginFailAttempts"]').clear('53');
    cy.get('[data-testid="maxLoginFailAttempts"]').type('3');
    cy.get('[data-testid="accessBlockTime"]').clear('500');
    cy.get('[data-testid="accessBlockTime"]').type('300');
    cy.get('[data-testid="jwtTokenExpiryTime"]').clear('5000');
    cy.get('[data-testid="jwtTokenExpiryTime"]').type('3600');
    cy.get('[data-testid="save-button"]').click();
    cy.get('.Toastify__toast-body > :nth-child(2)').should(
      'have.text',
      'Login Configuration updated successfully.'
    );
    /* ==== End Cypress Studio ==== */
  });
});
