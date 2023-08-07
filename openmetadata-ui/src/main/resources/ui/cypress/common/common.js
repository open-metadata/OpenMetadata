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

// / <reference types="cypress" />

import {
  CUSTOM_PROPERTY_INVALID_NAMES,
  CUSTOM_PROPERTY_NAME_VALIDATION_ERROR,
  DELETE_TERM,
  NAME_VALIDATION_ERROR,
  SEARCH_INDEX,
} from '../constants/constants';

export const descriptionBox =
  '.toastui-editor-md-container > .toastui-editor > .ProseMirror';
export const uuid = () => Cypress._.random(0, 1e6);
const RETRY_TIMES = 4;
const BASE_WAIT_TIME = 20000;

const ADMIN = 'admin';

const TEAM_TYPES = ['BusinessUnit', 'Department', 'Division', 'Group'];

export const replaceAllSpacialCharWith_ = (text) => {
  return text.replaceAll(/[&/\\#, +()$~%.'":*?<>{}]/g, '_');
};

const isDatabaseService = (type) => type === 'database';

export const checkServiceFieldSectionHighlighting = (field) => {
  cy.get(`[data-id="${field}"]`).should(
    'have.attr',
    'data-highlighted',
    'true'
  );
};

const checkTeamTypeOptions = () => {
  for (const teamType of TEAM_TYPES) {
    cy.get(`.ant-select-dropdown [title="${teamType}"]`)
      .should('exist')
      .should('be.visible');
  }
};

// intercepting URL with cy.intercept
export const interceptURL = (method, url, alias, callback) => {
  cy.intercept({ method: method, url: url }, callback).as(alias);
};

// waiting for response and validating the response status code
export const verifyResponseStatusCode = (
  alias,
  responseCode,
  option,
  hasMultipleResponseCode = false
) => {
  if (hasMultipleResponseCode) {
    cy.wait(alias, option)
      .its('response.statusCode')
      .should('be.oneOf', responseCode);
  } else {
    cy.wait(alias, option)
      .its('response.statusCode')
      .should('eq', responseCode);
  }
};

// waiting for multiple response and validating the response status code
export const verifyMultipleResponseStatusCode = (
  alias = [],
  responseCode = 200,
  option
) => {
  cy.wait(alias, option).then((data) => {
    data.map((value) => expect(value.response.statusCode).eq(responseCode));
  });
};

export const handleIngestionRetry = (
  type,
  testIngestionButton,
  count = 0,
  ingestionType = 'metadata'
) => {
  let timer = BASE_WAIT_TIME;
  const rowIndex = ingestionType === 'metadata' ? 1 : 2;

  interceptURL(
    'GET',
    '/api/v1/services/ingestionPipelines?*',
    'ingestionPipelines'
  );
  interceptURL(
    'GET',
    '/api/v1/services/ingestionPipelines/*/pipelineStatus?startTs=*&endTs=*',
    'pipelineStatuses'
  );
  interceptURL('GET', '/api/v1/services/*/name/*', 'serviceDetails');
  interceptURL('GET', '/api/v1/permissions?limit=100', 'allPermissions');

  // ingestions page
  let retryCount = count;
  const testIngestionsTab = () => {
    // click on the tab only for the first time
    if (retryCount === 0) {
      cy.get('[data-testid="ingestions"]').should('exist').and('be.visible');
      cy.get('[data-testid="ingestions"] >> [data-testid="count"]').should(
        'have.text',
        rowIndex
      );
      cy.get('[data-testid="ingestions"]').click();

      if (ingestionType === 'metadata') {
        verifyResponseStatusCode('@pipelineStatuses', 200, {
          responseTimeout: 50000,
        });
      }
    }
  };
  const checkSuccessState = () => {
    testIngestionsTab();

    if (retryCount !== 0) {
      cy.wait('@allPermissions').then(() => {
        cy.wait('@serviceDetails').then(() => {
          verifyResponseStatusCode('@ingestionPipelines', 200);
          verifyResponseStatusCode('@pipelineStatuses', 200, {
            responseTimeout: 50000,
          });
        });
      });
    }

    retryCount++;

    cy.get(`[data-row-key*="${ingestionType}"]`)
      .find('[data-testid="pipeline-status"]')
      .as('checkRun');
    // the latest run should be success
    cy.get('@checkRun').then(($ingestionStatus) => {
      if (
        $ingestionStatus.text() !== 'Success' &&
        $ingestionStatus.text() !== 'Failed' &&
        retryCount <= RETRY_TIMES
      ) {
        // retry after waiting with log1 method [20s,40s,80s,160s,320s]
        cy.wait(timer);
        timer *= 2;
        cy.reload();
        checkSuccessState();
      } else {
        cy.get('@checkRun').should('have.text', 'Success');
      }
    });
  };

  checkSuccessState();
};

export const scheduleIngestion = () => {
  interceptURL(
    'POST',
    '/api/v1/services/ingestionPipelines',
    'createIngestionPipelines'
  );
  interceptURL(
    'POST',
    '/api/v1/services/ingestionPipelines/deploy/*',
    'deployPipeline'
  );
  interceptURL(
    'GET',
    '/api/v1/services/ingestionPipelines/status',
    'getIngestionPipelineStatus'
  );
  // Schedule & Deploy
  cy.get('[data-testid="cron-type"]').should('be.visible').click();
  cy.get('.ant-select-item-option-content').contains('Hour').click();
  cy.get('[data-testid="deploy-button"]').should('be.visible').click();

  verifyResponseStatusCode('@createIngestionPipelines', 201);
  verifyResponseStatusCode('@deployPipeline', 200, {
    responseTimeout: 50000,
  });
  verifyResponseStatusCode('@getIngestionPipelineStatus', 200);
  // check success
  cy.get('[data-testid="success-line"]', { timeout: 15000 }).should(
    'be.visible'
  );
  cy.contains('has been created and deployed successfully').should(
    'be.visible'
  );
};

// Storing the created service name and the type of service for later use

export const testServiceCreationAndIngestion = ({
  serviceType,
  connectionInput,
  addIngestionInput,
  serviceName,
  type = 'database',
  testIngestionButton = true,
  serviceCategory,
}) => {
  // Storing the created service name and the type of service
  // Select Service in step 1
  cy.get(`[data-testid="${serviceType}"]`).should('exist').click();
  cy.get('[data-testid="next-button"]').should('exist').click();

  // Enter service name in step 2

  // validation should work
  cy.get('[data-testid="next-button"]').should('exist').click();

  cy.get('#name_help').should('be.visible').contains('Name is required');

  // invalid name validation should work
  cy.get('[data-testid="service-name"]').should('exist').type('!@#$%^&*()');
  cy.get('#name_help').should('be.visible').contains(NAME_VALIDATION_ERROR);

  cy.get('[data-testid="service-name"]')
    .should('exist')
    .clear()
    .type(serviceName);
  interceptURL('GET', '/api/v1/services/ingestionPipelines/ip', 'ipApi');
  interceptURL(
    'GET',
    'api/v1/services/ingestionPipelines/*',
    'ingestionPipelineStatus'
  );
  // intercept the service requirement md file fetch request
  interceptURL(
    'GET',
    `en-US/${serviceCategory}/${serviceType}.md`,
    'getServiceRequirements'
  );
  cy.get('[data-testid="next-button"]').should('exist').click();
  verifyResponseStatusCode('@ingestionPipelineStatus', 200);
  verifyResponseStatusCode('@ipApi', 204);

  // Connection Details in step 3
  cy.get('[data-testid="add-new-service-container"]')
    .parent()
    .parent()
    .scrollTo('top', {
      ensureScrollable: false,
    });
  cy.contains('Connection Details').scrollIntoView().should('be.visible');

  // Requirement panel should be visible and fetch the requirements md file
  cy.get('[data-testid="service-requirements"]').should('be.visible');
  verifyResponseStatusCode('@getServiceRequirements', [200, 304], {}, true);

  connectionInput();

  // Test the connection
  interceptURL(
    'GET',
    '/api/v1/services/testConnectionDefinitions/name/*',
    'testConnectionStepDefinition'
  );

  interceptURL('POST', '/api/v1/automations/workflows', 'createWorkflow');

  interceptURL(
    'POST',
    '/api/v1/automations/workflows/trigger/*',
    'triggerWorkflow'
  );

  interceptURL('GET', '/api/v1/automations/workflows/*', 'getWorkflow');

  cy.get('[data-testid="test-connection-btn"]').should('exist').click();

  verifyResponseStatusCode('@testConnectionStepDefinition', 200);

  cy.get('[data-testid="test-connection-modal"]').should('exist');
  cy.get('.ant-modal-footer > .ant-btn-primary')
    .should('exist')
    .contains('OK')
    .click();

  verifyResponseStatusCode('@createWorkflow', 201);
  // added extra buffer time as triggerWorkflow API can take up to 2minute to provide result
  verifyResponseStatusCode('@triggerWorkflow', 200, {
    responseTimeout: 120000,
  });
  verifyResponseStatusCode('@getWorkflow', 200);
  cy.get('[data-testid="messag-text"]').then(($message) => {
    if ($message.text().includes('partially successful')) {
      cy.contains('Test connection partially successful').should('exist');
    } else {
      cy.contains('Connection test was successful').should('exist');
    }
  });
  interceptURL(
    'GET',
    '/api/v1/services/ingestionPipelines/status',
    'getIngestionPipelineStatus'
  );
  cy.get('[data-testid="submit-btn"]').should('exist').click();
  verifyResponseStatusCode('@getIngestionPipelineStatus', 200);
  // check success
  cy.get('[data-testid="success-line"]').should('be.visible');
  cy.contains(`"${serviceName}"`).should('be.visible');
  cy.contains('has been created successfully').should('be.visible');

  cy.get('[data-testid="add-ingestion-button"]').should('be.visible').click();

  // Add ingestion page
  cy.get('[data-testid="add-ingestion-container"]').should('be.visible');

  if (isDatabaseService(type)) {
    cy.get('[data-testid="configure-ingestion-container"]').should(
      'be.visible'
    );

    // Set mark-deleted slider to off to disable it.
    cy.get('[data-testid="toggle-button-mark-deleted"]')
      .should('exist')
      .click();
  }

  addIngestionInput && addIngestionInput();

  cy.get('[data-testid="next-button"]').should('exist').click();

  scheduleIngestion();

  cy.contains(`${replaceAllSpacialCharWith_(serviceName)}_metadata`).should(
    'be.visible'
  );

  // wait for ingestion to run
  cy.clock();
  cy.wait(10000);

  interceptURL(
    'GET',
    '/api/v1/services/ingestionPipelines?*',
    'ingestionPipelines'
  );
  interceptURL('GET', '/api/v1/services/*/name/*', 'serviceDetails');

  cy.get('[data-testid="view-service-button"]').should('be.visible').click();
  verifyResponseStatusCode('@serviceDetails', 200);
  verifyResponseStatusCode('@ingestionPipelines', 200);
  handleIngestionRetry(type, testIngestionButton);
};

export const deleteCreatedService = (
  typeOfService,
  service_Name,
  apiService,
  serviceCategory
) => {
  // Click on settings page
  interceptURL(
    'GET',
    'api/v1/teams/name/Organization?fields=*',
    'getSettingsPage'
  );
  cy.get('[data-testid="appbar-item-settings"]')
    .should('be.visible')
    .click({ force: true });
  verifyResponseStatusCode('@getSettingsPage', 200);
  // Services page
  interceptURL('GET', '/api/v1/services/*', 'getServices');

  cy.get('.ant-menu-title-content')
    .contains(typeOfService)
    .should('be.visible')
    .click();

  verifyResponseStatusCode('@getServices', 200);

  // click on created service
  cy.get(`[data-testid="service-name-${service_Name}"]`)
    .should('exist')
    .should('be.visible')
    .click();

  cy.get(`[data-testid="entity-header-display-name"]`)
    .should('exist')
    .should('be.visible')
    .invoke('text')
    .then((text) => {
      expect(text).to.equal(service_Name);
    });

  verifyResponseStatusCode('@getServices', 200);

  // Clicking on permanent delete radio button and checking the service name
  cy.get('[data-testid="manage-button"]')
    .should('exist')
    .should('be.visible')
    .click();

  cy.get('[data-menu-id*="delete-button"]')
    .should('exist')
    .should('be.visible');
  cy.get('[data-testid="delete-button-title"]')
    .should('be.visible')
    .click()
    .as('deleteBtn');

  // Clicking on permanent delete radio button and checking the service name
  cy.get('[data-testid="hard-delete-option"]')
    .contains(service_Name)
    .should('be.visible')
    .click();

  cy.get('[data-testid="confirmation-text-input"]')
    .should('be.visible')
    .type(DELETE_TERM);
  interceptURL('DELETE', `/api/v1/services/${apiService}/*`, 'deleteService');
  interceptURL(
    'GET',
    '/api/v1/services/*/name/*?fields=owner',
    'serviceDetails'
  );

  cy.get('[data-testid="confirm-button"]').should('be.visible').click();
  verifyResponseStatusCode('@deleteService', 200);

  // Closing the toast notification
  toastNotification(
    `${serviceCategory ?? typeOfService} Service deleted successfully!`
  );

  cy.get(`[data-testid="service-name-${service_Name}"]`).should('not.exist');
};

export const goToAddNewServicePage = (service_type) => {
  interceptURL(
    'GET',
    'api/v1/teams/name/Organization?fields=*',
    'getSettingsPage'
  );
  // Click on settings page
  cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();
  verifyResponseStatusCode('@getSettingsPage', 200);
  // Services page
  interceptURL('GET', '/api/v1/services/*', 'getServiceList');
  cy.get('[data-testid="global-setting-left-panel"]')
    .contains(service_type)
    .should('be.visible')
    .click();

  verifyResponseStatusCode('@getServiceList', 200);

  cy.get('[data-testid="add-service-button"]').should('be.visible').click();

  // Add new service page
  cy.url().should('include', '/add-service');
  cy.get('[data-testid="header"]').should('be.visible');
  cy.contains('Add New Service').should('be.visible');
  cy.get('[data-testid="service-category"]').should('be.visible');
};

/**
 * Search for entities through the search bar
 * @param {string} term Entity name
 */
export const searchEntity = (term, suggestionOverly = true) => {
  cy.get('[data-testid="searchBox"]').scrollIntoView().should('be.visible');
  cy.get('[data-testid="searchBox"]').type(`${term}{enter}`);
  if (suggestionOverly) {
    cy.get('[data-testid="suggestion-overlay"]').click(1, 1);
  }
};

export const visitEntityDetailsPage = (
  term,
  serviceName,
  entity,
  dataTestId,
  entityType
) => {
  interceptURL('GET', '/api/v1/*/name/*', 'getEntityDetails');
  interceptURL(
    'GET',
    `/api/v1/search/query?q=*&index=${SEARCH_INDEX[entity]}&from=*&size=**`,
    'explorePageTabSearch'
  );
  interceptURL('GET', `/api/v1/search/suggest?q=*&index=*`, 'searchQuery');
  interceptURL('GET', `/api/v1/search/*`, 'explorePageSearch');
  const id = dataTestId ?? `${serviceName}-${term}`;

  if (entityType) {
    cy.get('[data-testid="global-search-selector"]').click();
    cy.get(`[data-testid="global-search-select-option-${entityType}"]`).click();
  }

  // searching term in search box
  cy.get('[data-testid="searchBox"]').scrollIntoView().should('be.visible');
  cy.get('[data-testid="searchBox"]').type(term);
  verifyResponseStatusCode('@searchQuery', 200);
  cy.get('[data-testid="suggestion-overlay"]').should('exist');
  cy.get('body').then(($body) => {
    // checking if requested term is available in search suggestion
    if ($body.find(`[data-testid="${id}"] [data-testid="data-name"]`).length) {
      // if term is available in search suggestion, redirecting to entity details page
      cy.get(`[data-testid="${id}"] [data-testid="data-name"]`)
        .should('be.visible')
        .first()
        .click();
    } else {
      // if term is not available in search suggestion, hitting enter to search box so it will redirect to explore page
      cy.get('body').click(1, 1);
      cy.get('[data-testid="searchBox"]').type('{enter}');
      verifyResponseStatusCode('@explorePageSearch', 200);

      cy.get(`[data-testid="${entity}-tab"]`).should('be.visible').click();
      cy.get(`[data-testid="${entity}-tab"]`).should('be.visible');
      verifyResponseStatusCode('@explorePageTabSearch', 200);

      cy.get(`[data-testid="${id}"]`)
        .scrollIntoView()
        .should('be.visible')
        .click();
    }
  });

  verifyResponseStatusCode('@getEntityDetails', 200);
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="suggestion-overlay"]').length) {
      cy.get('[data-testid="suggestion-overlay"]').click(1, 1);
    }
  });
  cy.get('body').click(1, 1);
  cy.get('[data-testid="searchBox"]').clear();
};

