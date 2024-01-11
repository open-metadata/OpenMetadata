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
  deleteUser,
  descriptionBox,
  interceptURL,
  login,
  signupAndLogin,
  toastNotification,
  uuid,
  verifyMultipleResponseStatusCode,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import { deleteGlossary } from '../../common/GlossaryUtils';
import { addOwner, removeOwner } from '../../common/Utils/Owner';
import {
  COLUMN_NAME_FOR_APPLY_GLOSSARY_TERM,
  CYPRESS_ASSETS_GLOSSARY,
  CYPRESS_ASSETS_GLOSSARY_1,
  CYPRESS_ASSETS_GLOSSARY_TERMS,
  CYPRESS_ASSETS_GLOSSARY_TERMS_1,
  DELETE_TERM,
  INVALID_NAMES,
  NAME_MAX_LENGTH_VALIDATION_ERROR,
  NAME_VALIDATION_ERROR,
  NEW_GLOSSARY,
  NEW_GLOSSARY_1,
  NEW_GLOSSARY_1_TERMS,
  NEW_GLOSSARY_TERMS,
  SEARCH_ENTITY_TABLE,
} from '../../constants/constants';

const userName = `test_dataconsumer${uuid()}`;

const CREDENTIALS = {
  firstName: 'Cypress',
  lastName: 'UserDC',
  email: `${userName}@openmetadata.org`,
  password: 'User@OMD123',
  username: 'CypressUserDC',
};

let createdUserId = '';

