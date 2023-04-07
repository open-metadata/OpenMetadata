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
    interceptURL(
      'GET',
      '/api/v1/system/config/pipeline-service-client',
      'pipelineServiceClient'
    );
    interceptURL(
      'GET',
      `/api/v1/*?service=${service.name}&fields=*`,
      'serviceDetails'
    );
    interceptURL(
      'GET',
      `/api/v1/services/ingestionPipelines?fields=*&service=${service.name}`,
      'ingestionPipelines'
    );
    cy.login();
    // redirecting to services page

    cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();

    cy.get('[data-testid="settings-left-panel"]')
      .contains('Database')
      .should('be.visible')
      .click();
  });

  it('Update service description', () => {
    cy.get(`[data-testid="service-name-${service.name}"]`)
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@serviceDetails', 200);
    verifyResponseStatusCode('@ingestionPipelines', 200);
    verifyResponseStatusCode('@pipelineServiceClient', 200);
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
    cy.get(`[data-testid="service-name-${service.name}"]`)
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@serviceDetails', 200);
    verifyResponseStatusCode('@ingestionPipelines', 200);
    verifyResponseStatusCode('@pipelineServiceClient', 200);
    interceptURL(
      'GET',
      '/api/v1/search/query?q=*%20AND%20teamType:Group&from=0&size=15&index=team_search_index',
      'editOwner'
    );
    cy.get('[data-testid="edit-owner"]')
      .should('exist')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@editOwner', 200);

    cy.get('.select-owner-tabs')
      .contains('Users')
      .should('exist')
      .should('be.visible')
      .click();

    interceptURL('PUT', '/api/v1/services/databaseServices', 'updateService');

    cy.get('[data-testid="selectable-list"]')
      .contains(service.Owner)
      .scrollIntoView()
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@updateService', 200);

    cy.get('[data-testid="owner-dropdown"]').should('have.text', service.Owner);
    // Checking if description exists after assigning the owner
    cy.get(':nth-child(1) > .link-title').click();
    // need wait here

    cy.get('[data-testid="viewer-container"]').contains(service.newDescription);
  });

  it('Remove owner from service', () => {
    interceptURL(
      'GET',
      '/api/v1/search/query?q=*teamType:Group&from=0&size=15&index=team_search_index',
      'editOwner'
    );
    cy.get(`[data-testid="service-name-${service.name}"]`)
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@serviceDetails', 200);
    verifyResponseStatusCode('@ingestionPipelines', 200);
    verifyResponseStatusCode('@pipelineServiceClient', 200);

    cy.get('[data-testid="edit-owner"]')
      .should('exist')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@editOwner', 200);

    cy.get('.select-owner-tabs')
      .contains('Users')
      .should('exist')
      .should('be.visible')
      .click();

    interceptURL('PATCH', '/api/v1/services/databaseServices/*', 'removeOwner');
    cy.get('[data-testid="selectable-list"]')
      .eq(1)
      .contains(service.Owner)
      .should('be.visible');

    cy.get('[data-testid="remove-owner"]')
      .should('exist')
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@removeOwner', 200);

    // Check if Owner exist
    cy.get('[data-testid="entity-summary-details"]')
      .scrollIntoView()
      .should('exist')
      .contains('No Owner');
  });
});
