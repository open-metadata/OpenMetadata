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
/// <reference types="cypress" />

import {
  BASE_URL,
  CUSTOM_PROPERTY_INVALID_NAMES,
  CUSTOM_PROPERTY_NAME_VALIDATION_ERROR,
  DELETE_TERM,
  INVALID_NAMES,
  NAME_VALIDATION_ERROR,
} from '../constants/constants';
import { GlobalSettingOptions } from '../constants/settings.constant';

export const descriptionBox =
  '.toastui-editor-md-container > .toastui-editor > .ProseMirror';
export const uuid = () => Cypress._.random(0, 1e6);
export const RETRY_TIMES = 4;
export const BASE_WAIT_TIME = 20000;

const RETRIES_COUNT = 4;

const TEAM_TYPES = ['Department', 'Division', 'Group'];

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

const getTeamType = (currentTeam) => {
  switch (currentTeam) {
    case 'BusinessUnit':
      return {
        childTeamType: 'Division',
        teamTypeOptions: TEAM_TYPES,
      };

    case 'Division':
      return {
        childTeamType: 'Department',
        teamTypeOptions: TEAM_TYPES,
      };

    case 'Department':
      return {
        childTeamType: 'Group',
        teamTypeOptions: ['Department', 'Group'],
      };
  }
};

const checkTeamTypeOptions = (type) => {
  for (const teamType of getTeamType(type).teamTypeOptions) {
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
      const text = $ingestionStatus.text();
      if (
        text !== 'Success' &&
        text !== 'Failed' &&
        retryCount <= RETRY_TIMES
      ) {
        // retry after waiting with log1 method [20s,40s,80s,160s,320s]
        cy.wait(timer);
        timer *= 2;
        cy.reload();
        checkSuccessState();
      } else {
        cy.get('@checkRun').should('contain', 'Success');
      }
    });
  };

  checkSuccessState();
};

export const scheduleIngestion = (hasRetryCount = true) => {
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

  if (hasRetryCount) {
    cy.get('#retries').scrollIntoView().clear().type(RETRIES_COUNT);
  }

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
  viewIngestionInput,
  serviceName,
  type = 'database',
  testIngestionButton = true,
  serviceCategory,
  shouldAddIngestion = true,
  allowTestConnection = true,
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
  cy.get('[data-testid="service-name"]')
    .should('exist')
    .type(INVALID_NAMES.WITH_SPECIAL_CHARS);
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

  if (allowTestConnection) {
    cy.get('[data-testid="test-connection-btn"]').should('exist').click();

    verifyResponseStatusCode('@testConnectionStepDefinition', 200);

    verifyResponseStatusCode('@createWorkflow', 201);
    // added extra buffer time as triggerWorkflow API can take up to 2minute to provide result
    verifyResponseStatusCode('@triggerWorkflow', 200, {
      responseTimeout: 120000,
    });
    cy.get('[data-testid="test-connection-modal"]').should('exist');
    cy.get('.ant-modal-footer > .ant-btn-primary')
      .should('exist')
      .contains('OK')
      .click();
    verifyResponseStatusCode('@getWorkflow', 200);
    cy.get('[data-testid="messag-text"]').then(($message) => {
      if ($message.text().includes('partially successful')) {
        cy.contains('Test connection partially successful').should('exist');
      } else {
        cy.contains('Connection test was successful').should('exist');
      }
    });
  }
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

  if (shouldAddIngestion) {
    cy.get('[data-testid="add-ingestion-button"]').should('be.visible').click();

    // Add ingestion page
    cy.get('[data-testid="add-ingestion-container"]').should('be.visible');

    if (isDatabaseService(type)) {
      // Set mark-deleted slider to off to disable it.
      cy.get('#root\\/markDeletedTables').click();
    }

    addIngestionInput && addIngestionInput();

    cy.get('[data-testid="submit-btn"]').scrollIntoView().click();

    if (viewIngestionInput) {
      // Go back and data should persist
      cy.get('[data-testid="back-button"]').scrollIntoView().click();

      viewIngestionInput();

      // Go Next
      cy.get('[data-testid="submit-btn"]').scrollIntoView().click();
    }

    scheduleIngestion();

    cy.contains(`${replaceAllSpacialCharWith_(serviceName)}_metadata`).should(
      'be.visible'
    );

    // wait for ingestion to run
    cy.clock();
    cy.wait(1000);

    interceptURL(
      'GET',
      '/api/v1/services/ingestionPipelines?*',
      'ingestionPipelines'
    );
    interceptURL('GET', '/api/v1/services/*/name/*', 'serviceDetails');

    cy.get('[data-testid="view-service-button"]').click();
    verifyResponseStatusCode('@serviceDetails', 200);
    verifyResponseStatusCode('@ingestionPipelines', 200);
    handleIngestionRetry(type, testIngestionButton);
  }
};