const visitGlossaryTermPage = (termName, fqn, fetchPermission) => {
  interceptURL(
    'GET',
    `/api/v1/search/query?q=*&from=0&size=*&index=glossary_term_search_index`,
    'getGlossaryTerm'
  );
  interceptURL(
    'GET',
    '/api/v1/permissions/glossaryTerm/*',
    'waitForTermPermission'
  );

  cy.get(`[data-row-key="${Cypress.$.escapeSelector(fqn)}"]`)
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

const createGlossary = (glossaryData) => {
  // Intercept API calls
  interceptURL('POST', '/api/v1/glossaries', 'createGlossary');
  interceptURL(
    'GET',
    '/api/v1/search/query?q=*disabled:false&index=tag_search_index&from=0&size=10&query_filter=%7B%7D',
    'fetchTags'
  );

  // Click on the "Add Glossary" button
  cy.get('[data-testid="add-glossary"]').click();

  // Validate redirection to the add glossary page
  cy.get('[data-testid="form-heading"]')
    .contains('Add Glossary')
    .should('be.visible');

  // Perform glossary creation steps
  cy.get('[data-testid="save-glossary"]')
    .scrollIntoView()
    .should('be.visible')
    .click();

  validateForm();

  cy.get('[data-testid="name"]')
    .scrollIntoView()
    .should('be.visible')
    .clear()
    .type(glossaryData.name);

  cy.get(descriptionBox)
    .scrollIntoView()
    .should('be.visible')
    .type(glossaryData.description);

  if (glossaryData.isMutually) {
    cy.get('[data-testid="mutually-exclusive-button"]')
      .scrollIntoView()
      .click();
  }

  if (glossaryData.tag) {
    // Add tag
    cy.get('[data-testid="tag-selector"] .ant-select-selection-overflow')
      .scrollIntoView()
      .type(glossaryData.tag);

    verifyResponseStatusCode('@fetchTags', 200);
    cy.get(`[data-testid="tag-${glossaryData.tag}"]`).click();
    cy.get('[data-testid="right-panel"]').click();
  }

  if (glossaryData.addReviewer) {
    // Add reviewer
    cy.get('[data-testid="add-reviewers"]').scrollIntoView().click();
    cy.get('[data-testid="searchbar"]').type(CREDENTIALS.username);
    cy.get(`[title="${CREDENTIALS.username}"]`)
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('[data-testid="selectable-list-update-btn"]')
      .should('exist')
      .and('be.visible')
      .click();
  }

  cy.get('[data-testid="save-glossary"]')
    .scrollIntoView()
    .should('be.visible')
    .click();

  cy.wait('@createGlossary').then(({ request }) => {
    expect(request.body.name).equals(glossaryData.name);
    expect(request.body.description).equals(glossaryData.description);
  });

  cy.url().should('include', '/glossary/');
  checkDisplayName(glossaryData.name);
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

const checkAssetsCount = (assetsCount) => {
  cy.get('[data-testid="assets"] [data-testid="filter-count"]')
    .scrollIntoView()
    .should('have.text', assetsCount);
};

const validateForm = () => {
  // error messages
  cy.get('#name_help')
    .scrollIntoView()
    .should('be.visible')
    .contains('Name is required');
  cy.get('#description_help')
    .should('be.visible')
    .contains('Description is required');

  // max length validation
  cy.get('[data-testid="name"]')
    .scrollIntoView()
    .should('be.visible')
    .type(INVALID_NAMES.MAX_LENGTH);
  cy.get('#name_help')
    .should('be.visible')
    .contains(NAME_MAX_LENGTH_VALIDATION_ERROR);

  // with special char validation
  cy.get('[data-testid="name"]')
    .should('be.visible')
    .clear()
    .type(INVALID_NAMES.WITH_SPECIAL_CHARS);
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

  if (term.icon) {
    cy.get('[data-testid="icon-url"]').scrollIntoView().type(term.icon);
  }
  if (term.color) {
    cy.get('[data-testid="color-input"]').scrollIntoView().type(term.color);
  }

  // check for parent glossary reviewer
  if (glossary.name === NEW_GLOSSARY.name) {
    cy.get('[data-testid="user-tag"]')
      .contains(CREDENTIALS.username)
      .should('be.visible');
  }
};

const addAssetToGlossaryTerm = (glossaryTerm, glossary) => {
  goToGlossaryPage();
  selectActiveGlossary(glossary.name);
  goToAssetsTab(glossaryTerm.name, glossaryTerm.fullyQualifiedName, true);

  checkAssetsCount(0);
  cy.contains('Adding a new Asset is easy, just give it a spin!').should(
    'be.visible'
  );

  cy.get('[data-testid="glossary-term-add-button-menu"]').click();
  cy.get('.ant-dropdown-menu .ant-dropdown-menu-title-content')
    .contains('Assets')
    .click();

  cy.get('[data-testid="asset-selection-modal"] .ant-modal-title').should(
    'contain',
    'Add Assets'
  );

  glossaryTerm.assets.forEach((asset) => {
    interceptURL('GET', '/api/v1/search/query*', 'searchAssets');
    cy.get('[data-testid="asset-selection-modal"] [data-testid="searchbar"]')
      .click()
      .clear()
      .type(asset.name);

    verifyResponseStatusCode('@searchAssets', 200);

    cy.get(
      `[data-testid="table-data-card_${asset.fullyQualifiedName}"] input[type="checkbox"]`
    ).click();
  });

  cy.get('[data-testid="save-btn"]').click();
  checkAssetsCount(glossaryTerm.assets.length);
};

const removeAssetsFromGlossaryTerm = (glossaryTerm, glossary) => {
  goToGlossaryPage();
  selectActiveGlossary(glossary.name);
  goToAssetsTab(glossaryTerm.name, glossaryTerm.fullyQualifiedName, true);
  checkAssetsCount(glossaryTerm.assets.length);
  glossaryTerm.assets.forEach((asset, index) => {
    interceptURL('GET', '/api/v1/search/query*', 'searchAssets');
    cy.get(`[data-testid="manage-button-${asset.fullyQualifiedName}"]`).click();
    cy.get('[data-testid="delete-button"]').click();
    cy.get("[data-testid='save-button']").click();

    cy.get('[data-testid="overview"]').click();
    cy.get('[data-testid="assets"]').click();

    // go assets tab
    verifyResponseStatusCode('@searchAssets', 200);

    checkAssetsCount(glossaryTerm.assets.length - (index + 1));
  });
};

const createGlossaryTerm = (term, glossary, status, isMutually = false) => {
  fillGlossaryTermDetails(term, glossary, isMutually);

  interceptURL('POST', '/api/v1/glossaryTerms', 'createGlossaryTerms');
  cy.get('[data-testid="save-glossary-term"]')
    .scrollIntoView()
    .should('be.visible')
    .click();

  verifyResponseStatusCode('@createGlossaryTerms', 201);

  cy.get(
    `[data-row-key="${Cypress.$.escapeSelector(term.fullyQualifiedName)}"]`
  )
    .scrollIntoView()
    .should('be.visible')
    .contains(term.name);

  cy.get(
    `[data-testid="${Cypress.$.escapeSelector(
      term.fullyQualifiedName
    )}-status"]`
  )
    .should('be.visible')
    .contains(status);
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
  cy.get('.ant-menu-item').contains(glossaryName).click();
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
  cy.get('[data-testid="save-synonym-btn"]').should('be.visible').click();
  verifyResponseStatusCode('@saveGlossaryTermData', 200);
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
    '/api/v1/search/query?q=*&index=tag_search_index&from=0&size=*&query_filter=*',
    'tags'
  );
  cy.get('[data-testid="tags-container"] [data-testid="add-tag"]').click();

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
    ? '[data-testid="tags-container"]'
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
  cy.get('.ant-select-selection-overflow')
    .should('be.visible')
    .click()
    .type(newTerm);
  verifyResponseStatusCode('@getGlossaryTerm', 200);
  cy.get('.ant-select-item-option-content').contains(newTerm).click();
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

const upVoting = (api) => {
  cy.get('[data-testid="up-vote-btn"]').click();

  cy.wait(api).then(({ request, response }) => {
    expect(request.body.updatedVoteType).to.equal('votedUp');

    expect(response.statusCode).to.equal(200);
  });

  cy.get('[data-testid="up-vote-count"]').contains(1);
};

const downVoting = (api) => {
  cy.get('[data-testid="down-vote-btn"]').click();

  cy.wait(api).then(({ request, response }) => {
    expect(request.body.updatedVoteType).to.equal('votedDown');

    expect(response.statusCode).to.equal(200);
  });

  cy.get('[data-testid="down-vote-count"]').contains(1);

  // after voting down, the selected up-voting will cancel and count goes down
  cy.get('[data-testid="up-vote-count"]').contains(0);
};

// goes to initial stage after down voting glossary or glossary term
const initialVoting = (api) => {
  cy.get('[data-testid="down-vote-btn"]').click();

  cy.wait(api).then(({ request, response }) => {
    expect(request.body.updatedVoteType).to.equal('unVoted');

    expect(response.statusCode).to.equal(200);
  });

  cy.get('[data-testid="up-vote-count"]').contains(0);
  cy.get('[data-testid="down-vote-count"]').contains(0);
};

const voteGlossary = (isGlossary) => {
  if (isGlossary) {
    interceptURL('PUT', '/api/v1/glossaries/*/vote', 'voteGlossary');
  } else {
    interceptURL('PUT', '/api/v1/glossaryTerms/*/vote', 'voteGlossaryTerm');
  }
  upVoting(isGlossary ? '@voteGlossary' : '@voteGlossaryTerm');

  downVoting(isGlossary ? '@voteGlossary' : '@voteGlossaryTerm');

  initialVoting(isGlossary ? '@voteGlossary' : '@voteGlossaryTerm');
};

const goToGlossaryPage = () => {
  interceptURL('GET', '/api/v1/glossaryTerms*', 'getGlossaryTerms');
  interceptURL('GET', '/api/v1/glossaries?fields=*', 'fetchGlossaries');
  cy.get('[data-testid="governance"]').click({
    animationDistanceThreshold: 20,
  });

  // Clicking on Glossary
  cy.get('.govern-menu').then(($el) => {
    cy.wrap($el)
      .find('[data-testid="app-bar-item-glossary"]')
      .click({ force: true });
  });
};

const approveGlossaryTermWorkflow = ({ glossary, glossaryTerm }) => {
  goToGlossaryPage();

  selectActiveGlossary(glossary.name);

  const { name, fullyQualifiedName } = glossaryTerm;

  visitGlossaryTermPage(name, fullyQualifiedName);

  cy.get('[data-testid="activity_feed"]').click();

  interceptURL('GET', '/api/v1/feed*', 'activityFeed');

  cy.get('[data-testid="global-setting-left-panel"]').contains('Tasks').click();

  verifyResponseStatusCode('@activityFeed', 200);

  interceptURL('PUT', '/api/v1/feed/tasks/*/resolve', 'resolveTask');

  cy.get('[data-testid="approve-task"]').click();

  verifyResponseStatusCode('@resolveTask', 200);

  // Verify toast notification
  toastNotification('Task resolved successfully');

  verifyResponseStatusCode('@activityFeed', 200);

  goToGlossaryPage();
  selectActiveGlossary(glossary.name);

  cy.get(`[data-testid="${fullyQualifiedName}-status"]`)
    .should('be.visible')
    .contains('Approved');
};

const addGlossaryTermsInEntityField = ({
  entityTerm,
  entityField,
  glossaryTerms,
}) => {
  const glossaryContainer = `[data-row-key$="${entityTerm}.${entityField}"] [data-testid="glossary-container"]`;

  cy.get(`${glossaryContainer} [data-testid="entity-tags"] .ant-tag`)
    .scrollIntoView()
    .click();

  const tagSelector = `${glossaryContainer} [data-testid="tag-selector"]`;
  cy.get(tagSelector).click();

  glossaryTerms.forEach((term) => {
    cy.get(`${tagSelector} .ant-select-selection-search input`).type(term.name);

    cy.get(
      `.ant-select-dropdown [data-testid='tag-${term.fullyQualifiedName}']`
    ).click();
    cy.get(`[data-testid="selected-tag-${term.fullyQualifiedName}"]`).should(
      'exist'
    );
  });

  cy.get('[data-testid="saveAssociatedTag"]').click();
};

const checkTagsSortingAndHighlighting = ({ termFQN }) => {
  cy.get('[data-testid="tags-viewer"] [data-testid="tags"]')
    .first()
    .as('firstTag');

  cy.get('@firstTag').within(() => {
    cy.get(`[data-testid="tag-${termFQN}"]`).should('exist');
  });
  cy.get('@firstTag').should('have.class', 'tag-highlight');
};

const checkSummaryListItemSorting = ({ termFQN, columnName }) => {
  cy.get('#right-panelV1 [data-testid="summary-list"]')
    .as('summaryList')
    .scrollIntoView();

  cy.get('@summaryList').within(() => {
    cy.get('[data-testid="summary-list-item"]')
      .first()
      .within(() => {
        cy.get('[data-testid="entity-title"]')
          .first() // checking for first entity title as collapse type will have more then 1 entity-title present
          .should('have.text', columnName);

        checkTagsSortingAndHighlighting({ termFQN });
      });
  });
};

describe('Prerequisites', () => {
  it('Create a user with data consumer role', () => {
    signupAndLogin(
      CREDENTIALS.email,
      CREDENTIALS.password,
      CREDENTIALS.firstName,
      CREDENTIALS.lastName
    ).then((id) => {
      createdUserId = id;
    });
  });
});

describe('Glossary page should work properly', () => {
  beforeEach(() => {
    interceptURL('PATCH', '/api/v1/glossaryTerms/*', 'saveGlossaryTermData');
    cy.login();
    goToGlossaryPage();
  });

  it('Create new glossary flow should work properly', () => {
    createGlossary(NEW_GLOSSARY);
    createGlossary(NEW_GLOSSARY_1);
  });

  it('Assign Owner', () => {
    cy.get('[data-testid="glossary-left-panel"]')
      .contains(NEW_GLOSSARY.name)
      .click();

    checkDisplayName(NEW_GLOSSARY.name);
    addOwner(CREDENTIALS.username);
  });

  it('Update Owner', () => {
    cy.get('[data-testid="glossary-left-panel"]')
      .contains(NEW_GLOSSARY.name)
      .click();

    checkDisplayName(NEW_GLOSSARY.name);
    addOwner('Aaron Johnson');
  });

  it('Remove Owner', () => {
    cy.get('[data-testid="glossary-left-panel"]')
      .contains(NEW_GLOSSARY.name)
      .click();

    checkDisplayName(NEW_GLOSSARY.name);
    removeOwner('Aaron Johnson');
  });

  it('Verify and Remove Tags from Glossary', () => {
    cy.get('[data-testid="glossary-left-panel"]')
      .contains(NEW_GLOSSARY.name)
      .click();

    checkDisplayName(NEW_GLOSSARY.name);
    // Verify Tags which is added at the time of creating glossary
    cy.get('[data-testid="tags-container"]')
      .contains('Personal')
      .should('be.visible');

    // Remove Tag
    cy.get(
      '[data-testid="tags-container"] [data-testid="edit-button"]'
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
      .click();

    checkDisplayName(NEW_GLOSSARY.name);

    cy.get('[data-testid="viewer-container"]')
      .invoke('text')
      .then((text) => {
        expect(text).to.contain(NEW_GLOSSARY.description);
      });

    cy.get(`[data-testid="glossary-reviewer-name"]`)
      .invoke('text')
      .then((text) => {
        expect(text).to.contain(CREDENTIALS.username);
      });

    // Verify Product glossary details
    cy.get('.ant-menu-item').contains(NEW_GLOSSARY_1.name).click();

    cy.get('[data-testid="glossary-left-panel"]')
      .contains(NEW_GLOSSARY_1.name)
      .should('be.visible')
      .scrollIntoView();

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
    terms.forEach((term) =>
      createGlossaryTerm(term, NEW_GLOSSARY, 'Draft', true)
    );

    // Glossary term for Product glossary
    selectActiveGlossary(NEW_GLOSSARY_1.name);

    const ProductTerms = Object.values(NEW_GLOSSARY_1_TERMS);
    ProductTerms.forEach((term) =>
      createGlossaryTerm(term, NEW_GLOSSARY_1, 'Approved', false)
    );
  });

  it('Approval Workflow for Glossary Term', () => {
    cy.logout();

    login(CREDENTIALS.email, CREDENTIALS.password);
    approveGlossaryTermWorkflow({
      glossary: NEW_GLOSSARY,
      glossaryTerm: NEW_GLOSSARY_TERMS.term_1,
    });
    approveGlossaryTermWorkflow({
      glossary: NEW_GLOSSARY,
      glossaryTerm: NEW_GLOSSARY_TERMS.term_2,
    });
    cy.logout();
    Cypress.session.clearAllSavedSessions();
    cy.login();
  });

  it('Updating data of glossary should work properly', () => {
    cy.get('[data-testid="glossary-left-panel"]')
      .contains(NEW_GLOSSARY.name)
      .click();

    checkDisplayName(NEW_GLOSSARY.name);

    // Updating owner
    addOwner(CREDENTIALS.username);

    // updating tags
    updateTags(false);

    // updating description
    updateDescription('Updated description', true);

    voteGlossary(true);
  });

  it('Update glossary term', () => {
    const uSynonyms = ['pick up', 'take', 'obtain'];
    const newRef = { name: 'take', url: 'https://take.com' };
    const term2 = NEW_GLOSSARY_TERMS.term_2.name;
    const { name, fullyQualifiedName } = NEW_GLOSSARY_1_TERMS.term_1;

    // visit glossary page
    interceptURL('GET', `/api/v1/glossaryTerms?glossary=*`, 'glossaryTerm');
    interceptURL('GET', `/api/v1/permissions/glossary/*`, 'permissions');

    cy.get('.ant-menu-item').contains(NEW_GLOSSARY_1.name).click();
    verifyMultipleResponseStatusCode(['@glossaryTerm', '@permissions'], 200);

    // visit glossary term page
    visitGlossaryTermPage(name, fullyQualifiedName);

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

    // updating voting for glossary term
    voteGlossary();
  });

  it('Request Tags workflow for Glossary', function () {
    cy.get('[data-testid="glossary-left-panel"]')
      .contains(NEW_GLOSSARY_1.name)
      .click();

    interceptURL(
      'GET',
      `/api/v1/search/query?q=*%20AND%20disabled:false&index=tag_search_index*`,
      'suggestTag'
    );
    interceptURL('POST', '/api/v1/feed', 'taskCreated');
    interceptURL('PUT', '/api/v1/feed/tasks/*/resolve', 'taskResolve');

    cy.get('[data-testid="request-entity-tags"]').should('exist').click();

    // set assignees for task
    cy.get(
      '[data-testid="select-assignee"] > .ant-select-selector > .ant-select-selection-overflow'
    )
      .click()
      .type(userName);
    cy.get(`[data-testid="${userName}"]`).click();
    cy.clickOutside();

    cy.get('[data-testid="tag-selector"]')
      .click()
      .type('{backspace}')
      .type('{backspace}')
      .type('Personal');

    verifyResponseStatusCode('@suggestTag', 200);
    cy.get(
      '.ant-select-dropdown [data-testid="tag-PersonalData.Personal"]'
    ).click();
    cy.clickOutside();

    cy.get('[data-testid="submit-tag-request"]').click();
    verifyResponseStatusCode('@taskCreated', 201);

    // Accept the tag suggestion which is created
    cy.get('.ant-btn-compact-first-item').contains('Accept Suggestion').click();

    verifyResponseStatusCode('@taskResolve', 200);

    cy.reload();

    cy.get('[data-testid="glossary-left-panel"]')
      .contains(NEW_GLOSSARY_1.name)
      .click();

    checkDisplayName(NEW_GLOSSARY_1.name);

    // Verify Tags which is added at the time of creating glossary
    cy.get('[data-testid="tags-container"]')
      .contains('Personal')
      .should('be.visible');
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

    cy.get('.ant-menu-item').contains(NEW_GLOSSARY_1.name).click();

    goToAssetsTab(
      NEW_GLOSSARY_1_TERMS.term_1.name,
      NEW_GLOSSARY_1_TERMS.term_1.fullyQualifiedName,
      true
    );
    cy.contains('Adding a new Asset is easy, just give it a spin!').should(
      'be.visible'
    );
    visitEntityDetailsPage({
      term: entity.term,
      serviceName: entity.serviceName,
      entity: entity.entity,
    });

    const parentPath =
      '[data-testid="entity-right-panel"] [data-testid="glossary-container"]';

    // Add glossary tag to entity for mutually exclusive
    cy.get(parentPath).then((glossaryContainer) => {
      // Check if the "Add Tag" button is visible
      if (!glossaryContainer.find('[data-testid="add-tag"]').is(':visible')) {
        // If "Add Tag" is not visible, click on "Edit Tag"
        cy.get(
          '[data-testid="entity-right-panel"] [data-testid="glossary-container"] [data-testid="edit-button"]'
        ).click();
        cy.get('[data-testid="remove-tags"]')
          .should('be.visible')
          .click({ multiple: true });

        interceptURL('PATCH', '/api/v1/tables/*', 'removeTags');
        cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
        verifyResponseStatusCode('@removeTags', 200);
      }
    });

    cy.get(`${parentPath} [data-testid="add-tag"]`).click();

    // Select 1st term
    cy.get('[data-testid="tag-selector"] #tagsForm_tags').click().type(term1);
    cy.get(`[data-testid="tag-${glossary}.${term1}"]`).click();
    cy.get('[data-testid="tag-selector"]').should('contain', term1);
    // Select 2nd term
    cy.get('[data-testid="tag-selector"] #tagsForm_tags').click().type(term2);
    cy.get(`[data-testid="tag-${glossary}.${term2}"]`).click();
    cy.get('[data-testid="tag-selector"]').should('contain', term2);

    interceptURL('GET', '/api/v1/feed/count*', 'countTag');
    interceptURL('GET', '/api/v1/tags', 'tags');
    interceptURL('PATCH', '/api/v1/tables/*', 'saveTag');

    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView();
    cy.clickOutside();
    cy.get('[data-testid="saveAssociatedTag"]').click();
    verifyResponseStatusCode('@saveTag', 400);
    toastNotification(
      `Tag labels ${glossary}.${term2} and ${glossary}.${term1} are mutually exclusive and can't be assigned together`
    );

    // Add non mutually exclusive tags
    cy.get(
      '[data-testid="entity-right-panel"] [data-testid="glossary-container"] > [data-testid="entity-tags"] [data-testid="add-tag"]'
    ).click();

    // Select 1st term
    cy.get('[data-testid="tag-selector"] #tagsForm_tags').click().type(term3);

    cy.get(`[data-testid="tag-${glossary1}.${term3}"]`).click();
    cy.get('[data-testid="tag-selector"]').should('contain', term3);
    // Select 2nd term
    cy.get('[data-testid="tag-selector"] #tagsForm_tags').click().type(term4);
    cy.get(`[data-testid="tag-${glossary1}.${term4}"]`).click();
    cy.clickOutside();
    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@saveTag', 200);
    verifyResponseStatusCode('@countTag', 200);
    cy.get(
      '[data-testid="entity-right-panel"] [data-testid="glossary-container"]'
    )
      .scrollIntoView()
      .should('contain', term3)
      .should('contain', term4);

    cy.get(
      '[data-testid="entity-right-panel"] [data-testid="glossary-container"] [data-testid="icon"]'
    ).should('have.length', 2);

    // Add tag to schema table
    const firstColumn =
      '[data-testid="glossary-tags-0"] > [data-testid="tags-wrapper"] > [data-testid="glossary-container"] > [data-testid="entity-tags"] [data-testid="add-tag"]';
    cy.get(firstColumn).scrollIntoView();
    cy.get(firstColumn).click();

    cy.get('[data-testid="tag-selector"]').click().type(term3);
    cy.get(
      `.ant-select-dropdown [data-testid="tag-${glossary1}.${term3}"]`
    ).click();

    cy.get('[data-testid="tag-selector"] > .ant-select-selector').contains(
      term3
    );
    cy.clickOutside();
    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@countTag', 200);
    cy.get(
      '[data-testid="glossary-tags-0"] > [data-testid="tags-wrapper"] > [data-testid="glossary-container"]'
    )
      .scrollIntoView()
      .should('contain', term3);
    cy.get(
      '[data-testid="glossary-tags-0"] > [data-testid="tags-wrapper"] > [data-testid="glossary-container"] [data-testid="icon"]'
    ).should('be.visible');
    cy.get('[data-testid="governance"]').click();
    cy.get('[data-testid="app-bar-item-glossary"]').click({ force: true });

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

  it('Add asset to glossary term using asset modal', () => {
    createGlossary(CYPRESS_ASSETS_GLOSSARY);
    const terms = Object.values(CYPRESS_ASSETS_GLOSSARY_TERMS);
    selectActiveGlossary(CYPRESS_ASSETS_GLOSSARY.name);
    terms.forEach((term) =>
      createGlossaryTerm(term, CYPRESS_ASSETS_GLOSSARY, 'Approved', true)
    );

    terms.forEach((term) => {
      addAssetToGlossaryTerm(term, CYPRESS_ASSETS_GLOSSARY);
    });
  });

  it('Remove asset from glossary term using asset modal', () => {
    const terms = Object.values(CYPRESS_ASSETS_GLOSSARY_TERMS);
    terms.forEach((term) => {
      removeAssetsFromGlossaryTerm(term, CYPRESS_ASSETS_GLOSSARY);
    });
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
    cy.clickOutside();
    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@removeTags', 200);

    // Remove the added column tag from entity
    interceptURL('PATCH', '/api/v1/tables/*', 'removeSchemaTags');

    cy.get(
      '[data-testid="glossary-tags-0"] > [data-testid="tags-wrapper"] > [data-testid="glossary-container"]'
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
      '[data-testid="glossary-tags-0"] > [data-testid="tags-wrapper"] > [data-testid="glossary-container"]'
    )
      .scrollIntoView()
      .should('not.contain', name)
      .and('not.contain', 'Personal');

    cy.get('[data-testid="governance"]').click();
    cy.get('[data-testid="app-bar-item-glossary"]').click({ force: true });

    selectActiveGlossary(NEW_GLOSSARY_1.name);

    goToAssetsTab(name, fullyQualifiedName);
    cy.contains('Adding a new Asset is easy, just give it a spin!').should(
      'be.visible'
    );
  });

  it('Tags and entity summary columns should be sorted based on current Term Page', () => {
    createGlossary(CYPRESS_ASSETS_GLOSSARY_1);
    selectActiveGlossary(CYPRESS_ASSETS_GLOSSARY_1.name);

    const terms = Object.values(CYPRESS_ASSETS_GLOSSARY_TERMS_1);
    terms.forEach((term) =>
      createGlossaryTerm(term, CYPRESS_ASSETS_GLOSSARY_1, 'Approved', true)
    );

    const entityTable = SEARCH_ENTITY_TABLE.table_1;

    visitEntityDetailsPage({
      term: entityTable.term,
      serviceName: entityTable.serviceName,
      entity: entityTable.entity,
    });

    addGlossaryTermsInEntityField({
      entityTerm: entityTable.term,
      entityField: COLUMN_NAME_FOR_APPLY_GLOSSARY_TERM,
      glossaryTerms: terms,
    });

    goToGlossaryPage();
    selectActiveGlossary(CYPRESS_ASSETS_GLOSSARY_1.name);
    goToAssetsTab(terms[0].name, terms[0].fullyQualifiedName, true);

    checkSummaryListItemSorting({
      columnName: COLUMN_NAME_FOR_APPLY_GLOSSARY_TERM,
      termFQN: terms[0].fullyQualifiedName,
    });
  });
});

describe('Cleanup', () => {
  beforeEach(() => {
    Cypress.session.clearAllSavedSessions();
    cy.login();
  });

  it('delete user', () => {
    deleteUser(createdUserId);
  });

  it('Delete glossary term should work properly', () => {
    goToGlossaryPage();
    const terms = Object.values(NEW_GLOSSARY_TERMS);
    selectActiveGlossary(NEW_GLOSSARY.name);
    terms.forEach(deleteGlossaryTerm);

    // Glossary term for Product glossary
    selectActiveGlossary(NEW_GLOSSARY_1.name);
    Object.values(NEW_GLOSSARY_1_TERMS).forEach(deleteGlossaryTerm);
  });

  it('Delete glossary should work properly', () => {
    goToGlossaryPage();
    verifyResponseStatusCode('@fetchGlossaries', 200);
    [
      NEW_GLOSSARY.name,
      NEW_GLOSSARY_1.name,
      CYPRESS_ASSETS_GLOSSARY.name,
      CYPRESS_ASSETS_GLOSSARY_1.name,
    ].forEach((glossary) => {
      deleteGlossary(glossary);
    });
  });
});
