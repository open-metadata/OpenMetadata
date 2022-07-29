/*
 *  Copyright 2021 Collate
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

import { service } from '../../constants/constants';

const updateService = () => {
  cy.get('[data-testid="edit-description"]')
    .should('exist')
    .should('be.visible')
    .click({ force: true });
  cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
    .clear()
    .type(service.newDescription);
  cy.get('[data-testid="save"]').click();
  cy.get(
    '[data-testid="description"] > [data-testid="viewer-container"] > [data-testid="markdown-parser"] > :nth-child(1) > .toastui-editor-contents > p'
  ).contains(service.newDescription);
  cy.get(':nth-child(1) > .link-title').click();
  cy.get('.toastui-editor-contents > p').contains(service.newDescription);
};

const updateOwner = () => {
  cy.get('[data-testid="Manage"]').should('be.visible').click();

  cy.get('[data-testid="owner-dropdown"]')
    .should('exist')
    .should('be.visible')
    .click();
  cy.get('[data-testid="dropdown-list"] > .tw-flex > :nth-child(1)')
    .should('exist')
    .should('be.visible')
    .click();
  cy.get('[data-testid="list-item"]')
    .contains(service.Owner)
    .should('be.visible')
    .click();
  cy.get('[data-testid="owner-dropdown"]').should('have.text', service.Owner);
};

describe('Services page should work properly', () => {
  beforeEach(() => {
    // cy.goToHomePage();
    // //redirecting to services page
    // cy.get(
    //   '.tw-ml-5 > [data-testid="dropdown-item"] > div > [data-testid="menu-button"]'
    // )
    //   .scrollIntoView()
    //   .should('be.visible')
    //   .click();
    // cy.get('[data-testid="menu-item-Services"]').should('be.visible').click();
    cy.visit('http://localhost:8585/settings', { failOnStatusCode: false });

    cy.get('[data-testid="WhatsNewModalFeatures"]').should('be.visible');
    cy.get('[data-testid="closeWhatsNew"]').click();
    cy.get('[data-testid="WhatsNewModalFeatures"]').should('not.exist');
    cy.contains('Database').scrollIntoView().click();
  });

  it('Update service description', () => {
    cy.get(`[data-testid="service-name-${service.name}"]`)
      .should('be.visible')
      .click();
    cy.wait(1000);
    //need wait here
    updateService();
  });

  it('Update owner and check description', () => {
    cy.get(`[data-testid="service-name-${service.name}"]`)
      .should('be.visible')
      .click();
    cy.wait(1000);
    updateOwner();
    //Checking if description exists after assigning the owner
    cy.get(':nth-child(1) > .link-title').click();
    //need wait here
    cy.wait(1000);
    cy.get('[data-testid="viewer-container"]').contains(service.newDescription);
  });
});
