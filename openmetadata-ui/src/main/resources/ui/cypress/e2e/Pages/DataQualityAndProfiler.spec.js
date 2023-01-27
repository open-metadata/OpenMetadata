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
  deleteCreatedService,
  descriptionBox,
  goToAddNewServicePage,
  handleIngestionRetry,
  interceptURL,
  mySqlConnectionInput,
  scheduleIngestion,
  testServiceCreationAndIngestion,
  toastNotification,
  uuid,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import {
  API_SERVICE,
  DATA_QUALITY_SAMPLE_DATA_TABLE,
  DELETE_TERM,
  MYDATA_SUMMARY_OPTIONS,
  NEW_COLUMN_TEST_CASE,
  NEW_TABLE_TEST_CASE,
  NEW_TEST_SUITE,
  SERVICE_TYPE,
  TEAM_ENTITY,
} from '../../constants/constants';

const serviceType = 'Mysql';
const serviceName = `${serviceType}-ct-test-${uuid()}`;
const columnTestName = `${NEW_COLUMN_TEST_CASE.column}_${NEW_COLUMN_TEST_CASE.type}`;

const goToProfilerTab = () => {
  interceptURL(
    'GET',
    `api/v1/tables/name/${serviceName}.*.${TEAM_ENTITY}?fields=*&include=all`,
    'waitForPageLoad'
  );
  visitEntityDetailsPage(
    TEAM_ENTITY,
    serviceName,
    MYDATA_SUMMARY_OPTIONS.tables
  );
  verifyResponseStatusCode('@waitForPageLoad', 200);

  cy.get('[data-testid="Profiler & Data Quality"]')
    .should('be.visible')
    .click();
};

