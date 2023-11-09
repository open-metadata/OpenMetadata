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
  SEARCH_ENTITY_TABLE,
} from '../constants/constants';
import {
  descriptionBox,
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from './common';

export const validateDomainForm = () => {
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

const checkDisplayName = (displayName) => {
  cy.get('[data-testid="entity-header-display-name"]')
    .scrollIntoView()
    .should('exist')
    .and('be.visible')
    .within(() => {
      cy.contains(displayName);
    });
};

const checkName = (name) => {
  cy.get('[data-testid="entity-header-name"]')
    .scrollIntoView()
    .should('exist')
    .and('be.visible')
    .within(() => {
      cy.contains(name);
    });
};

const updateOwner = (newOwner) => {
  interceptURL('PATCH', `/api/v1/domains/*`, 'patchOwner');
  interceptURL('GET', '/api/v1/users?limit=25&isBot=false', 'getUsers');
  cy.get('[data-testid="edit-owner"]').click();
  cy.get('.ant-tabs [id*=tab-users]').click();
  verifyResponseStatusCode('@getUsers', 200);

  interceptURL(
    'GET',
    `api/v1/search/query?q=*${encodeURI(newOwner)}*`,
    'searchOwner'
  );

  cy.get('[data-testid="owner-select-users-search-bar"]').type(newOwner);
  verifyResponseStatusCode('@searchOwner', 200);
  cy.get(`.ant-popover [title="${newOwner}"]`).click();
  verifyResponseStatusCode('@patchOwner', 200);

  cy.get(`[data-testid="domain-owner-name"]`)
    .invoke('text')
    .then((text) => {
      expect(text).to.contain(newOwner);
    });
};

const goToAssetsTab = (domainObj) => {
  cy.get('[data-testid="domain-left-panel"]').contains(domainObj.name).click();
  checkDisplayName(domainObj.name);
  cy.get('[data-testid="assets"]').should('be.visible').click();
  cy.get('.ant-tabs-tab-active').contains('Assets').should('be.visible');
};

export const updateAssets = (domainObj) => {
  interceptURL(
    'GET',
    `/api/v1/search/query?q=*&index=domain_search_index*`,
    'searchDomain'
  );

  const entity = SEARCH_ENTITY_TABLE.table_2;
  goToAssetsTab(domainObj);
  cy.contains('Adding a new Asset is easy, just give it a spin!').should(
    'be.visible'
  );
  visitEntityDetailsPage(entity.term, entity.serviceName, entity.entity);

  cy.get('[data-testid="add-domain"]').click();

  // Enter domain name
  cy.get('.domain-select-popover [data-testid="searchbar"]')
    .click()
    .type(domainObj.name);
  verifyResponseStatusCode('@searchDomain', 200);

  cy.get('[data-testid="selectable-list"]')
    .find(`[title="${domainObj.name}"]`)
    .click();

  cy.get('[data-testid="domain-link"]').should('contain', domainObj.name);

  cy.get('[data-testid="app-bar-item-domain"]')
    .should('be.visible')
    .click({ force: true });

  goToAssetsTab(domainObj);

  cy.get('.assets-data-container [data-testid="entity-header-display-name"]')
    .contains(entity.term)
    .should('be.visible');
};

export const removeAssets = (domainObj) => {
  const entity = SEARCH_ENTITY_TABLE.table_2;
  interceptURL('GET', '/api/v1/search/query*', 'assetTab');
  // go assets tab
  goToAssetsTab(domainObj);
  verifyResponseStatusCode('@assetTab', 200);

  interceptURL('GET', '/api/v1/domain*', 'domains');
  interceptURL('PATCH', '/api/v1/tables/*', 'patchDomain');

  cy.get('[data-testid="entity-header-display-name"]')
    .contains(entity.term)
    .click();

  visitEntityDetailsPage(entity.term, entity.serviceName, entity.entity);

  cy.get('[data-testid="add-domain"]').click();
  verifyResponseStatusCode('@domains', 200);
  cy.get('[data-testid="remove-owner"]').click();
  verifyResponseStatusCode('@patchDomain', 200);

  cy.get('[data-testid="app-bar-item-domain"]')
    .should('be.visible')
    .click({ force: true });

  goToAssetsTab(domainObj);
  cy.contains('Adding a new Asset is easy, just give it a spin!').should(
    'be.visible'
  );
};

const updateDescription = (newDescription) => {
  interceptURL('PATCH', '/api/v1/domains/*', 'saveDomain');
  cy.get('[data-testid="edit-description"]').should('be.visible').click();
  cy.get('.ant-modal-wrap').should('be.visible');
  cy.get(descriptionBox).should('be.visible').as('description');
  cy.get('@description').clear();
  cy.get('@description').type(newDescription);
  cy.get('[data-testid="save"]').click();
  verifyResponseStatusCode('@saveDomain', 200);
  cy.get('.ant-modal-wrap').should('not.exist');
  cy.get('[data-testid="viewer-container"]')
    .contains(newDescription)
    .should('be.visible');
};

const fillForm = (formObj, type) => {
  interceptURL('GET', '/api/v1/users?limit=25&isBot=false', 'getUsers');
  cy.get('[data-testid="name"]').scrollIntoView().clear().type(formObj.name);

  cy.get(descriptionBox)
    .scrollIntoView()
    .should('be.visible')
    .type(formObj.description);

  cy.get('[data-testid="add-owner"]').scrollIntoView().click();
  cy.get('.ant-tabs [id*=tab-users]').click();
  verifyResponseStatusCode('@getUsers', 200);

  interceptURL(
    'GET',
    `api/v1/search/query?q=*${encodeURI(formObj.owner)}*`,
    'searchOwner'
  );

  cy.get('[data-testid="owner-select-users-search-bar"]').type(formObj.owner);
  verifyResponseStatusCode('@searchOwner', 200);
  cy.get(`.ant-popover [title="${formObj.owner}"]`).click();
  cy.get('[data-testid="owner-container"]').children().should('have.length', 1);

  cy.get('[data-testid="add-experts"]').scrollIntoView().click();
  cy.get('.user-select-popover [data-testid="searchbar"]').type(
    formObj.experts
  );
  cy.get(`[title="${formObj.experts}"]`).scrollIntoView().click();
  cy.get('[data-testid="selectable-list-update-btn"]')
    .should('exist')
    .and('be.visible')
    .click();

  cy.get('[data-testid="delete-modal"]').should('not.exist');
  cy.get('[data-testid="experts-container"]')
    .children()
    .should('have.length', 1);

  if (type === 'domain') {
    cy.get('[data-testid="domainType"]').click();
    cy.get(`.ant-select-dropdown [title="${formObj.domainType}"]`).click();
  }
};

/**
 * Creates a new domain.
 *
 * @param {Object} domainObj - An object containing the properties of the domain.
 * @param {boolean} validate - A flag indicating whether to validate the form.
 * @return {void}
 */
export const createDomain = (domainObj, validate) => {
  cy.get('[data-testid="add-domain"]').click();

  interceptURL('POST', '/api/v1/domains', 'createDomain');

  // Redirecting to add domain page
  cy.get('[data-testid="form-heading"]')
    .contains('Add Domain')
    .should('be.visible');

  // validation should work
  cy.get('[data-testid="save-domain"]').scrollIntoView().click();

  if (validate) {
    validateDomainForm();
  }

  fillForm(domainObj, 'domain');

  cy.get('[data-testid="save-domain"]').scrollIntoView().click();

  cy.wait('@createDomain').then(({ request }) => {
    expect(request.body.name).equals(domainObj.name);
    expect(request.body.description).equals(domainObj.description);
    expect(request.body.experts).has.length(1);

    cy.url().should('include', '/domain/');
    checkDisplayName(domainObj.name);
  });
};

export const deleteDomain = (domainObj) => {
  cy.get('.ant-menu-item').contains(domainObj.updatedDisplayName).click();
  cy.get('[data-testid="manage-button"]').click();
  cy.get('[data-testid="delete-button"]').scrollIntoView().click();
  cy.get('[data-testid="delete-modal"]').then(() => {
    cy.get('[role="dialog"]').should('be.visible');
  });

  cy.get('[data-testid="delete-modal"] .ant-modal-title').should(
    'contain',
    `Delete ${domainObj.updatedName}`
  );

  cy.get('[data-testid="confirmation-text-input"]').type(DELETE_TERM);

  interceptURL('DELETE', '/api/v1/domains/*', 'getDomains');

  cy.get('[data-testid="confirm-button"]').click();

  verifyResponseStatusCode('@getDomains', 200);

  toastNotification('Domain deleted successfully!');
};

export const verifyDomain = (domainObj) => {
  cy.get('[data-testid="domain-left-panel"]').contains(domainObj.name).click();
  checkDisplayName(domainObj.name);

  cy.get('[data-testid="viewer-container"]')
    .invoke('text')
    .then((text) => {
      expect(text).to.contain(domainObj.description);
    });

  cy.get(`[data-testid="domain-owner-name"]`)
    .invoke('text')
    .then((text) => {
      expect(text).to.contain(domainObj.owner);
    });

  cy.get(`[data-testid="domain-expert-name"]`)
    .invoke('text')
    .then((text) => {
      expect(text).to.contain(domainObj.experts);
    });
};

export const updateDomainDetails = (domainObj) => {
  cy.get('[data-testid="domain-left-panel"]').contains(domainObj.name).click();
  checkDisplayName(domainObj.name);

  // Update description
  updateDescription(domainObj.updatedDescription);

  // Update Owner
  updateOwner(domainObj.updatedOwner);
};

export const createDataProducts = (dataProduct, domainObj) => {
  cy.get('[data-testid="domain-left-panel"]').contains(domainObj.name).click();
  checkDisplayName(domainObj.name);

  cy.get('[data-testid="domain-details-add-button"]').click();
  cy.get('.ant-dropdown-menu .ant-dropdown-menu-title-content')
    .contains('Data Products')
    .click();

  interceptURL('POST', '/api/v1/dataProducts', 'createDataProducts');

  cy.contains('Add Data Product').should('be.visible');

  fillForm(dataProduct, 'dataProduct');

  cy.get('[data-testid="save-data-product"]').scrollIntoView().click();

  cy.wait('@createDataProducts').then(({ request }) => {
    expect(request.body.name).equals(dataProduct.name);
    expect(request.body.domain).equals(domainObj.name);
    expect(request.body.description).equals(dataProduct.description);
    expect(request.body.experts).has.length(1);
  });
};

export const renameDomain = (domainObj) => {
  interceptURL('PATCH', `/api/v1/domains/*`, 'patchName&DisplayName');
  cy.get('[data-testid="domain-left-panel"]').contains(domainObj.name).click();
  checkDisplayName(domainObj.name);

  cy.get('[data-testid="manage-button"]').click();
  cy.get('[data-testid="rename-button-details-container"]').click();

  cy.get('#name').should('not.be.disabled').clear();
  cy.get('#displayName').should('not.be.disabled').clear();

  cy.get('#name').type(domainObj.updatedName);
  cy.get('#displayName').type(domainObj.updatedDisplayName);

  cy.get('[data-testid="save-button"]').click();
  verifyResponseStatusCode('@patchName&DisplayName', 200);

  checkName(domainObj.updatedName);
  checkDisplayName(domainObj.updatedDisplayName);
};