export const deleteCreatedService = (
  typeOfService,
  serviceName,
  apiService,
  serviceCategory
) => {
  // Click on settings page
  // Services page
  interceptURL('GET', '/api/v1/services/*', 'getServices');

  cy.settingClick(typeOfService);

  verifyResponseStatusCode('@getServices', 200);

  interceptURL(
    'GET',
    'api/v1/search/query?q=*&from=0&size=15&index=*',
    'searchService'
  );
  cy.get('[data-testid="searchbar"]').type(serviceName);

  verifyResponseStatusCode('@searchService', 200);

  // click on created service
  cy.get(`[data-testid="service-name-${serviceName}"]`)
    .should('exist')
    .should('be.visible')
    .click();

  cy.get(`[data-testid="entity-header-display-name"]`)
    .should('exist')
    .should('be.visible')
    .invoke('text')
    .then((text) => {
      expect(text).to.equal(serviceName);
    });

  verifyResponseStatusCode('@getServices', 200);

  // Clicking on permanent delete radio button and checking the service name
  cy.get('[data-testid="manage-button"]')
    .should('exist')
    .should('be.visible')
    .click();

  cy.get('[data-menu-id*="delete-button"]').should('be.visible');
  cy.get('[data-testid="delete-button-title"]').click();

  // Clicking on permanent delete radio button and checking the service name
  cy.get('[data-testid="hard-delete-option"]').contains(serviceName).click();

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
  toastNotification(`"${serviceName}" deleted successfully!`);

  cy.get(`[data-testid="service-name-${serviceName}"]`).should('not.exist');
};

export const goToAddNewServicePage = (service_type) => {
  // Services page
  interceptURL('GET', '/api/v1/services/*', 'getServiceList');
  cy.settingClick(service_type);
  verifyResponseStatusCode('@getServiceList', 200);

  cy.get('[data-testid="add-service-button"]').should('be.visible').click();

  // Add new service page
  cy.url().should('include', '/add-service');
  cy.get('[data-testid="header"]').should('be.visible');
  cy.contains('Add New Service').should('be.visible');
  cy.get('[data-testid="service-category"]').should('be.visible');
};

// add new tag to entity and its table
export const addNewTagToEntity = (entityObj, term) => {
  const { name, fqn } = term;

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
  if (term.color) {
    cy.get(
      '[data-testid="classification-tags-0"] [data-testid="tags-container"] [data-testid="icon"]'
    ).should('be.visible');
  }
};

export const toastNotification = (msg, closeToast = true) => {
  cy.get('.Toastify__toast-body').should('contain.text', msg);
  cy.wait(200);
  if (closeToast) {
    cy.get('.Toastify__close-button').click();
  }
};

export const addCustomPropertiesForEntity = (
  propertyName,
  customPropertyData,
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

  if (customType === 'Enum') {
    value.values.forEach((val) => {
      cy.get('#root\\/customPropertyConfig').type(`${val}{enter}`);
    });

    cy.clickOutside();

    if (value.multiSelect) {
      cy.get('#root\\/multiSelect').scrollIntoView().click();
    }
  }

  cy.get(descriptionBox).clear().type(customPropertyData.description);

  // Check if the property got added
  cy.intercept('/api/v1/metadata/types/name/*?fields=customProperties').as(
    'customProperties'
  );
  cy.get('[data-testid="create-button"]').scrollIntoView().click();

  cy.wait('@customProperties');
  cy.get('.ant-table-row').should('contain', propertyName);

  // Navigating to home page
  cy.clickOnLogo();
};

export const editCreatedProperty = (propertyName, type) => {
  // Fetching for edit button
  cy.get(`[data-row-key="${propertyName}"]`)
    .find('[data-testid="edit-button"]')
    .as('editButton');

  if (type === 'Enum') {
    cy.get(`[data-row-key="${propertyName}"]`)
      .find('[data-testid="enum-config"]')
      .should('contain', '["enum1","enum2","enum3"]');
  }

  cy.get('@editButton').click();

  cy.get(descriptionBox).clear().type('This is new description');

  if (type === 'Enum') {
    cy.get('#root\\/customPropertyConfig').type(`updatedValue{enter}`);

    cy.clickOutside();
  }

  interceptURL('PATCH', '/api/v1/metadata/types/*', 'checkPatchForDescription');

  cy.get('button[type="submit"]').scrollIntoView().click();

  cy.wait('@checkPatchForDescription', { timeout: 15000 });

  cy.get('.ant-modal-wrap').should('not.exist');

  // Fetching for updated descriptions for the created custom property
  cy.get(`[data-row-key="${propertyName}"]`)
    .find('[data-testid="viewer-container"]')
    .should('contain', 'This is new description');

  if (type === 'Enum') {
    cy.get(`[data-row-key="${propertyName}"]`)
      .find('[data-testid="enum-config"]')
      .should('contain', '["enum1","enum2","enum3","updatedValue"]');
  }
};

