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

import { DELETE_TERM, SEARCH_INDEX } from '../constants/constants';

export const descriptionBox =
  '.toastui-editor-md-container > .toastui-editor > .ProseMirror';
export const uuid = () => Cypress._.random(0, 1e6);
const RETRY_TIMES = 4;
const BASE_WAIT_TIME = 20000;

const ADMIN = 'admin';

const TEAM_TYPES = ['BusinessUnit', 'Department', 'Division', 'Group'];

const isDatabaseService = (type) => type === 'database';

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
export const verifyResponseStatusCode = (alias, responseCode) => {
  cy.wait(alias).its('response.statusCode').should('eq', responseCode);
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
    '/api/v1/services/ingestionPipelines?fields=owner,pipelineStatuses&service=*',
    'pipelineStatuses'
  );
  interceptURL('GET', '/api/v1/services/*/name/*', 'serviceDetails');

  // ingestions page
  let retryCount = count;
  const testIngestionsTab = () => {
    cy.get('[data-testid="Ingestions"]').should('exist').and('be.visible');
    cy.get('[data-testid="Ingestions"] >> [data-testid="filter-count"]').should(
      'have.text',
      rowIndex
    );
    // click on the tab only for the first time
    if (retryCount === 0) {
      // Wait for pipeline status to be loaded
      verifyResponseStatusCode('@pipelineStatuses', 200);
      cy.wait(1000); // adding manual wait for ingestion button to attach to DOM
      cy.get('[data-testid="Ingestions"]').click();
    }
    if (isDatabaseService(type) && testIngestionButton) {
      cy.get('[data-testid="add-new-ingestion-button"]').should('be.visible');
    }
  };
  const checkSuccessState = () => {
    testIngestionsTab();
    retryCount++;
    cy.get('body').then(($body) => {
      if ($body.find('.ant-skeleton-input').length) {
        cy.wait(1000);
      }
    });

    if (ingestionType === 'metadata') {
      cy.get(`[data-row-key*="${ingestionType}"]`)
        .find('[data-testid="pipeline-status"]')
        .as('checkRun');
    } else {
      cy.get(`[data-row-key*="${ingestionType}"]`)
        .find('[data-testid="pipeline-status"]')
        .as('checkRun');
    }
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
        verifyResponseStatusCode('@serviceDetails', 200);
        checkSuccessState();
      } else {
        cy.get('@checkRun').should('have.text', 'Success');
      }
    });
  };

  checkSuccessState();
};

export const scheduleIngestion = () => {
  // Schedule & Deploy
  cy.contains('Schedule for Ingestion').should('be.visible');
  cy.get('[data-testid="cron-type"]').should('be.visible').select('hour');
  cy.get('[data-testid="deploy-button"]').should('be.visible').click();

  // check success
  cy.get('[data-testid="success-line"]', { timeout: 15000 }).should(
    'be.visible'
  );
  cy.contains('has been created and deployed successfully').should(
    'be.visible'
  );
};

// Storing the created service name and the type of service for later use