// add new tag to entity and its table
export const addNewTagToEntity = (entityObj, term) => {
  const { name, fqn } = term;
  visitEntityDetailsPage(
    entityObj.term,
    entityObj.serviceName,
    entityObj.entity
  );
  cy.wait(500);
  cy.get(
    '[data-testid="classification-tags-0"] [data-testid="entity-tags"] [data-testid="add-tag"]'
  )
    .eq(0)
    .should('be.visible')
    .scrollIntoView()
    .click();

  cy.get('[data-testid="tag-selector"] input').should('be.visible').type(name);

  cy.get(`[data-testid="tag-${fqn}"]`).should('be.visible').click();
  // to close popup
  cy.clickOutside();

  cy.get('[data-testid="tag-selector"] > .ant-select-selector').contains(name);
  cy.get('[data-testid="saveAssociatedTag"]')
    .scrollIntoView()
    .should('be.visible')
    .click();
  cy.get('[data-testid="classification-tags-0"] [data-testid="tags-container"]')
    .scrollIntoView()
    .contains(name)
    .should('exist');
};

export const addUser = (username, email) => {
  cy.get('[data-testid="email"]')
    .scrollIntoView()
    .should('exist')
    .should('be.visible')
    .type(email);
  cy.get('[data-testid="displayName"]')
    .should('exist')
    .should('be.visible')
    .type(username);
  cy.get(descriptionBox)
    .should('exist')
    .should('be.visible')
    .type('Adding user');
  interceptURL('GET', ' /api/v1/users/generateRandomPwd', 'generatePassword');
  cy.get('[data-testid="password-generator"]').should('be.visible').click();
  verifyResponseStatusCode('@generatePassword', 200);
  cy.wait(1000);
  interceptURL('POST', ' /api/v1/users', 'add-user');
  cy.get('[data-testid="save-user"]').scrollIntoView().click();
  verifyResponseStatusCode('@add-user', 201);
};

