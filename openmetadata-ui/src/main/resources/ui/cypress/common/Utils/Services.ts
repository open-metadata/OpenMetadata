/*
 *  Copyright 2024 Collate.
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
import { DELETE_TERM } from '../../constants/constants';
import { EntityType } from '../../constants/Entity.interface';
import {
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
} from '../common';

export enum Services {
  Database = 'Databases',
  Messaging = 'Messaging',
  Dashboard = 'Dashboards',
  Pipeline = 'Pipelines',
  MLModels = 'ML Models',
  Storage = 'Storages',
  Search = 'Search',
}

export const RETRY_TIMES = 4;
export const BASE_WAIT_TIME = 20000;

export const goToServiceListingPage = (services: Services) => {
  interceptURL(
    'GET',
    'api/v1/teams/name/Organization?fields=*',
    'getSettingsPage'
  );
  // Click on settings page
  cy.get('[data-testid="app-bar-item-settings"]').click();
  verifyResponseStatusCode('@getSettingsPage', 200);
  // Services page
  interceptURL('GET', '/api/v1/services/*', 'getServiceList');
  cy.get(`[data-testid="global-setting-left-panel"]`)
    .contains(services)
    .click();

  verifyResponseStatusCode('@getServiceList', 200);
};

export const getEntityTypeFromService = (service: Services) => {
  switch (service) {
    case Services.Dashboard:
      return EntityType.DashboardService;
    case Services.Database:
      return EntityType.DatabaseService;
    case Services.Storage:
      return EntityType.StorageService;
    case Services.Messaging:
      return EntityType.MessagingService;
    case Services.Search:
      return EntityType.SearchService;
    case Services.MLModels:
      return EntityType.MlModelService;
    case Services.Pipeline:
      return EntityType.PipelineService;
    default:
      return EntityType.DatabaseService;
  }
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
        cy.get('[data-testid="pipeline-status"]').should('contain', 'Success');
      }
    });
  };

  checkSuccessState();
};

export const deleteService = (typeOfService: Services, serviceName: string) => {
  interceptURL(
    'GET',
    'api/v1/search/query?q=*&from=0&size=15&index=*',
    'searchService'
  );
  cy.get('[data-testid="searchbar"]').type(serviceName);

  verifyResponseStatusCode('@searchService', 200);

  // click on created service
  cy.get(`[data-testid="service-name-${serviceName}"]`).click();

  cy.get(`[data-testid="entity-header-display-name"]`)
    .invoke('text')
    .then((text) => {
      expect(text).to.equal(serviceName);
    });

  // Clicking on permanent delete radio button and checking the service name
  cy.get('[data-testid="manage-button"]').click();

  cy.get('[data-menu-id*="delete-button"]').should('be.visible');
  cy.get('[data-testid="delete-button-title"]').click().as('deleteBtn');

  // Clicking on permanent delete radio button and checking the service name
  cy.get('[data-testid="hard-delete-option"]').contains(serviceName).click();

  cy.get('[data-testid="confirmation-text-input"]').type(DELETE_TERM);
  interceptURL(
    'DELETE',
    `/api/v1/${getEntityTypeFromService(typeOfService)}/*`,
    'deleteService'
  );
  interceptURL(
    'GET',
    '/api/v1/services/*/name/*?fields=owner',
    'serviceDetails'
  );

  cy.get('[data-testid="confirm-button"]').click();
  verifyResponseStatusCode('@deleteService', 200);

  // Closing the toast notification
  toastNotification(`Service deleted successfully!`);

  cy.get(`[data-testid="service-name-${serviceName}"]`).should('not.exist');
};

export const testConnection = () => {
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
};
