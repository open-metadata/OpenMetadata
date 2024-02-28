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
  addDomainFilter,
  addEntityFQNFilter,
  addExternalDestination,
  addGetSchemaChangesAction,
  addInternalDestination,
  addOwnerFilter,
  addPipelineStatusUpdatesAction,
  deleteAlertSteps,
  verifyAlertDetails,
} from '../../common/AlertUtils';
import {
  descriptionBox,
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
} from '../../common/common';
import { createEntityTable, hardDeleteService } from '../../common/EntityUtils';
import {
  ALERT_DESCRIPTION,
  ALERT_NAME,
  ALERT_UPDATED_DESCRIPTION,
  INGESTION_PIPELINE_NAME,
  OBSERVABILITY_CREATION_DETAILS,
  TABLE_FQN,
  TEST_CASE_NAME,
  TEST_SUITE_FQN,
} from '../../constants/Alert.constant';
import { DELETE_TERM } from '../../constants/constants';
import { SidebarItem } from '../../constants/Entity.interface';
import {
  DATABASE_SERVICE,
  DOMAIN_CREATION_DETAILS,
  PIPELINE_SERVICE,
  USER_DETAILS,
} from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';

const SOURCE_NAME_1 = 'Container';
const SOURCE_NAME_2 = 'Pipeline';