export const softDeleteUser = (username, isAdmin) => {
  // Search the created user
  interceptURL(
    'GET',
    '/api/v1/search/query?q=**&from=0&size=*&index=*',
    'searchUser'
  );
  cy.get('[data-testid="searchbar"]').type(username);

  verifyResponseStatusCode('@searchUser', 200);

  // Click on delete button
  cy.get(`[data-testid="delete-user-btn-${username}"]`).click();

  // Soft deleting the user
  cy.get('[data-testid="soft-delete"]').click();
  cy.get('[data-testid="confirmation-text-input"]').type('DELETE');

  interceptURL(
    'DELETE',
    '/api/v1/users/*?hardDelete=false&recursive=false',
    'softdeleteUser'
  );
  interceptURL('GET', '/api/v1/users*', 'userDeleted');
  cy.get('[data-testid="confirm-button"]').click();
  verifyResponseStatusCode('@softdeleteUser', 200);
  verifyResponseStatusCode('@userDeleted', 200);

  toastNotification('User deleted successfully!');

  interceptURL('GET', '/api/v1/search/query*', 'searchUser');

  // Verifying the deleted user
  cy.get('[data-testid="searchbar"]').scrollIntoView().clear().type(username);

  verifyResponseStatusCode('@searchUser', 200);
  cy.get('[data-testid="search-error-placeholder"]').should('be.visible');
};

