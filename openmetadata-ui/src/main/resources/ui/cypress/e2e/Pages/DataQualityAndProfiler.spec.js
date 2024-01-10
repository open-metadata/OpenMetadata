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
import { createEntityTable, hardDeleteService } from '../../common/EntityUtils';
import { searchServiceFromSettingPage } from '../../common/serviceUtils';
import { addOwner, removeOwner, updateOwner } from '../../common/Utils/Owner';
import {
  API_SERVICE,
  DATA_ASSETS,
  DATA_QUALITY_SAMPLE_DATA_TABLE,
  DELETE_TERM,
  NEW_COLUMN_TEST_CASE,
  NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE,
  NEW_TABLE_TEST_CASE,
  NEW_TEST_SUITE,
  SERVICE_TYPE,
  TEAM_ENTITY,
} from '../../constants/constants';
import { DATABASE_SERVICE } from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';

const serviceType = 'Mysql';
const serviceName = `${serviceType}-ct-test-${uuid()}`;
const tableFqn = `${DATABASE_SERVICE.entity.databaseSchema}.${DATABASE_SERVICE.entity.name}`;
const testSuite = {
  name: `${tableFqn}.testSuite`,
  executableEntityReference: tableFqn,
};
const testCase = {
  name: `user_tokens_table_column_name_to_exist_${uuid()}`,
  entityLink: `<#E::table::${testSuite.executableEntityReference}>`,
  parameterValues: [{ name: 'columnName', value: 'id' }],
  testDefinition: 'tableColumnNameToExist',
  description: 'test case description',
  testSuite: testSuite.name,
};
let testCaseId = '';

const OWNER1 = 'Aaron Johnson';
const OWNER2 = 'Cynthia Meyer';

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
const clickOnTestSuite = (testSuiteName) => {
  cy.get('[data-testid="test-suite-container"]').then(($body) => {
    if ($body.find(`[data-testid="${testSuiteName}"]`).length) {
      cy.get(`[data-testid="${testSuiteName}"]`).scrollIntoView().click();
    } else {
      if ($body.find('[data-testid="next"]').length) {
        cy.get('[data-testid="next"]').click();
        verifyResponseStatusCode('@testSuite', 200);
        clickOnTestSuite(testSuiteName);
      } else {
        throw new Error('Test Suite not found');
      }
    }
  });
};
const visitTestSuiteDetailsPage = (testSuiteName) => {
  interceptURL(
    'GET',
    '/api/v1/dataQuality/testSuites?*testSuiteType=logical*',
    'testSuite'
  );
  interceptURL('GET', '/api/v1/dataQuality/testCases?fields=*', 'testCase');
  cy.get('[data-testid="data-quality"]').click();
  cy.get('[data-testid="app-bar-item-data-contract"]').click();
  cy.get('[data-testid="by-test-suites"]').click();
  verifyResponseStatusCode('@testSuite', 200);
  clickOnTestSuite(testSuiteName);
};

