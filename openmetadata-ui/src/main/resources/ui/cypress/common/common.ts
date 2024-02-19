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

const RETRIES_COUNT = 4;

const TEAM_TYPES = ['Department', 'Division', 'Group'];

export const replaceAllSpacialCharWith_ = (text: string) => {
  return text.replaceAll(/[&/\\#, +()$~%.'":*?<>{}]/g, '_');
};

const isDatabaseService = (type: string) => type === 'database';

export const checkServiceFieldSectionHighlighting = (field: string) => {
  cy.get(`[data-id="${field}"]`).should(
    'have.attr',
    'data-highlighted',
    'true'
  );
};

const getTeamType = (
  currentTeam: string
): {
  childTeamType: string;
  teamTypeOptions: typeof TEAM_TYPES;
} | null => {
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

  return null;
};

const checkTeamTypeOptions = (type: string) => {
  for (const teamType of getTeamType(type)?.teamTypeOptions) {
    cy.get(`.ant-select-dropdown [title="${teamType}"]`)
      .should('exist')
      .should('be.visible');
  }
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
  responseCode: number,
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
    cy.get('#retries')
      .scrollIntoView()
      .clear()
      .type(RETRIES_COUNT + '');
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

// add new tag to entity and its table
export const addNewTagToEntity = (term: typeof NEW_TAG) => {
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

export const toastNotification = (msg: string, closeToast = true) => {
  cy.get('.Toastify__toast-body').should('contain.text', msg);
  cy.wait(200);
  if (closeToast) {
    cy.get('.Toastify__close-button').click();
  }
};

export const selectTeamHierarchy = (index: number) => {
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
    cy.login(email, password);

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
