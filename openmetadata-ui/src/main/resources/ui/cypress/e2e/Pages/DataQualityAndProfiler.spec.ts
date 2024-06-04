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

import {
  descriptionBox,
  interceptURL,
  selectOptionFromDropdown,
  toastNotification,
  verifyResponseStatusCode,
} from '../../common/common';
import { createEntityTable, hardDeleteService } from '../../common/EntityUtils';
import MysqlIngestionClass from '../../common/Services/MysqlIngestionClass';
import { searchServiceFromSettingPage } from '../../common/serviceUtils';
import {
  DATA_QUALITY_TEST_CASE_DATA,
  prepareDataQualityTestCases,
} from '../../common/Utils/DataQuality';
import { addDomainToEntity } from '../../common/Utils/Domain';
import { visitEntityDetailsPage } from '../../common/Utils/Entity';
import {
  handleIngestionRetry,
  scheduleIngestion,
} from '../../common/Utils/Ingestion';
import { getToken } from '../../common/Utils/LocalStorage';
import { removeOwner, updateOwner } from '../../common/Utils/Owner';
import { goToServiceListingPage, Services } from '../../common/Utils/Services';
import {
  DATA_QUALITY_SAMPLE_DATA_TABLE,
  DELETE_TERM,
  NEW_COLUMN_TEST_CASE,
  NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE,
  NEW_TABLE_TEST_CASE,
  NEW_TEST_SUITE,
} from '../../constants/constants';
import { EntityType, SidebarItem } from '../../constants/Entity.interface';
import { DATABASE_SERVICE } from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';
import { GlobalSettingOptions } from '../../constants/settings.constant';

const OWNER1 = 'Aaron Johnson';
const OWNER2 = 'Cynthia Meyer';
const {
  testCase1,
  testCase2,
  filterTable,
  filterTable2,
  filterTableTestCases,
  filterTable2TestCases,
  customTable,
  domainDetail,
} = DATA_QUALITY_TEST_CASE_DATA;
const TEAM_ENTITY = customTable.name;
const serviceName = DATABASE_SERVICE.service.name;
const goToProfilerTab = (data?: { service: string; entityName: string }) => {
  interceptURL(
    'GET',
    `api/v1/tables/name/${data?.service ?? serviceName}.*.${
      data?.entityName ?? TEAM_ENTITY
    }?fields=*&include=all`,
    'waitForPageLoad'
  );
  visitEntityDetailsPage({
    term: data?.entityName ?? TEAM_ENTITY,
    serviceName: data?.service ?? serviceName,
    entity: EntityType.Table,
  });
  verifyResponseStatusCode('@waitForPageLoad', 200);

  cy.get('[data-testid="profiler"]').should('be.visible').click();
};

const visitTestSuiteDetailsPage = (testSuiteName: string) => {
  interceptURL(
    'GET',
    '/api/v1/dataQuality/testSuites/search/list?*testSuiteType=logical*',
    'testSuite'
  );
  interceptURL('GET', '/api/v1/dataQuality/testCases?fields=*', 'testCase');

  cy.sidebarClick(SidebarItem.DATA_QUALITY);

  cy.get('[data-testid="by-test-suites"]').click();
  verifyResponseStatusCode('@testSuite', 200);
  interceptURL(
    'GET',
    `/api/v1/dataQuality/testSuites/search/list?*${testSuiteName}*testSuiteType=logical*`,
    'testSuiteBySearch'
  );
  cy.get('[data-testid="search-bar-container"]').type(testSuiteName);
  verifyResponseStatusCode('@testSuiteBySearch', 200);
  cy.get(`[data-testid="${testSuiteName}"]`).scrollIntoView().click();
};

const verifyFilterTestCase = () => {
  filterTableTestCases.map((testCase) => {
    cy.get(`[data-testid="${testCase}"]`).scrollIntoView().should('be.visible');
  });
};
const verifyFilter2TestCase = (negation = false) => {
  filterTable2TestCases.map((testCase) => {
    negation
      ? cy.get(`[data-testid="${testCase}"]`).should('not.exist')
      : cy
          .get(`[data-testid="${testCase}"]`)
          .scrollIntoView()
          .should('be.visible');
  });
};