export const restoreUser = (username) => {
  // Click on deleted user toggle
  interceptURL('GET', '/api/v1/users*', 'deletedUser');
  cy.get('.ant-switch-handle').should('exist').should('be.visible').click();
  verifyResponseStatusCode('@deletedUser', 200);

  cy.get(`[data-testid="restore-user-btn-${username}"]`)
    .should('exist')
    .should('be.visible')
    .click();
  cy.get('.ant-modal-body > p').should(
    'contain',
    `Are you sure you want to restore ${username}?`
  );
  interceptURL('PUT', '/api/v1/users', 'restoreUser');
  cy.get('.ant-modal-footer > .ant-btn-primary')
    .should('exist')
    .should('be.visible')
    .click();
  verifyResponseStatusCode('@restoreUser', 200);
  toastNotification('User restored successfully');

  // Verifying the restored user
  cy.get('.ant-switch').should('exist').should('be.visible').click();

  interceptURL('GET', '/api/v1/search/query*', 'searchUser');
  cy.get('[data-testid="searchbar"]')
    .should('exist')
    .should('be.visible')
    .type(username);
  verifyResponseStatusCode('@searchUser', 200);

  cy.get('.ant-table-row > :nth-child(1)').should('contain', username);
};

export const deleteSoftDeletedUser = (username) => {
  interceptURL(
    'GET',
    '/api/v1/users?fields=profile,teams,roles&include=*&limit=*',
    'getSoftDeletedUser'
  );

  cy.get('.ant-switch-handle').should('exist').should('be.visible').click();

  verifyResponseStatusCode('@getSoftDeletedUser', 200);

  cy.get(`[data-testid="delete-user-btn-${username}"]`)
    .should('exist')
    .should('be.visible')
    .click();
  cy.get('[data-testid="confirmation-text-input"]').type('DELETE');
  interceptURL(
    'DELETE',
    'api/v1/users/*?hardDelete=true&recursive=false',
    'hardDeleteUser'
  );
  cy.get('[data-testid="confirm-button"]')
    .should('exist')
    .should('be.visible')
    .click();
  verifyResponseStatusCode('@hardDeleteUser', 200);

  toastNotification('User deleted successfully!');

  interceptURL(
    'GET',
    'api/v1/search/query?q=**&from=0&size=15&index=user_search_index',
    'searchUser'
  );

  cy.get('[data-testid="searchbar"]')
    .should('exist')
    .should('be.visible')
    .type(username);
  verifyResponseStatusCode('@searchUser', 200);

  cy.get('[data-testid="search-error-placeholder"]').should('be.visible');
};

