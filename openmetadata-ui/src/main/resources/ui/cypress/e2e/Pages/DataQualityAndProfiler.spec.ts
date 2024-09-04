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
import { goToServiceListingPage, Services } from '../../common/Utils/Services';
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
  visitEntityDetailsPage({
    term: data?.entityName ?? TEAM_ENTITY,
    serviceName: data?.service ?? serviceName,
    entity: EntityType.Table,
  });

  cy.get('[data-testid="profiler"]').should('be.visible').click();
  cy.get('[data-testid="profiler-tab-left-panel"]')
    .contains('Table Profile')
    .click();
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
        service: 'cypress%mysql',
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

      searchServiceFromSettingPage(data.service);
      cy.get(`[data-testid="service-name-${data.service}"]`)
        .should('exist')
        .click();
      cy.get('[data-testid="tabs"]').should('exist');
      cy.wait('@ingestionData');
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
        service: 'cypress%mysql',
      });
      cy.get('[data-testid="no-profiler-placeholder"]').should('not.exist');
    });

    it('delete created service', () => {
      goToServiceListingPage(Services.Database);
      mySql.deleteService();
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
      cy.get('#tableTestForm_table').should(
        'have.value',
        DATABASE_SERVICE.entity.name
      );
      cy.get('#tableTestForm_column').should('have.value', 'email');
      cy.get('#tableTestForm_name').should('have.value', testCase2.name);
      cy.get('#tableTestForm_testDefinition').should(
        'have.value',
        'Column Values To Be In Set'
      );
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
      cy.get('#serviceName').should('not.exist');

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
      // remove tags filter
      cy.get('[data-testid="advanced-filter"]').click({
        waitForAnimations: true,
      });
      cy.get('[value="tags"]').click({ waitForAnimations: true });
      verifyResponseStatusCode('@getTestCase', 200);
      cy.get('#tags').should('not.exist');

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
      // remove tier filter
      cy.get('[data-testid="advanced-filter"]').click({
        waitForAnimations: true,
      });
      cy.get('[value="tier"]').click({ waitForAnimations: true });
      verifyResponseStatusCode('@getTestCase', 200);
      cy.get('#tier').should('not.exist');

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
      cy.url().then((url) => {
        cy.reload();
        verifyResponseStatusCode('@testCasePlatformByOpenMetadata', 200);
        cy.url().then((updatedUrl) => {
          expect(url).to.be.equal(updatedUrl);
        });
      });

      cy.get('[data-testid="advanced-filter"]').click({
        waitForAnimations: true,
      });
      cy.get('[value="testPlatforms"]').click({
        waitForAnimations: true,
      });
      verifyResponseStatusCode('@getTestCase', 200);
      cy.get('[value="platform-select-filter"]').should('not.exist');
      cy.reload();
      verifyResponseStatusCode('@getTestCase', 200);
      cy.get('[value="tier"]').should('not.exist');
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
      cy.get('[data-testid="profiler-tab-left-panel"]')
        .contains('Table Profile')
        .click();
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