describe('Data Quality and Profiler should work properly', () => {
  beforeEach(() => {
    cy.login();
  });

  it('Add and ingest mysql data', () => {
    goToAddNewServicePage(SERVICE_TYPE.Database);

    const addIngestionInput = () => {
      cy.get('[data-testid="schema-filter-pattern-checkbox"]').check();
      cy.get('[data-testid="filter-pattern-includes-schema"]')
        .should('be.visible')
        .type(Cypress.env('mysqlDatabaseSchema'));
    };

    testServiceCreationAndIngestion(
      serviceType,
      mySqlConnectionInput,
      addIngestionInput,
      serviceName
    );
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

    cy.get('[data-testid="service-summary"] [data-testid="service"]')
      .should('be.visible')
      .click();
    cy.intercept('/api/v1/services/ingestionPipelines?*').as('ingestionData');
    interceptURL('GET', '/api/v1/config/airflow', 'airflow');
    cy.get(`[data-testid="service-name-${serviceName}"]`)
      .should('exist')
      .click();
    cy.get('[data-testid="tabs"]').should('exist');
    cy.wait('@ingestionData');
    verifyResponseStatusCode('@airflow', 200);
    cy.get('[data-testid="Ingestions"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('[data-testid="ingestion-details-container"]').should('exist');
    cy.get('[data-testid="add-new-ingestion-button"]')
      .should('be.visible')
      .click();
    cy.get('#menu-item-1')
      .scrollIntoView()
      .contains('Profiler Ingestion')
      .click();
    cy.get('[data-testid="slider-input"]')
      .scrollIntoView()
      .should('be.visible')
      .and('not.be.disabled')
      .type(10);
    cy.get('[data-testid="next-button"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    scheduleIngestion();

    cy.wait('@deployIngestion').then(() => {
      cy.get('[data-testid="view-service-button"]')
        .scrollIntoView()
        .should('be.visible')
        .click();

      handleIngestionRetry('database', true, 0, 'profiler');
    });
  });

  it('Check if profiler is ingested properly or not', () => {
    goToProfilerTab();
    cy.get('[data-testid="no-profiler-placeholder"]').should('not.exist');
  });

  it('Add table test case with new test suite', () => {
    const term = TEAM_ENTITY;
    goToProfilerTab();
    interceptURL(
      'GET',
      `api/v1/tables/name/${serviceName}.*.${term}?include=all`,
      'addTableTestPage'
    );
    cy.get('[data-testid="profiler-add-table-test-btn"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@addTableTestPage', 200);
    cy.get('[data-testid="create-new-test-suite"]')
      .should('be.visible')
      .click();

    // creating new test suite
    cy.get('[data-testid="new-test-title"]')
      .should('be.visible')
      .contains('New Test Suite');
    cy.get('[data-testid="test-suite-name"]')
      .scrollIntoView()
      .type(NEW_TEST_SUITE.name);
    cy.get(descriptionBox).scrollIntoView().type(NEW_TEST_SUITE.description);
    cy.get('[data-testid="next-button"]').scrollIntoView().click();

    // creating new test case
    cy.get('#tableTestForm_testTypeId').scrollIntoView().click();
    cy.contains(NEW_TABLE_TEST_CASE.type).should('be.visible').click();
    cy.get('#tableTestForm_params_columnName')
      .should('be.visible')
      .type(NEW_TABLE_TEST_CASE.field);
    cy.get(descriptionBox)
      .scrollIntoView()
      .type(NEW_TABLE_TEST_CASE.description);

    cy.get('[data-testid="submit-test"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('[data-testid="success-line"]').should('be.visible');
    cy.get('[data-testid="add-ingestion-button"]').should('be.visible').click();
    scheduleIngestion();

    cy.get('[data-testid="success-line"]').should('be.visible');

    // wait for ingestion to run
    cy.clock();
    cy.wait(10000);
    interceptURL('GET', '/api/v1/testCase?fields=*', 'testCase');
    cy.get('[data-testid="view-service-button"]')
      .should('be.visible')
      .click({ force: true });

    verifyResponseStatusCode('@getEntityDetails', 200);

    verifyResponseStatusCode('@testCase', 200);
    cy.contains(`${TEAM_ENTITY}_${NEW_TABLE_TEST_CASE.type}`).should(
      'be.visible'
    );
  });

  it('Edit Test Case should work properly', () => {
    const testName = `${TEAM_ENTITY}_${NEW_TABLE_TEST_CASE.type}`;
    goToProfilerTab();

    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Data Quality')
      .should('be.visible')
      .click();

    cy.get(`[data-testid="${testName}"]`).should('be.visible');
    cy.get(`[data-testid="edit-${testName}"]`).should('be.visible').click();
    cy.get('#tableTestForm_params_columnName')
      .scrollIntoView()
      .clear()
      .wait(200)
      .type('test');
    interceptURL('PATCH', '/api/v1/testCase/*', 'updateTest');
    cy.get('.ant-modal-footer').contains('Submit').click();
    verifyResponseStatusCode('@updateTest', 200);
    cy.get('.Toastify__toast-body')
      .contains('Test case updated successfully!')
      .should('be.visible')
      .wait(200);
    cy.get(`[data-testid="${testName}"]`).should('be.visible').click();
    cy.contains('columnName: test').scrollIntoView().should('exist');
  });

  it('Delete Test Case should work properly', () => {
    const testName = `${TEAM_ENTITY}_${NEW_TABLE_TEST_CASE.type}`;

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
      '/api/v1/testCase/*?hardDelete=true&recursive=false',
      'deleteTest'
    );
    interceptURL('GET', '/api/v1/testCase?*', 'getTestCase');
    cy.get('[data-testid="confirm-button"]')
      .should('be.visible')
      .should('not.be.disabled')
      .click();
    verifyResponseStatusCode('@deleteTest', 200);
    verifyResponseStatusCode('@getTestCase', 200);
    toastNotification('Test Case deleted successfully!');
    cy.get('[class="ant-empty-description"]')
      .invoke('text')
      .should('eq', 'No data');
  });

  it('Add Column test case should work properly', () => {
    goToProfilerTab();
    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Column Profile')
      .should('be.visible')
      .click();

    cy.get('[data-testid="add-test-id"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    // selecting existing test suite
    cy.get('#selectTestSuite_testSuiteId').should('exist').click();
    cy.contains(NEW_TEST_SUITE.name).should('be.visible').click();
    cy.get('[data-testid="next-button"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    // creating new test case
    cy.get('#tableTestForm_testTypeId').scrollIntoView().click();
    cy.get(`[title="${NEW_COLUMN_TEST_CASE.type}"]`)
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('#tableTestForm_params_minLength')
      .scrollIntoView()
      .should('be.visible')
      .type(NEW_COLUMN_TEST_CASE.min);
    cy.get('#tableTestForm_params_maxLength')
      .scrollIntoView()
      .should('be.visible')
      .type(NEW_COLUMN_TEST_CASE.max);
    cy.get(descriptionBox)
      .scrollIntoView()
      .type(NEW_COLUMN_TEST_CASE.description);

    cy.get('[data-testid="submit-test"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('[data-testid="success-line"]')
      .contains(
        'has been created successfully. This will be picked up in the next run.'
      )
      .should('be.visible');
    cy.get('[data-testid="view-service-button"]').scrollIntoView().click();
    cy.get('.ant-table-row').should(
      'contain',
      'id_columnValueLengthsToBeBetween'
    );
  });

  it('Edit column test case should work properly', () => {
    interceptURL('GET', '/api/v1/testCase?*', 'testCase');
    goToProfilerTab();
    verifyResponseStatusCode('@testCase', 200);
    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Column Profile')
      .should('be.visible')
      .click();
    cy.get('[data-testid="id-test-count"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get(`[data-testid="${columnTestName}"]`).should('be.visible');
    cy.get(`[data-testid="edit-${columnTestName}"]`)
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('#tableTestForm_params_minLength')
      .scrollIntoView()
      .should('be.visible')
      .clear()
      .type(4);
    interceptURL('PATCH', '/api/v1/testCase/*', 'updateTest');
    cy.get('.ant-modal-footer').contains('Submit').click();
    verifyResponseStatusCode('@updateTest', 200);
    cy.get('.Toastify__toast-body')
      .contains('Test case updated successfully!')
      .should('be.visible')
      .wait(200);
    cy.get(`[data-testid="${columnTestName}"]`).should('be.visible').click();
    cy.contains('minLength: 4').scrollIntoView().should('exist');
  });

  it('Delete Column Test Case should work properly', () => {
    interceptURL('GET', '/api/v1/testCase?*', 'testCase');
    goToProfilerTab();
    verifyResponseStatusCode('@testCase', 200);
    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Column Profile')
      .should('be.visible')
      .click();
    cy.get('[data-testid="id-test-count"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get(`[data-testid="${columnTestName}"]`).should('be.visible');
    cy.get(`[data-testid="delete-${columnTestName}"]`)
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('[data-testid="hard-delete-option"]').should('be.visible').click();
    cy.get('[data-testid="confirmation-text-input"]')
      .should('be.visible')
      .type(DELETE_TERM);
    interceptURL(
      'DELETE',
      '/api/v1/testCase/*?hardDelete=true&recursive=false',
      'deleteTest'
    );
    interceptURL('GET', '/api/v1/testCase?*', 'getTestCase');
    cy.get('[data-testid="confirm-button"]')
      .should('be.visible')
      .should('not.be.disabled')
      .click();
    verifyResponseStatusCode('@deleteTest', 200);
    verifyResponseStatusCode('@getTestCase', 200);
    toastNotification('Test Case deleted successfully!');
    cy.get('[class="ant-empty-description"]')
      .invoke('text')
      .should('eq', 'No data');
  });

  it('Delete Test suite should work properly', () => {
    cy.get('[data-testid="appbar-item-data-quality"]')
      .should('be.visible')
      .click();
    cy.get(`[data-row-key="${NEW_TEST_SUITE.name}"] > :nth-child(1) > a`)
      .contains(NEW_TEST_SUITE.name)
      .should('be.visible')
      .click();
    cy.get('[data-testid="test-suite-delete"]').should('be.visible').click();
    cy.get('[data-testid="hard-delete-option"]').should('be.visible').click();
    cy.get('[data-testid="confirmation-text-input"]')
      .should('be.visible')
      .type(DELETE_TERM);
    interceptURL(
      'DELETE',
      '/api/v1/testSuite/*?hardDelete=true&recursive=true',
      'deleteTestSuite'
    );
    cy.get('[data-testid="confirm-button"]')
      .should('be.visible')
      .should('not.be.disabled')
      .click();
    verifyResponseStatusCode('@deleteTestSuite', 200);
    cy.get('.Toastify__toast-body')
      .contains('Test Suite deleted successfully!')
      .should('be.visible')
      .wait(200);
  });

  it('delete created service', () => {
    deleteCreatedService(
      SERVICE_TYPE.Database,
      serviceName,
      API_SERVICE.databaseServices
    );
  });

  it('Profiler matrix and test case graph should visible', () => {
    const { term, entity, serviceName, testCaseName } =
      DATA_QUALITY_SAMPLE_DATA_TABLE;
    visitEntityDetailsPage(term, serviceName, entity);
    cy.get('[data-testid="inactive-link"]').should('be.visible').contains(term);
    cy.get('[data-testid="Profiler & Data Quality"]')
      .should('be.visible')
      .click();
    cy.get('[data-testid="Profiler & Data Quality"]').should(
      'have.class',
      'active'
    );
    interceptURL('GET', '/api/v1/tables/*/columnProfile?*', 'getProfilerInfo');

    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Column Profile')
      .should('be.visible')
      .click();
    cy.get('[data-row-key="shop_id"] > :nth-child(1) > a')
      .scrollIntoView()
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@getProfilerInfo', 200);

    cy.get('#count_graph').scrollIntoView().should('be.visible');
    cy.get('#proportion_graph').scrollIntoView().should('be.visible');
    cy.get('#math_graph').scrollIntoView().should('be.visible');
    cy.get('#sum_graph').scrollIntoView().should('be.visible');

    interceptURL('GET', '/api/v1/testCase?*', 'getTestCaseInfo');
    interceptURL('GET', '/api/v1/testCase/*/testCaseResult?*', 'getTestResult');
    cy.get('[data-testid="profiler-switch"]')
      .contains('Data Quality')
      .scrollIntoView()
      .click();
    verifyResponseStatusCode('@getTestCaseInfo', 200);
    cy.get(`[data-testid="${testCaseName}"]`).should('be.visible').click();
    verifyResponseStatusCode('@getTestResult', 200);
    cy.get(`[id="${testCaseName}_graph"]`).should('be.visible');
  });

  it('SQL query should be visible while editing the test case', () => {
    const { term, entity, serviceName, sqlTestCase, testSuiteName, sqlQuery } =
      DATA_QUALITY_SAMPLE_DATA_TABLE;
    interceptURL(
      'GET',
      `api/v1/tables/name/${serviceName}.*.${term}?fields=*&include=all`,
      'waitForPageLoad'
    );
    visitEntityDetailsPage(term, serviceName, entity);
    verifyResponseStatusCode('@waitForPageLoad', 200);
    cy.get('[data-testid="inactive-link"]').should('be.visible').contains(term);
    cy.get('[data-testid="Profiler & Data Quality"]')
      .should('be.visible')
      .click();
    cy.get('[data-testid="Profiler & Data Quality"]').should(
      'have.class',
      'active'
    );
    interceptURL(
      'GET',
      `api/v1/tables/name/${serviceName}.*.${term}?include=all`,
      'addTableTestPage'
    );
    cy.get('[data-testid="profiler-add-table-test-btn"]')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@addTableTestPage', 200);

    // selecting existing test suite
    cy.get('#selectTestSuite_testSuiteId').should('exist').click();
    cy.contains(testSuiteName).should('be.visible').click();
    cy.get('[data-testid="next-button"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    // creating new test case
    cy.get('#tableTestForm_testTypeId').scrollIntoView().click();
    cy.contains(sqlTestCase).should('be.visible').click();
    cy.get('.CodeMirror-scroll')
      .scrollIntoView()
      .should('be.visible')
      .type(sqlQuery);
    cy.get(descriptionBox).scrollIntoView().type(sqlTestCase);

    cy.get('[data-testid="submit-test"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    interceptURL('GET', '/api/v1/testCase?fields=*', 'testCase');
    interceptURL('GET', '/api/v1/testDefinition/*', 'testCaseDefinition');

    cy.get('[data-testid="success-line"]').should('be.visible');
    cy.get('[data-testid="view-service-button"]').should('be.visible').click();

    verifyResponseStatusCode('@testCase', 200);
    cy.get('[data-testid="dim_address_tableCustomSQLQuery"]').should(
      'be.visible'
    );
    cy.get('[data-testid="edit-dim_address_tableCustomSQLQuery"]')
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@testCaseDefinition', 200);
    cy.get('#tableTestForm').should('be.visible');
    cy.get('.CodeMirror-scroll')
      .scrollIntoView()
      .should('be.visible')
      .contains(sqlQuery);
  });
});