export const toastNotification = (msg, closeToast = true) => {
  cy.get('.Toastify__toast-body').should('be.visible').contains(msg);
  cy.wait(200);
  if (closeToast) {
    cy.get('.Toastify__close-button').should('be.visible').click();
  }
};

export const addCustomPropertiesForEntity = (
  propertyName,
  entityType,
  customType,
  value,
  entityObj
) => {
  // Add Custom property for selected entity
  cy.get('[data-testid="add-field-button"]').click();

  // validation should work
  cy.get('[data-testid="create-button"]').scrollIntoView().click();

  cy.get('#name_help').should('contain', 'Name is required');
  cy.get('#propertyType_help').should('contain', 'Property Type is required');

  cy.get('#description_help').should('contain', 'Description is required');

  // capital case validation
  cy.get('[data-testid="name"]')
    .scrollIntoView()
    .type(CUSTOM_PROPERTY_INVALID_NAMES.CAPITAL_CASE);
  cy.get('[role="alert"]').should(
    'contain',
    CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
  );

  // with underscore validation
  cy.get('[data-testid="name"]')
    .clear()
    .type(CUSTOM_PROPERTY_INVALID_NAMES.WITH_UNDERSCORE);
  cy.get('[role="alert"]').should(
    'contain',
    CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
  );

  // with space validation
  cy.get('[data-testid="name"]')
    .clear()
    .type(CUSTOM_PROPERTY_INVALID_NAMES.WITH_SPACE);
  cy.get('[role="alert"]').should(
    'contain',
    CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
  );

  // with dots validation
  cy.get('[data-testid="name"]')
    .clear()
    .type(CUSTOM_PROPERTY_INVALID_NAMES.WITH_DOTS);
  cy.get('[role="alert"]').should(
    'contain',
    CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
  );

  // should allow name in another languages
  cy.get('[data-testid="name"]').clear().type('汝らヴェディア');
  // should not throw the validation error
  cy.get('#name_help').should('not.exist');

  cy.get('[data-testid="name"]').clear().type(propertyName);

  cy.get('[data-testid="propertyType"]').click();
  cy.get(`[title="${customType}"]`).click();

  cy.get(descriptionBox).clear().type(entityType.description);

  // Check if the property got added
  cy.intercept('/api/v1/metadata/types/name/*?fields=customProperties').as(
    'customProperties'
  );
  cy.get('[data-testid="create-button"]').scrollIntoView().click();

  cy.wait('@customProperties');
  cy.get('.ant-table-row').should('contain', propertyName);

  // Navigating to home page
  cy.clickOnLogo();

  // Checking the added property in Entity

  visitEntityDetailsPage(
    entityObj.term,
    entityObj.serviceName,
    entityObj.entity
  );

  cy.get('[data-testid="custom_properties"]').click();
  cy.get('tbody').should('contain', propertyName);

  // Adding value for the custom property

  // Navigating through the created custom property for adding value
  cy.get(`[data-row-key="${propertyName}"]`)
    .find('[data-testid="edit-icon"]')
    .as('editbutton');
  cy.wait(1000);

  cy.get('@editbutton').click();

  // Checking for value text box or markdown box
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="value-input"]').length > 0) {
      cy.get('[data-testid="value-input"]').type(value);
      cy.get('[data-testid="inline-save-btn"]').click();
    } else if (
      $body.find(
        '.toastui-editor-md-container > .toastui-editor > .ProseMirror'
      )
    ) {
      cy.get(
        '.toastui-editor-md-container > .toastui-editor > .ProseMirror'
      ).type(value);
      cy.get('[data-testid="save"]').click();
    }
  });

  cy.get(`[data-row-key="${propertyName}"]`).should('contain', value);
};

