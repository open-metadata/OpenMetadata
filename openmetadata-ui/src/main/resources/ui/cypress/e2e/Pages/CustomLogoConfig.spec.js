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
import { interceptURL, verifyResponseStatusCode } from '../../common/common';

const config = {
  logo: 'https://custom-logo.png',
  monogram: 'https://custom-monogram.png',
  logoError: 'Logo URL is not valid url',
  monogramError: 'Monogram URL is not valid url',
};

describe('Custom Logo Config', () => {
  beforeEach(() => {
    cy.login();

    cy.get('[data-testid="appbar-item-settings"]')
      .should('exist')
      .and('be.visible')
      .click();

    interceptURL(
      'GET',
      'api/v1/system/settings/customLogoConfiguration',
      'customLogoConfiguration'
    );

    cy.get('[data-testid="global-setting-left-panel"]')
      .contains('Custom Logo')
      .scrollIntoView()
      .should('be.visible')
      .and('exist')
      .click();

    verifyResponseStatusCode('@customLogoConfiguration', 200);
  });

  it('Should have default config', () => {
    cy.get('[data-testid="sub-heading"]')
      .should('be.visible')
      .contains('Configure The Application Logo and Monogram.');
    cy.get('[data-testid="logo-url"]').should('be.visible').contains('--');
    cy.get('[data-testid="monogram-url"]').should('be.visible').contains('--');
    cy.get('[data-testid="edit-button"]').should('be.visible');
  });

  it('Should update the config', () => {
    interceptURL(
      'GET',
      'api/v1/system/settings/customLogoConfiguration',
      'customLogoConfiguration'
    );
    cy.get('[data-testid="edit-button"]').should('be.visible').click();
    verifyResponseStatusCode('@customLogoConfiguration', 200);

    cy.get('[data-testid="customLogoUrlPath"]')
      .scrollIntoView()
      .should('be.visible')
      .click()
      .clear()
      .type('incorrect url');

    // validation should work
    cy.get('[role="alert"]').should('contain', config.logoError);

    cy.get('[data-testid="customLogoUrlPath"]')
      .scrollIntoView()
      .should('be.visible')
      .click()
      .clear()
      .type(config.logo);

    cy.get('[data-testid="customMonogramUrlPath"]')
      .scrollIntoView()
      .should('be.visible')
      .click()
      .clear()
      .type('incorrect url');

    // validation should work
    cy.get('[role="alert"]').should('contain', config.monogramError);

    cy.get('[data-testid="customMonogramUrlPath"]')
      .scrollIntoView()
      .should('be.visible')
      .click()
      .clear()
      .type(config.monogram);

    interceptURL('PUT', 'api/v1/system/settings', 'updatedConfig');

    interceptURL(
      'GET',
      'api/v1/system/settings/customLogoConfiguration',
      'updatedCustomLogoConfiguration'
    );

    cy.get('[data-testid="save-button"]').click();

    verifyResponseStatusCode('@updatedConfig', 200);
    verifyResponseStatusCode('@updatedCustomLogoConfiguration', 200);

    cy.get('[data-testid="logo-url"]')
      .should('be.visible')
      .contains(config.logo);
    cy.get('[data-testid="monogram-url"]')
      .should('be.visible')
      .contains(config.monogram);
  });
});