export const deleteCreatedProperty = (propertyName) => {
  // Fetching for delete button
  cy.get(`[data-row-key="${propertyName}"]`)
    .scrollIntoView()
    .find('[data-testid="delete-button"]')
    .click();

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
  interceptURL('POST', '/api/v1/users/login', 'loginUser');
  cy.get('[id="email"]').should('be.visible').clear().type(username);
  cy.get('[id="password"]').should('be.visible').clear().type(password);

  // Don't want to show any popup in the tests
  cy.setCookie(`STAR_OMD_USER_${username.split('@')[0]}`, 'true');

  // Get version and set cookie to hide version banner
  cy.request({
    method: 'GET',
    url: `api/v1/system/version`,
  }).then((res) => {
    const version = res.body.version;
    const versionCookie = `VERSION_${version
      .split('-')[0]
      .replaceAll('.', '_')}`;

    cy.setCookie(versionCookie, 'true');
    window.localStorage.setItem('loggedInUsers', username.split('@')[0]);
  });

  cy.get('.ant-btn').contains('Login').should('be.visible').click();
  cy.wait('@loginUser');
};

export const selectTeamHierarchy = (index) => {
  if (index > 0) {
    cy.get('[data-testid="team-type"]')
      .invoke('text')
      .then((text) => {
        cy.log(text);
        checkTeamTypeOptions(text);
        cy.log('check type', text);
        cy.get(
          `.ant-select-dropdown [title="${getTeamType(text).childTeamType}"]`
        ).click();
      });
  } else {
    checkTeamTypeOptions('BusinessUnit');

    cy.get(`.ant-select-dropdown [title='BusinessUnit']`)
      .should('exist')
      .should('be.visible')
      .click();
  }
};

export const addTeam = (teamDetails, index, isHierarchy) => {
  interceptURL('GET', '/api/v1/teams*', 'addTeam');
  // Fetching the add button and clicking on it
  if (index > 0) {
    cy.get('[data-testid="add-placeholder-button"]').click();
  } else {
    cy.get('[data-testid="add-team"]').click();
  }

  verifyResponseStatusCode('@addTeam', 200);

  // Entering team details
  cy.get('[data-testid="name"]').type(teamDetails.name);

  cy.get('[data-testid="display-name"]').type(teamDetails.name);

  cy.get('[data-testid="email"]').type(teamDetails.email);

  cy.get('[data-testid="team-selector"]').click();

  if (isHierarchy) {
    selectTeamHierarchy(index);
  } else {
    cy.get(`.ant-select-dropdown [title="${teamDetails.teamType}"]`).click();
  }

  cy.get(descriptionBox).type(teamDetails.description);

  interceptURL('POST', '/api/v1/teams', 'saveTeam');
  interceptURL('GET', '/api/v1/team*', 'createTeam');

  // Saving the created team
  cy.get('[form="add-team-form"]').scrollIntoView().click();

  verifyResponseStatusCode('@saveTeam', 201);
  verifyResponseStatusCode('@createTeam', 200);
};

export const deleteEntity = (
  entityName,
  serviceName,
  entity,
  successMessageEntityName,
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
  settingsMenuId,
  serviceCategory,
  serviceName,
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

export const visitDataModelPage = (dataModelFQN, dataModelName) => {
  interceptURL('GET', '/api/v1/services/dashboardServices*', 'getServices');
  cy.settingClick(GlobalSettingOptions.DASHBOARDS);
  verifyResponseStatusCode('@getServices', 200);

  interceptURL(
    'GET',
    'api/v1/services/dashboardServices/name/sample_looker*',
    'getDashboardDetails'
  );
  interceptURL(
    'GET',
    '/api/v1/dashboard/datamodels?service=sample_looker*',
    'getDataModels'
  );

  cy.get('[data-testid="service-name-sample_looker"]').scrollIntoView().click();

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

export const signupAndLogin = (email, password, firstName, lastName) => {
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
    login(email, password);
    // cy.goToHomePage(true);
    cy.url().should('eq', `${BASE_URL}/my-data`);

    // Verify user profile
    cy.get('[data-testid="avatar"]').first().trigger('mouseover').click();
    cy.get('[data-testid="user-name"]')
      .should('be.visible')
      .invoke('text')
      .should('contain', `${firstName}${lastName}`);

    interceptURL('GET', 'api/v1/users/name/*', 'getUserPage');

    cy.get('[data-testid="user-name"]').click({ force: true });
    cy.wait('@getUserPage').then((response) => {
      createdUserId = response.response.body.id;
      resolve(createdUserId); // Resolve the promise with the createdUserId
    });
    cy.get(
      '[data-testid="user-profile"] [data-testid="user-profile-details"]'
    ).should('contain', `${firstName}${lastName}`);
  });
};