export const editCreatedProperty = (propertyName) => {
  // Fetching for edit button
  cy.get(`[data-row-key="${propertyName}"]`)
    .find('[data-testid="edit-button"]')
    .as('editbutton');

  cy.get('@editbutton').click();

  cy.get(descriptionBox)
    .should('be.visible')
    .clear()
    .type('This is new description');

  interceptURL('PATCH', '/api/v1/metadata/types/*', 'checkPatchForDescription');

  cy.get('[data-testid="save"]').should('be.visible').click();

  verifyResponseStatusCode('@checkPatchForDescription', 200);

  cy.get('.ant-modal-wrap').should('not.exist');

  // Fetching for updated descriptions for the created custom property
  cy.get(`[data-row-key="${propertyName}"]`)
    .find('[data-testid="viewer-container"]')
    .should('contain', 'This is new description');
};

export const deleteCreatedProperty = (propertyName) => {
  // Fetching for delete button
  cy.get(`[data-row-key="${propertyName}"]`)
    .find('[data-testid="delete-button"]')
    .as('deletebutton');

  cy.get('@deletebutton').click();

  // Checking property name is present on the delete pop-up
  cy.get('[data-testid="body-text"]').should('contain', propertyName);

  cy.get('[data-testid="save-button"]').should('be.visible').click();
};

