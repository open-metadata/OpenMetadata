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

// eslint-disable-next-line spaced-comment
/// <reference types="Cypress" />

import {
  descriptionBox,
  interceptURL,
  toastNotification,
  verifyMultipleResponseStatusCode,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import {
  DELETE_TERM,
  GLOSSARY_INVALID_NAMES,
  GLOSSARY_NAME_MAX_LENGTH_VALIDATION_ERROR,
  NAME_VALIDATION_ERROR,
  NEW_GLOSSARY,
  NEW_GLOSSARY_1,
  NEW_GLOSSARY_1_TERMS,
  NEW_GLOSSARY_TERMS,
  SEARCH_ENTITY_TABLE,
} from '../../constants/constants';

const visitGlossaryTermPage = (termName, fqn, fetchPermission) => {
  interceptURL(
    'GET',
    `/api/v1/glossaryTerms/name/*.${termName}?fields=*`,
    'getGlossaryTerm'
  );
  interceptURL(
    'GET',
    '/api/v1/permissions/glossaryTerm/*',
    'waitForTermPermission'
  );

  cy.get(`[data-row-key="${fqn}"]`)
    .scrollIntoView()
    .should('be.visible')
    .contains(termName)
    .should('be.visible')
    .click();

  verifyResponseStatusCode('@getGlossaryTerms', 200);
  // verifyResponseStatusCode('@glossaryAPI', 200);
  if (fetchPermission) {
    verifyResponseStatusCode('@waitForTermPermission', 200);
  }
  cy.get('.ant-tabs .glossary-overview-tab').should('be.visible').click();
};

const checkDisplayName = (displayName) => {
  cy.get('[data-testid="entity-header-display-name"]')
    .scrollIntoView()
    .should('exist')
    .and('be.visible')
    .within(() => {
      cy.contains(displayName);
    });
};

const validateForm = () => {
  // error messages
  cy.get('#name_help')
    .scrollIntoView()
    .should('be.visible')
    .contains('name is required');
  cy.get('#description_help')
    .should('be.visible')
    .contains('description is required');

  // max length validation
  cy.get('[data-testid="name"]')
    .scrollIntoView()
    .should('be.visible')
    .type(GLOSSARY_INVALID_NAMES.MAX_LENGTH);
  cy.get('#name_help')
    .should('be.visible')
    .contains(GLOSSARY_NAME_MAX_LENGTH_VALIDATION_ERROR);

  // with special char validation
  cy.get('[data-testid="name"]')
    .should('be.visible')
    .clear()
    .type(GLOSSARY_INVALID_NAMES.WITH_SPECIAL_CHARS);
  cy.get('#name_help').should('be.visible').contains(NAME_VALIDATION_ERROR);
};

const fillGlossaryTermDetails = (term, glossary, isMutually = false) => {
  checkDisplayName(glossary.name);
  cy.get('[data-testid="add-new-tag-button-header"]').click();

  cy.contains('Add Glossary Term').should('be.visible');

  // validation should work
  cy.get('[data-testid="save-glossary-term"]')
    .scrollIntoView()
    .should('be.visible')
    .click();

  validateForm();

  cy.get('[data-testid="name"]')
    .scrollIntoView()
    .should('be.visible')
    .clear()
    .type(term.name);
  cy.get(descriptionBox)
    .scrollIntoView()
    .should('be.visible')
    .type(term.description);

  const synonyms = term.synonyms.split(',');
  cy.get('[data-testid="synonyms"]')
    .scrollIntoView()
    .should('be.visible')
    .type(synonyms.join('{enter}'));
  if (isMutually) {
    cy.get('[data-testid="mutually-exclusive-button"]')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .click();
  }
  cy.get('[data-testid="add-reference"]')
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

  verifyResponseStatusCode('@createGlossaryTerms', 201);

  cy.get(`[data-row-key="${glossary.name}.${term.name}"]`)
    .scrollIntoView()
    .should('be.visible')
    .contains(term.name)
    .should('be.visible');
};

const deleteGlossaryTerm = ({ name, fullyQualifiedName }) => {
  visitGlossaryTermPage(name, fullyQualifiedName);

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

  toastNotification('Glossary Term deleted successfully!');
  cy.get('[data-testid="delete-confirmation-modal"]').should('not.exist');
  cy.get('[data-testid="glossary-left-panel"]')
    .should('be.visible')
    .should('not.contain', name);
};

const goToAssetsTab = (name, fqn, fetchPermission) => {
  visitGlossaryTermPage(name, fqn, fetchPermission);

  cy.get('[data-testid="assets"]').should('be.visible').click();
  cy.get('.ant-tabs-tab-active').contains('Assets').should('be.visible');
};

const selectActiveGlossary = (glossaryName) => {
  interceptURL('GET', '/api/v1/glossaryTerms*', 'getGlossaryTerms');
  cy.get('.ant-menu-item').contains(glossaryName).should('be.visible').click();
  verifyResponseStatusCode('@getGlossaryTerms', 200);
};

const updateSynonyms = (uSynonyms) => {
  cy.get('[data-testid="synonyms-container"]')
    .scrollIntoView()
    .should('be.visible');
  cy.get('[data-testid="synonyms-container"]')
    .find('[data-testid="edit-button"]', { timeout: 10000 })
    .scrollIntoView()
    .should('be.visible')
    .click();
  cy.get('[data-testid="synonyms-container"] .ant-select-selector')
    .should('be.visible')
    .find('.ant-select-selection-item-remove')
    .should('exist')
    .click({ force: true, multiple: true });
  cy.get('.ant-select-selection-overflow')
    .should('exist')
    .type(uSynonyms.join('{enter}'))
    .type('{enter}');

  interceptURL('PATCH', '/api/v1/glossaryTerms/*', 'saveSynonyms');
  cy.get('[data-testid="save-synonym-btn"]').should('be.visible').click();
  verifyResponseStatusCode('@saveSynonyms', 200);
  cy.get('[data-testid="synonyms-container"]')
    .as('synonyms-container')
    .should('be.visible');
  uSynonyms.forEach((synonym) => {
    cy.get('@synonyms-container').contains(synonym).should('be.visible');
  });
};

const updateTags = (inTerm) => {
  // visit glossary page
  interceptURL(
    'GET',
    '/api/v1/search/query?q=disabled%3Afalse&index=tag_search_index&from=0&size=10&query_filter=%7B%7D',
    'tags'
  );
  cy.get(
    '[data-testid="tags-input-container"] [data-testid="add-tag"]'
  ).click();

  verifyResponseStatusCode('@tags', 200);

  cy.get('[data-testid="tag-selector"]')
    .scrollIntoView()
    .should('be.visible')
    .type('personal');
  cy.get('[data-testid="tag-PersonalData.Personal"]').click();
  // to close popup
  cy.clickOutside();

  cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
  const container = inTerm
    ? '[data-testid="tags-input-container"]'
    : '[data-testid="glossary-details"]';
  cy.wait(1000);
  cy.get(container).scrollIntoView().contains('Personal').should('be.visible');
};

const updateTerms = (newTerm) => {
  interceptURL(
    'GET',
    '/api/v1/search/query?q=**&from=0&size=10&index=glossary_search_index',
    'getGlossaryTerm'
  );
  cy.get('[data-testid="related-term-container"]')
    .scrollIntoView()
    .should('be.visible');
  cy.get('[data-testid="related-term-add-button"]')
    .scrollIntoView()
    .should('be.visible')
    .click({ force: true });
  cy.get('.ant-select-selection-overflow').should('be.visible').click();
  verifyResponseStatusCode('@getGlossaryTerm', 200);
  cy.get('.ant-select-item-option-content')
    .contains(newTerm)
    .should('be.visible')
    .click();
  cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();
  verifyResponseStatusCode('@saveGlossaryTermData', 200);

  cy.get('[data-testid="related-term-container"]')
    .contains(newTerm)
    .should('be.visible');
};

const updateReferences = (newRef) => {
  cy.get('[data-testid="section-References"]')
    .find('[data-testid="edit-button"]')
    .should('exist')
    .click();
  cy.get('[data-testid="add-references-button"]').should('be.visible').click();
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
};

const updateDescription = (newDescription, isGlossary) => {
  if (isGlossary) {
    interceptURL('PATCH', '/api/v1/glossaries/*', 'saveGlossary');
  } else {
    interceptURL('PATCH', '/api/v1/glossaryTerms/*', 'saveData');
  }

  cy.get('[data-testid="edit-description"]').should('be.visible').click();
  cy.get('.ant-modal-wrap').should('be.visible');
  cy.get(descriptionBox).should('be.visible').as('description');
  cy.get('@description').clear();
  cy.get('@description').type(newDescription);
  cy.get('[data-testid="save"]').click();
  if (isGlossary) {
    verifyResponseStatusCode('@saveGlossary', 200);
  } else {
    verifyResponseStatusCode('@saveData', 200);
  }
  cy.get('.ant-modal-wrap').should('not.exist');

  cy.get('[data-testid="viewer-container"]')
    .contains(newDescription)
    .should('be.visible');
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
    cy.get('.govern-menu')
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
    interceptURL(
      'GET',
      '/api/v1/search/query?q=disabled%3Afalse&index=tag_search_index&from=0&size=10&query_filter=%7B%7D',
      'fetchTags'
    );

    // check for no data placeholder
    cy.get('[data-testid="add-placeholder-button"]')
      .should('be.visible')
      .click();

    // Redirecting to add glossary page
    cy.get('[data-testid="form-heading"]')
      .contains('Add Glossary')
      .should('be.visible');

    // validation should work
    cy.get('[data-testid="save-glossary"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    validateForm();

    cy.get('[data-testid="name"]')
      .scrollIntoView()
      .should('be.visible')
      .clear()
      .type(NEW_GLOSSARY.name);

    cy.get(descriptionBox)
      .scrollIntoView()
      .should('be.visible')
      .type(NEW_GLOSSARY.description);

    cy.get('[data-testid="mutually-exclusive-button"]')
      .scrollIntoView()
      .click();

    cy.get('[data-testid="tag-selector"] .ant-select-selection-overflow')
      .scrollIntoView()
      .type('Personal');
    verifyResponseStatusCode('@fetchTags', 200);
    cy.get('.ant-select-item-option-content').contains('Personal').click();
    cy.get('[data-testid="right-panel"]').click();

    cy.get('[data-testid="add-reviewers"]').scrollIntoView().click();

    cy.get('[data-testid="searchbar"]').type(NEW_GLOSSARY.reviewer);
    cy.get(`[title="${NEW_GLOSSARY.reviewer}"]`)
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('[data-testid="selectable-list-update-btn"]')
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
        'mutuallyExclusive',
        'name',
        'owner',
        'reviewers',
        'tags'
      );
      expect(request.body.name).equals(NEW_GLOSSARY.name);
      expect(request.body.description).equals(NEW_GLOSSARY.description);
      expect(request.body.mutuallyExclusive).equals(true);
      expect(request.body.owner).to.have.all.keys('id', 'type');
      expect(request.body.reviewers).has.length(1);
      expect(request.body.tags).has.length(1);
      expect(request.body.tags[0]).to.deep.equal({
        tagFQN: 'PersonalData.Personal',
        source: 'Classification',
      });

      cy.url().should('include', '/glossary/');

      checkDisplayName(NEW_GLOSSARY.name);
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
        'mutuallyExclusive',
        'name',
        'owner',
        'reviewers',
        'tags'
      );

      expect(request.body.name).equals(NEW_GLOSSARY_1.name);
      expect(request.body.description).equals(NEW_GLOSSARY_1.description);
      expect(request.body.mutuallyExclusive).equals(false);
      expect(request.body.owner).to.have.all.keys('id', 'type');
      expect(request.body.reviewers).has.length(0);
      expect(request.body.tags).has.length(0);

      cy.url().should('include', '/glossary/');
      checkDisplayName(NEW_GLOSSARY_1.name);
    });
  });

  it('Verify and Remove Tags from Glossary', () => {
    // Verify Tags which is added at the time of creating glossary
    cy.get('[data-testid="tags-container"]')
      .contains('Personal')
      .should('be.visible');

    // Remove Tag
    cy.get(
      '[data-testid="tags-input-container"] [data-testid="edit-button"]'
    ).click();

    cy.get('[data-testid="remove-tags"]').should('be.visible').click();
    interceptURL('PATCH', '/api/v1/glossaries/*', 'updateGlossary');
    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@updateGlossary', 200);
    cy.get('[data-testid="add-tag"]').should('be.visible');
  });

  it('Verify added glossary details', () => {
    cy.get('[data-testid="glossary-left-panel"]')
      .contains(NEW_GLOSSARY.name)
      .should('be.visible');

    checkDisplayName(NEW_GLOSSARY.name);

    cy.get('[data-testid="viewer-container"]')
      .invoke('text')
      .then((text) => {
        expect(text).to.contain(NEW_GLOSSARY.description);
      });

    cy.get(`[data-testid="glossary-reviewer-name"]`)
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

    selectActiveGlossary(NEW_GLOSSARY_1.name);

    checkDisplayName(NEW_GLOSSARY_1.name);
    cy.get('[data-testid="viewer-container"]')
      .invoke('text')
      .then((text) => {
        expect(text).to.contain(NEW_GLOSSARY_1.description);
      });
  });

  it('Create glossary term should work properly', () => {
    const terms = Object.values(NEW_GLOSSARY_TERMS);
    selectActiveGlossary(NEW_GLOSSARY.name);
    terms.forEach((term) => createGlossaryTerm(term, NEW_GLOSSARY, true));

    // Glossary term for Product glossary

    selectActiveGlossary(NEW_GLOSSARY_1.name);

    const ProductTerms = Object.values(NEW_GLOSSARY_1_TERMS);
    ProductTerms.forEach((term) => createGlossaryTerm(term, NEW_GLOSSARY_1));
  });

  it('Updating data of glossary should work properly', () => {
    // updating tags
    updateTags(false);

    // updating description
    updateDescription('Updated description', true);
  });

  it('Update glossary term', () => {
    const uSynonyms = ['pick up', 'take', 'obtain'];
    const newRef = { name: 'take', url: 'https://take.com' };
    const term2 = NEW_GLOSSARY_TERMS.term_2.name;
    const { name, fullyQualifiedName } = NEW_GLOSSARY_1_TERMS.term_1;

    // visit glossary page
    interceptURL('GET', `/api/v1/glossaryTerms?glossary=*`, 'glossaryTerm');
    interceptURL('GET', `/api/v1/permissions/glossary/*`, 'permissions');

    cy.get('.ant-menu-item')
      .contains(NEW_GLOSSARY_1.name)
      .should('be.visible')
      .click();
    verifyMultipleResponseStatusCode(['@glossaryTerm', '@permissions'], 200);

    // visit glossary term page
    interceptURL(
      'GET',
      `/api/v1/glossaryTerms/name/*?fields=*`,
      'glossaryTermDetails'
    );
    interceptURL('GET', `/api/v1/glossaryTerms?parent=*`, 'listGlossaryTerm');
    interceptURL(
      'GET',
      `/api/v1/permissions/glossaryTerm/*`,
      'glossaryTermPermission'
    );
    cy.get(`[data-row-key="${fullyQualifiedName}"]`)
      .contains(name)
      .should('be.visible')
      .click();
    verifyMultipleResponseStatusCode(
      ['@glossaryTermDetails', '@listGlossaryTerm', '@glossaryTermPermission'],
      200
    );
    cy.wait(5000); // adding manual wait as edit icon takes time to appear on screen
    // Updating synonyms
    updateSynonyms(uSynonyms);

    // Updating References
    updateReferences(newRef);

    // Updating Related terms
    updateTerms(term2);

    // updating tags
    // Some weired issue on terms, Term alread has an tag which causing failure
    // Will fix this later
    // updateTags(true);

    // updating description
    updateDescription('Updated description', false);
  });

  it('Assets Tab should work properly', () => {
    selectActiveGlossary(NEW_GLOSSARY.name);
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

    goToAssetsTab(
      NEW_GLOSSARY_1_TERMS.term_1.name,
      NEW_GLOSSARY_1_TERMS.term_1.fullyQualifiedName,
      true
    );
    cy.contains('Adding a new Asset is easy, just give it a spin!').should(
      'be.visible'
    );
    visitEntityDetailsPage(entity.term, entity.serviceName, entity.entity);

    // Add glossary tag to entity for mutually exclusive
    cy.get(
      '[data-testid="entity-right-panel"] [data-testid="glossary-container"] > [data-testid="entity-tags"]'
    ).click();
    // Select 1st term
    cy.get('[data-testid="tag-selector"]').click().type(term1);
    cy.get(`[data-testid="tag-${glossary}.${term1}"]`).click();
    cy.get('[data-testid="tag-selector"]').should('contain', term1);
    // Select 2nd term
    cy.get('[data-testid="tag-selector"]').click().type(term2);
    cy.get(`[data-testid="tag-${glossary}.${term2}"]`).click();
    cy.get('[data-testid="tag-selector"]').should('contain', term2);

    interceptURL('GET', '/api/v1/feed/count*', 'countTag');
    interceptURL('GET', '/api/v1/tags', 'tags');
    interceptURL('PATCH', '/api/v1/tables/*', 'saveTag');

    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView();
    cy.get('[data-testid="saveAssociatedTag"]').click();
    verifyResponseStatusCode('@saveTag', 400);
    toastNotification(
      `Tag labels ${glossary}.${term2} and ${glossary}.${term1} are mutually exclusive and can't be assigned together`
    );

    // Add non mutually exclusive tags
    cy.get(
      '[data-testid="entity-right-panel"] [data-testid="glossary-container"] > [data-testid="entity-tags"]'
    ).click();

    // Select 1st term
    cy.get('[data-testid="tag-selector"]').click().type(term3);

    cy.get(`[data-testid="tag-${glossary1}.${term3}"]`).click();
    cy.get('[data-testid="tag-selector"]').should('contain', term3);
    // Select 2nd term
    cy.get('[data-testid="tag-selector"]').click().type(term4);
    cy.get(`[data-testid="tag-${glossary1}.${term4}"]`).click();
    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@saveTag', 200);
    verifyResponseStatusCode('@countTag', 200);
    cy.get(
      '[data-testid="entity-right-panel"] [data-testid="glossary-container"]'
    )
      .scrollIntoView()
      .should('contain', term3)
      .should('contain', term4);

    // Add tag to schema table
    const firstColumn =
      '[data-testid="Glossary-tags-0"] > [data-testid="tags-wrapper"] > [data-testid="glossary-container"] > [data-testid="entity-tags"]';
    cy.get(firstColumn).scrollIntoView();
    cy.get(firstColumn).click();

    cy.get('[data-testid="tag-selector"]').click().type(term3);
    cy.get(
      `.ant-select-dropdown [data-testid="tag-${glossary1}.${term3}"]`
    ).click();

    cy.get('[data-testid="tag-selector"] > .ant-select-selector').contains(
      term3
    );
    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@countTag', 200);
    cy.get(
      '[data-testid="Glossary-tags-0"] > [data-testid="tags-wrapper"] > [data-testid="glossary-container"]'
    )
      .scrollIntoView()
      .should('contain', term3);

    cy.get('[data-testid="governance"]').click();
    cy.get('[data-testid="appbar-item-glossary"]').click();

    cy.get('.ant-menu-item').contains(NEW_GLOSSARY_1.name).click();

    goToAssetsTab(
      NEW_GLOSSARY_1_TERMS.term_1.name,
      NEW_GLOSSARY_1_TERMS.term_1.fullyQualifiedName,
      false
    );

    cy.get('[data-testid="entity-header-display-name"]')
      .contains(entity.term)
      .should('be.visible');
  });

  it('Remove Glossary term from entity should work properly', () => {
    const glossaryName = NEW_GLOSSARY_1.name;
    const { name, fullyQualifiedName } = NEW_GLOSSARY_1_TERMS.term_1;
    const entity = SEARCH_ENTITY_TABLE.table_3;

    selectActiveGlossary(NEW_GLOSSARY_1.name);

    interceptURL('GET', '/api/v1/search/query*', 'assetTab');
    // go assets tab
    goToAssetsTab(name, fullyQualifiedName);
    verifyResponseStatusCode('@assetTab', 200);

    interceptURL('GET', '/api/v1/feed*', 'entityDetails');

    cy.get('[data-testid="entity-header-display-name"]')
      .contains(entity.term)
      .click();
    verifyResponseStatusCode('@entityDetails', 200);

    // Remove all added tags
    cy.get(
      '[data-testid="entity-right-panel"] [data-testid="glossary-container"] [data-testid="edit-button"]'
    ).click();
    cy.get('[data-testid="remove-tags"]')
      .should('be.visible')
      .click({ multiple: true });

    interceptURL('PATCH', '/api/v1/tables/*', 'removeTags');
    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@removeTags', 200);

    // Remove the added column tag from entity
    interceptURL('PATCH', '/api/v1/tables/*', 'removeSchemaTags');

    cy.get(
      '[data-testid="Glossary-tags-0"] > [data-testid="tags-wrapper"] > [data-testid="glossary-container"]'
    )
      .scrollIntoView()
      .trigger('mouseover')
      .find('[data-testid="edit-button"]')
      .click();

    cy.get(
      `[data-testid="selected-tag-${glossaryName}.${name}"] [data-testid="remove-tags"`
    ).click();

    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@removeSchemaTags', 200);

    cy.get(
      '[data-testid="Glossary-tags-0"] > [data-testid="tags-wrapper"] > [data-testid="glossary-container"]'
    )
      .scrollIntoView()
      .should('not.contain', name)
      .and('not.contain', 'Personal');

    cy.get('[data-testid="governance"]').click();
    cy.get('[data-testid="appbar-item-glossary"]').click();

    selectActiveGlossary(NEW_GLOSSARY_1.name);

    goToAssetsTab(name, fullyQualifiedName);
    cy.contains('Adding a new Asset is easy, just give it a spin!').should(
      'be.visible'
    );
  });

  it('Delete glossary term should work properly', () => {
    const terms = Object.values(NEW_GLOSSARY_TERMS);
    selectActiveGlossary(NEW_GLOSSARY.name);
    terms.forEach(deleteGlossaryTerm);

    // Glossary term for Product glossary
    selectActiveGlossary(NEW_GLOSSARY_1.name);
    Object.values(NEW_GLOSSARY_1_TERMS).forEach(deleteGlossaryTerm);
  });

  it('Delete glossary should work properly', () => {
    [NEW_GLOSSARY.name, NEW_GLOSSARY_1.name].forEach((glossary) => {
      verifyResponseStatusCode('@fetchGlossaries', 200);
      cy.get('.ant-menu-item').contains(glossary).should('be.visible').click();

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
