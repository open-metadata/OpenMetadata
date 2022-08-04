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
import { uuid } from '../../common/common';

const webhookName = `Webhook-ct-test-${uuid()}`;

describe('Webooks Page', () => {
  beforeEach(() => {
    cy.visit('http://localhost:8585/settings', {
      failOnStatusCode: false,
    });
    cy.get('[data-testid="WhatsNewModalFeatures"]').should('be.visible');
    cy.get('[data-testid="closeWhatsNew"]').click();
    cy.get('[data-testid="WhatsNewModalFeatures"]').should('not.exist');
    cy.contains('Webhook')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .click();
  });

  it('Add webhook', () => {
    cy.get('[data-testid="add-webhook-button"]')
      .should('exist')
      .should('be.visible')
      .click();
    cy.get('[data-testid="name"]').should('exist').type(webhookName);
    cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
      .should('exist')
      .type('This is webhook description');
    cy.get('[data-testid="endpoint-url"]')
      .should('exist')
      .type('http://localhost:8585/add-webhook');
    cy.get('[data-testid="save-webhook"]')
      .should('exist')
      .should('be.visible')
      .click();
    cy.wait(1000);
    cy.get('[data-testid="webhook-data-card"]')
      .should('be.visible')
      .should('exist')
      .should('contain', webhookName);
  });

  it.skip('Edit Webhook description', () => {
    cy.contains(webhookName).should('exist').should('be.visible').click();
    cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
      .should('exist')
      .type('This is updated webhook description');
    cy.get('[data-testid="endpoint-url"]')
      .should('exist')
      .type('http://localhost:8585');
    cy.get('[data-testid="save-webhook"]')
      .should('exist')
      .should('be.visible')
      .click();
    cy.wait(1000);
    cy.get('[data-testid="markdown-parser"]').should(
      'contain',
      'This is updated webhook description'
    );
  });

  it('Delete webhook', () => {
    cy.contains(webhookName)
      .should('exist')
      .should('be.visible')
      .scrollIntoView()
      .click();
    cy.get('[data-testid="delete-webhook"]')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .click();
    cy.get('[data-testid="save-button"]')
      .should('exist')
      .should('be.visible')
      .click();
    cy.wait(1000);
    cy.contains(webhookName).should('not.exist');
  });
});