export const updateOwner = () => {
  cy.get('[data-testid="avatar"]').click();
  cy.get('[data-testid="user-name"]')
    .should('exist')
    .invoke('text')
    .then((text) => {
      cy.get('[data-testid="hiden-layer"]').should('exist').click();
      interceptURL('GET', '/api/v1/users?limit=15', 'getUsers');
      // Clicking on edit owner button
      cy.get('[data-testid="edit-owner"]').click();

      cy.get('.user-team-select-popover').contains('Users').click();
      cy.get('[data-testid="owner-select-users-search-bar"]').type(text);
      cy.get('[data-testid="selectable-list"]')
        .eq(1)
        .find(`[title="${text.trim()}"]`)
        .click();

      // Asserting the added name
      cy.get('[data-testid="owner-link"]').should('contain', text.trim());
    });
};

export const mySqlConnectionInput = () => {
  cy.get('#root\\/username').type(Cypress.env('mysqlUsername'));
  checkServiceFieldSectionHighlighting('username');
  cy.get('#root\\/authType\\/password').type(Cypress.env('mysqlPassword'));
  checkServiceFieldSectionHighlighting('password');
  cy.get('#root\\/hostPort').type(Cypress.env('mysqlHostPort'));
  checkServiceFieldSectionHighlighting('hostPort');
  cy.get('#root\\/databaseSchema').type(Cypress.env('mysqlDatabaseSchema'));
  checkServiceFieldSectionHighlighting('databaseSchema');
};

export const login = (username, password) => {
  cy.visit('/');
  cy.get('[id="email"]').should('be.visible').clear().type(username);
  cy.get('[id="password"]').should('be.visible').clear().type(password);
  cy.get('.ant-btn').contains('Login').should('be.visible').click();
};

export const addTeam = (TEAM_DETAILS, index) => {
  interceptURL('GET', '/api/v1/teams*', 'addTeam');
  // Fetching the add button and clicking on it
  if (index > 0) {
    cy.get('[data-testid="add-placeholder-button"]').click();
  } else {
    cy.get('[data-testid="add-team"]').click();
  }

  verifyResponseStatusCode('@addTeam', 200);

  // Entering team details
  cy.get('[data-testid="name"]')
    .should('exist')
    .should('be.visible')
    .type(TEAM_DETAILS.name);

  cy.get('[data-testid="display-name"]')
    .should('exist')
    .should('be.visible')
    .type(TEAM_DETAILS.name);

  cy.get('[data-testid="email"]')
    .should('exist')
    .should('be.visible')
    .type(TEAM_DETAILS.email);

  cy.get('[data-testid="team-selector"]')
    .should('exist')
    .should('be.visible')
    .click();

  checkTeamTypeOptions();

  cy.get(`.ant-select-dropdown [title="${TEAM_DETAILS.teamType}"]`)
    .should('exist')
    .should('be.visible')
    .click();

  cy.get(descriptionBox)
    .should('exist')
    .should('be.visible')
    .type(TEAM_DETAILS.description);

  interceptURL('POST', '/api/v1/teams', 'saveTeam');
  interceptURL('GET', '/api/v1/team*', 'createTeam');

  // Saving the created team
  cy.get('[form="add-team-form"]')
    .scrollIntoView()
    .should('be.visible')
    .click();

  verifyResponseStatusCode('@saveTeam', 201);
  verifyResponseStatusCode('@createTeam', 200);
};

export const retryIngestionRun = () => {
  interceptURL('GET', '/api/v1/services/*/name/*', 'serviceDetails');
  interceptURL(
    'GET',
    '/api/v1/services/ingestionPipelines/*/pipelineStatus/*',
    'pipelineStatus'
  );
  let timer = BASE_WAIT_TIME;
  let retryCount = 0;
  const testIngestionsTab = () => {
    cy.get('[data-testid="ingestions"]').scrollIntoView().should('be.visible');
    cy.get('[data-testid="ingestions"] >> [data-testid="count"]').should(
      'have.text',
      '1'
    );
    if (retryCount === 0) {
      cy.wait(1000);
      cy.get('[data-testid="ingestions"]').should('be.visible');
    }
  };

  const checkSuccessState = () => {
    testIngestionsTab();
    retryCount++;

    // the latest run should be success
    cy.get('[data-testid="pipeline-status"]').then(($ingestionStatus) => {
      if ($ingestionStatus.text() !== 'Success' && retryCount <= RETRY_TIMES) {
        // retry after waiting with log1 method [20s,40s,80s,160s,320s]
        cy.wait(timer);
        timer *= 2;
        cy.reload();
        verifyResponseStatusCode('@serviceDetails', 200);
        verifyResponseStatusCode('@pipelineStatus', 200);
        checkSuccessState();
      } else {
        cy.get('[data-testid="pipeline-status"]').should(
          'have.text',
          'Success'
        );
      }
    });
  };

  checkSuccessState();
};

