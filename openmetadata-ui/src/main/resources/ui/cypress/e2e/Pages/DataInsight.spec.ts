/*
 *  Copyright 2023 Collate.
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
  customFormatDateTime,
  getCurrentMillis,
  getEpochMillisForFutureDays,
} from '../../../src/utils/date-time/DateTimeUtils';
import {
  descriptionBox,
  interceptURL,
  verifyResponseStatusCode,
} from '../../common/common';
import { verifyKpiChart } from '../../common/DataInsightUtils';
import { getToken } from '../../common/Utils/LocalStorage';
import {
  EXPLORE_PAGE_TABS,
  SidebarItem,
} from '../../constants/Entity.interface';
import { GlobalSettingOptions } from '../../constants/settings.constant';

const KPI_DATA = [
  {
    dataInsightChart: 'Percentage of Entities With Description',
    displayName: 'Cypress description with percentage',
    metricType: 'completedDescriptionFraction (PERCENTAGE)',
  },
  {
    dataInsightChart: 'Percentage of Entities With Owner',
    displayName: 'Cypress Owner with percentage',
    metricType: 'hasOwnerFraction (PERCENTAGE)',
  },
];

const deleteKpiRequest = () => {
  cy.get('[data-menu-id*="kpi"]').click();
  cy.wait('@getKpi').then(({ response }) => {
    const data = response.body.data;
    if (data.length > 0) {
      cy.getAllLocalStorage().then((storageData) => {
        const token = getToken(storageData);

        data.forEach((element) => {
          cy.request({
            method: 'DELETE',
            url: `/api/v1/kpi/${element.id}?hardDelete=true&recursive=false`,
            headers: { Authorization: `Bearer ${token}` },
          }).then((response) => {
            expect(response.status).to.eq(200);
          });
        });
      });
      cy.reload();
    }
  });
};

const addKpi = (data) => {
  const startDate = customFormatDateTime(getCurrentMillis(), 'yyyy-MM-dd');
  const endDate = customFormatDateTime(
    getEpochMillisForFutureDays(1),
    'yyyy-MM-dd'
  );
  interceptURL('POST', '/api/v1/kpi', 'createKpi');
  cy.get('#dataInsightChart').click();
  cy.get(`.ant-select-dropdown [title="${data.dataInsightChart}"]`).click();
  cy.get('[data-testid="displayName"]').type(data.displayName);
  cy.get('#metricType').click();
  cy.get(`.ant-select-dropdown [title="${data.metricType}"]`).click();
  cy.get('[data-testid="metric-percentage-input"] [role="spinbutton"]')
    .scrollIntoView()
    .type('100');
  cy.get('[data-testid="start-date"]').click().type(`${startDate}{enter}`);
  cy.get('[data-testid="end-date"]').click().type(`${endDate}{enter}`);
  cy.get(descriptionBox).scrollIntoView().type('cypress test');
  cy.get('[data-testid="submit-btn"]').scrollIntoView().click();
  verifyResponseStatusCode('@createKpi', 201);
};

describe('Data Insight feature', { tags: 'Observability' }, () => {
  beforeEach(() => {
    interceptURL(
      'GET',
      '/api/v1/analytics/dataInsights/charts/aggregate?*',
      'dataInsightsChart'
    );
    interceptURL('GET', '/api/v1/kpi?fields=*', 'getKpi');
    cy.login();
  });

  it('Initial setup', () => {
    cy.sidebarClick(SidebarItem.DATA_INSIGHT);
    verifyResponseStatusCode('@dataInsightsChart', 200);
    deleteKpiRequest();
  });

  it('Create description and owner KPI', () => {
    cy.sidebarClick(SidebarItem.DATA_INSIGHT);
    verifyResponseStatusCode('@dataInsightsChart', 200);
    cy.get('[data-menu-id*="kpi"]').click();
    KPI_DATA.map((data) => {
      cy.get('[data-testid="add-kpi-btn"]').click();
      verifyResponseStatusCode('@getKpi', 200);
      addKpi(data);
    });
  });

  it('Deploy data insight index', () => {
    interceptURL('GET', '/api/v1/apps?limit=*', 'apps');
    interceptURL(
      'GET',
      '/api/v1/apps/name/DataInsightsApplication?*',
      'dataInsightsApplication'
    );
    interceptURL(
      'POST',
      '/api/v1/apps/deploy/DataInsightsApplication',
      'deploy'
    );
    interceptURL(
      'POST',
      '/api/v1/apps/trigger/DataInsightsApplication',
      'triggerPipeline'
    );
    cy.settingClick(GlobalSettingOptions.APPLICATIONS);
    verifyResponseStatusCode('@apps', 200);
    cy.get(
      '[data-testid="data-insights-application-card"] [data-testid="config-btn"]'
    ).click();
    verifyResponseStatusCode('@dataInsightsApplication', 200);
    cy.get('[data-testid="deploy-button"]').click();
    verifyResponseStatusCode('@deploy', 200);
    cy.reload();
    verifyResponseStatusCode('@dataInsightsApplication', 200);

    // Adding a manual wait to allow some time between deploying the pipeline and triggering it
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(2000);
    cy.get('[data-testid="run-now-button"]').click();
    verifyResponseStatusCode('@triggerPipeline', 200);
    cy.reload();
    verifyKpiChart();
  });

  it('Verifying Data assets tab', () => {
    cy.sidebarClick(SidebarItem.DATA_INSIGHT);
    verifyResponseStatusCode('@dataInsightsChart', 200);
    cy.get('[data-testid="search-dropdown-Team"]').should('be.visible');
    cy.get('[data-testid="search-dropdown-Tier"]').should('be.visible');
    cy.get('[data-testid="summary-card"]').should('be.visible');
    cy.get('[data-testid="kpi-card"]').should('be.visible');
    cy.get('#entity-summary-chart').scrollIntoView().should('be.visible');
    cy.get('#PercentageOfEntitiesWithDescriptionByType-graph')
      .scrollIntoView()
      .should('be.visible');
    cy.get('#PercentageOfServicesWithDescription-graph')
      .scrollIntoView()
      .should('be.visible');
    cy.get('#PercentageOfEntitiesWithOwnerByType-graph')
      .scrollIntoView()
      .should('be.visible');
    cy.get('#PercentageOfServicesWithOwner-graph')
      .scrollIntoView()
      .should('be.visible');
    cy.get('#TotalEntitiesByTier-graph').scrollIntoView().should('be.visible');
  });

  it('Verify No owner and description redirection to explore page', () => {
    cy.sidebarClick(SidebarItem.DATA_INSIGHT);
    verifyResponseStatusCode('@dataInsightsChart', 200);
    interceptURL(
      'GET',
      '/api/v1/search/query?*descriptionStatus*INCOMPLETE*',
      'noDescriptionAssets'
    );
    cy.get('[data-testid="explore-asset-with-no-description"]')
      .scrollIntoView()
      .click();
    Object.values(EXPLORE_PAGE_TABS).map((tab) => {
      cy.get(`[data-testid="${tab}-tab"]`).scrollIntoView().click();
      verifyResponseStatusCode('@noDescriptionAssets', 200);
      cy.get('[data-testid="advance-search-filter-text"]').should(
        'contain',
        "descriptionStatus = 'INCOMPLETE'"
      );
    });

    cy.sidebarClick(SidebarItem.DATA_INSIGHT);
    verifyResponseStatusCode('@dataInsightsChart', 200);
    interceptURL(
      'GET',
      '/api/v1/search/query?*must_not*exists*owner.displayName.keyword*',
      'noOwnerAssets'
    );
    cy.get('[data-testid="explore-asset-with-no-owner"]')
      .scrollIntoView()
      .click();

    Object.values(EXPLORE_PAGE_TABS).map((tab) => {
      cy.get(`[data-testid="${tab}-tab"]`).scrollIntoView().click();
      verifyResponseStatusCode('@noOwnerAssets', 200);
      cy.get('[data-testid="advance-search-filter-text"]').should(
        'contain',
        'owner.displayName.keyword IS NULL'
      );
    });
  });

  it('Verifying App analytics tab', () => {
    cy.sidebarClick(SidebarItem.DATA_INSIGHT);
    cy.get('[data-menu-id*="app-analytics"]').click();
    verifyResponseStatusCode('@dataInsightsChart', 200);
    cy.get('[data-testid="summary-card-content"]').should('be.visible');
    cy.get('[data-testid="entity-summary-card-percentage"]')
      .contains('Most Viewed Data Assets')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="entity-page-views-card"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="entity-active-user-card"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="entity-summary-card-percentage"]')
      .contains('Most Active Users')
      .scrollIntoView()
      .should('be.visible');
  });

  it('Verifying KPI tab', () => {
    cy.sidebarClick(SidebarItem.DATA_INSIGHT);
    cy.get('[data-menu-id*="kpi"]').click();
    verifyResponseStatusCode('@getKpi', 200);
    cy.get('[data-testid="kpi-card"]').should('be.visible');
    cy.get(
      '[data-row-key="cypress-description-with-percentage-completed-description-fraction"]'
    )
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-row-key="cypress-owner-with-percentage-has-owner-fraction"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it('Update KPI', () => {
    interceptURL('GET', '/api/v1/kpi/name/*', 'fetchKpiByName');
    interceptURL('PATCH', '/api/v1/kpi/*', 'updateKpi');
    cy.sidebarClick(SidebarItem.DATA_INSIGHT);
    verifyResponseStatusCode('@dataInsightsChart', 200);
    cy.get('[data-menu-id*="kpi"]').click();
    verifyResponseStatusCode('@getKpi', 200);
    KPI_DATA.map((data) => {
      cy.get(`[data-testid="edit-action-${data.displayName}"]`).click();
      verifyResponseStatusCode('@fetchKpiByName', 200);
      cy.get('[data-testid="metric-percentage-input"] [role="spinbutton"]')
        .scrollIntoView()
        .clear()
        .type('50');
      cy.get('[data-testid="submit-btn"]').scrollIntoView().click();
      verifyResponseStatusCode('@updateKpi', 200);
    });
  });

  it('Delete Kpi', () => {
    interceptURL('GET', '/api/v1/kpi/name/*', 'fetchKpiByName');
    interceptURL(
      'DELETE',
      '/api/v1/kpi/*?hardDelete=true&recursive=false',
      'deleteKpi'
    );
    cy.sidebarClick(SidebarItem.DATA_INSIGHT);
    verifyResponseStatusCode('@dataInsightsChart', 200);
    cy.get('[data-menu-id*="kpi"]').click();
    verifyResponseStatusCode('@getKpi', 200);
    KPI_DATA.map((data) => {
      cy.get(`[data-testid="delete-action-${data.displayName}"]`).click();
      cy.get('[data-testid="confirmation-text-input"]').type('DELETE');
      cy.get('[data-testid="confirm-button"]').click();
      verifyResponseStatusCode('@deleteKpi', 200);
    });
  });
});