describe(
  'Data Quality and Profiler should work properly',
  { tags: 'Observability' },
  () => {
    const mySql = new MysqlIngestionClass();
    before(() => {
      cy.login();
      cy.getAllLocalStorage().then((data) => {
        const token = getToken(data);

        createEntityTable({
          token,
          ...DATABASE_SERVICE,
          tables: [
            DATABASE_SERVICE.entity,
            filterTable,
            filterTable2,
            customTable,
          ],
        });

        prepareDataQualityTestCases(token);
      });
    });

    after(() => {
      cy.login();
      cy.getAllLocalStorage().then((data) => {
        const token = getToken(data);
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
      goToServiceListingPage(Services.Database);

      mySql.createService();
    });

    it('Add Profiler ingestion', () => {
      const data = {
        entityName: 'alert_entity',
        service: 'cypress-mysql',
      };
      interceptURL(
        'POST',
        '/api/v1/services/ingestionPipelines/deploy/*',
        'deployIngestion'
      );

      goToProfilerTab(data);

      cy.get('[data-testid="no-profiler-placeholder"]').should('be.visible');
      cy.clickOnLogo();

      cy.settingClick(GlobalSettingOptions.DATABASES);

      cy.intercept('/api/v1/services/ingestionPipelines?*').as('ingestionData');
      interceptURL(
        'GET',
        '/api/v1/system/config/pipeline-service-client',
        'airflow'
      );
      searchServiceFromSettingPage(data.service);
      cy.get(`[data-testid="service-name-${data.service}"]`)
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
        .type('10');
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

        handleIngestionRetry(0, 'profiler');
      });
    });

    it('Verifying profiler ingestion', () => {
      goToProfilerTab({
        entityName: 'alert_entity',
        service: 'cypress-mysql',
      });
      cy.get('[data-testid="no-profiler-placeholder"]').should('not.exist');
    });

    it('Add table test case', () => {
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

      cy.get('[data-testid="submit-test"]')
        .scrollIntoView()
        .should('be.visible')
        .click();

      cy.get('[data-testid="success-line"]')
        .scrollIntoView()
        .should('be.visible');
      cy.get('[data-testid="add-ingestion-button"]')
        .should('be.visible')
        .click();
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

      cy.get(`[data-testid="${NEW_TABLE_TEST_CASE.name}"]`).should(
        'be.visible'
      );
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
      cy.get(`[title="${NEW_COLUMN_TEST_CASE.column}"]`)
        .scrollIntoView()
        .click();
      cy.get('#tableTestForm_testName').type(NEW_COLUMN_TEST_CASE.name);
      cy.get('#tableTestForm_testTypeId').scrollIntoView().click();
      cy.get(`[title="${NEW_COLUMN_TEST_CASE.label}"]`)
        .scrollIntoView()
        .click();
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
        .contains('Data Quality')
        .click();
      verifyResponseStatusCode('@testCase', 200);
      cy.get(`[data-testid="${NEW_COLUMN_TEST_CASE.name}"]`).should(
        'be.visible'
      );
      cy.get(`[data-testid="edit-${NEW_COLUMN_TEST_CASE.name}"]`)
        .scrollIntoView()
        .should('be.visible')
        .click();
      cy.get('#tableTestForm_params_minLength')
        .scrollIntoView()
        .should('be.visible')
        .clear()
        .type('4');
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
        .contains('Data Quality')
        .should('be.visible')
        .click();
      verifyResponseStatusCode('@testCase', 200);
      [NEW_COLUMN_TEST_CASE.name, NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name].map(
        (test) => {
          cy.get(`[data-testid="${test}"]`)
            .scrollIntoView()
            .should('be.visible');
          cy.get(`[data-testid="delete-${test}"]`).scrollIntoView().click();
          cy.get('[data-testid="hard-delete-option"]').click();
          cy.get('[data-testid="confirmation-text-input"]').type(DELETE_TERM);
          interceptURL(
            'DELETE',
            '/api/v1/dataQuality/testCases/*?hardDelete=true&recursive=true',
            'deleteTest'
          );
          interceptURL('GET', '/api/v1/dataQuality/testCases?*', 'getTestCase');
          cy.get('[data-testid="confirm-button"]').click();
          verifyResponseStatusCode('@deleteTest', 200);
          verifyResponseStatusCode('@getTestCase', 200);
          toastNotification(`"${test}" deleted successfully!`);
        }
      );
    });

    it('Create logical test suite', () => {
      const testCaseName = 'column_value_max_to_be_between';
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testSuites/search/list?*testSuiteType=logical*',
        'testSuite'
      );
      interceptURL(
        'GET',
        '/api/v1/search/query?q=*&index=test_case_search_index*',
        'getTestCase'
      );

      cy.sidebarClick(SidebarItem.DATA_QUALITY);

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

      updateOwner(OWNER2);
      removeOwner(OWNER2);
      updateOwner(OWNER1);
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

    it('Remove test case from logical test suite', () => {
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

    it('Test suite filters', () => {
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testSuites/search/list?*testSuiteType=logical*',
        'testSuite'
      );
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testSuites/search/list?*owner=*',
        'testSuiteByOwner'
      );
      cy.sidebarClick(SidebarItem.DATA_QUALITY);

      cy.get('[data-testid="by-test-suites"]').click();
      verifyResponseStatusCode('@testSuite', 200);

      // owner filter
      cy.get('[data-testid="owner-select-filter"]').click();
      cy.get("[data-testid='select-owner-tabs']").should('be.visible');
      cy.get('.ant-tabs [id*=tab-users]').click();

      interceptURL(
        'GET',
        `api/v1/search/query?q=*&index=user_search_index*`,
        'searchOwner'
      );

      cy.get('[data-testid="owner-select-users-search-bar"]').type(OWNER1);

      verifyResponseStatusCode('@searchOwner', 200);
      cy.get(`.ant-popover [title="${OWNER1}"]`).click();
      verifyResponseStatusCode('@testSuiteByOwner', 200);
      cy.get(`[data-testid="${NEW_TEST_SUITE.name}"]`)
        .scrollIntoView()
        .should('be.visible');
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

      toastNotification('"mysql_matrix" deleted successfully!');
    });

    it('delete created service', () => {
      goToServiceListingPage(Services.Database);
      mySql.deleteService();
    });

    it('Profiler matrix and test case graph should visible', () => {
      const { term, entity, serviceName, testCaseName } =
        DATA_QUALITY_SAMPLE_DATA_TABLE;
      visitEntityDetailsPage({ term, serviceName, entity });
      cy.get('[data-testid="entity-header-display-name"]')
        .contains(term)
        .should('be.visible');

      cy.get('[data-testid="profiler"]').should('be.visible').click();
      interceptURL(
        'GET',
        '/api/v1/tables/*/columnProfile?*',
        'getProfilerInfo'
      );
      interceptURL('GET', '/api/v1/dataQuality/testCases?*', 'getTestCaseInfo');

      cy.get('[data-testid="profiler-tab-left-panel"]')
        .contains('Column Profile')
        .click();

      cy.get('[data-row-key="shop_id"]')
        .contains('shop_id')
        .scrollIntoView()
        .click();
      verifyResponseStatusCode('@getProfilerInfo', 200);
      verifyResponseStatusCode('@getTestCaseInfo', 200);

      cy.get('#count_graph').scrollIntoView().should('be.visible');
      cy.get('#proportion_graph').scrollIntoView().should('be.visible');
      cy.get('#math_graph').scrollIntoView().should('be.visible');
      cy.get('#sum_graph').scrollIntoView().should('be.visible');

      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases/name/*?fields=*',
        'getTestCaseDetails'
      );
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases/*/testCaseResult?*',
        'getTestResult'
      );
      cy.get('[data-testid="profiler-tab-left-panel"]')
        .contains('Data Quality')
        .click();

      cy.get(`[data-testid="${testCaseName}"]`).contains(testCaseName).click();
      verifyResponseStatusCode('@getTestCaseDetails', 200);
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
      cy.get('[data-testid="view-service-button"]')
        .should('be.visible')
        .click();
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

    it('Array params value should be visible while editing the test case', () => {
      const tableName = DATABASE_SERVICE.entity.name;
      goToProfilerTab({
        service: DATABASE_SERVICE.service.name,
        entityName: tableName,
      });

      interceptURL('GET', '/api/v1/dataQuality/testCases?fields=*', 'testCase');
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testDefinitions/*',
        'testCaseDefinition'
      );
      cy.get('[data-testid="profiler-tab-left-panel"]')
        .contains('Data Quality')
        .click();
      verifyResponseStatusCode('@testCase', 200);
      cy.get(`[data-testid="${testCase2.name}"]`)
        .scrollIntoView()
        .should('be.visible');
      cy.get(`[data-testid="edit-${testCase2.name}"]`)
        .should('be.visible')
        .click();

      verifyResponseStatusCode('@testCaseDefinition', 200);

      cy.get('#tableTestForm_params_allowedValues_0_value')
        .scrollIntoView()
        .should('have.value', 'gmail');
      cy.get('#tableTestForm_params_allowedValues_1_value')
        .scrollIntoView()
        .should('have.value', 'yahoo');
      cy.get('#tableTestForm_params_allowedValues_2_value')
        .scrollIntoView()
        .should('have.value', 'collate');
    });

    it('Validate patch request for edit test case', () => {
      const tableName = DATABASE_SERVICE.entity.name;
      goToProfilerTab({
        service: DATABASE_SERVICE.service.name,
        entityName: tableName,
      });

      interceptURL(
        'PATCH',
        '/api/v1/dataQuality/testCases/*',
        'updateTestCase'
      );
      interceptURL('GET', '/api/v1/dataQuality/testCases?fields=*', 'testCase');
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testDefinitions/*',
        'testCaseDefinition'
      );
      cy.get('[data-testid="profiler-tab-left-panel"]')
        .contains('Data Quality')
        .click();
      verifyResponseStatusCode('@testCase', 200);
      cy.get(`[data-testid="edit-${testCase2.name}"]`).scrollIntoView().click();

      verifyResponseStatusCode('@testCaseDefinition', 200);
      cy.get('#tableTestForm_displayName').type('Table test case display name');
      cy.get('.ant-modal-footer').contains('Submit').click();
      cy.wait('@updateTestCase').then((interception) => {
        const { body } = interception.request;

        expect(body).to.deep.equal([
          {
            op: 'add',
            path: '/displayName',
            value: 'Table test case display name',
          },
        ]);
      });
      cy.get(`[data-testid="edit-${testCase2.name}"]`).scrollIntoView().click();
      cy.get('#tableTestForm_params_allowedValues_0_value')
        .scrollIntoView()
        .clear()
        .type('test');
      cy.get('.ant-modal-footer').contains('Submit').click();
      cy.wait('@updateTestCase').then((interception) => {
        const { body } = interception.request;

        expect(body).to.deep.equal([
          {
            op: 'replace',
            path: '/parameterValues/0/value',
            value: '["test","yahoo","collate"]',
          },
        ]);
      });
      cy.get(`[data-testid="edit-${testCase2.name}"]`).scrollIntoView().click();
      cy.get(descriptionBox).scrollIntoView().type('Test case description');
      cy.get('.ant-modal-footer').contains('Submit').click();
      cy.wait('@updateTestCase').then((interception) => {
        const { body } = interception.request;

        expect(body).to.deep.equal([
          { op: 'add', path: '/description', value: 'Test case description' },
        ]);
      });
    });

    it('Update displayName of test case', () => {
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases/search/list?*',
        'getTestCase'
      );

      cy.sidebarClick(SidebarItem.DATA_QUALITY);

      cy.get('[data-testid="by-test-cases"]').click();
      verifyResponseStatusCode('@getTestCase', 200);
      interceptURL(
        'GET',
        `/api/v1/dataQuality/testCases/search/list?*q=*${testCase1.name}*`,
        'searchTestCase'
      );
      cy.get(
        '[data-testid="test-case-container"] [data-testid="searchbar"]'
      ).type(testCase1.name);
      verifyResponseStatusCode('@searchTestCase', 200);
      cy.get(`[data-testid="${testCase1.name}"]`)
        .scrollIntoView()
        .should('be.visible');
      cy.get(`[data-testid="edit-${testCase1.name}"]`).click();
      cy.get('.ant-modal-body').should('be.visible');
      cy.get('#tableTestForm_displayName').type('Table test case display name');
      interceptURL(
        'PATCH',
        '/api/v1/dataQuality/testCases/*',
        'updateTestCase'
      );
      cy.get('.ant-modal-footer').contains('Submit').click();
      verifyResponseStatusCode('@updateTestCase', 200);
      cy.get(`[data-testid="${testCase1.name}"]`)
        .scrollIntoView()
        .invoke('text')
        .then((text) => {
          expect(text).to.eq('Table test case display name');
        });
    });

    it('Test case filters', () => {
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases/search/list?*',
        'getTestCase'
      );

      interceptURL(
        'GET',
        `/api/v1/search/query?q=*index=tag_search_index*`,
        'searchTags'
      );

      cy.sidebarClick(SidebarItem.DATA_QUALITY);

      cy.get('[data-testid="by-test-cases"]').click();
      verifyResponseStatusCode('@getTestCase', 200);
      interceptURL(
        'GET',
        `/api/v1/dataQuality/testCases/search/list?*q=*${filterTableTestCases[0]}*`,
        'searchTestCase'
      );
      cy.get('[data-testid="advanced-filter"]').click({
        waitForAnimations: true,
      });
      cy.get('[value="tableFqn"]').click({ waitForAnimations: true });
      cy.get('[data-testid="advanced-filter"]').click({
        waitForAnimations: true,
      });
      cy.get('[value="testPlatforms"]').click({ waitForAnimations: true });
      cy.get('[data-testid="advanced-filter"]').click({
        waitForAnimations: true,
      });
      cy.get('[value="lastRunRange"]').click({ waitForAnimations: true });
      cy.get('[data-testid="advanced-filter"]').click({
        waitForAnimations: true,
      });
      cy.get('[value="serviceName"]').click({ waitForAnimations: true });

      cy.get('[data-testid="advanced-filter"]').click({
        waitForAnimations: true,
      });
      cy.get('[value="tags"]').click({ waitForAnimations: true });
      cy.get('[data-testid="advanced-filter"]').click({
        waitForAnimations: true,
      });
      cy.get('[value="tier"]').click({ waitForAnimations: true });

      // Test case search filter
      cy.get(
        '[data-testid="test-case-container"] [data-testid="searchbar"]'
      ).type(filterTableTestCases[0]);
      verifyResponseStatusCode('@searchTestCase', 200);
      cy.get(`[data-testid="${filterTableTestCases[0]}"]`)
        .scrollIntoView()
        .should('be.visible');
      cy.get('.ant-input-clear-icon').click();
      verifyResponseStatusCode('@getTestCase', 200);

      // Test case filter by service name
      interceptURL(
        'GET',
        `/api/v1/dataQuality/testCases/search/list?*serviceName=${DATABASE_SERVICE.service.name}*`,
        'getTestCaseByServiceName'
      );
      interceptURL(
        'GET',
        `/api/v1/search/query?q=*index=database_service_search_index*`,
        'searchService'
      );
      cy.get('#serviceName')
        .scrollIntoView()
        .type(DATABASE_SERVICE.service.name);
      verifyResponseStatusCode('@searchService', 200);
      cy.get('.ant-select-dropdown')
        .not('.ant-select-dropdown-hidden')
        .find(`[data-testid="${DATABASE_SERVICE.service.name}"]`)
        .click({ force: true });
      verifyResponseStatusCode('@getTestCaseByServiceName', 200);
      verifyFilterTestCase();
      verifyFilter2TestCase();
      // remove service filter
      cy.get('[data-testid="advanced-filter"]').click({
        waitForAnimations: true,
      });
      cy.get('[value="serviceName"]').click({ waitForAnimations: true });
      verifyResponseStatusCode('@getTestCase', 200);

      // Test case filter by Tags
      interceptURL(
        'GET',
        `/api/v1/dataQuality/testCases/search/list?*tags=${'PII.None'}*`,
        'getTestCaseByTags'
      );
      cy.get('#tags').scrollIntoView().click().type('PII.None');
      verifyResponseStatusCode('@searchTags', 200);
      cy.get('.ant-select-dropdown')
        .not('.ant-select-dropdown-hidden')
        .find(`[data-testid="${'PII.None'}"]`)
        .click({ force: true });
      verifyResponseStatusCode('@getTestCaseByTags', 200);
      verifyFilterTestCase();
      verifyFilter2TestCase(true);
      // remove service filter
      cy.get('[data-testid="advanced-filter"]').click({
        waitForAnimations: true,
      });
      cy.get('[value="tags"]').click({ waitForAnimations: true });
      verifyResponseStatusCode('@getTestCase', 200);

      // Test case filter by Tier
      interceptURL(
        'GET',
        `/api/v1/dataQuality/testCases/search/list?*tier=${'Tier.Tier2'}*`,
        'getTestCaseByTier'
      );
      cy.get('#tier').click();
      cy.get('.ant-select-dropdown')
        .not('.ant-select-dropdown-hidden')
        .find(`[data-testid="${'Tier.Tier2'}"]`)
        .click({ force: true });
      verifyResponseStatusCode('@getTestCaseByTier', 200);
      verifyFilterTestCase();
      verifyFilter2TestCase(true);
      // remove service filter
      cy.get('[data-testid="advanced-filter"]').click({
        waitForAnimations: true,
      });
      cy.get('[value="tier"]').click({ waitForAnimations: true });
      verifyResponseStatusCode('@getTestCase', 200);

      // Test case filter by table name
      interceptURL(
        'GET',
        `/api/v1/dataQuality/testCases/search/list?*entityLink=*${filterTable.name}*`,
        'searchTestCaseByTable'
      );
      interceptURL(
        'GET',
        `/api/v1/search/query?q=*index=table_search_index*`,
        'searchTable'
      );
      cy.get('#tableFqn').scrollIntoView().type(filterTable.name);
      verifyResponseStatusCode('@searchTable', 200);
      cy.get('.ant-select-dropdown')
        .not('.ant-select-dropdown-hidden')
        .find(
          `[data-testid="${filterTable.databaseSchema}.${filterTable.name}"]`
        )
        .click({ force: true });
      verifyResponseStatusCode('@searchTestCaseByTable', 200);
      verifyFilterTestCase();
      verifyFilter2TestCase(true);

      // Test case filter by test type
      interceptURL(
        'GET',
        `/api/v1/dataQuality/testCases/search/list?*testCaseType=column*`,
        'testCaseTypeByColumn'
      );
      cy.get('[data-testid="test-case-type-select-filter"]').click();
      selectOptionFromDropdown('Column');
      verifyResponseStatusCode('@testCaseTypeByColumn', 200);
      cy.get('[data-testid="search-error-placeholder"]').should('be.visible');

      interceptURL(
        'GET',
        `/api/v1/dataQuality/testCases/search/list?*testCaseType=table*`,
        'testCaseTypeByTable'
      );
      cy.get('[data-testid="test-case-type-select-filter"]').click();
      selectOptionFromDropdown('Table');
      verifyResponseStatusCode('@testCaseTypeByTable', 200);
      verifyFilterTestCase();

      cy.get('[data-testid="test-case-type-select-filter"]').click();
      selectOptionFromDropdown('All');
      verifyResponseStatusCode('@getTestCase', 200);

      // Test case filter by status
      interceptURL(
        'GET',
        `/api/v1/dataQuality/testCases/search/list?*testCaseStatus=Success*`,
        'testCaseStatusBySuccess'
      );
      cy.get('[data-testid="status-select-filter"]').click();
      selectOptionFromDropdown('Success');
      verifyResponseStatusCode('@testCaseStatusBySuccess', 200);
      cy.get('[data-testid="search-error-placeholder"]').should('be.visible');

      interceptURL(
        'GET',
        `/api/v1/dataQuality/testCases/search/list?*testCaseStatus=Failed*`,
        'testCaseStatusByFailed'
      );
      cy.get('[data-testid="status-select-filter"]').click();
      selectOptionFromDropdown('Failed');
      verifyResponseStatusCode('@testCaseStatusByFailed', 200);
      verifyFilterTestCase();

      // Test case filter by platform
      interceptURL(
        'GET',
        `/api/v1/dataQuality/testCases/search/list?*testPlatforms=DBT*`,
        'testCasePlatformByDBT'
      );
      cy.get('[data-testid="platform-select-filter"]').click();
      selectOptionFromDropdown('DBT');
      verifyResponseStatusCode('@testCasePlatformByDBT', 200);
      cy.clickOutside();
      cy.get('[data-testid="search-error-placeholder"]').should('be.visible');
      cy.get(
        '[data-testid="platform-select-filter"] .ant-select-clear'
      ).click();
      verifyResponseStatusCode('@getTestCase', 200);

      interceptURL(
        'GET',
        `/api/v1/dataQuality/testCases/search/list?*testPlatforms=OpenMetadata*`,
        'testCasePlatformByOpenMetadata'
      );
      cy.get('[data-testid="platform-select-filter"]').click();
      selectOptionFromDropdown('OpenMetadata');
      verifyResponseStatusCode('@testCasePlatformByOpenMetadata', 200);
      cy.clickOutside();
      verifyFilterTestCase();
    });

    it('Filter with domain', () => {
      visitEntityDetailsPage({
        term: filterTable.name,
        serviceName: serviceName,
        entity: EntityType.Table,
      });

      addDomainToEntity(domainDetail.name);

      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases/search/list?*',
        'getTestCase'
      );
      cy.get('[data-testid="domain-dropdown"]').click();
      cy.get(`li[data-menu-id*='${domainDetail.name}']`).click();
      cy.sidebarClick(SidebarItem.DATA_QUALITY);

      cy.get('[data-testid="by-test-cases"]').click();
      verifyResponseStatusCode('@getTestCase', 200);

      cy.get('[data-testid="advanced-filter"]').click({
        waitForAnimations: true,
      });
      cy.get('[value="tableFqn"]').click({ waitForAnimations: true });

      // Test case filter by table name
      interceptURL(
        'GET',
        `/api/v1/dataQuality/testCases/search/list?*entityLink=*${filterTable.name}*`,
        'searchTestCaseByTable'
      );
      cy.get('#tableFqn').scrollIntoView().type(filterTable.name);
      cy.get('.ant-select-dropdown')
        .not('.ant-select-dropdown-hidden')
        .find(
          `[data-testid="${filterTable.databaseSchema}.${filterTable.name}"]`
        )
        .click({ force: true });
      verifyResponseStatusCode('@searchTestCaseByTable', 200);
      verifyFilterTestCase();
    });

    it('Update profiler setting modal', () => {
      const profilerSetting = {
        profileSample: '60',
        sampleDataCount: '100',
        profileQuery: 'select * from table',
        excludeColumns: 'user_id',
        includeColumns: 'shop_id',
        partitionColumnName: 'name',
        partitionIntervalType: 'COLUMN-VALUE',
        partitionValues: 'test',
      };
      interceptURL(
        'GET',
        '/api/v1/tables/*/tableProfile?startTs=*',
        'tableProfiler'
      );
      interceptURL('GET', '/api/v1/tables/*/systemProfile?*', 'systemProfiler');
      interceptURL(
        'GET',
        '/api/v1/tables/*/tableProfilerConfig',
        'tableProfilerConfig'
      );
      visitEntityDetailsPage({
        term: DATABASE_SERVICE.entity.name,
        serviceName: DATABASE_SERVICE.service.name,
        entity: EntityType.Table,
      });
      cy.get('[data-testid="profiler"]').should('be.visible').click();
      verifyResponseStatusCode('@tableProfiler', 200);
      verifyResponseStatusCode('@systemProfiler', 200);
      cy.get('[data-testid="profiler-setting-btn"]').click();
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
      cy.get('[data-testid="enable-partition-switch"]')
        .scrollIntoView()
        .click();
      cy.get('[data-testid="interval-type"]').scrollIntoView().click();
      cy.get('.ant-select-dropdown')
        .not('.ant-select-dropdown-hidden')
        .find(`[title="${profilerSetting.partitionIntervalType}"]`)
        .click();
      cy.get('#includeColumnsProfiler_partitionColumnName').click();
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

      cy.get('[data-testid="table_queries"]').click();
      cy.get('[data-testid="profiler"]').click();
      // verify profiler setting details
      cy.get('[data-testid="profiler-setting-btn"]').click();
      // need extra time to load API response
      verifyResponseStatusCode('@tableProfilerConfig', 200, { timeout: 10000 });

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
  }
);
