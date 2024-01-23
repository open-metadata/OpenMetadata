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
  interceptURL,
  scheduleIngestion,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import { createEntityTableViaREST } from '../../common/Utils/Entity';
import { DATA_ASSETS, NEW_TABLE_TEST_CASE } from '../../constants/constants';
import { SidebarItem } from '../../constants/Entity.interface';
import { DATABASE_SERVICE } from '../../constants/EntityConstant';
const TABLE_NAME = DATABASE_SERVICE.entity.name;

const goToProfilerTab = () => {
  interceptURL(
    'GET',
    `api/v1/tables/name/${DATABASE_SERVICE.service.name}.*.${TABLE_NAME}?fields=*&include=all`,
    'waitForPageLoad'
  );
  visitEntityDetailsPage({
    term: TABLE_NAME,
    serviceName: DATABASE_SERVICE.service.name,
    entity: DATA_ASSETS.tables,
  });
  verifyResponseStatusCode('@waitForPageLoad', 200);

  cy.get('[data-testid="profiler"]').should('be.visible').click();
};

const acknowledgeTask = (testCase) => {
  goToProfilerTab();

  cy.get('[data-testid="profiler-tab-left-panel"]')
    .contains('Data Quality')
    .click();
  cy.get(`[data-testid="${testCase}"]`)
    .find('.last-run-box.failed')
    .should('be.visible');
  cy.get('.ant-table-row-level-0').should('contain', 'New');
  cy.get(`[data-testid="${testCase}"]`).contains(testCase).click();
  cy.get('[data-testid="edit-resolution-icon"]').click();
  cy.get('[data-testid="test-case-resolution-status-type"]').click();
  cy.get('[title="Ack"]').click();
  interceptURL(
    'POST',
    '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
    'updateTestCaseIncidentStatus'
  );
  cy.get('#update-status-button').click();
  verifyResponseStatusCode('@updateTestCaseIncidentStatus', 200);
  cy.get(`[data-testid="${testCase}-status"]`).should('contain', 'Ack');
};

