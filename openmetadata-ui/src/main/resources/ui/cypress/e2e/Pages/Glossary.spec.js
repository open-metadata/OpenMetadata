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

// / <reference types="Cypress" />
import {
  descriptionBox,
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import {
  DELETE_TERM,
  GLOSSARY_TERM_WITH_DETAILS,
  NEW_GLOSSARY,
  NEW_GLOSSARY_1,
  NEW_GLOSSARY_1_TERMS,
  NEW_GLOSSARY_TERMS,
  SEARCH_ENTITY_TABLE,
} from '../../constants/constants';

const visitGlossaryTermPage = (termName) => {
  cy.get(`[data-row-key="${termName}"]`)
    .scrollIntoView()
    .should('be.visible')
    .contains(termName)
    .should('be.visible')
    .click();
  cy.get('.ant-tabs [id*=tab-summary]').should('be.visible').click();
};

const fillGlossaryTermDetails = (term, glossary, isMutually = false) => {
  cy.get('[data-testid="breadcrumb-link"]')
    .scrollIntoView()
    .should('exist')
    .and('be.visible')
    .contains(glossary.name)
    .should('exist');
  cy.get('[data-testid="add-new-tag-button"]').should('be.visible').click();

  cy.contains('Add Glossary Term').should('be.visible');
  cy.get('[data-testid="name"]')
    .scrollIntoView()
    .should('be.visible')
    .type(term.name);
  cy.get(descriptionBox)
    .scrollIntoView()
    .should('be.visible')
    .type(term.description);
  cy.get('[data-testid="synonyms"]')
    .scrollIntoView()
    .should('be.visible')
    .type(term.synonyms);
  if (isMutually) {
    cy.get('[data-testid="mutually-exclusive-button"]')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .click();
  }
  cy.get('[data-testid="references"] > .ant-space-item > .button-comp')
    .scrollIntoView()
    .should('be.visible')
    .click();

  cy.get('#name-0').scrollIntoView().should('be.visible').type('test');
  cy.get('#url-0')
    .scrollIntoView()
    .should('be.visible')
    .type('https://test.com');
};

const createGlossaryTerm = (term, glossary, isMutually = false) => {
  fillGlossaryTermDetails(term, glossary, isMutually);

  interceptURL('POST', '/api/v1/glossaryTerms', 'createGlossaryTerms');
  cy.get('[data-testid="save-glossary-term"]')
    .scrollIntoView()
    .should('be.visible')
    .click();

  cy.get(`[data-row-key="${term.name}"]`)
    .scrollIntoView()
    .should('be.visible')
    .contains(term.name)
    .should('be.visible');
};

const deleteGlossaryTerm = ({ name }) => {
  visitGlossaryTermPage(name);
  cy.wait(500);
  cy.get('[data-testid="inactive-link"]').contains(name).should('be.visible');

  cy.get('[data-testid="manage-button"]').should('be.visible').click();
  cy.get('[data-testid="delete-button"]')
    .scrollIntoView()
    .should('be.visible')
    .click();

  cy.get('[data-testid="delete-confirmation-modal"]')
    .should('exist')
    .then(() => {
      cy.get('[role="dialog"]').should('be.visible');
      cy.get('[data-testid="modal-header"]').should('be.visible');
    });
  cy.get('[data-testid="modal-header"]')
    .should('be.visible')
    .should('contain', `Delete ${name}`);
  cy.get('[data-testid="confirmation-text-input"]')
    .should('be.visible')
    .type(DELETE_TERM);

  cy.get('[data-testid="confirm-button"]')
    .should('be.visible')
    .should('not.disabled')
    .click();

  toastNotification('Glossary term deleted successfully!');
  cy.get('[data-testid="delete-confirmation-modal"]').should('not.exist');
  cy.get('[data-testid="glossary-left-panel"]')
    .should('be.visible')
    .should('not.contain', name);
};

const goToAssetsTab = (term) => {
  visitGlossaryTermPage(term);
  cy.wait(500);
  cy.get('[data-testid="inactive-link"]').contains(term).should('be.visible');
  cy.get('[data-testid="assets"]').should('be.visible').click();
  cy.get('.ant-tabs-tab-active').contains('Assets').should('be.visible');
};

describe('Glossary page should work properly', () => {
  beforeEach(() => {
    cy.login();

    interceptURL('GET', '/api/v1/glossaryTerms*', 'getGlossaryTerms');
    interceptURL('GET', '/api/v1/glossaries?fields=*', 'fetchGlossaries');
    cy.get('[data-testid="governance"]')
      .should('exist')
      .and('be.visible')
      .click({ animationDistanceThreshold: 20 });

    // Clicking on Glossary
    cy.get('.ant-dropdown-menu')
      .should('exist')
      .and('be.visible')
      .then(($el) => {
        cy.wrap($el)
          .find('[data-testid="appbar-item-glossary"]')
          .should('exist')
          .and('be.visible')
          .click();
      });
  });

  it('Create new glossary flow should work properly', () => {
    interceptURL('POST', '/api/v1/glossaries', 'createGlossary');

    // check for no data placeholder
    cy.get('[data-testid="add-glossary"]').should('be.visible').click();

    // Redirecting to add glossary page
    cy.get('[data-testid="form-heading"]')
      .contains('Add Glossary')
      .should('be.visible');

    cy.get('[data-testid="name"]')
      .scrollIntoView()
      .should('be.visible')
      .type(NEW_GLOSSARY.name);

    cy.get(descriptionBox)
      .scrollIntoView()
      .should('be.visible')
      .type(NEW_GLOSSARY.description);

    cy.get('[data-testid="mutually-exclusive-button"]')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .click();
    interceptURL('GET', '/api/v1/tags?limit=1000', 'fetchTags');
    cy.get('[data-testid="tags-container"] .ant-select-selection-overflow')
      .scrollIntoView()
      .should('be.visible')
      .type('PersonalData.Personal');
    verifyResponseStatusCode('@fetchTags', 200);
    cy.get('[title="PersonalData.Personal"]').should('be.visible').click();
    cy.get('#right-panel').click();

    cy.get('[data-testid="add-reviewers"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('[data-testid="confirmation-modal"]')
      .should('exist')
      .within(() => {
        cy.get('[role="dialog"]').should('be.visible');
      });

    interceptURL(
      'GET',
      '/api/v1/search/suggest?q=*&index=user_search_index',
      'getReviewer'
    );
    cy.get('[data-testid="searchbar"]')
      .should('be.visible')
      .type(NEW_GLOSSARY.reviewer);
    verifyResponseStatusCode('@getReviewer', 200);
    cy.get('[data-testid="user-card-container"]')
      .first()
      .should('be.visible')
      .as('reviewer');

    cy.get('@reviewer')
      .find('[data-testid="checkboxAddUser"]')
      .should('be.visible')
      .check();

    cy.get('[data-testid="save-button"]')
      .should('exist')
      .and('be.visible')
      .click();
    cy.get('[data-testid="delete-confirmation-modal"]').should('not.exist');
    cy.get('[data-testid="reviewers-container"]')
      .children()
      .should('have.length', 1);

    cy.get('[data-testid="save-glossary"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.wait('@createGlossary').then(({ request }) => {
      expect(request.body).to.have.all.keys(
        'description',
        'displayName',
        'mutuallyExclusive',
        'name',
        'owner',
        'reviewers',
        'tags'
      );
      expect(request.body.displayName).equals(NEW_GLOSSARY.name);
      expect(request.body.name).equals(NEW_GLOSSARY.name);
      expect(request.body.description).equals(NEW_GLOSSARY.description);
      expect(request.body.mutuallyExclusive).equals(true);
      expect(request.body.owner).to.have.all.keys('id', 'type');
      expect(request.body.reviewers).has.length(1);
      expect(request.body.tags).has.length(1);
      expect(request.body.tags[0]).to.deep.equal({
        labelType: 'Manual',
        state: 'Confirmed',
        tagFQN: 'PersonalData.Personal',
        source: 'Classification',
      });

      cy.url().should('include', '/glossary/');
      cy.get('[data-testid="breadcrumb-link"]')
        .scrollIntoView()
        .should('exist')
        .and('be.visible')
        .within(() => {
          cy.contains(NEW_GLOSSARY.name);
        });
    });

    // Adding another Glossary with mutually exclusive flag off
    cy.get('[data-testid="add-glossary"]').should('be.visible').click();
    cy.get('[data-testid="name"]')
      .scrollIntoView()
      .should('be.visible')
      .type(NEW_GLOSSARY_1.name);

    cy.get(descriptionBox)
      .scrollIntoView()
      .should('be.visible')
      .type(NEW_GLOSSARY_1.description);

    cy.get('[data-testid="save-glossary"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.wait('@createGlossary').then(({ request }) => {
      expect(request.body).to.have.all.keys(
        'description',
        'displayName',
        'mutuallyExclusive',
        'name',
        'owner',
        'reviewers',
        'tags'
      );
      expect(request.body.displayName).equals(NEW_GLOSSARY_1.name);
      expect(request.body.name).equals(NEW_GLOSSARY_1.name);
      expect(request.body.description).equals(NEW_GLOSSARY_1.description);
      expect(request.body.mutuallyExclusive).equals(false);
      expect(request.body.owner).to.have.all.keys('id', 'type');
      expect(request.body.reviewers).has.length(0);
      expect(request.body.tags).has.length(0);

      cy.url().should('include', '/glossary/');
      cy.get('[data-testid="breadcrumb-link"]')
        .scrollIntoView()
        .should('exist')
        .and('be.visible')
        .within(() => {
          cy.contains(NEW_GLOSSARY_1.name);
        });
    });
  });

  it('Search glossary in left panel', () => {
    cy.get('#left-panelV1').should('be.visible').as('leftPanel');
    cy.get('@leftPanel').contains(NEW_GLOSSARY.name).should('be.visible');
    cy.get('@leftPanel').contains(NEW_GLOSSARY_1.name).should('be.visible');
    cy.get('#left-panelV1 [data-testid="searchbar"]')
      .should('be.visible')
      .click()
      .type(NEW_GLOSSARY_1.name);
    cy.get('#left-panelV1').should('not.contain', NEW_GLOSSARY.name);
    cy.get('#left-panelV1').contains(NEW_GLOSSARY_1.name).should('be.visible');
  });

  it('Verify and Remove Tags from Glossary', () => {
    // Verify Tags which is added at the time of creating glossary
    cy.get('[data-testid="glossary-details"]')
      .contains('PersonalData.Personal')
      .should('be.visible');

    // Remove Tag
    cy.get('[data-testid="edit-tag-icon"]').should('be.visible').click();
    cy.get('.ant-select-selection-item-remove').should('be.visible').click();
    interceptURL('PATCH', '/api/v1/glossaries/*', 'updateGlossary');
    cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();
    verifyResponseStatusCode('@updateGlossary', 200);
    cy.get('[data-testid="glossary-details"]');
    cy.get('[data-testid="glossary-details"] [data-testid="tag-container"]')
      .contains('Add tag')
      .should('be.visible');
  });

  it('Verify added glossary details', () => {
    cy.get('[data-testid="glossary-left-panel"]')
      .contains(NEW_GLOSSARY.name)
      .should('be.visible');
    cy.get('[data-testid="header"]')
      .invoke('text')
      .then((text) => {
        expect(text).to.contain(NEW_GLOSSARY.name);
      });
    cy.get('[data-testid="viewer-container"]')
      .invoke('text')
      .then((text) => {
        expect(text).to.contain(NEW_GLOSSARY.description);
      });
    cy.get('[data-testid="reviewer-card-container"]').should('be.visible');

    cy.get(`[data-testid="reviewer-${NEW_GLOSSARY.reviewer}"]`)
      .invoke('text')
      .then((text) => {
        expect(text).to.contain(NEW_GLOSSARY.reviewer);
      });

    // Verify Product glossary details
    cy.get('.ant-menu-item')
      .contains(NEW_GLOSSARY_1.name)
      .should('be.visible')
      .click();

    cy.get('[data-testid="glossary-left-panel"]')
      .contains(NEW_GLOSSARY_1.name)
      .should('be.visible');
    cy.get('[data-testid="header"]')
      .invoke('text')
      .then((text) => {
        expect(text).to.contain(NEW_GLOSSARY_1.name);
      });
    cy.get('[data-testid="viewer-container"]')
      .invoke('text')
      .then((text) => {
        expect(text).to.contain(NEW_GLOSSARY_1.description);
      });
  });

  it('Create glossary term should work properly', () => {
    const terms = Object.values(NEW_GLOSSARY_TERMS);
    terms.forEach((term) => createGlossaryTerm(term, NEW_GLOSSARY, true));

    // Glossary term for Product glossary

    cy.get('.ant-menu-item')
      .contains(NEW_GLOSSARY_1.name)
      .should('be.visible')
      .click();

    const ProductTerms = Object.values(NEW_GLOSSARY_1_TERMS);
    ProductTerms.forEach((term) => createGlossaryTerm(term, NEW_GLOSSARY_1));
  });

  it('Updating data of glossary should work properly', () => {
    const newDescription = 'Updated description';
    // updating tags
    cy.get('[data-testid="tag-container"]')
      .should('exist')
      .and('be.visible')
      .within(() => {
        cy.get('[data-testid="add-tag"]')
          .should('exist')
          .and('be.visible')
          .click();
      });

    cy.get('[data-testid="tag-selector"]')
      .scrollIntoView()
      .should('be.visible')
      .type('personal');
    cy.get('.ant-select-item-option-content')
      .contains('PersonalData.Personal')
      .should('be.visible')
      .click();

    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    cy.get('[data-testid="glossary-details"]')
      .scrollIntoView()
      .contains('PersonalData.Personal')
      .should('be.visible');

    // updating description
    cy.get('[data-testid="edit-description"]').should('be.visible').click();
    cy.get('.ant-modal-wrap').should('be.visible');
    cy.get(descriptionBox).should('be.visible').as('description');

    cy.get('@description').clear();
    cy.get('@description').type(newDescription);

    interceptURL('PATCH', '/api/v1/glossaries/*', 'saveGlossary');
    cy.get('[data-testid="save"]').click();

    cy.get('.ant-modal-wrap').should('not.exist');

    verifyResponseStatusCode('@saveGlossary', 200);

    cy.get('[data-testid="viewer-container"]')
      .contains(newDescription)
      .should('be.visible');
  });

  it('Update glossary term synonyms', () => {
    const uSynonyms = ['pick up', 'take', 'obtain'];
    interceptURL(
      'GET',
      `/api/v1/glossaryTerms/name/*.${NEW_GLOSSARY_TERMS.term_1.name}?fields=*`,
      'getGlossaryTerm'
    );
    interceptURL(
      'GET',
      '/api/v1/permissions/glossaryTerm/*',
      'waitForTermPermission'
    );
    visitGlossaryTermPage(NEW_GLOSSARY_TERMS.term_1.name);

    verifyResponseStatusCode('@getGlossaryTerm', 200);
    verifyResponseStatusCode('@waitForTermPermission', 200);
    // updating synonyms
    cy.get('[data-testid="section-synonyms"]')
      .scrollIntoView()
      .should('be.visible');

    cy.wait(200);
    cy.get('[data-testid="section-synonyms"]')
      .find('[data-testid="edit-button"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('.ant-select-selector').should('be.visible');
    cy.get('.ant-select-clear > .anticon > svg')
      .should('exist')
      .click({ force: true });

    cy.get('.ant-select-selection-overflow')
      .should('exist')
      .type(uSynonyms.join('{enter}'));

    interceptURL('PATCH', '/api/v1/glossaryTerms/*', 'saveSynonyms');
    cy.get('[data-testid="save-btn"]').should('be.visible').click();
    verifyResponseStatusCode('@saveSynonyms', 200);

    cy.get('[data-testid="synonyms-container"]')
      .as('synonyms-container')
      .should('be.visible');

    uSynonyms.forEach((synonym) => {
      cy.get('@synonyms-container').contains(synonym).should('be.visible');
    });
  });

  it('Update glossary term reference and related terms', () => {
    const newRef = { name: 'take', url: 'https://take.com' };
    const term2 = NEW_GLOSSARY_TERMS.term_2.name;
    // Navigate to glossary term
    interceptURL(
      'GET',
      `/api/v1/glossaryTerms/name/*.${NEW_GLOSSARY_TERMS.term_1.name}?fields=*`,
      'getGlossaryTerm'
    );
    interceptURL(
      'GET',
      '/api/v1/permissions/glossaryTerm/*',
      'waitForTermPermission'
    );
    visitGlossaryTermPage(NEW_GLOSSARY_TERMS.term_1.name);
    verifyResponseStatusCode('@getGlossaryTerm', 200);
    verifyResponseStatusCode('@waitForTermPermission', 200);
    cy.get('[data-testid="section-references"]').should('be.visible');
    cy.wait(200);
    // updating References
    cy.get('[data-testid="section-references"]')
      .find('[data-testid="edit-button"]')
      .should('exist')
      .click();
    cy.get('[data-testid="add-button"]').should('be.visible').click();
    cy.get('#references_1_name').should('be.visible').type(newRef.name);
    cy.get('#references_1_endpoint').should('be.visible').type(newRef.url);
    interceptURL('PATCH', '/api/v1/glossaryTerms/*', 'saveGlossaryTermData');
    cy.get('[data-testid="save-btn"]').should('be.visible').click();
    verifyResponseStatusCode('@saveGlossaryTermData', 200);
    cy.get('[data-testid="references-container"]')
      .contains(newRef.name)
      .should('be.visible')
      .invoke('attr', 'href')
      .should('eq', newRef.url);

    // add relented term
    cy.get('[data-testid="section-related-terms"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="section-related-terms"] [data-testid="edit-button"]')
      .scrollIntoView()
      .should('be.visible')
      .click({ force: true });
    interceptURL(
      'GET',
      '/api/v1/search/query?q=*&from=0&size=10&index=glossary_search_index',
      'getGlossaryTerm'
    );
    cy.get('.ant-select-selection-overflow').should('be.visible').click();
    verifyResponseStatusCode('@getGlossaryTerm', 200);
    cy.get('.ant-select-item-option-content')
      .contains(term2)
      .should('be.visible')
      .click();

    cy.get('[data-testid="save-btn"]').should('be.visible').click();
    verifyResponseStatusCode('@saveGlossaryTermData', 200);

    cy.get('[data-testid="related-term-container"]')
      .contains(term2)
      .should('be.visible');
  });

  it('Updating description and tags of glossary term should work properly', () => {
    interceptURL('GET', '/api/v1/permissions/*/*', 'permissionApi');
    interceptURL('GET', '/api/v1/search/query?*', 'glossaryAPI');
    const term = NEW_GLOSSARY_TERMS.term_1.name;
    const newDescription = 'Updated description';
    visitGlossaryTermPage(term);
    verifyResponseStatusCode('@permissionApi', 200);
    verifyResponseStatusCode('@glossaryAPI', 200);

    // updating tags
    cy.get('[data-testid="tag-container"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('[data-testid="tag-selector"]')
      .scrollIntoView()
      .should('be.visible')
      .type('personal');
    cy.get('.ant-select-item-option-content')
      .contains('PersonalData.Personal')
      .should('be.visible')
      .click();

    interceptURL('PATCH', '/api/v1/glossaryTerms/*', 'saveData');
    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@saveData', 200);
    cy.get('[data-testid="glossary-term"]')
      .scrollIntoView()
      .contains('PersonalData.Personal')
      .should('be.visible');

    // updating description
    cy.get('[data-testid="edit-description"]').should('be.visible').click();
    cy.get('.ant-modal-wrap').should('be.visible');
    cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
      .should('be.visible')
      .as('description');
    cy.get('@description').clear();
    cy.get('@description').type(newDescription);
    cy.get('[data-testid="save"]').click();
    verifyResponseStatusCode('@saveData', 200);
    cy.get('.ant-modal-wrap').should('not.exist');

    cy.get('[data-testid="viewer-container"]')
      .contains(newDescription)
      .should('be.visible');

    cy.get('[data-testid="inactive-link"]').contains(term).should('be.visible');
  });

  it('Assets Tab should work properly', () => {
    const glossary = NEW_GLOSSARY.name;
    const term1 = NEW_GLOSSARY_TERMS.term_1.name;
    const term2 = NEW_GLOSSARY_TERMS.term_2.name;

    const glossary1 = NEW_GLOSSARY_1.name;
    const term3 = NEW_GLOSSARY_1_TERMS.term_1.name;
    const term4 = NEW_GLOSSARY_1_TERMS.term_2.name;

    const entity = SEARCH_ENTITY_TABLE.table_3;

    cy.get('.ant-menu-item')
      .contains(NEW_GLOSSARY_1.name)
      .should('be.visible')
      .click();

    goToAssetsTab(term3);
    cy.contains('No assets available.').should('be.visible');
    cy.get('[data-testid="no-data-image"]').should('be.visible');
    visitEntityDetailsPage(entity.term, entity.serviceName, entity.entity);

    // Add tag to breadcrumb
    cy.get('[data-testid="tag-container"] [data-testid="tags"]')
      .eq(0)
      .should('be.visible')
      .click();
    cy.get('[data-testid="tag-selector"]')
      .should('be.visible')
      .click()
      .type(`${glossary}.${term1}`);
    cy.get('.ant-select-item-option-content')
      .contains(term1)
      .should('be.visible')
      .click();
    cy.get(
      '[data-testid="tags-wrapper"] [data-testid="tag-container"]'
    ).contains(term1);

    cy.get('[data-testid="tag-selector"]')
      .should('be.visible')
      .click()
      .type(`${glossary}.${term2}`);
    cy.get('.ant-select-item-option-content')
      .contains(term2)
      .should('be.visible')
      .click();
    cy.get(
      '[data-testid="tags-wrapper"] [data-testid="tag-container"]'
    ).contains(term2);

    interceptURL('GET', '/api/v1/feed/count*', 'countTag');
    interceptURL('GET', '/api/v1/tags', 'tags');
    interceptURL('PATCH', '/api/v1/tables/*', 'saveTag');

    cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();
    verifyResponseStatusCode('@saveTag', 400);
    toastNotification(
      `Tag labels ${glossary}.${term2} and ${glossary}.${term1} are mutually exclusive and can't be assigned together`
    );

    // Add non mutually exclusive tags
    cy.get('[data-testid="tag-container"] [data-testid="tags"]')
      .eq(0)
      .should('be.visible')
      .click();

    cy.get('[data-testid="tag-selector"]')
      .should('be.visible')
      .click()
      .type(`${glossary1}.${term3}`);
    cy.get('.ant-select-item-option-content')
      .contains(term3)
      .should('be.visible')
      .click();
    cy.get(
      '[data-testid="tags-wrapper"] [data-testid="tag-container"]'
    ).contains(term3);

    cy.get('[data-testid="tag-selector"]')
      .should('be.visible')
      .click()
      .type(`${glossary1}.${term4}`);
    cy.get('.ant-select-item-option-content')
      .contains(term4)
      .should('be.visible')
      .click();
    cy.get(
      '[data-testid="tags-wrapper"] [data-testid="tag-container"]'
    ).contains(term4);

    cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();
    verifyResponseStatusCode('@saveTag', 200);
    verifyResponseStatusCode('@countTag', 200);
    cy.get('[data-testid="entity-tags"]')
      .scrollIntoView()
      .should('be.visible')
      .contains(term3);

    // Add tag to schema table
    cy.get(
      '[data-row-key="comments"] [data-testid="tags-wrapper"] [data-testid="tag-container"]'
    )
      .should('be.visible')
      .first()
      .click();

    cy.get('[data-testid="tag-selector"]')
      .should('be.visible')
      .click()
      .type(`${glossary1}.${term3}`);
    cy.get('.ant-select-item-option-content')
      .contains(term3)
      .should('be.visible')
      .click();

    cy.get(
      '[data-row-key="comments"] [data-testid="tags-wrapper"] [data-testid="tag-container"]'
    ).contains(term3);
    cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();
    verifyResponseStatusCode('@countTag', 200);
    cy.get(`[data-testid="tag-${glossary1}.${term3}"]`)
      .scrollIntoView()
      .should('be.visible')
      .contains(term3);

    cy.get('[data-testid="governance"]')
      .should('exist')
      .and('be.visible')
      .click();
    cy.get('[data-testid="appbar-item-glossary"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('.ant-menu-item')
      .contains(NEW_GLOSSARY_1.name)
      .should('be.visible')
      .click();
    goToAssetsTab(term3);

    cy.get(`[data-testid="${entity.serviceName}-${entity.term}"]`)
      .contains(entity.term)
      .should('be.visible');
  });

  it('Create glossaryTerm with tags, related terms, synonyms, references and reviewer & verify API payload', () => {
    interceptURL(
      'GET',
      '/api/v1/search/query?q=*&from=0&size=10&index=glossary_search_index',
      'searchGlossaryTerm'
    );
    interceptURL(
      'GET',
      '/api/v1/search/suggest?q=*&index=user_search_index',
      'searchReviewer'
    );
    interceptURL('GET', '/api/v1/users/*?fields=profile', 'getProfile');
    fillGlossaryTermDetails(GLOSSARY_TERM_WITH_DETAILS, NEW_GLOSSARY);
    // Add Tags
    interceptURL('GET', '/api/v1/tags?limit=1000', 'fetchTags');
    cy.get('[data-testid="tags-container"] .ant-select-selection-overflow')
      .scrollIntoView()
      .should('be.visible')
      .type(GLOSSARY_TERM_WITH_DETAILS.tag);
    verifyResponseStatusCode('@fetchTags', 200);
    cy.get(`[title="${GLOSSARY_TERM_WITH_DETAILS.tag}"]`)
      .should('be.visible')
      .click();
    cy.get('#right-panel').click();

    // Add Related terms
    cy.get('[data-testid="add-related-terms"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('.ant-modal-body').should('be.visible');
    cy.get('[data-testid="searchbar"]')
      .should('be.visible')
      .type(GLOSSARY_TERM_WITH_DETAILS.relatedTerms);
    cy.get('[data-testid="searchbar"]').should(
      'have.value',
      GLOSSARY_TERM_WITH_DETAILS.relatedTerms
    );
    verifyResponseStatusCode('@searchGlossaryTerm', 200);
    cy.wait(500); // adding manual wait for getting updated UI
    cy.get('[data-testid="user-card-container"]').should('be.visible');
    cy.get('[data-testid="checkboxAddUser"]').should('be.visible').click();
    cy.get('[data-testid="saveButton"]').should('be.visible').click();
    cy.get('.ant-modal-body').should('not.exist');

    // Add reviewer
    cy.get('[data-testid="add-reviewers"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('.ant-modal-body').should('be.visible');
    cy.get('[data-testid="searchbar"]')
      .should('be.visible')
      .type(GLOSSARY_TERM_WITH_DETAILS.reviewer);

    verifyResponseStatusCode('@searchGlossaryTerm', 200);
    cy.wait(500); // adding manual wait for getting updated UI
    cy.get('[data-testid="user-card-container"]').should('be.visible');
    cy.get('[data-testid="checkboxAddUser"]').should('be.visible').click();
    cy.get('[data-testid="save-button"]').should('be.visible').click();
    cy.get('.ant-modal-body').should('not.exist');

    interceptURL('POST', '/api/v1/glossaryTerms', 'createGlossaryTerms');
    cy.get('[data-testid="save-glossary-term"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.wait('@createGlossaryTerms').then(({ request }) => {
      const synonym = GLOSSARY_TERM_WITH_DETAILS.synonyms.split(',');

      expect(request.body).to.have.all.keys(
        'description',
        'displayName',
        'mutuallyExclusive',
        'name',
        'glossary',
        'references',
        'relatedTerms',
        'reviewers',
        'tags',
        'synonyms'
      );
      expect(request.body.displayName).equals(GLOSSARY_TERM_WITH_DETAILS.name);
      expect(request.body.name).equals(GLOSSARY_TERM_WITH_DETAILS.name);
      expect(request.body.description).equals(
        GLOSSARY_TERM_WITH_DETAILS.description
      );
      expect(request.body.mutuallyExclusive).equals(false);
      expect(request.body.glossary).equals(NEW_GLOSSARY.name);
      expect(request.body.reviewers).has.length(2);
      expect(request.body.references).has.length(1);
      expect(request.body.references[0]).to.have.all.keys('name', 'endpoint');
      expect(request.body.synonyms).has.length(synonym.length);
      expect(request.body.synonyms).to.deep.equal(synonym);
      expect(request.body.tags).has.length(1);
      expect(request.body.tags[0]).to.deep.equal({
        labelType: 'Manual',
        state: 'Confirmed',
        tagFQN: 'PersonalData.Personal',
        source: 'Classification',
      });
    });
  });

  it('Verify details of created glossaryTerm', () => {
    interceptURL(
      'GET',
      `/api/v1/glossaryTerms/name/*.${GLOSSARY_TERM_WITH_DETAILS.name}?fields=*`,
      'getGlossaryTerm'
    );
    interceptURL(
      'GET',
      '/api/v1/permissions/glossaryTerm/*',
      'waitForTermPermission'
    );
    visitGlossaryTermPage(GLOSSARY_TERM_WITH_DETAILS.name);

    verifyResponseStatusCode('@getGlossaryTerm', 200);
    verifyResponseStatusCode('@waitForTermPermission', 200);
    cy.get('[data-testid="glossary-term"] > :nth-child(1)')
      .scrollIntoView()
      .as('glossaryTermDetailsPanel');
    cy.get('@glossaryTermDetailsPanel').contains('admin').should('be.visible');
    cy.get('@glossaryTermDetailsPanel')
      .find(`[data-testid="reviewer-${GLOSSARY_TERM_WITH_DETAILS.reviewer}"]`)
      .should('be.visible');
    cy.get('@glossaryTermDetailsPanel')
      .find(
        `[data-testid="reviewer-${GLOSSARY_TERM_WITH_DETAILS.inheritedReviewer}"]`
      )
      .should('be.visible');
    cy.get('[data-testid="add-tag"]')
      .contains(GLOSSARY_TERM_WITH_DETAILS.tag)
      .should('be.visible');
  });

  it('Search GlossaryTerm functionality', () => {
    cy.get('[data-testid="glossary-left-panel"]')
      .contains(NEW_GLOSSARY.name)
      .should('be.visible');
    cy.get('[data-testid="header"]')
      .invoke('text')
      .then((text) => {
        expect(text).to.contain(NEW_GLOSSARY.name);
      });
    cy.get('[data-row-key="Accounts"]').should('be.visible');
    cy.get('[data-row-key="Purchase"]').should('be.visible');
    cy.get('[data-row-key="Sales"]').should('be.visible');
    cy.get('[data-testid="glossary-details"] [data-testid="searchbar"]')
      .should('be.visible')
      .type(GLOSSARY_TERM_WITH_DETAILS.name);
    cy.get('[data-row-key="Sales"]').should('not.exist');
    cy.get('[data-row-key="Accounts"]').should('be.visible');
    cy.get('[data-row-key="Purchase"]').should('not.exist');
  });

  it('Remove Glossary term from entity should work properly', () => {
    const glossaryName = NEW_GLOSSARY_1.name;
    const term = NEW_GLOSSARY_1_TERMS.term_1.name;
    const entity = SEARCH_ENTITY_TABLE.table_3;

    cy.get('.ant-menu-item')
      .contains(NEW_GLOSSARY_1.name)
      .should('be.visible')
      .click();

    interceptURL('GET', '/api/v1/search/query*', 'assetTab');
    // go assets tab
    goToAssetsTab(term);
    verifyResponseStatusCode('@assetTab', 200);

    interceptURL('GET', '/api/v1/feed*', 'entityDetails');
    cy.get(`[data-testid="${entity.serviceName}-${entity.term}"]`)
      .contains(entity.term)
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@entityDetails', 200);
    // redirect to entity detail page
    cy.get('[data-testid="entity-tags"]')
      .find('[data-testid="edit-button"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    // Remove all added tags from breadcrumb
    cy.get('.ant-select-selection-item-remove')
      .eq(0)
      .should('be.visible')
      .click();
    cy.wait(200);
    cy.get('.ant-select-selection-item-remove')
      .eq(0)
      .should('be.visible')
      .click();

    interceptURL('PATCH', '/api/v1/tables/*', 'removeTags');
    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@removeTags', 200);

    cy.get('[data-testid="entity-tags"]')
      .should('not.contain', term)
      .and('not.contain', 'Personal');
    // Remove the added column tag from entity
    interceptURL('PATCH', '/api/v1/tables/*', 'removeSchemaTags');
    cy.get(`[data-testid="remove-${glossaryName}.${term}-tag"]`)
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@removeSchemaTags', 200);

    cy.get('[data-testid="tags"]')
      .should('not.contain', term)
      .and('not.contain', 'Personal');

    cy.get('[data-testid="governance"]')
      .should('exist')
      .should('be.visible')
      .click();
    cy.get('[data-testid="appbar-item-glossary"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.wait(500);

    cy.get('.ant-menu-item')
      .contains(NEW_GLOSSARY_1.name)
      .should('be.visible')
      .click();

    goToAssetsTab(term);
    cy.contains('No assets available.').should('be.visible');
    cy.get('[data-testid="no-data-image"]').should('be.visible');
  });

  it('Delete glossary term should work properly', () => {
    const terms = Object.values(NEW_GLOSSARY_TERMS);

    terms.forEach(deleteGlossaryTerm);
    // Glossary term for Product glossary

    cy.get('.ant-menu-item')
      .contains(NEW_GLOSSARY_1.name)
      .should('be.visible')
      .click();

    Object.values(NEW_GLOSSARY_1_TERMS).forEach(deleteGlossaryTerm);
  });

  it('Delete glossary should work properly', () => {
    [NEW_GLOSSARY.name, NEW_GLOSSARY_1.name].forEach((glossary) => {
      verifyResponseStatusCode('@fetchGlossaries', 200);
      cy.wait(200);
      cy.get('[data-testid="header"]')
        .should('be.visible')
        .contains(glossary)
        .should('exist');
      cy.get('[data-testid="manage-button"]').should('be.visible').click();
      cy.get('[data-testid="delete-button"]')
        .scrollIntoView()
        .should('be.visible')
        .click();

      cy.get('[data-testid="delete-confirmation-modal"]')
        .should('exist')
        .then(() => {
          cy.get('[role="dialog"]').should('be.visible');
          cy.get('[data-testid="modal-header"]').should('be.visible');
        });
      cy.get('[data-testid="modal-header"]')
        .should('be.visible')
        .should('contain', `Delete ${glossary}`);
      cy.get('[data-testid="confirmation-text-input"]')
        .should('be.visible')
        .type(DELETE_TERM);
      interceptURL('DELETE', '/api/v1/glossaries/*', 'getGlossary');
      cy.get('[data-testid="confirm-button"]')
        .should('be.visible')
        .should('not.disabled')
        .click();
      verifyResponseStatusCode('@getGlossary', 200);

      toastNotification('Glossary deleted successfully!');
    });
  });
});