describe('Observability Alert Flow', { tags: 'Settings' }, () => {
  const data = {
    testCase: {},
    testSuite: {},
    pipelineService: {},
    ingestionPipeline: {},
    user: {
      displayName: '',
    },
    domain: {
      name: '',
    },
    alertDetails: {
      id: '',
    },
  };

  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((storageData) => {
      const token = Object.values(storageData)[0].oidcIdToken;

      // Create a table
      createEntityTable({
        token,
        ...DATABASE_SERVICE,
        tables: [DATABASE_SERVICE.entity],
      });

      // Create a test suite and test case for table
      cy.request({
        method: 'POST',
        url: `/api/v1/dataQuality/testSuites/executable`,
        headers: { Authorization: `Bearer ${token}` },
        body: {
          name: TEST_SUITE_FQN,
          executableEntityReference: TABLE_FQN,
        },
      }).then((response) => {
        data.testSuite = response.body;

        cy.request({
          method: 'POST',
          url: `/api/v1/dataQuality/testCases`,
          headers: { Authorization: `Bearer ${token}` },
          body: {
            name: TEST_CASE_NAME,
            displayName: TEST_CASE_NAME,
            entityLink: `<#E::table::${TABLE_FQN}>`,
            parameterValues: [
              {
                name: 'columnCount',
                value: 7,
              },
            ],
            testDefinition: 'tableColumnCountToEqual',
            testSuite: TEST_SUITE_FQN,
          },
        }).then((testCaseResponse) => {
          data.testCase = testCaseResponse.body;
        });
      });

      // Create a pipeline
      cy.request({
        method: 'POST',
        url: `/api/v1/services/${PIPELINE_SERVICE.serviceType}`,
        headers: { Authorization: `Bearer ${token}` },
        body: PIPELINE_SERVICE.service,
      }).then((pipelineServiceResponse) => {
        data.pipelineService = pipelineServiceResponse.body;

        cy.request({
          method: 'POST',
          url: `/api/v1/${PIPELINE_SERVICE.entityType}`,
          headers: { Authorization: `Bearer ${token}` },
          body: PIPELINE_SERVICE.entity,
        });

        // Create a ingestion pipeline
        cy.request({
          method: 'POST',
          url: `/api/v1/services/ingestionPipelines`,
          headers: { Authorization: `Bearer ${token}` },
          body: {
            airflowConfig: {},
            loggerLevel: 'INFO',
            name: INGESTION_PIPELINE_NAME,
            pipelineType: 'metadata',
            service: {
              id: data.pipelineService.id,
              type: 'pipelineService',
            },
            sourceConfig: {
              config: {},
            },
          },
        }).then((ingestionPipelineResponse) => {
          data.ingestionPipeline = ingestionPipelineResponse.body;
        });
      });

      // Create a new user
      cy.request({
        method: 'POST',
        url: `/api/v1/users/signup`,
        headers: { Authorization: `Bearer ${token}` },
        body: USER_DETAILS,
      }).then((response) => {
        data.user = response.body;
      });

      // Create a domain
      cy.request({
        method: 'PUT',
        url: `/api/v1/domains`,
        headers: { Authorization: `Bearer ${token}` },
        body: DOMAIN_CREATION_DETAILS,
      }).then((response) => {
        data.domain = response.body;
      });
    });
  });

  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((storageData) => {
      const token = Object.values(storageData)[0].oidcIdToken;

      // Delete created services
      hardDeleteService({
        token,
        serviceFqn: DATABASE_SERVICE.service.name,
        serviceType: SERVICE_CATEGORIES.DATABASE_SERVICES,
      });
      hardDeleteService({
        token,
        serviceFqn: PIPELINE_SERVICE.service.name,
        serviceType: PIPELINE_SERVICE.serviceType,
      });

      // Delete created domain
      cy.request({
        method: 'DELETE',
        url: `/api/v1/domains/name/${DOMAIN_CREATION_DETAILS.name}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      // Delete created user
      cy.request({
        method: 'DELETE',
        url: `/api/v1/users/${data.user.id}?hardDelete=true&recursive=false`,
        headers: { Authorization: `Bearer ${token}` },
      });
    });
  });

  beforeEach(() => {
    interceptURL('POST', '/api/v1/events/subscriptions', 'createAlert');
    interceptURL('PUT', '/api/v1/events/subscriptions', 'updateAlert');
    interceptURL('GET', '/api/v1/events/subscriptions/name/*', 'alertDetails');
    interceptURL('GET', '/api/v1/events/subscriptions?*', 'alertsPage');
    cy.login();
    cy.sidebarClick(SidebarItem.OBSERVABILITY_ALERT);
  });

  it('Create new alert Pipeline', () => {
    verifyResponseStatusCode('@alertsPage', 200);

    cy.get('[data-testid="create-observability"]').click();

    // Enter alert name
    cy.get('#name').type(ALERT_NAME);

    // Enter description
    cy.get(descriptionBox).clear().type(ALERT_DESCRIPTION);

    // Select all source
    cy.get('[data-testid="add-source-button"]').scrollIntoView().click();

    cy.get('[data-testid="drop-down-menu"] [data-testid="container-option"]')
      .contains(SOURCE_NAME_1)
      .click();

    cy.get('[data-testid="source-select"]').should('contain', SOURCE_NAME_1);

    // Select filters
    cy.get('[data-testid="add-filters"]').click();

    addOwnerFilter(0, data.user.displayName, false, 'Owner Name');

    // Select actions
    cy.get('[data-testid="add-trigger"]').click();

    addGetSchemaChangesAction(0);

    // Select Destination
    cy.get('[data-testid="add-destination-button"]').scrollIntoView().click();

    addInternalDestination(0, 'Admins', 'Email');

    // Click save
    cy.get('[data-testid="save-button"]').scrollIntoView().click();
    cy.wait('@createAlert').then((interception) => {
      data.alertDetails = interception?.response?.body;

      expect(interception?.response?.statusCode).equal(201);
    });
    toastNotification('Alerts created successfully.');

    // Check if the alert details page is visible
    verifyResponseStatusCode('@alertDetails', 200);
    cy.get('[data-testid="alert-details-container"]').should('exist');
  });

  it('Check created pipeline alert details', () => {
    const { id: alertId } = data.alertDetails;
    verifyResponseStatusCode('@alertsPage', 200);

    cy.get(`[data-row-key="${alertId}"] [data-testid="alert-name"]`)
      .should('contain', ALERT_NAME)
      .click();

    verifyResponseStatusCode('@alertDetails', 200);

    // Verify alert details
    verifyAlertDetails(data.alertDetails);
  });

  it('Edit created alert', () => {
    const { id: alertId } = data.alertDetails;

    // Go to edit alert page
    cy.get('table').should('contain', ALERT_NAME).click();

    cy.get(
      `[data-row-key="${alertId}"] [data-testid="alert-edit-${ALERT_NAME}"]`
    ).click();

    // Update description
    cy.get(descriptionBox).click().clear().type(ALERT_UPDATED_DESCRIPTION);

    // Update source
    cy.get('[data-testid="source-select"]').scrollIntoView().click();
    cy.get('[data-testid="pipeline-option"]').contains(SOURCE_NAME_2).click();

    // Filters should reset after source change
    cy.get('[data-testid="filter-select-0"]').should('not.exist');

    // Add multiple filters
    [...Array(3).keys()].forEach(() => {
      cy.get('[data-testid="add-filters"]').scrollIntoView().click();
    });

    addOwnerFilter(0, data.user.displayName, false, 'Owner Name');
    addEntityFQNFilter(
      1,
      `${PIPELINE_SERVICE.service.name}.${PIPELINE_SERVICE.entity.name}`,
      true,
      'Pipeline Name'
    );
    addDomainFilter(2, data.domain.name);

    // Add actions
    cy.get('[data-testid="add-trigger"]').click();

    addPipelineStatusUpdatesAction(0, 'Successful', true);

    // Add multiple destinations
    [...Array(2).keys()].forEach(() => {
      cy.get('[data-testid="add-destination-button"]').scrollIntoView().click();
    });

    addInternalDestination(1, 'Owners', 'G Chat');
    addInternalDestination(2, 'Teams', 'Slack', 'Team-select', 'Organization');

    // Click save
    cy.get('[data-testid="save-button"]').scrollIntoView().click();
    cy.wait('@updateAlert').then((interception) => {
      data.alertDetails = interception?.response?.body;

      expect(interception?.response?.statusCode).equal(200);

      // Verify the edited alert changes
      verifyAlertDetails(interception?.response?.body);
    });
  });

  it('Delete created alert', () => {
    deleteAlertSteps(ALERT_NAME);
  });

  Object.entries(OBSERVABILITY_CREATION_DETAILS).forEach(
    ([source, alertDetails]) => {
      it(`Alert creation for ${source}`, () => {
        verifyResponseStatusCode('@alertsPage', 200);

        cy.get('[data-testid="create-observability"]').click();

        // Enter alert name
        cy.get('#name').type(ALERT_NAME);

        // Enter description
        cy.get(descriptionBox).clear().type(ALERT_DESCRIPTION);

        // Select source
        cy.get('[data-testid="add-source-button"]').scrollIntoView().click();

        cy.get(
          `[data-testid="drop-down-menu"] [data-testid="${source}-option"]`
        )
          .contains(alertDetails.sourceDisplayName)
          .click();

        cy.get('[data-testid="source-select"]').should(
          'contain',
          alertDetails.sourceDisplayName
        );

        // Add filters
        alertDetails.filters.forEach((filter, filterNumber) => {
          cy.get('[data-testid="add-filters"]').click();

          // Select filter
          cy.get(`[data-testid="filter-select-${filterNumber}"]`).click({
            waitForAnimations: true,
          });
          cy.get(`[data-testid="${filter.name}-filter-option"]`)
            .filter(':visible')
            .click();

          // Search and select filter input value
          interceptURL('GET', `/api/v1/search/query?q=*`, 'getSearchResult');
          cy.get(`[data-testid="${filter.inputSelector}"]`)
            .click()
            .type(filter.inputValue);

          // Adding manual wait here as as safe since debounced API is not being detected in the cypress
          cy.wait(500);
          verifyResponseStatusCode('@getSearchResult', 200);
          cy.get(`[title="${filter.inputValue}"]`)
            .filter(':visible')
            .scrollIntoView()
            .click();

          // Check if option is selected
          cy.get(
            `[title="${filter.inputValue}"] .ant-select-item-option-state`
          ).should('exist');

          if (filter.exclude) {
            // Change filter effect
            cy.get(`[data-testid="filter-switch-${filterNumber}"]`)
              .scrollIntoView()
              .click();
          }
        });

        // Add actions
        alertDetails.actions.forEach((action, actionNumber) => {
          cy.get('[data-testid="add-trigger"]').click();

          // Select action
          cy.get(`[data-testid="trigger-select-${actionNumber}"]`).click({
            waitForAnimations: true,
          });
          cy.get(`[data-testid="${action.name}-filter-option"]`)
            .filter(':visible')
            .click();

          if (action.inputs && action.inputs.length > 0) {
            action.inputs.forEach((input) => {
              // Search and select domain
              interceptURL(
                'GET',
                `/api/v1/search/query?q=*`,
                'getSearchResult'
              );
              cy.get(`[data-testid="${input.inputSelector}"]`)
                .click()
                .type(input.inputValue);
              if (input.waitForAPI) {
                verifyResponseStatusCode('@getSearchResult', 200);
              }
              cy.get(`[title="${input.inputValue}"]`)
                .filter(':visible')
                .scrollIntoView()
                .click();
              cy.get(`[data-testid="${input.inputSelector}"]`).should(
                'contain',
                input.inputValue
              );
              cy.clickOutside();
            });
          }

          if (action.exclude) {
            // Change filter effect
            cy.get(`[data-testid="trigger-switch-${actionNumber}"]`)
              .scrollIntoView()
              .click();
          }
        });

        // Add Destinations
        alertDetails.destinations.forEach((destination, destinationNumber) => {
          cy.get('[data-testid="add-destination-button"]')
            .scrollIntoView()
            .click();

          if (destination.mode === 'internal') {
            addInternalDestination(
              destinationNumber,
              destination.category,
              destination.type,
              destination.inputSelector,
              destination.inputValue
            );
          } else {
            addExternalDestination(
              destinationNumber,
              destination.category,
              destination.inputValue
            );
          }
        });

        // Click save
        cy.get('[data-testid="save-button"]').scrollIntoView().click();
        cy.wait('@createAlert').then((interception) => {
          data.alertDetails = interception?.response?.body;

          expect(interception?.response?.statusCode).equal(201);
        });
        toastNotification('Alerts created successfully.');

        // Check if the alert details page is visible
        verifyResponseStatusCode('@alertDetails', 200);
        cy.get('[data-testid="alert-details-container"]').should('exist');
      });

      it(`Verify created ${source} alert details and delete alert`, () => {
        const { id: alertId } = data.alertDetails;
        verifyResponseStatusCode('@alertsPage', 200);

        cy.get(`[data-row-key="${alertId}"] [data-testid="alert-name"]`)
          .should('contain', ALERT_NAME)
          .click();

        verifyResponseStatusCode('@alertDetails', 200);

        // Verify alert details
        verifyAlertDetails(data.alertDetails);

        // Delete alert
        cy.get('[data-testid="delete-button"]').scrollIntoView().click();
        cy.get('.ant-modal-header').should(
          'contain',
          `Delete subscription "${ALERT_NAME}"`
        );
        cy.get('[data-testid="confirmation-text-input"]').type(DELETE_TERM);
        interceptURL('DELETE', '/api/v1/events/subscriptions/*', 'deleteAlert');
        cy.get('[data-testid="confirm-button"]').click();
        verifyResponseStatusCode('@deleteAlert', 200);

        toastNotification(`"${ALERT_NAME}" deleted successfully!`);
      });
    }
  );
});
