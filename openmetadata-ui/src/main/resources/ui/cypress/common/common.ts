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

import { RouteHandler, WaitOptions } from 'cypress/types/net-stubbing';
import { BASE_URL, DELETE_TERM, NEW_TAG } from '../constants/constants';
import { GlobalSettingOptions } from '../constants/settings.constant';

export const descriptionBox =
  '.toastui-editor-md-container > .toastui-editor > .ProseMirror';
export const uuid = () => Cypress._.random(0, 1e6);
export const RETRY_TIMES = 4;
export const BASE_WAIT_TIME = 20000;

export const replaceAllSpacialCharWith_ = (text: string) => {
  return text.replaceAll(/[&/\\#, +()$~%.'":*?<>{}]/g, '_');
};

export const checkServiceFieldSectionHighlighting = (field: string) => {
  cy.get(`[data-id="${field}"]`).should(
    'have.attr',
    'data-highlighted',
    'true'
  );
};

// intercepting URL with cy.intercept
export const interceptURL = (
  method: string,
  url: string,
  alias: string,
  callback?: RouteHandler
) => {
  cy.intercept({ method: method, url: url }, callback).as(alias);
};

// waiting for response and validating the response status code
export const verifyResponseStatusCode = (
  alias: string,
  responseCode: number | number[],
  option?: Partial<WaitOptions>,
  hasMultipleResponseCode = false
) => {
  if (hasMultipleResponseCode) {
    return cy
      .wait(alias, option)
      .its('response.statusCode')
      .should('be.oneOf', responseCode);
  } else {
    return cy
      .wait(alias, option)
      .its('response.statusCode')
      .should('eq', responseCode);
  }
};

// waiting for multiple response and validating the response status code
export const verifyMultipleResponseStatusCode = (
  alias: string[] = [],
  responseCode = 200,
  option?: Partial<WaitOptions>
) => {
  cy.wait(alias, option).then((data) => {
    data.map((value) => expect(value.response?.statusCode).eq(responseCode));
  });
};

// Storing the created service name and the type of service for later use

// add new tag to entity and its table
export const addNewTagToEntity = (term: typeof NEW_TAG) => {
  const { name, fqn } = term;

  cy.get(
    '[data-testid="classification-tags-0"] [data-testid="entity-tags"] [data-testid="add-tag"]'
  )
    .eq(0)
    .scrollIntoView()
    .click();

  cy.get('[data-testid="tag-selector"] input').type(name);

  cy.get(`[data-testid="tag-${fqn}"]`).click();

  cy.get('[data-testid="tag-selector"] > .ant-select-selector').contains(name);
  cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
  cy.get('[data-testid="classification-tags-0"] [data-testid="tags-container"]')
    .scrollIntoView()
    .contains(name)
    .should('exist');
  if (term.color) {
    cy.get(
      '[data-testid="classification-tags-0"] [data-testid="tags-container"] [data-testid="icon"]'
    ).should('be.visible');
  }
};

export const toastNotification = (msg: string, closeToast = true) => {
  cy.get('.Toastify__toast-body').should('contain.text', msg);
  cy.wait(200);
  if (closeToast) {
    cy.get('.Toastify__close-button').click();
  }
};

export const deleteEntity = (
  entityName: string,
  serviceName: string,
  entity: string,
  successMessageEntityName: string,
  deletionType = 'hard'
) => {
  cy.get('[data-testid="manage-button"]').click();

  cy.get('[data-testid="delete-button-title"]').click();

  cy.get('.ant-modal-header').should('contain', entityName);

  cy.get(`[data-testid="${deletionType}-delete-option"]`).click();

  cy.get('[data-testid="confirm-button"]').should('be.disabled');
  cy.get('[data-testid="confirmation-text-input"]').type(DELETE_TERM);

  interceptURL(
    'DELETE',
    `api/v1/${entity}/*?hardDelete=${deletionType === 'hard'}&recursive=true`,
    `${deletionType}DeleteTable`
  );
  cy.get('[data-testid="confirm-button"]').should('not.be.disabled');
  cy.get('[data-testid="confirm-button"]').click();
  verifyResponseStatusCode(`@${deletionType}DeleteTable`, 200);

  toastNotification(`deleted successfully!`);
};

export const visitServiceDetailsPage = (
  settingsMenuId: string,
  serviceCategory: string,
  serviceName: string,
  isServiceDeleted = false
) => {
  interceptURL(
    'GET',
    `/api/v1/search/query?q=*${isServiceDeleted ? 'deleted=true' : ''}`,
    'searchService'
  );
  interceptURL('GET', `/api/v1/services/${serviceCategory}*`, 'getServices');
  cy.settingClick(settingsMenuId);
  verifyResponseStatusCode('@getServices', 200);

  if (isServiceDeleted) {
    cy.get('[data-testid="show-deleted-switch"]').click();
  }

  interceptURL(
    'GET',
    `api/v1/services/${serviceCategory}/name/${serviceName}*`,
    'getServiceDetails'
  );

  cy.get('[data-testid="searchbar"]').type(serviceName);

  verifyResponseStatusCode('@searchService', 200);

  cy.get(`[data-testid="service-name-${serviceName}"]`).click();

  verifyResponseStatusCode('@getServiceDetails', 200);
};

export const visitDataModelPage = (
  dataModelFQN: string,
  dataModelName: string,
  serviceName: string
) => {
  interceptURL('GET', '/api/v1/services/dashboardServices*', 'getServices');
  cy.settingClick(GlobalSettingOptions.DASHBOARDS);
  verifyResponseStatusCode('@getServices', 200);

  interceptURL(
    'GET',
    `api/v1/services/dashboardServices/name/${serviceName}*`,
    'getDashboardDetails'
  );
  interceptURL(
    'GET',
    `/api/v1/dashboard/datamodels?service=${serviceName}*`,
    'getDataModels'
  );

  cy.get(`[data-testid="service-name-${serviceName}"]`)
    .scrollIntoView()
    .click();

  verifyResponseStatusCode('@getDashboardDetails', 200);
  verifyResponseStatusCode('@getDataModels', 200);

  cy.get('[data-testid="data-model"]').scrollIntoView().click();

  verifyResponseStatusCode('@getDataModels', 200);

  interceptURL(
    'GET',
    `/api/v1/dashboard/datamodels/name/${dataModelFQN}*`,
    'getDataModelDetails'
  );

  cy.get(`[data-testid="data-model-${dataModelName}"]`)
    .scrollIntoView()
    .click();

  verifyResponseStatusCode('@getDataModelDetails', 200);
};

export const signupAndLogin = (
  email: string,
  password: string,
  firstName: string,
  lastName: string
) => {
  return new Cypress.Promise((resolve) => {
    let createdUserId = '';
    interceptURL('GET', 'api/v1/system/config/auth', 'getLoginPage');
    cy.visit('/');
    verifyResponseStatusCode('@getLoginPage', 200);

    // Click on create account button
    cy.get('[data-testid="signup"]').scrollIntoView().click();

    // Enter first name
    cy.get('[id="firstName"]').type(firstName);

    // Enter last name
    cy.get('[id="lastName"]').type(lastName);

    // Enter email
    cy.get('[id="email"]').type(email);

    // Enter password
    cy.get('[id="password"]').type(password);
    cy.get('[id="password"]')
      .should('have.attr', 'type')
      .should('eq', 'password');

    // Confirm password
    cy.get('[id="confirmPassword"]').type(password);

    // Click on create account button
    cy.get('.ant-btn').contains('Create Account').click();

    cy.url().should('eq', `${BASE_URL}/signin`).and('contain', 'signin');

    // Login with the created user
    cy.login(email, password);

    cy.url().should('eq', `${BASE_URL}/my-data`);

    // Verify user profile
    cy.get('[data-testid="dropdown-profile"]').click();
    cy.get('[data-testid="user-name"]')
      .should('be.visible')
      .invoke('text')
      .should('contain', `${firstName}${lastName}`);

    interceptURL('GET', 'api/v1/users/name/*', 'getUserPage');

    cy.get('[data-testid="user-name"]').click({ force: true });
    cy.wait('@getUserPage').then((response) => {
      createdUserId = response.response?.body.id;
      resolve(createdUserId); // Resolve the promise with the createdUserId
    });
    cy.get(
      '[data-testid="user-profile"] [data-testid="user-profile-details"]'
    ).should('contain', `${firstName}${lastName}`);
  });
};

export const addTableFieldTags = (
  dataRowKey: string,
  classificationName: string,
  tagName: string,
  entity: string
) => {
  cy.get(
    `[data-row-key="${dataRowKey}"] [data-testid="tags-container"] [data-testid="add-tag"]`
  ).click();

  cy.get('[data-testid="tag-selector"] #tagsForm_tags')
    .scrollIntoView()
    .type(tagName);

  cy.get(`[data-testid="tag-${classificationName}.${tagName}"]`).click();

  interceptURL('PATCH', `/api/v1/${entity}/*`, 'patchTag');

  cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();

  verifyResponseStatusCode('@patchTag', 200);

  cy.get(
    `[data-row-key="${dataRowKey}"] [data-testid="tag-${classificationName}.${tagName}"]`
  )
    .scrollIntoView()
    .should('be.visible');
};

export const removeTableFieldTags = (
  dataRowKey: string,
  classificationName: string,
  tagName: string,
  entity: string
) => {
  cy.get(
    `[data-row-key="${dataRowKey}"] [data-testid="tags-container"] [data-testid="edit-button"]`
  )
    .scrollIntoView()
    .click();

  cy.get(
    `[data-testid="selected-tag-${classificationName}.${tagName}"] [data-testid="remove-tags"]`
  )
    .scrollIntoView()
    .click();

  interceptURL('PATCH', `/api/v1/${entity}/*`, `patchTag`);

  cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();

  verifyResponseStatusCode(`@patchTag`, 200);

  cy.get(`[data-row-key="${dataRowKey}"]`).then(($body) => {
    const manageButton = $body.find(
      `[data-testid="tag-${classificationName}.${tagName}"]`
    );

    expect(manageButton.length).to.equal(0);
  });
};

export const updateTableFieldDescription = (
  dataRowKey: string,
  description: string,
  entity: string
) => {
  cy.get(
    `[data-row-key="${dataRowKey}"] [data-testid="description"] [data-testid="edit-button"]`
  ).click();

  cy.get(descriptionBox).should('be.visible').click().clear().type(description);

  interceptURL('PATCH', `/api/v1/${entity}/*`, 'updateDescription');

  cy.get('[data-testid="save"]').click();

  verifyResponseStatusCode('@updateDescription', 200);
};

export const visitDatabaseDetailsPage = ({
  settingsMenuId,
  serviceCategory,
  serviceName,
  databaseRowKey,
  databaseName,
  isDeleted = false,
}: {
  settingsMenuId: string;
  serviceCategory: string;
  serviceName: string;
  databaseRowKey: string;
  databaseName: string;
  isDeleted?: boolean;
}) => {
  visitServiceDetailsPage(
    settingsMenuId,
    serviceCategory,
    serviceName,
    isDeleted
  );

  if (isDeleted) {
    interceptURL('GET', `/api/v1/databases*include=deleted*`, 'getDatabases');
    cy.get('[data-testid="show-deleted"]').click();
    verifyResponseStatusCode('@getDatabases', 200);
  }

  cy.get(`[data-row-key="${databaseRowKey}"]`).contains(databaseName).click();
};

export const visitDatabaseSchemaDetailsPage = ({
  settingsMenuId,
  serviceCategory,
  serviceName,
  databaseRowKey,
  databaseName,
  databaseSchemaRowKey,
  databaseSchemaName,
  isDeleted = false,
}: {
  settingsMenuId: string;
  serviceCategory: string;
  serviceName: string;
  databaseRowKey: string;
  databaseName: string;
  databaseSchemaRowKey: string;
  databaseSchemaName: string;
  isDeleted?: boolean;
}) => {
  visitDatabaseDetailsPage({
    settingsMenuId,
    serviceCategory,
    serviceName,
    databaseRowKey,
    databaseName,
    isDeleted,
  });

  if (isDeleted) {
    interceptURL(
      'GET',
      `/api/v1/databaseSchemas*include=deleted*`,
      'getDatabaseSchemas'
    );
    cy.get('[data-testid="show-deleted"]').click();
    verifyResponseStatusCode('@getDatabaseSchemas', 200);
  }

  cy.get(`[data-row-key="${databaseSchemaRowKey}"]`)
    .contains(databaseSchemaName)
    .click();
};

export const selectOptionFromDropdown = (option: string) => {
  cy.get('.ant-select-dropdown')
    .not('.ant-select-dropdown-hidden')
    .find(`[title="${option}"]`)
    .click();
};