describe('Data Quality and Profiler should work properly', () => {
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      createEntityTable({
        token,
        ...DATABASE_SERVICE,
        tables: [DATABASE_SERVICE.entity],
      });

      cy.request({
        method: 'POST',
        url: `/api/v1/dataQuality/testSuites/executable`,
        headers: { Authorization: `Bearer ${token}` },
        body: testSuite,
      }).then(() => {
        cy.request({
          method: 'POST',
          url: `/api/v1/dataQuality/testCases`,
          headers: { Authorization: `Bearer ${token}` },
          body: testCase,
        }).then((response) => {
          testCaseId = response.body.id;
        });
      });
    });
  });

  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;
      cy.request({
        method: 'DELETE',
        url: `/api/v1/dataQuality/testCases/${testCaseId}?hardDelete=true&recursive=false`,
        headers: { Authorization: `Bearer ${token}` },
      });
      hardDeleteService({
        token,
        serviceFqn: DATABASE_SERVICE.service.name,
        serviceType: SERVICE_CATEGORIES.DATABASE_SERVICES,
      });
    });
  });

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

    cy.get('[data-testid="app-bar-item-settings"]')
      .should('be.visible')
      .click();
    cy.get('[data-menu-id*="services.databases"]').should('be.visible').click();
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

  it('Verifying profiler ingestion', () => {
    goToProfilerTab();
    cy.get('[data-testid="no-profiler-placeholder"]').should('not.exist');
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

    cy.get('[data-testid="submit-test"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('[data-testid="success-line"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="add-ingestion-button"]').should('be.visible').click();
    scheduleIngestion(false);

    cy.get('[data-testid="success-line"]')
      .scrollIntoView()
      .should('be.visible');

    cy.get('[data-testid="view-service-button"]')
      .should('be.visible')
      .click({ force: true });

    verifyResponseStatusCode('@getEntityDetails', 200);

    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Data Quality')
      .click();
    verifyResponseStatusCode('@testCase', 200);
    cy.contains(NEW_TABLE_TEST_CASE.name).should('be.visible');
  });

  it('Edit table test case', () => {
    goToProfilerTab();

    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Data Quality')
      .click();

    cy.get(`[data-testid="${NEW_TABLE_TEST_CASE.name}"]`).should('be.visible');
    cy.get(`[data-testid="edit-${NEW_TABLE_TEST_CASE.name}"]`).click();
    cy.get('#tableTestForm_params_columnName')
      .scrollIntoView()
      .clear()
      .type('test');
    interceptURL('PATCH', '/api/v1/dataQuality/testCases/*', 'updateTest');
    cy.get('.ant-modal-footer').contains('Submit').click();
    verifyResponseStatusCode('@updateTest', 200);
    cy.get('.Toastify__toast-body')
      .contains('Test case updated successfully.')
      .should('be.visible');

    cy.get(`[data-testid="edit-${NEW_TABLE_TEST_CASE.name}"]`).click();
    cy.get('#tableTestForm_params_columnName').should('have.value', 'test');
  });

  it('Add Column test case with min max params', () => {
    goToProfilerTab();
    interceptURL(
      'GET',
      `api/v1/tables/name/${serviceName}.*.${TEAM_ENTITY}?include=all`,
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
    cy.get('[data-testid="column"]').click();

    // creating new test case
    cy.get('#tableTestForm_column').click();
    cy.get(`[title="${NEW_COLUMN_TEST_CASE.column}"]`).scrollIntoView().click();
    cy.get('#tableTestForm_testName').type(NEW_COLUMN_TEST_CASE.name);
    cy.get('#tableTestForm_testTypeId').scrollIntoView().click();
    cy.get(`[title="${NEW_COLUMN_TEST_CASE.label}"]`).scrollIntoView().click();
    cy.get('#tableTestForm_params_minLength')
      .scrollIntoView()
      .type(NEW_COLUMN_TEST_CASE.min);
    cy.get('#tableTestForm_params_maxLength')
      .scrollIntoView()
      .type(NEW_COLUMN_TEST_CASE.max);
    cy.get(descriptionBox)
      .scrollIntoView()
      .type(NEW_COLUMN_TEST_CASE.description);

    cy.get('[data-testid="submit-test"]').scrollIntoView().click();

    cy.get('[data-testid="success-line"]')
      .scrollIntoView()
      .contains(
        'has been created successfully. This will be picked up in the next run.'
      )
      .should('be.visible');
    cy.get('[data-testid="view-service-button"]').scrollIntoView().click();
    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Data Quality')
      .click();
    cy.contains(NEW_COLUMN_TEST_CASE.name)
      .scrollIntoView()
      .should('be.visible');
  });

  it('Add column test case for columnValuesToBeNotNull', () => {
    // Creating new test case and selecting Null team type

    goToProfilerTab();
    interceptURL(
      'GET',
      `api/v1/tables/name/${serviceName}.*.${TEAM_ENTITY}?include=all`,
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
    cy.get('[data-testid="column"]').click();

    cy.get('#tableTestForm_column').click();
    cy.get(`[title="${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.column}"]`)
      .scrollIntoView()
      .click();
    cy.get('#tableTestForm_testName').type(
      NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name
    );
    cy.get('#tableTestForm_testTypeId').type(
      NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.type
    );
    cy.get(`[title="${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.label}"]`).click();
    cy.get(descriptionBox)
      .scrollIntoView()
      .type(NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.description);

    cy.get('[data-testid="submit-test"]').scrollIntoView().click();

    cy.get('[data-testid="success-line"]')
      .contains(
        'has been created successfully. This will be picked up in the next run.'
      )
      .should('be.visible');
    cy.get('[data-testid="view-service-button"]').scrollIntoView().click();
    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Data Quality')
      .click();
    cy.get(
      `[data-testid="${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name}"]`
    ).should('contain', NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name);
  });

  it('Edit column test case should work properly', () => {
    interceptURL('GET', '/api/v1/dataQuality/testCases?*', 'testCase');
    goToProfilerTab();
    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Column Profile')
      .click();
    verifyResponseStatusCode('@testCase', 200);
    cy.get('[data-testid="id-test-count"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get(`[data-testid="${NEW_COLUMN_TEST_CASE.name}"]`).should('be.visible');
    cy.get(`[data-testid="edit-${NEW_COLUMN_TEST_CASE.name}"]`)
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('#tableTestForm_params_minLength')
      .scrollIntoView()
      .should('be.visible')
      .clear()
      .type(4);
    interceptURL('PATCH', '/api/v1/dataQuality/testCases/*', 'updateTest');
    cy.get('.ant-modal-footer').contains('Submit').click();
    verifyResponseStatusCode('@updateTest', 200);
    cy.get('.Toastify__toast-body')
      .contains('Test case updated successfully.')
      .should('be.visible');

    cy.get(`[data-testid="edit-${NEW_COLUMN_TEST_CASE.name}"]`).click();
    cy.get('#tableTestForm_params_minLength').should('have.value', '4');
    cy.get('.ant-modal-footer').contains('Cancel').click();

    // Editing Non Team Type Test Case
    cy.get(
      `[data-testid="${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name}"]`
    ).should('be.visible');
    cy.get(`[data-testid="edit-${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name}"]`)
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('.ant-modal-footer').contains('Cancel').click();
  });

  it('Delete Column Test Case should work properly', () => {
    interceptURL('GET', '/api/v1/dataQuality/testCases?*', 'testCase');
    goToProfilerTab();
    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Column Profile')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@testCase', 200);
    cy.get('[data-testid="id-test-count"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    [NEW_COLUMN_TEST_CASE.name, NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name].map(
      (test) => {
        cy.get(`[data-testid="${test}"]`).scrollIntoView().should('be.visible');
        cy.get(`[data-testid="delete-${test}"]`)
          .scrollIntoView()
          .should('be.visible')
          .click();
        cy.get('[data-testid="hard-delete-option"]')
          .should('be.visible')
          .click();
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
        toastNotification('Test Case deleted successfully!');
      }
    );
  });

  it('Create logical test suite', () => {
    const testCaseName = 'column_value_max_to_be_between';
    interceptURL(
      'GET',
      '/api/v1/dataQuality/testSuites?*testSuiteType=logical*',
      'testSuite'
    );
    interceptURL(
      'GET',
      '/api/v1/search/query?q=*&index=test_case_search_index*',
      'getTestCase'
    );
    cy.get('[data-testid="data-quality"]').click();
    cy.get('[data-testid="app-bar-item-data-contract"]').click();
    cy.get('[data-testid="by-test-suites"]').click();
    verifyResponseStatusCode('@testSuite', 200);
    cy.get('[data-testid="add-test-suite-btn"]').click();

    // creating test suite
    cy.get('[data-testid="test-suite-name"]').type(NEW_TEST_SUITE.name);
    cy.get(descriptionBox).scrollIntoView().type(NEW_TEST_SUITE.description);

    cy.get('[data-testid="submit-button"]').click();
    cy.get('[data-testid="searchbar"]').type(testCaseName);
    verifyResponseStatusCode('@getTestCase', 200);
    cy.get(`[data-testid="${testCaseName}"]`).scrollIntoView().as('testCase');
    cy.get('@testCase').click();
    cy.get('[data-testid="submit"]').scrollIntoView().click();

    cy.get('[data-testid="success-line"]').should(
      'contain',
      'has been created successfully'
    );
  });

  it('User as Owner assign, update & delete for test suite', () => {
    interceptURL(
      'GET',
      '/api/v1/search/query?q=*&index=test_case_search_index*',
      'searchTestCase'
    );
    interceptURL('GET', '/api/v1/dataQuality/testCases?fields=*', 'testCase');
    interceptURL(
      'PUT',
      '/api/v1/dataQuality/testCases/logicalTestCases',
      'putTestCase'
    );

    visitTestSuiteDetailsPage(NEW_TEST_SUITE.name);

    addOwner(OWNER1);
    updateOwner(OWNER2);
    removeOwner(OWNER2);
  });

  it('Add test case to logical test suite', () => {
    const testCaseName = 'column_values_to_be_between';
    interceptURL(
      'GET',
      '/api/v1/search/query?q=*&index=test_case_search_index*',
      'searchTestCase'
    );
    interceptURL('GET', '/api/v1/dataQuality/testCases?fields=*', 'testCase');
    interceptURL(
      'PUT',
      '/api/v1/dataQuality/testCases/logicalTestCases',
      'putTestCase'
    );

    visitTestSuiteDetailsPage(NEW_TEST_SUITE.name);

    cy.get('[data-testid="add-test-case-btn"]').click();
    verifyResponseStatusCode('@testCase', 200);

    cy.get('[data-testid="searchbar"]').type(testCaseName);
    verifyResponseStatusCode('@searchTestCase', 200);
    cy.get(`[data-testid="${testCaseName}"]`)
      .scrollIntoView()
      .as('newTestCase');
    cy.get('@newTestCase').click();
    cy.get('[data-testid="submit"]').scrollIntoView().click();
    verifyResponseStatusCode('@putTestCase', 200);
  });

  it.skip('Remove test case from logical test suite', () => {
    interceptURL('GET', '/api/v1/dataQuality/testCases?fields=*', 'testCase');
    interceptURL(
      'GET',
      '/api/v1/permissions/testSuite/name/mysql_matrix',
      'testSuitePermission'
    );
    interceptURL(
      'DELETE',
      '/api/v1/dataQuality/testCases/logicalTestCases/*/*',
      'removeTestCase'
    );
    visitTestSuiteDetailsPage(NEW_TEST_SUITE.name);
    verifyResponseStatusCode('@testSuitePermission', 200);
    verifyResponseStatusCode('@testCase', 200);

    cy.get('[data-testid="remove-column_values_to_be_between"]').click();
    cy.get('[data-testid="save-button"]').click();
    verifyResponseStatusCode('@removeTestCase', 200);

    cy.get('[data-testid="remove-column_value_max_to_be_between"]').click();
    cy.get('[data-testid="save-button"]').click();
    verifyResponseStatusCode('@removeTestCase', 200);
  });

  it('Delete test suite', () => {
    visitTestSuiteDetailsPage(NEW_TEST_SUITE.name);

    cy.get('[data-testid="manage-button"]').should('be.visible').click();

    cy.get('[data-testid="delete-button"]').should('be.visible').click();

    // Click on Permanent/Hard delete option
    cy.get('[data-testid="hard-delete-option"]')
      .should('contain', NEW_TEST_SUITE.name)
      .should('be.visible')
      .click();

    cy.get('[data-testid="confirm-button"]')
      .should('exist')
      .should('be.disabled');

    cy.get('[data-testid="confirmation-text-input"]')
      .should('be.visible')
      .type(DELETE_TERM);
    interceptURL(
      'DELETE',
      '/api/v1/dataQuality/testSuites/*?hardDelete=true&recursive=true',
      'deleteTestSuite'
    );
    cy.get('[data-testid="confirm-button"]')
      .should('be.visible')
      .should('not.be.disabled')
      .click();
    verifyResponseStatusCode('@deleteTestSuite', 200);

    toastNotification('Test Suite deleted successfully!');
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
    visitEntityDetailsPage({ term, serviceName, entity });
    cy.get('[data-testid="entity-header-display-name"]')
      .contains(term)
      .should('be.visible');

    cy.get('[data-testid="profiler"]').should('be.visible').click();
    interceptURL('GET', '/api/v1/tables/*/columnProfile?*', 'getProfilerInfo');
    interceptURL('GET', '/api/v1/dataQuality/testCases?*', 'getTestCaseInfo');

    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Column Profile')
      .click();
    verifyResponseStatusCode('@getTestCaseInfo', 200);
    cy.get('[data-row-key="shop_id"]')
      .contains('shop_id')
      .scrollIntoView()
      .click();
    verifyResponseStatusCode('@getProfilerInfo', 200);

    cy.get('#count_graph').scrollIntoView().should('be.visible');
    cy.get('#proportion_graph').scrollIntoView().should('be.visible');
    cy.get('#math_graph').scrollIntoView().should('be.visible');
    cy.get('#sum_graph').scrollIntoView().should('be.visible');

    interceptURL(
      'GET',
      '/api/v1/dataQuality/testCases/*/testCaseResult?*',
      'getTestResult'
    );
    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Data Quality')
      .click();

    cy.get(`[data-testid="${testCaseName}"]`).click();
    cy.wait('@getTestResult').then(() => {
      cy.get(`[id="${testCaseName}_graph"]`)
        .scrollIntoView()
        .should('be.visible');
    });
  });

  it('SQL query should be visible while editing the test case', () => {
    const {
      term,
      entity,
      serviceName,
      sqlTestCase,
      sqlQuery,
      sqlTestCaseName,
    } = DATA_QUALITY_SAMPLE_DATA_TABLE;
    interceptURL(
      'GET',
      `api/v1/tables/name/${serviceName}.*.${term}?fields=*&include=all`,
      'waitForPageLoad'
    );
    visitEntityDetailsPage({ term, serviceName, entity });
    verifyResponseStatusCode('@waitForPageLoad', 200);
    cy.get('[data-testid="entity-header-display-name"]').should(
      'contain',
      term
    );

    cy.get('[data-testid="profiler"]').click();
    interceptURL('GET', '/api/v1/dataQuality/testCases?fields=*', 'testCase');
    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Data Quality')
      .click();
    verifyResponseStatusCode('@testCase', 200);
    cy.get('[data-testid="profiler-add-table-test-btn"]').click();
    cy.get('[data-testid="table"]').click();

    // creating new test case
    cy.get('#tableTestForm_testName').type(sqlTestCaseName);
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

    interceptURL('GET', '/api/v1/dataQuality/testCases?fields=*', 'testCase');
    interceptURL(
      'GET',
      '/api/v1/dataQuality/testDefinitions/*',
      'testCaseDefinition'
    );

    cy.get('[data-testid="success-line"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="view-service-button"]').should('be.visible').click();
    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Data Quality')
      .click();
    verifyResponseStatusCode('@testCase', 200);
    cy.get('[data-testid="my_sql_test_case_cypress"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="edit-my_sql_test_case_cypress"]')
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@testCaseDefinition', 200);
    cy.get('#tableTestForm').should('be.visible');
    cy.get('.CodeMirror-scroll')
      .scrollIntoView()
      .should('be.visible')
      .contains(sqlQuery);
  });

  it('Update displayName of test case', () => {
    interceptURL('GET', '/api/v1/dataQuality/testCases?*', 'getTestCase');
    cy.get('[data-testid="data-quality"]').click();
    cy.get('[data-testid="app-bar-item-data-contract"]').click();
    cy.get('[data-testid="by-test-cases"]').click();
    verifyResponseStatusCode('@getTestCase', 200);
    interceptURL(
      'GET',
      `/api/v1/search/query?q=*${testCase.name}*&index=test_case_search_index*`,
      'searchTestCase'
    );
    cy.get(
      '[data-testid="test-case-container"] [data-testid="searchbar"]'
    ).type(testCase.name);
    verifyResponseStatusCode('@searchTestCase', 200);
    cy.get(`[data-testid="${testCase.name}"]`)
      .scrollIntoView()
      .should('be.visible');
    cy.get(`[data-testid="edit-${testCase.name}"]`).click();
    cy.get('.ant-modal-body').should('be.visible');
    cy.get('#tableTestForm_displayName').type('Table test case display name');
    interceptURL('PATCH', '/api/v1/dataQuality/testCases/*', 'updateTestCase');
    cy.get('.ant-modal-footer').contains('Submit').click();
    verifyResponseStatusCode('@updateTestCase', 200);
    cy.get(`[data-testid="${testCase.name}"]`)
      .scrollIntoView()
      .invoke('text')
      .then((text) => {
        expect(text).to.eq('Table test case display name');
      });
  });

  it('Update profiler setting modal', () => {
    const profilerSetting = {
      profileSample: 60,
      sampleDataCount: 100,
      profileQuery: 'select * from table',
      excludeColumns: 'user_id',
      includeColumns: 'shop_id',
      partitionColumnName: 'name',
      partitionIntervalType: 'COLUMN-VALUE',
      partitionValues: 'test',
    };
    interceptURL('GET', '/api/v1/tables/*/tableProfile?*', 'tableProfiler');
    interceptURL('GET', '/api/v1/tables/*/systemProfile?*', 'systemProfiler');
    interceptURL(
      'GET',
      '/api/v1/tables/*/tableProfilerConfig*',
      'tableProfilerConfig'
    );
    visitEntityDetailsPage({
      term: DATABASE_SERVICE.entity.name,
      serviceName: DATABASE_SERVICE.service.name,
      entity: DATA_ASSETS.tables,
    });
    cy.get('[data-testid="profiler"]').should('be.visible').click();
    verifyResponseStatusCode('@tableProfiler', 200);
    verifyResponseStatusCode('@systemProfiler', 200);
    cy.get('[data-testid="profiler-setting-btn"]').click();
    verifyResponseStatusCode('@tableProfilerConfig', 200);
    cy.get('.ant-modal-body').should('be.visible');
    cy.get('[data-testid="slider-input"]')
      .clear()
      .type(profilerSetting.profileSample);
    cy.get('[data-testid="sample-data-count-input"]')
      .clear()
      .type(profilerSetting.sampleDataCount);
    cy.get('[data-testid="exclude-column-select"]')
      .scrollIntoView()
      .type(`${profilerSetting.excludeColumns}{enter}`);
    cy.clickOutside();
    cy.get('.CodeMirror-scroll')
      .scrollIntoView()
      .click()
      .type(profilerSetting.profileQuery);

    cy.get('[data-testid="include-column-select"]').scrollIntoView().click();
    cy.get('.ant-select-dropdown')
      .not('.ant-select-dropdown-hidden')
      .find(`[title="${profilerSetting.includeColumns}"]`)
      .click();
    cy.get('[data-testid="enable-partition-switch"]').scrollIntoView().click();
    cy.get('[data-testid="interval-type"]').scrollIntoView().click();
    cy.get('.ant-select-dropdown')
      .not('.ant-select-dropdown-hidden')
      .find(`[title="${profilerSetting.partitionIntervalType}"]`)
      .click();
    cy.get('[data-testid="column-name"]').click();
    cy.get('.ant-select-dropdown')
      .not('.ant-select-dropdown-hidden')
      .find(`[title="${profilerSetting.partitionColumnName}"]`)
      .click();
    cy.get('[data-testid="partition-value"]')
      .scrollIntoView()
      .type(profilerSetting.partitionValues);

    interceptURL(
      'PUT',
      '/api/v1/tables/*/tableProfilerConfig',
      'updateTableProfilerConfig'
    );
    cy.get('.ant-modal-footer').contains('Save').scrollIntoView().click();
    cy.wait('@updateTableProfilerConfig').then(({ request }) => {
      expect(request.body).to.deep.equal({
        excludeColumns: ['user_id'],
        profileQuery: 'select * from table',
        profileSample: 60,
        profileSampleType: 'PERCENTAGE',
        includeColumns: [{ columnName: 'shop_id' }],
        partitioning: {
          partitionColumnName: 'name',
          partitionIntervalType: 'COLUMN-VALUE',
          partitionValues: ['test'],
          enablePartitioning: true,
        },
        sampleDataCount: 100,
      });
    });

    cy.reload();
    // verify profiler setting details
    verifyResponseStatusCode('@tableProfiler', 200);
    verifyResponseStatusCode('@systemProfiler', 200);
    cy.get('[data-testid="profiler-setting-btn"]').click();
    verifyResponseStatusCode('@tableProfilerConfig', 200);

    cy.get('[data-testid="slider-input"]').should(
      'have.value',
      `${profilerSetting.profileSample}%`
    );
    cy.get('.CodeMirror-scroll').should(
      'contain',
      profilerSetting.profileQuery
    );
    cy.get('[data-testid="exclude-column-select"]').should(
      'contain',
      profilerSetting.excludeColumns
    );
    cy.get('[data-testid="enable-partition-switch"]').should(
      'have.value',
      'true'
    );
    cy.get('[data-testid="interval-type"]').should(
      'contain',
      profilerSetting.partitionIntervalType
    );
    cy.get('[data-testid="column-name"]').should(
      'contain',
      profilerSetting.partitionColumnName
    );
    cy.get('[data-testid="partition-value"]').should(
      'have.value',
      profilerSetting.partitionValues
    );
  });
});