export const testServiceCreationAndIngestion = (
  serviceType,
  connectionInput,
  addIngestionInput,
  serviceName,
  type = 'database',
  testIngestionButton = true
) => {
  // Storing the created service name and the type of service
  // Select Service in step 1
  cy.get(`[data-testid="${serviceType}"]`).should('exist').click();
  cy.get('[data-testid="next-button"]').should('exist').click();

  // Enter service name in step 2
  cy.get('[data-testid="service-name"]').should('exist').type(serviceName);
  interceptURL(
    'GET',
    'api/v1/services/ingestionPipelines/*',
    'getIngestionPipelineStatus'
  );
  cy.get('[data-testid="next-button"]').click();
  verifyResponseStatusCode('@getIngestionPipelineStatus', 200);
  // Connection Details in step 3
  cy.get('[data-testid="add-new-service-container"]')
    .parent()
    .parent()
    .scrollTo('top', {
      ensureScrollable: false,
    });
  cy.contains('Connection Details').scrollIntoView().should('be.visible');

  connectionInput();

  // check for the ip-address widget
  cy.get('[data-testid="ip-address"]').should('exist');

  // Test the connection
  interceptURL(
    'POST',
    '/api/v1/services/ingestionPipelines/testConnection',
    'testConnection'
  );
  cy.get('[data-testid="test-connection-btn"]').should('exist');
  cy.get('[data-testid="test-connection-btn"]').click();
  verifyResponseStatusCode('@testConnection', 200);
  cy.contains('Connection test was successful').should('exist');
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

  cy.get('[data-testid="add-ingestion-button"]').should('be.visible');
  cy.get('[data-testid="add-ingestion-button"]').click();

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

  addIngestionInput();

  cy.get('[data-testid="next-button"]').should('exist').click();

  scheduleIngestion();

  cy.contains(`${serviceName}_metadata`).should('be.visible');
  // On the Right panel
  cy.contains('Metadata Ingestion Added & Deployed Successfully').should(
    'be.visible'
  );

  // wait for ingestion to run
  cy.clock();
  cy.wait(10000);

  cy.get('[data-testid="view-service-button"]').should('be.visible');
  cy.get('[data-testid="view-service-button"]').click();
  verifyResponseStatusCode('@getIngestionPipelineStatus', 200);
  handleIngestionRetry(type, testIngestionButton);
};

export const deleteCreatedService = (
  typeOfService,
  service_Name,
  apiService
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

  cy.get(`[data-testid="inactive-link"]`)
    .should('exist')
    .should('be.visible')
    .invoke('text')
    .then((text) => {
      expect(text).to.equal(service_Name);
    });

  verifyResponseStatusCode('@getServices', 200);

  cy.get('[data-testid="service-delete"]')
    .should('exist')
    .should('be.visible')
    .click();

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
  toastNotification(`${typeOfService} Service deleted successfully!`);

  cy.get(`[data-testid="service-name-${service_Name}"]`).should('not.exist');
};

export const editOwnerforCreatedService = (
  service_type,
  service_Name,
  api_services
) => {
  interceptURL(
    'GET',
    'api/v1/teams/name/Organization?fields=*',
    'getSettingsPage'
  );
  // Click on settings page
  cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();
  verifyResponseStatusCode('@getSettingsPage', 200);

  // Services page
  cy.get('.ant-menu-title-content')
    .contains(service_type)
    .should('be.visible')
    .click();

  interceptURL(
    'GET',
    `/api/v1/services/${api_services}/name/${service_Name}?fields=owner`,
    'getSelectedService'
  );

  interceptURL(
    'GET',
    `/api/v1/services/ingestionPipelines?fields=owner,pipelineStatuses&service=${service_Name}`,
    'waitForIngestion'
  );

  interceptURL(
    'GET',
    '/api/v1/system/config/pipeline-service-client',
    'airflow'
  );
  // click on created service
  cy.get(`[data-testid="service-name-${service_Name}"]`)
    .should('exist')
    .should('be.visible')
    .click();

  verifyResponseStatusCode('@getSelectedService', 200);
  verifyResponseStatusCode('@waitForIngestion', 200);
  verifyResponseStatusCode('@airflow', 200);
  interceptURL(
    'GET',
    '/api/v1/search/query?q=*%20AND%20teamType:Group&from=0&size=10&index=team_search_index',
    'waitForTeams'
  );

  // Click on edit owner button
  cy.get('[data-testid="edit-Owner-icon"]')
    .should('exist')
    .should('be.visible')
    .trigger('mouseover')
    .click();

  verifyResponseStatusCode('@waitForTeams', 200);

  // Clicking on users tab
  cy.get('[data-testid="dropdown-tab"]')
    .contains('Users')
    .should('exist')
    .should('be.visible')
    .click();

  // Selecting the user
  cy.get('[data-testid="list-item"]')
    .first()
    .should('exist')
    .should('be.visible')
    .click();

  cy.get('[data-testid="owner-dropdown"]')
    .invoke('text')
    .then((text) => {
      expect(text).equal(ADMIN);
    });
};