export const addTags = (classificationName, tagName, entity) => {
  cy.get(
    '[data-testid="entity-right-panel"] [data-testid="tags-container"] [data-testid="add-tag"]'
  ).click();

  cy.get('[data-testid="tag-selector"] #tagsForm_tags').type(tagName);

  cy.get(`[data-testid="tag-${classificationName}.${tagName}"]`).click();

  interceptURL('PATCH', `/api/v1/${entity}/*`, 'patchTag');

  cy.get('[data-testid="saveAssociatedTag"]').click();

  verifyResponseStatusCode('@patchTag', 200);

  cy.get(
    `[data-testid="entity-right-panel"] [data-testid="tags-container"] [data-testid="tag-${classificationName}.${tagName}"]`
  )
    .scrollIntoView()
    .should('be.visible');
};

export const removeTags = (classificationName, tagName, entity) => {
  cy.get(
    '[data-testid="entity-right-panel"] [data-testid="tags-container"] [data-testid="edit-button"]'
  ).click();

  cy.get(
    `[data-testid="selected-tag-${classificationName}.${tagName}"] [data-testid="remove-tags"]`
  ).click();

  interceptURL('PATCH', `/api/v1/${entity}/*`, `patchTag`);

  cy.get('[data-testid="saveAssociatedTag"]').click();

  verifyResponseStatusCode(`@patchTag`, 200);

  cy.get(
    '[data-testid="entity-right-panel"] [data-testid="tags-container"]'
  ).then(($body) => {
    const manageButton = $body.find(
      `[data-testid="tag-${classificationName}.${tagName}"]`
    );

    expect(manageButton.length).to.equal(0);
  });
};

export const addTableFieldTags = (
  dataRowKey,
  classificationName,
  tagName,
  entity
) => {
  cy.get(
    `[data-row-key="${dataRowKey}"] [data-testid="tags-container"] [data-testid="add-tag"]`
  ).click();

  cy.get('[data-testid="tag-selector"] #tagsForm_tags')
    .scrollIntoView()
    .type(tagName);

  cy.get(`[data-testid="tag-${classificationName}.${tagName}"]`).click();

  interceptURL('PATCH', `/api/v1/${entity}/*`, 'patchTag');

  cy.get('[data-testid="saveAssociatedTag"]').click();

  verifyResponseStatusCode('@patchTag', 200);

  cy.get(
    `[data-row-key="${dataRowKey}"] [data-testid="tag-${classificationName}.${tagName}"]`
  )
    .scrollIntoView()
    .should('be.visible');
};

export const removeTableFieldTags = (
  dataRowKey,
  classificationName,
  tagName,
  entity
) => {
  cy.get(
    `[data-row-key="${dataRowKey}"] [data-testid="tags-container"] [data-testid="edit-button"]`
  ).click();

  cy.get(
    `[data-testid="selected-tag-${classificationName}.${tagName}"] [data-testid="remove-tags"]`
  ).click();

  interceptURL('PATCH', `/api/v1/${entity}/*`, `patchTag`);

  cy.get('[data-testid="saveAssociatedTag"]').click();

  verifyResponseStatusCode(`@patchTag`, 200);

  cy.get(`[data-row-key="${dataRowKey}"]`).then(($body) => {
    const manageButton = $body.find(
      `[data-testid="tag-${classificationName}.${tagName}"]`
    );

    expect(manageButton.length).to.equal(0);
  });
};

export const updateDescription = (description, entity) => {
  cy.get(
    '[data-testid="asset-description-container"] [data-testid="edit-description"]'
  ).click();

  cy.get(descriptionBox).should('be.visible').click().clear().type(description);

  interceptURL('PATCH', `/api/v1/${entity}/*`, 'updateDescription');

  cy.get('[data-testid="save"]').click();

  verifyResponseStatusCode('@updateDescription', 200);
};

export const updateTableFieldDescription = (
  dataRowKey,
  description,
  entity
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
