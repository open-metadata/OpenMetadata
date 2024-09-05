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
  interceptURL,
  selectOptionFromDropdown,
  verifyResponseStatusCode,
} from '../../common/common';
import { createEntityTable, hardDeleteService } from '../../common/EntityUtils';
import {
  DATA_QUALITY_TEST_CASE_DATA,
  prepareDataQualityTestCases,
} from '../../common/Utils/DataQuality';
import { addDomainToEntity } from '../../common/Utils/Domain';
import { visitEntityDetailsPage } from '../../common/Utils/Entity';
import { getToken } from '../../common/Utils/LocalStorage';
import { EntityType, SidebarItem } from '../../constants/Entity.interface';
import { DATABASE_SERVICE } from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';

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
  }
);