export const updateDescriptionForIngestedTables = (
  serviceName,
  tableName,
  description,
  type,
  entity
) => {
  interceptURL(
    'GET',
    `/api/v1/services/ingestionPipelines?fields=*&service=*`,
    'ingestionPipelines'
  );
  interceptURL('GET', `/api/v1/*?service=*&fields=*`, 'serviceDetails');
  interceptURL(
    'GET',
    `/api/v1/system/config/pipeline-service-client`,
    'pipelineServiceClient'
  );
  interceptURL(
    'GET',
    `/api/v1/services/ingestionPipelines/*/pipelineStatus?*`,
    'pipelineStatus'
  );
  // Navigate to ingested table
  visitEntityDetailsPage(tableName, serviceName, entity);

  // update description
  cy.get('[data-testid="edit-description"]')
    .should('be.visible')
    .click({ force: true });
  cy.get(descriptionBox).should('be.visible').click().clear().type(description);
  interceptURL('PATCH', '/api/v1/*/*', 'updateEntity');
  cy.get('[data-testid="save"]').click();
  verifyResponseStatusCode('@updateEntity', 200);

  // re-run ingestion flow
  cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();

  // Services page
  cy.get('.ant-menu-title-content').contains(type).should('be.visible').click();

  // click on created service
  cy.get(`[data-testid="service-name-${serviceName}"]`)
    .should('exist')
    .should('be.visible')
    .click();

  verifyResponseStatusCode('@serviceDetails', 200);
  verifyResponseStatusCode('@ingestionPipelines', 200);
  verifyResponseStatusCode('@pipelineServiceClient', 200);
  cy.get('[data-testid="ingestions"]').should('be.visible').click();
  verifyResponseStatusCode('@pipelineStatus', 200);

  interceptURL(
    'POST',
    '/api/v1/services/ingestionPipelines/trigger/*',
    'checkRun'
  );
  cy.get(
    `[data-row-key*="${replaceAllSpacialCharWith_(
      serviceName
    )}_metadata"] [data-testid="run"]`
  )
    .should('be.visible')
    .click();
  verifyResponseStatusCode('@checkRun', 200);

  // Close the toast message
  cy.get('.Toastify__close-button').should('be.visible').click();

  // Wait for success
  retryIngestionRun();

  // Navigate to table name
  visitEntityDetailsPage(tableName, serviceName, entity);
  cy.get('[data-testid="markdown-parser"]')
    .first()
    .invoke('text')
    .should('contain', description);
};

export const followAndOwnTheEntity = (termObj) => {
  // search for the term and redirect to the respective entity tab

  visitEntityDetailsPage(termObj.term, termObj.serviceName, termObj.entity);
  // go to manage tab and search for logged in user and set the owner
  interceptURL(
    'GET',
    '/api/v1/search/query?q=*%20AND%20teamType:Group&from=0&size=15&index=team_search_index',
    'getTeams'
  );
  cy.get('[data-testid="edit-owner"]').should('be.visible').click();

  verifyResponseStatusCode('@getTeams', 200);
  // Clicking on users tab
  cy.get('.user-team-select-popover')
    .contains('Users')
    .should('exist')
    .should('be.visible')
    .click();

  cy.get('[data-testid="selectable-list"]')
    .eq(1)
    .should('exist')
    .should('be.visible')
    .find('[title="admin"]')
    .should('be.visible')
    .click();

  cy.get('[data-testid="owner-link"]')
    .scrollIntoView()
    .invoke('text')
    .then((text) => {
      expect(text).equal('admin');
    });

  interceptURL('PUT', '/api/v1/*/*/followers', 'waitAfterFollow');
  cy.get('[data-testid="follow-button"]')
    .scrollIntoView()
    .should('be.visible')
    .click();
  verifyResponseStatusCode('@waitAfterFollow', 200);

  cy.clickOnLogo();

  cy.get('[data-testid="message-container"]')
    .first()
    .contains(`Followed ${termObj.entity.slice(0, -1)}`)
    .should('be.visible');

  // checks newly generated feed for follow and setting owner
  cy.get('[data-testid="message-container"]')
    .eq(1)
    .scrollIntoView()
    .contains('Added owner: admin')
    .should('be.visible');

  // Check followed entity on mydata page
  cy.get('[data-testid="following-data-container"]')
    .find(`[data-testid="following-${termObj.displayName}"]`)
    .should('be.visible');

  // Check owned entity
  cy.get('[data-testid="my-data-container"]')
    .find(`[data-testid="My data-${termObj.displayName}"]`)
    .should('be.visible');

  cy.clickOnLogo();
};