export const goToAddNewServicePage = (service_type) => {
  interceptURL(
    'GET',
    'api/v1/teams/name/Organization?fields=*',
    'getSettingsPage'
  );
  cy.get('[data-testid="tables"]').should('be.visible');
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

export const visitEntityDetailsPage = (term, serviceName, entity) => {
  interceptURL('GET', '/api/v1/*/name/*', 'getEntityDetails');
  interceptURL(
    'GET',
    `/api/v1/search/query?q=*&index=${SEARCH_INDEX[entity]}&from=*&size=**`,
    'explorePageTabSearch'
  );
  interceptURL('GET', `/api/v1/search/suggest?q=*&index=*`, 'searchQuery');
  interceptURL('GET', `/api/v1/search/*`, 'explorePageSearch');

  // searching term in search box
  cy.get('[data-testid="searchBox"]').scrollIntoView().should('be.visible');
  cy.get('[data-testid="searchBox"]').type(term);
  cy.get('[data-testid="suggestion-overlay"]').should('exist');
  verifyResponseStatusCode('@searchQuery', 200);
  cy.get('body').then(($body) => {
    // checking if requested term is available in search suggestion
    if (
      $body.find(
        `[data-testid="${serviceName}-${term}"] [data-testid="data-name"]`
      ).length
    ) {
      // if term is available in search suggestion, redirecting to entity details page
      cy.get(`[data-testid="${serviceName}-${term}"] [data-testid="data-name"]`)
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

      cy.get(`[data-testid="${serviceName}-${term}"]`)
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
  visitEntityDetailsPage(
    entityObj.term,
    entityObj.serviceName,
    entityObj.entity
  );
  cy.wait(500);
  cy.get('[data-testid="tags"] > [data-testid="add-tag"]')
    .eq(0)
    .should('be.visible')
    .scrollIntoView()
    .click();

  cy.get('[data-testid="tag-selector"] input').should('be.visible').type(term);

  cy.get(`[title="${term}"]`).should('be.visible').click();
  cy.get(
    '[data-testid="tags-wrapper"] > [data-testid="tag-container"]'
  ).contains(term);
  cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();
  cy.get('[data-testid="entity-tags"]')
    .scrollIntoView()
    .should('be.visible')
    .contains(term);

  cy.get('[data-testid="tag-container"]')
    .contains('Tags')
    .should('be.visible')
    .click();

  cy.get('[data-testid="tag-selector"]')
    .scrollIntoView()
    .should('be.visible')
    .type(term);
  cy.wait(500);
  cy.get(`[title="${term}"]`).should('be.visible').click();
  cy.get('[data-testid="saveAssociatedTag"]')
    .scrollIntoView()
    .should('be.visible')
    .click();
  cy.get('[data-testid="tag-container"]').contains(term).should('exist');
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
};

export const softDeleteUser = (username) => {
  // Search the created user
  interceptURL(
    'GET',
    '/api/v1/search/query?q=**&from=0&size=*&index=*',
    'searchUser'
  );
  cy.get('[data-testid="searchbar"]')
    .should('exist')
    .should('be.visible')
    .type(username);

  verifyResponseStatusCode('@searchUser', 200);

  // Click on delete button
  cy.get(`[data-testid="delete-user-btn-${username}"]`)
    .should('exist')
    .should('be.visible')
    .click();

  // Soft deleting the user
  cy.get('[data-testid="soft-delete"]').click();
  cy.get('[data-testid="confirmation-text-input"]').type('DELETE');

  interceptURL(
    'DELETE',
    '/api/v1/users/*?hardDelete=false&recursive=false',
    'softdeleteUser'
  );
  interceptURL('GET', '/api/v1/users*', 'userDeleted');
  cy.get('[data-testid="confirm-button"]')
    .should('exist')
    .should('be.visible')
    .click();
  verifyResponseStatusCode('@softdeleteUser', 200);
  verifyResponseStatusCode('@userDeleted', 200);

  toastNotification('User deleted successfully!');

  interceptURL('GET', '/api/v1/search/query*', 'searchUser');

  // Verifying the deleted user
  cy.get('[data-testid="searchbar"]')
    .should('exist')
    .should('be.visible')
    .clear()
    .type(username);

  verifyResponseStatusCode('@searchUser', 200);
  cy.get('.ant-table-placeholder > .ant-table-cell').should(
    'not.contain',
    username
  );
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
  toastNotification('User restored successfully.');

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

  cy.get('.ant-table-placeholder > .ant-table-cell').should(
    'not.contain',
    username
  );
};

export const toastNotification = (msg) => {
  cy.get('.Toastify__toast-body').should('be.visible').contains(msg);
  cy.wait(200);
  cy.get('.Toastify__close-button').should('be.visible').click();
};

export const addCustomPropertiesForEntity = (
  propertyName,
  entityType,
  customType,
  value,
  entityObj
) => {
  // Add Custom property for selected entity
  cy.get('[data-testid="add-field-button"]')
    .should('exist')
    .should('be.visible')
    .click();
  cy.get('[data-testid="name"]').should('be.visible').type(propertyName);
  cy.get('select').select(customType);
  cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
    .should('be.visible')
    .type(entityType.description);
  // Check if the property got added
  cy.intercept('/api/v1/metadata/types/name/*?fields=customProperties').as(
    'customProperties'
  );
  cy.get('[data-testid="create-custom-field"]').scrollIntoView().click();

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

  cy.get('[data-testid="Custom Properties"]')
    .should('exist')
    .should('be.visible')
    .click();
  cy.get('tbody').should('contain', propertyName);

  // Adding value for the custom property

  // Navigating through the created custom property for adding value
  cy.get(`[data-row-key="${propertyName}"]`)
    .find('[data-testid="edit-icon"]')
    .as('editbutton');
  cy.wait(1000);

  cy.get('@editbutton').should('exist').should('be.visible').click();

  // Checking for value text box or markdown box
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="value-input"]').length > 0) {
      cy.get('[data-testid="value-input"]').should('be.visible').type(value);
      cy.get('[data-testid="save-value"]').click();
    } else if (
      $body.find(
        '.toastui-editor-md-container > .toastui-editor > .ProseMirror'
      )
    ) {
      cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
        .should('be.visible')
        .type(value);
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

  // Checking if property got deleted successfully
  cy.get('[data-testid="add-field-button"]')
    .scrollIntoView()
    .should('be.visible');
};

export const updateOwner = (isAddingOwnerToTeam = false) => {
  cy.get('[data-testid="avatar"]').should('be.visible').click();
  cy.get('[data-testid="user-name"]')
    .should('exist')
    .invoke('text')
    .then((text) => {
      cy.get('[data-testid="hiden-layer"]').should('exist').click();
      interceptURL(
        'GET',
        '/api/v1/search/query?q=*%20AND%20teamType:Group&from=0&size=10&index=team_search_index',
        'getTeams'
      );
      // Clicking on edit owner button
      cy.get('[data-testid="edit-Owner-icon"]').should('be.visible').click();

      verifyResponseStatusCode('@getTeams', 200);

      if (!isAddingOwnerToTeam) {
        // Clicking on users tab
        cy.get('button[data-testid="dropdown-tab"]')
          .should('exist')
          .should('be.visible')
          .contains('Users')
          .click();
      }

      cy.get('[data-testid="list-item"]')
        .first()
        .should('contain', text.trim())
        .click();

      // Asserting the added name
      cy.get('[data-testid="owner-link"]').should('contain', text.trim());
    });
};

export const mySqlConnectionInput = () => {
  cy.get('#root_username').type(Cypress.env('mysqlUsername'));
  cy.get('#root_password').type(Cypress.env('mysqlPassword'));
  cy.get('#root_hostPort').type(Cypress.env('mysqlHostPort'));
  cy.get('#root_databaseSchema').type(Cypress.env('mysqlDatabaseSchema'));
};

export const login = (username, password) => {
  cy.visit('/');
  cy.get('[id="email"]').should('be.visible').clear().type(username);
  cy.get('[id="password"]').should('be.visible').clear().type(password);
  cy.get('.ant-btn').contains('Login').should('be.visible').click();
};

export const addTeam = (TEAM_DETAILS) => {
  interceptURL('GET', '/api/v1/teams*', 'addTeam');
  // Fetching the add button and clicking on it
  cy.get('[data-testid="add-team"]').should('be.visible').click();

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
  let timer = BASE_WAIT_TIME;
  let retryCount = 0;
  const testIngestionsTab = () => {
    cy.get('[data-testid="Ingestions"]').scrollIntoView().should('be.visible');
    cy.get('[data-testid="Ingestions"] >> [data-testid="filter-count"]').should(
      'have.text',
      '1'
    );
    if (retryCount === 0) {
      cy.wait(1000);
      cy.get('[data-testid="Ingestions"]').should('be.visible');
    }
  };

  const checkSuccessState = () => {
    testIngestionsTab();
    retryCount++;
    cy.get('body').then(($body) => {
      if ($body.find('.ant-skeleton-input').length) {
        cy.wait(1000);
      }
    });

    // the latest run should be success
    cy.get('[data-testid="pipeline-status"]').then(($ingestionStatus) => {
      if ($ingestionStatus.text() !== 'Success' && retryCount <= RETRY_TIMES) {
        // retry after waiting with log1 method [20s,40s,80s,160s,320s]
        cy.wait(timer);
        timer *= 2;
        cy.reload();
        verifyResponseStatusCode('@serviceDetails', 200);
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
    '/api/v1/services/ingestionPipelines?fields=owner,pipelineStatuses&service=*',
    'pipelineStatuses'
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

  interceptURL(
    'GET',
    `/api/v1/services/ingestionPipelines?fields=owner,pipelineStatuses&service=${serviceName}`,
    'getSelectedService'
  );
  interceptURL(
    'GET',
    '/api/v1/system/config/pipeline-service-client',
    'airflow'
  );

  // click on created service
  cy.get(`[data-testid="service-name-${serviceName}"]`)
    .should('exist')
    .should('be.visible')
    .click();

  verifyResponseStatusCode('@getSelectedService', 200);
  verifyResponseStatusCode('@pipelineStatuses', 200);
  verifyResponseStatusCode('@airflow', 200);
  cy.get('[data-testid="Ingestions"]').should('be.visible').click();
  interceptURL(
    'POST',
    '/api/v1/services/ingestionPipelines/trigger/*',
    'checkRun'
  );
  cy.get(`[data-row-key*="${serviceName}_metadata"] [data-testid="run"]`)
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
    '/api/v1/search/query?q=*%20AND%20teamType:Group&from=0&size=10&index=team_search_index',
    'getTeams'
  );
  cy.get('[data-testid="edit-Owner-icon"]').should('be.visible').click();

  verifyResponseStatusCode('@getTeams', 200);
  // Clicking on users tab
  cy.get('[data-testid="dropdown-tab"]')
    .contains('Users')
    .should('exist')
    .should('be.visible')
    .click();

  // Selecting the user
  cy.get('[data-testid="list-item"]')
    .first()
    .should('exist')
    .should('be.visible')
    .click();

  cy.get(':nth-child(2) > [data-testid="owner-link"]')
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
    .find(`[data-testid="Following data-${termObj.displayName}"]`)
    .should('be.visible');

  // Check owned entity
  cy.get('[data-testid="my-data-container"]')
    .find(`[data-testid="My data-${termObj.displayName}"]`)
    .should('be.visible');

  cy.clickOnLogo();
};
