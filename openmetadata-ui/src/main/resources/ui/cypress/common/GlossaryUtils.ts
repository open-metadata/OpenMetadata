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

import {
  DELETE_TERM,
  INVALID_NAMES,
  NAME_MAX_LENGTH_VALIDATION_ERROR,
  NAME_VALIDATION_ERROR,
} from '../constants/constants';
import { SidebarItem } from '../constants/Entity.interface';
import {
  descriptionBox,
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
} from './common';

export const validateForm = () => {
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

export const selectActiveGlossary = (glossaryName) => {
  interceptURL('GET', '/api/v1/glossaryTerms*', 'getGlossaryTerms');
  cy.get('.ant-menu-item').contains(glossaryName).click();
  verifyResponseStatusCode('@getGlossaryTerms', 200);
};

export const checkDisplayName = (displayName) => {
  cy.get('[data-testid="entity-header-display-name"]')
    .filter(':visible')
    .scrollIntoView()
    .within(() => {
      cy.contains(displayName);
    });
};

export const visitGlossaryPage = () => {
  interceptURL('GET', '/api/v1/glossaries?fields=*', 'getGlossaries');

  cy.sidebarClick(SidebarItem.GLOSSARY);

  verifyResponseStatusCode('@getGlossaries', 200);
};

export const removeReviewer = (entity) => {
  interceptURL('PATCH', `/api/v1/${entity}/*`, 'patchOwner');

  cy.get('[data-testid="edit-reviewer-button"]').click();

  cy.get('[data-testid="clear-all-button"]').click();

  cy.get('[data-testid="selectable-list-update-btn"]').click();

  verifyResponseStatusCode('@patchOwner', 200);

  cy.get('[data-testid="glossary-reviewer"] [data-testid="Add"]').should(
    'be.visible'
  );
};

export const deleteGlossary = (glossary) => {
  cy.get('.ant-menu-item').contains(glossary).click();

  cy.get('[data-testid="manage-button"]').click();

  cy.get('[data-testid="delete-button"]').scrollIntoView().click();

  cy.get('[data-testid="delete-confirmation-modal"]').then(() => {
    cy.get('[role="dialog"]').should('be.visible');
    cy.get('[data-testid="modal-header"]').should('be.visible');
  });

  cy.get('[data-testid="modal-header"]').should('contain', glossary);

  cy.get('[data-testid="confirmation-text-input"]').type(DELETE_TERM);

  interceptURL('DELETE', '/api/v1/glossaries/*', 'getGlossary');

  cy.get('[data-testid="confirm-button"]').click();

  verifyResponseStatusCode('@getGlossary', 200);

  toastNotification('"Glossary" deleted successfully!');
};

export const addOwnerInGlossary = (
  ownerNames: string | string[],
  activatorBtnDataTestId: string,
  resultTestId = 'owner-link',
  isSelectableInsideForm = false
) => {
  const isMultipleOwners = Array.isArray(ownerNames);
  const owners = isMultipleOwners ? ownerNames : [ownerNames];

  interceptURL('GET', '/api/v1/users?*isBot=false*', 'getUsers');

  cy.get(`[data-testid="${activatorBtnDataTestId}"]`).click();
  cy.get("[data-testid='select-owner-tabs']").should('be.visible');
  cy.wait(500); // Due to popover positioning issue adding wait here, will handle this with playwright @karan
  cy.get('.ant-tabs [id*=tab-users]').click({
    waitForAnimations: true,
  });
  verifyResponseStatusCode('@getUsers', 200);

  interceptURL(
    'GET',
    `api/v1/search/query?q=*&index=user_search_index*`,
    'searchOwner'
  );
  interceptURL('PATCH', `/api/v1/**`, 'patchOwner');

  if (isMultipleOwners) {
    cy.get('[data-testid="clear-all-button"]').scrollIntoView().click();
  }

  owners.forEach((ownerName) => {
    cy.get('[data-testid="owner-select-users-search-bar"]')
      .clear()
      .type(ownerName);
    verifyResponseStatusCode('@searchOwner', 200);
    cy.get(`.ant-popover [title="${ownerName}"]`).click();
  });

  if (isMultipleOwners) {
    cy.get('[data-testid="selectable-list-update-btn"]').click();
  }

  if (!isSelectableInsideForm) {
    verifyResponseStatusCode('@patchOwner', 200);
  }

  cy.get(`[data-testid=${resultTestId}]`).within(() => {
    owners.forEach((name) => {
      cy.contains(name);
    });
  });
};

export const addTeamAsReviewer = (
  teamName: string,
  activatorBtnDataTestId: string,
  dataTestId?: string,
  isSelectableInsideForm = false
) => {
  interceptURL(
    'GET',
    '/api/v1/search/query?q=*&from=0&size=*&index=team_search_index&sort_field=displayName.keyword&sort_order=asc',
    'getTeams'
  );

  cy.get(`[data-testid="${activatorBtnDataTestId}"]`).click();

  cy.get("[data-testid='select-owner-tabs']").should('be.visible');

  verifyResponseStatusCode('@getTeams', 200);

  interceptURL(
    'GET',
    `api/v1/search/query?q=*${encodeURI(teamName)}*`,
    'searchTeams'
  );

  cy.get('[data-testid="owner-select-teams-search-bar"]').type(teamName);

  verifyResponseStatusCode('@searchTeams', 200);

  interceptURL('PATCH', `/api/v1/**`, 'patchOwner');
  cy.get(`.ant-popover [title="${teamName}"]`).click();

  if (!isSelectableInsideForm) {
    verifyResponseStatusCode('@patchOwner', 200);
  }

  cy.get(`[data-testid=${dataTestId ?? 'owner-link'}]`).should(
    'contain',
    teamName
  );
};

export const createGlossary = (glossaryData, bValidateForm) => {
  // Intercept API calls
  interceptURL('POST', '/api/v1/glossaries', `create_${glossaryData.name}`);
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

  if (bValidateForm) {
    validateForm();
  }

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

  if (glossaryData.reviewers.length > 0) {
    // Add reviewer
    if (glossaryData.reviewers[0].type === 'user') {
      addOwnerInGlossary(
        glossaryData.reviewers.map((reviewer) => reviewer.name),
        'add-reviewers',
        'reviewers-container',
        true
      );
    } else {
      addTeamAsReviewer(
        glossaryData.reviewers[0].name,
        'add-reviewers',
        'reviewers-container',
        true
      );
    }
  }

  cy.get('[data-testid="save-glossary"]')
    .scrollIntoView()
    .should('be.visible')
    .click();

  cy.wait(`@create_${glossaryData.name}`).then(({ request }) => {
    expect(request.body.name).equals(glossaryData.name);
    expect(request.body.description).equals(glossaryData.description);
  });

  cy.url().should('include', '/glossary/');
  checkDisplayName(glossaryData.name);
};

const fillGlossaryTermDetails = (
  term,
  isMutually = false,
  validateCreateForm = true
) => {
  cy.get('[data-testid="add-new-tag-button-header"]').click();

  cy.contains('Add Glossary Term').should('be.visible');

  // validation should work
  cy.get('[data-testid="save-glossary-term"]')
    .scrollIntoView()
    .should('be.visible')
    .click();

  if (validateCreateForm) {
    validateForm();
  }

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
    cy.get('[data-testid="color-color-input"]')
      .scrollIntoView()
      .type(term.color);
  }

  if (term.owner) {
    addOwnerInGlossary(term.owner, 'add-owner', 'owner-container', true);
  }
};