describe('Incident Manager', () => {
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      createEntityTableViaREST({
        token,
        ...DATABASE_SERVICE,
        tables: [DATABASE_SERVICE.entity],
      });
    });
  });

  describe('Basic Scenario', () => {
    beforeEach(() => {
      cy.login();
      interceptURL('GET', `/api/v1/tables/*/systemProfile?*`, 'systemProfile');
      interceptURL('GET', `/api/v1/tables/*/tableProfile?*`, 'tableProfile');
    });

    it('Add table test case', () => {
      const term = TABLE_NAME;
      goToProfilerTab();
      interceptURL(
        'GET',
        `api/v1/tables/name/${DATABASE_SERVICE.service.name}.*.${term}?include=all`,
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
      cy.get('#tableTestForm_params_columnName').type(
        NEW_TABLE_TEST_CASE.field
      );
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

      interceptURL(
        'GET',
        '/api/v1/services/ingestionPipelines/*/pipelineStatus?startTs=*&endTs=*',
        'getPipelineStatus'
      );
      cy.get('[id*="tab-pipeline"]').click();
      verifyResponseStatusCode('@getPipelineStatus', 200);
      cy.get('[data-testid="run"]').click();
    });

    it("Acknowledge table test case's failure", () => {
      acknowledgeTask(NEW_TABLE_TEST_CASE.name);
    });

    it('Assign incident to user', () => {
      cy.sidebarClick(SidebarItem.INCIDENT_MANAGER);
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
      cy.get('[data-testid="aaron_johnson0"]').click();
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

      cy.sidebarClick(SidebarItem.INCIDENT_MANAGER);

      cy.get(`[data-testid="test-case-${NEW_TABLE_TEST_CASE.name}"]`).click();
      verifyResponseStatusCode('@getTestCase', 200);
      cy.get('[data-testid="incident"]').click();
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
      interceptURL(
        'POST',
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
        'updateTestCaseIncidentStatus'
      );
      cy.get('.ant-modal-footer').contains('Submit').click();
      verifyResponseStatusCode('@updateTestCaseIncidentStatus', 200);
      // Todo: skipping this for now as its not working from backend
      // cy.clickOnLogo();
      // cy.get('[id*="tab-tasks"]').click();
      // cy.get('[data-testid="task-feed-card"]')
      //   .contains(NEW_TABLE_TEST_CASE.name)
      //   .scrollIntoView()
      //   .should('be.visible');
    });

    it('Resolve incident', () => {
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases/name/*?fields=*',
        'getTestCase'
      );
      interceptURL('GET', '/api/v1/feed?entityLink=*&type=Task', 'getTaskFeed');
      cy.sidebarClick(SidebarItem.INCIDENT_MANAGER);
      cy.get(`[data-testid="test-case-${NEW_TABLE_TEST_CASE.name}"]`).click();
      verifyResponseStatusCode('@getTestCase', 200);
      cy.get('[data-testid="incident"]').click();
      verifyResponseStatusCode('@getTaskFeed', 200);
      cy.get('[data-testid="approve-task"]').scrollIntoView().click();
      cy.get('#testCaseFailureReason').click();
      cy.get('[title="Missing Data"]').click();
      cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
        .click()
        .type('test');
      interceptURL(
        'POST',
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
        'updateTestCaseIncidentStatus'
      );
      cy.get('.ant-modal-footer').contains('Submit').click();
      verifyResponseStatusCode('@updateTestCaseIncidentStatus', 200);
    });
  });

  describe('Resolving task from the Incident List Page', () => {
    const testName = `${NEW_TABLE_TEST_CASE.name}_new_name`;

    beforeEach(() => {
      cy.login();
      interceptURL('GET', `/api/v1/tables/*/systemProfile?*`, 'systemProfile');
      interceptURL('GET', `/api/v1/tables/*/tableProfile?*`, 'tableProfile');
    });

    it('Add table test case', () => {
      const term = TABLE_NAME;

      goToProfilerTab();
      interceptURL(
        'GET',
        `api/v1/tables/name/${DATABASE_SERVICE.service.name}.*.${term}?include=all`,
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
      cy.get('#tableTestForm_testName').type(testName);
      cy.get('#tableTestForm_params_columnName').type(
        NEW_TABLE_TEST_CASE.field
      );
      cy.get(descriptionBox).scrollIntoView();
      cy.get(descriptionBox).type(NEW_TABLE_TEST_CASE.description);

      cy.get('[data-testid="submit-test"]').scrollIntoView().click();

      cy.get('[data-testid="success-line"]')
        .scrollIntoView()
        .should('be.visible');

      cy.get('[data-testid="view-service-button"]').click({ force: true });

      verifyResponseStatusCode('@getEntityDetails', 200);

      cy.get('[data-testid="profiler-tab-left-panel"]')
        .contains('Data Quality')
        .click();
      verifyResponseStatusCode('@testCase', 200);
      cy.contains(testName).should('be.visible');

      interceptURL(
        'GET',
        '/api/v1/services/ingestionPipelines/*/pipelineStatus?startTs=*&endTs=*',
        'getPipelineStatus'
      );
      cy.get('[id*="tab-pipeline"]').click();
      verifyResponseStatusCode('@getPipelineStatus', 200);
      cy.get('[data-testid="run"]').click();
    });

    it("Acknowledge table test case's failure", () => {
      acknowledgeTask(testName);
    });

    it('Resolve task from incident list page', () => {
      goToProfilerTab();

      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases?fields=*&entityLink=*&includeAllTests=true&limit=*',
        'testCaseList'
      );
      cy.get('[data-testid="profiler-tab-left-panel"]')
        .contains('Data Quality')
        .click();
      verifyResponseStatusCode('@testCaseList', 200);
      cy.get(`[data-testid="${testName}"]`)
        .find('.last-run-box.failed')
        .should('be.visible');
      cy.get('.ant-table-row-level-0').should('contain', 'New');
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus?latest=true&startTs=*&endTs=*&limit=*',
        'getIncidentList'
      );
      cy.sidebarClick(SidebarItem.INCIDENT_MANAGER);

      verifyResponseStatusCode('@getIncidentList', 200);

      cy.get(`[data-testid="test-case-${testName}"]`).should('be.visible');
      cy.get(`[data-testid="${testName}-status"]`)
        .find(`[data-testid="edit-resolution-icon"]`)
        .click();
      cy.get(`[data-testid="test-case-resolution-status-type"]`).click();
      cy.get(`[title="Resolved"]`).click();
      cy.get('#testCaseResolutionStatusDetails_testCaseFailureReason').click();
      cy.get('[title="Missing Data"]').click();
      cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
        .click()
        .type('test');
      interceptURL(
        'POST',
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
        'updateTestCaseIncidentStatus'
      );
      cy.get('.ant-modal-footer').contains('Submit').click();
      verifyResponseStatusCode('@updateTestCaseIncidentStatus', 200);
    });

    it('Task should be closed', () => {
      goToProfilerTab();
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases/name/*?fields=*',
        'getTestCase'
      );
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases?fields=*&entityLink=*&includeAllTests=true&limit=*',
        'testCaseList'
      );
      interceptURL('GET', '/api/v1/feed?entityLink=*&type=Task', 'getTaskFeed');
      cy.get('[data-testid="profiler-tab-left-panel"]')
        .contains('Data Quality')
        .click();
      verifyResponseStatusCode('@testCaseList', 200);
      cy.get(`[data-testid="${testName}"]`)
        .find('.last-run-box.failed')
        .should('be.visible');

      cy.get(`[data-testid="${testName}"]`).contains(testName).click();
      verifyResponseStatusCode('@getTestCase', 200);
      cy.get('[data-testid="incident"]').click();
      verifyResponseStatusCode('@getTaskFeed', 200);
      cy.get('[data-testid="closed-task"]').click();
      cy.get('[data-testid="task-feed-card"]').should('be.visible');
      cy.get('[data-testid="task-tab"]').should(
        'contain',
        'Resolved the Task.'
      );
    });
  });
});
