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
import {
  descriptionBox,
  goToAddNewServicePage,
  handleIngestionRetry,
  interceptURL,
  mySqlConnectionInput,
  scheduleIngestion,
  testServiceCreationAndIngestion,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import { searchServiceFromSettingPage } from '../../common/serviceUtils';
import {
  DATA_ASSETS,
  DELETE_TERM,
  NEW_TABLE_TEST_CASE,
  SERVICE_TYPE,
  TEAM_ENTITY,
  uuid,
} from '../../constants/constants';

const serviceType = 'Mysql';
const serviceName = `${serviceType}-ct-test-${uuid()}`;
const goToProfilerTab = () => {
  interceptURL(
    'GET',
    `api/v1/tables/name/${serviceName}.*.${TEAM_ENTITY}?fields=*&include=all`,
    'waitForPageLoad'
  );
  visitEntityDetailsPage({
    term: TEAM_ENTITY,
    serviceName,
    entity: DATA_ASSETS.tables,
  });
  verifyResponseStatusCode('@waitForPageLoad', 200);

  cy.get('[data-testid="profiler"]').should('be.visible').click();
};

// need to add more scenarios & update existing flow, will be done in septate PR
describe.skip('Incident Manager', () => {
  beforeEach(() => {
    cy.login();
    interceptURL('GET', `/api/v1/tables/*/systemProfile?*`, 'systemProfile');
    interceptURL('GET', `/api/v1/tables/*/tableProfile?*`, 'tableProfile');
  });

  it('Add and ingest mysql data', () => {
    goToAddNewServicePage(SERVICE_TYPE.Database);

    const addIngestionInput = () => {
      cy.get('#root\\/schemaFilterPattern\\/includes')
        .scrollIntoView()
        .type(`${Cypress.env('mysqlDatabaseSchema')}{enter}`);
    };

    testServiceCreationAndIngestion({
      serviceType,
      connectionInput: mySqlConnectionInput,
      addIngestionInput,
      serviceName,
      serviceCategory: SERVICE_TYPE.Database,
    });
  });

  it('Add Profiler ingestion', () => {
    interceptURL(
      'POST',
      '/api/v1/services/ingestionPipelines/deploy/*',
      'deployIngestion'
    );

    goToProfilerTab();

    cy.get('[data-testid="no-profiler-placeholder"]').should('be.visible');

    cy.clickOnLogo();

    cy.sidebarClick('app-bar-item-settings');
    cy.get('[data-menu-id*="databases"]').should('be.visible').click();
    cy.intercept('/api/v1/services/ingestionPipelines?*').as('ingestionData');
    interceptURL(
      'GET',
      '/api/v1/system/config/pipeline-service-client',
      'airflow'
    );
    searchServiceFromSettingPage(serviceName);
    cy.get(`[data-testid="service-name-${serviceName}"]`)
      .should('exist')
      .click();
    cy.get('[data-testid="tabs"]').should('exist');
    cy.wait('@ingestionData');
    verifyResponseStatusCode('@airflow', 200);
    cy.get('[data-testid="ingestions"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('[data-testid="ingestion-details-container"]').should('exist');
    cy.get('[data-testid="add-new-ingestion-button"]')
      .should('be.visible')
      .click();
    cy.get('[data-menu-id*="profiler"')
      .scrollIntoView()
      .contains('Profiler Ingestion')
      .click();
    cy.get('#root\\/profileSample')
      .scrollIntoView()
      .should('be.visible')
      .and('not.be.disabled')
      .type(10);
    cy.get('[data-testid="submit-btn"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    scheduleIngestion(false);

    cy.wait('@deployIngestion').then(() => {
      cy.get('[data-testid="view-service-button"]')
        .scrollIntoView()
        .should('be.visible')
        .click();

      handleIngestionRetry('database', true, 0, 'profiler');
    });
  });

  it('Add table test case', () => {
    const term = TEAM_ENTITY;
    goToProfilerTab();
    interceptURL(
      'GET',
      `api/v1/tables/name/${serviceName}.*.${term}?include=all`,
      'addTableTestPage'
    );
    verifyResponseStatusCode('@systemProfile', 200);
    verifyResponseStatusCode('@tableProfile', 200);
    interceptURL('GET', '/api/v1/dataQuality/testCases?fields=*', 'testCase');
    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Data Quality')
      .click();
    verifyResponseStatusCode('@testCase', 200);
    cy.get('[data-testid="profiler-add-table-test-btn"]').click();
    cy.get('[data-testid="table"]').click();

    // creating new test case
    cy.get('#tableTestForm_testTypeId').scrollIntoView().click();
    cy.contains(NEW_TABLE_TEST_CASE.label).should('be.visible').click();
    cy.get('#tableTestForm_testName').type(NEW_TABLE_TEST_CASE.name);
    cy.get('#tableTestForm_params_columnName').type(NEW_TABLE_TEST_CASE.field);
    cy.get(descriptionBox).scrollIntoView();
    cy.get(descriptionBox).type(NEW_TABLE_TEST_CASE.description);

    cy.get('[data-testid="submit-test"]').scrollIntoView().click();

    cy.get('[data-testid="success-line"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="add-ingestion-button"]').click();
    scheduleIngestion(false);

    cy.get('[data-testid="success-line"]')
      .scrollIntoView()
      .should('be.visible');

    cy.get('[data-testid="view-service-button"]').click({ force: true });

    verifyResponseStatusCode('@getEntityDetails', 200);

    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Data Quality')
      .click();
    verifyResponseStatusCode('@testCase', 200);
    cy.contains(NEW_TABLE_TEST_CASE.name).should('be.visible');
  });

  it("Acknowledge table test case's failure", () => {
    goToProfilerTab();

    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Data Quality')
      .click();
    cy.get(`[data-testid="${NEW_TABLE_TEST_CASE.name}"]`)
      .find('.last-run-box.failed')
      .should('be.visible');
    cy.get('.ant-table-row-level-0').should('contain', 'New');
    cy.get(`[data-testid="${NEW_TABLE_TEST_CASE.name}"]`)
      .contains(NEW_TABLE_TEST_CASE.name)
      .click();
    cy.get('[data-testid="test-case-resolution-status-type"]').click();
    cy.get('[title="Ack"]').click();
    interceptURL(
      'POST',
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
      'updateTestCaseIncidentStatus'
    );
    cy.get('#update-status-button').click();
    verifyResponseStatusCode('@updateTestCaseIncidentStatus', 200);
    cy.get('.ant-table-row-level-0').should('contain', 'Ack');
  });

  it('Assign incident to user', () => {
    cy.sidebarHover();
    cy.get("[data-testid='data-quality'").click();
    cy.sidebarClick('app-bar-item-incident-manager');
    cy.get(`[data-testid="test-case-${NEW_TABLE_TEST_CASE.name}"]`).should(
      'be.visible'
    );
    cy.get(`[data-testid="${NEW_TABLE_TEST_CASE.name}-status"]`)
      .find(`[data-testid="edit-resolution-icon"]`)
      .click();
    cy.get(`[data-testid="test-case-resolution-status-type"]`).click();
    cy.get(`[title="Assigned"]`).click();
    cy.get('#testCaseResolutionStatusDetails_assignee').should('be.visible');
    interceptURL(
      'GET',
      '/api/v1/search/suggest?q=Aaron%20Johnson&index=user_search_index',
      'searchAssignee'
    );
    cy.get('#testCaseResolutionStatusDetails_assignee').type('Aaron Johnson');
    verifyResponseStatusCode('@searchAssignee', 200);
    cy.get('[data-testid="Aaron Johnson"]').click();
    interceptURL(
      'POST',
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
      'updateTestCaseIncidentStatus'
    );
    cy.get('#update-status-button').click();
    verifyResponseStatusCode('@updateTestCaseIncidentStatus', 200);
    cy.get(
      `[data-testid="${NEW_TABLE_TEST_CASE.name}-status"] [data-testid="badge-container"]`
    ).should('contain', 'Assigned');
  });

  it('Re-assign incident to user', () => {
    interceptURL(
      'GET',
      '/api/v1/dataQuality/testCases/name/*?fields=*',
      'getTestCase'
    );
    interceptURL('GET', '/api/v1/feed?entityLink=*&type=Task', 'getTaskFeed');
    cy.sidebarHover();
    cy.get("[data-testid='data-quality'").click();
    cy.sidebarClick('app-bar-item-incident-manager');
    cy.get(`[data-testid="test-case-${NEW_TABLE_TEST_CASE.name}"]`).click();
    verifyResponseStatusCode('@getTestCase', 200);
    cy.get('[data-testid="issue"]').click();
    verifyResponseStatusCode('@getTaskFeed', 200);
    cy.get('[data-testid="reject-task"]').scrollIntoView().click();
    interceptURL(
      'GET',
      '/api/v1/search/suggest?q=admin&index=*user_search_index*',
      'searchAssignee'
    );
    cy.get('[data-testid="select-assignee"]').click().type('admin');
    verifyResponseStatusCode('@searchAssignee', 200);
    cy.get('[data-testid="admin"]').click();
    interceptURL('PUT', '/api/v1/feed/tasks/*/close', 'closeTask');
    cy.get('.ant-modal-footer').contains('Submit').click();
    verifyResponseStatusCode('@closeTask', 200);
    cy.clickOnLogo();
    cy.get('[id*="tab-tasks"]').click();
    cy.get('[data-testid="task-feed-card"]')
      .contains(NEW_TABLE_TEST_CASE.name)
      .scrollIntoView()
      .should('be.visible');
  });

  it('Resolve incident', () => {
    interceptURL(
      'GET',
      '/api/v1/dataQuality/testCases/name/*?fields=*',
      'getTestCase'
    );
    interceptURL('GET', '/api/v1/feed?entityLink=*&type=Task', 'getTaskFeed');
    cy.sidebarHover();
    cy.get("[data-testid='data-quality'").click();
    cy.sidebarClick('app-bar-item-incident-manager');
    cy.get(`[data-testid="test-case-${NEW_TABLE_TEST_CASE.name}"]`).click();
    verifyResponseStatusCode('@getTestCase', 200);
    cy.get('[data-testid="issue"]').click();
    verifyResponseStatusCode('@getTaskFeed', 200);
    cy.get('[data-testid="approve-task"]').scrollIntoView().click();
    cy.get('#testCaseFailureReason').click();
    cy.get('[title="Missing Data"]').click();
    cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
      .click()
      .type('test');
    interceptURL('PUT', '/api/v1/feed/tasks/*/resolve', 'resolveTask');
    cy.get('.ant-modal-footer').contains('Submit').click();
    verifyResponseStatusCode('@resolveTask', 200);
  });

  it('Delete table test case', () => {
    const testName = NEW_TABLE_TEST_CASE.name;

    goToProfilerTab();

    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Data Quality')
      .should('be.visible')
      .click();

    cy.get(`[data-testid="${testName}"]`).should('be.visible');
    cy.get(`[data-testid="delete-${testName}"]`).should('be.visible').click();
    cy.get('[data-testid="hard-delete-option"]').should('be.visible').click();
    cy.get('[data-testid="confirmation-text-input"]')
      .should('be.visible')
      .type(DELETE_TERM);
    interceptURL(
      'DELETE',
      '/api/v1/dataQuality/testCases/*?hardDelete=true&recursive=false',
      'deleteTest'
    );
    interceptURL('GET', '/api/v1/dataQuality/testCases?*', 'getTestCase');
    cy.get('[data-testid="confirm-button"]')
      .should('be.visible')
      .should('not.be.disabled')
      .click();
    verifyResponseStatusCode('@deleteTest', 200);
    verifyResponseStatusCode('@getTestCase', 200);
  });
});