export const createGlossaryTerm = (
  term,
  status,
  isMutually = false,
  validateCreateForm = true
) => {
  fillGlossaryTermDetails(term, isMutually, validateCreateForm);

  interceptURL('POST', '/api/v1/glossaryTerms', `createGlossaryTerms`);
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

export const verifyGlossaryDetails = (glossaryDetails) => {
  cy.get('[data-testid="glossary-left-panel"]')
    .contains(glossaryDetails.name)
    .click();

  checkDisplayName(glossaryDetails.name);

  cy.get('[data-testid="viewer-container"]')
    .invoke('text')
    .then((text) => {
      expect(text).to.contain(glossaryDetails.description);
    });

  // Owner
  cy.get(`[data-testid="glossary-right-panel-owner-link"]`).should(
    'contain',
    glossaryDetails.owner ? glossaryDetails.owner : 'No Owner'
  );

  // Reviewer
  if (glossaryDetails.reviewers.length > 0) {
    cy.get(`[data-testid="glossary-reviewer-name"]`).within(() => {
      glossaryDetails.reviewers.forEach((reviewer) => {
        cy.contains(reviewer.name);
      });
    });
  }

  // Tags
  if (glossaryDetails.tag) {
    cy.get(`[data-testid="tag-${glossaryDetails.tag}"]`).should('be.visible');
  }
};

const verifyGlossaryTermDataInTable = (term, status: string) => {
  const escapedName = Cypress.$.escapeSelector(term.fullyQualifiedName);
  const selector = `[data-row-key=${escapedName}]`;
  cy.get(selector).scrollIntoView().should('be.visible');
  cy.get(`${selector} [data-testid="${escapedName}-status"]`).contains(status);
  // If empty owner, the creator is the owner
  cy.get(`${selector} [data-testid="owner-link"]`).contains(
    term.owner ?? 'admin'
  );
};

export const createGlossaryTerms = (glossaryDetails) => {
  selectActiveGlossary(glossaryDetails.name);
  const termStatus =
    glossaryDetails.reviewers.length > 0 ? 'Draft' : 'Approved';
  glossaryDetails.terms.forEach((term, index) => {
    createGlossaryTerm(term, termStatus, true, index === 0);
    verifyGlossaryTermDataInTable(term, termStatus);
  });
};
