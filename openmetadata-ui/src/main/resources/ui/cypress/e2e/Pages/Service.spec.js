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
  verifyResponseStatusCode,
} from '../../common/common';
import { service } from '../../constants/constants';

describe('Services page should work properly', () => {
  beforeEach(() => {
    cy.login();
    // redirecting to services page

    cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();

    cy.get('[data-testid="settings-left-panel"]')
      .contains('Database')
      .should('be.visible')
      .click();
  });

  it('Update service description', () => {
    interceptURL('GET', '/api/v1/config/airflow', 'getService');
    cy.get(`[data-testid="service-name-${service.name}"]`)
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@getService', 200);
    // need wait here
    cy.get('[data-testid="edit-description"]')
      .should('exist')
      .should('be.visible')
      .click({ force: true });
    cy.get(descriptionBox).clear().type(service.newDescription);
    cy.get('[data-testid="save"]').click();
    cy.get(
      '[data-testid="description"] > [data-testid="viewer-container"] > [data-testid="markdown-parser"] > :nth-child(1) > .toastui-editor-contents > p'
    ).contains(service.newDescription);
    cy.get(':nth-child(1) > .link-title').click();
    cy.get('.toastui-editor-contents > p').contains(service.newDescription);
  });

  it('Update owner and check description', () => {
    interceptURL('GET', '/api/v1/config/airflow', 'getService');
    cy.get(`[data-testid="service-name-${service.name}"]`)
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@getService', 200);
    interceptURL(
      'GET',
      '/api/v1//search/query?q=*&from=0&size=10&index=*',
      'editOwner'
    );
    cy.get('[data-testid="edit-Owner-icon"]')
      .should('exist')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@editOwner', 200);

    cy.get('[data-testid="dropdown-list"]')
      .contains('Users')
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('[data-testid="list-item"]')
      .contains(service.Owner)
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('[data-testid="owner-dropdown"]').should('have.text', service.Owner);
    // Checking if description exists after assigning the owner
    cy.get(':nth-child(1) > .link-title').click();
    // need wait here

    cy.get('[data-testid="viewer-container"]').contains(service.newDescription);
  });
});
