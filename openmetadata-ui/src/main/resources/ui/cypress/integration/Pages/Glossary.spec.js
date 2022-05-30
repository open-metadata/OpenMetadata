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

import { DELETE_TERM, NEW_GLOSSARY, NEW_GLOSSARY_TERMS } from '../../constants/constants';

const createGlossaryTerm = (term) => {
  cy.get('[data-testid="header"]')
    .should('be.visible')
    .contains(NEW_GLOSSARY.name)
    .should('exist');
  cy.get('[data-testid="add-new-tag-button"]').should('be.visible').click();

  cy.contains('Add Glossary Term').should('be.visible');
  cy.get('[data-testid="name"]')
    .scrollIntoView()
    .should('be.visible')
    .type(term.name);
  cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
    .scrollIntoView()
    .should('be.visible')
    .type(term.description);
  cy.get('[data-testid="synonyms"]')
    .scrollIntoView()
    .should('be.visible')
    .type(term.synonyms);

  cy.get('[data-testid="references"] > .tw-flex > .button-comp')
    .scrollIntoView()
    .should('be.visible')
    .click();

  cy.get('#name-0').scrollIntoView().should('be.visible').type('test');
  cy.get('#url-0')
    .scrollIntoView()
    .should('be.visible')
    .type('https://test.com');

  cy.get('[data-testid="save-glossary-term"]')
    .scrollIntoView()
    .should('be.visible')
    .click();
  cy.wait(200);
  cy.get('#left-panel').contains(term.name).should('be.visible');
};

const deleteGlossaryTerm = ({ name }) => {
  cy.get('#left-panel').contains(name).should('be.visible').click();
  cy.wait(100);
  cy.get('[data-testid="inactive-link"]').contains(name).should('be.visible');

  cy.get('[data-testid="Manage"]').should('be.visible').click();
  cy.get('[data-testid="delete-button"]')
    .scrollIntoView()
    .should('be.visible')
    .click();

  cy.get('.tw-modal-container').should('be.visible');
  cy.get('[data-testid="confirmation-text-input"]')
    .should('be.visible')
    .type(DELETE_TERM);

  cy.get('[data-testid="confirm-button"]')
    .should('be.visible')
    .should('not.disabled')
    .click();
  cy.get('.Toastify__toast-body')
    .contains('Glossary Term deleted successfully!')
    .should('be.visible');

  cy.get('.Toastify__close-button > svg > path').should('be.visible').click();
  cy.wait(100);
};

describe('Glossary page should work properly', () => {
  beforeEach(() => {
    cy.goToHomePage();
    // redirecting to glossary page
    cy.get(
      '.tw-ml-5 > [data-testid="dropdown-item"] > div > [data-testid="menu-button"]'
    )
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('[data-testid="menu-item-Glossaries"]').should('be.visible').click();
    // Todo: need to remove below uncaught exception once tree-view error resolves
    cy.on('uncaught:exception', () => {
      // return false to prevent the error from
      // failing this test
      return false;
    });
  });

  it('Create new glossary flow should work properly', () => {
    // check for no data placeholder
    cy.contains('No glossaries found').should('be.visible');

    // Redirecting to add glossary page
    cy.get('[data-testid="add-webhook-button"]').should('be.visible').click();
    cy.get('#center > .tw-heading')
      .contains('Add Glossary')
      .should('be.visible');

    cy.get('[data-testid="name"]')
      .scrollIntoView()
      .should('be.visible')
      .type(NEW_GLOSSARY.name);

    cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
      .scrollIntoView()
      .should('be.visible')
      .type(NEW_GLOSSARY.description);

    cy.get('[data-testid="add-reviewers"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('.tw-modal-container').should('be.visible');

    cy.get('.tw-grid > [data-testid="user-card-container"]')
      .first()
      .should('be.visible')
      .as('reviewer');

    cy.get('@reviewer')
      .find('[data-testid="checkboxAddUser"]')
      .should('be.visible')
      .check();

    cy.get('[data-testid="saveButton"]').should('be.visible').click();
    cy.get('.tw-modal-container').should('not.exist');
    cy.get('[data-testid="reviewers-container"]')
      .children()
      .should('have.length', 1);

    cy.get('[data-testid="save-glossary"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('[data-testid="inactive-link"]')
      .should('be.visible')
      .invoke('text')
      .then((text) => {
        expect(text).to.equal(NEW_GLOSSARY.name);
      });
  });

  it('Create glossary term should work properly', () => {
    const terms = Object.values(NEW_GLOSSARY_TERMS);

    terms.forEach(createGlossaryTerm);
  });

  it('Delete glossary term should work properly', () => {
    const terms = Object.values(NEW_GLOSSARY_TERMS);

    terms.forEach(deleteGlossaryTerm);
  });

  it('Delete glossary should work properly', () => {
    cy.get('[data-testid="header"]')
      .should('be.visible')
      .contains(NEW_GLOSSARY.name)
      .should('exist');

    cy.get('[data-testid="delete-button"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('.tw-modal-container').should('be.visible');
    cy.get('[data-testid="confirmation-text-input"]')
      .should('be.visible')
      .type(DELETE_TERM);

    cy.get('[data-testid="confirm-button"]')
      .should('be.visible')
      .should('not.disabled')
      .click();

    cy.get('.Toastify__toast-body')
      .contains('Glossary deleted successfully!')
      .should('be.visible');
    cy.get('.Toastify__close-button > svg > path').should('be.visible').click();
    cy.wait(1000);
    cy.contains('No glossaries found').should('be.visible');
  });
});
