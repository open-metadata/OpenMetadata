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
import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import { checkAndDeleteApp } from '../../common/Utils/Apps';
import { getToken } from '../../common/Utils/LocalStorage';
import { GlobalSettingOptions } from '../../constants/settings.constant';

const visitDataInsightReportApplicationPage = () => {
  interceptURL(
    'GET',
    '/api/v1/apps/name/DataInsightsReportApplication?fields=*',
    'getDataInsightsReportApplication'
  );
  cy.get(
    '[data-testid="data-insights-report-application-card"] [data-testid="config-btn"]'
  ).click();
  verifyResponseStatusCode('@getDataInsightsReportApplication', 200);
};

const logButton = () => {
  // check if the button is disabled to perform the click action
  cy.get('[data-testid="logs"]').then(($logButton) => {
    if ($logButton.is(':enabled')) {
      cy.get('[data-testid="logs"]').click();
      cy.get('[data-testid="logs"]').should('be.visible');
    } else {
      cy.reload();
      logButton();
    }
  });
};

describe('Data Insight Report Application', { tags: 'Settings' }, () => {
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);

      checkAndDeleteApp({
        token,
        applicationName: 'DataInsightsReportApplication',
      });
    });
  });

  beforeEach(() => {
    cy.login();

    interceptURL('GET', '/api/v1/apps?limit=*', 'getApplications');

    cy.settingClick(GlobalSettingOptions.APPLICATIONS);

    verifyResponseStatusCode('@getApplications', 200);
  });

  it('Install application', () => {
    interceptURL('GET', '/api/v1/apps/marketplace?limit=*', 'getMarketPlace');
    interceptURL('POST', '/api/v1/apps', 'installApplication');
    cy.get('[data-testid="add-application"]').click();
    verifyResponseStatusCode('@getMarketPlace', 200);
    cy.get(
      '[data-testid="data-insights-report-application-card"] [data-testid="config-btn"]'
    ).click();
    cy.get('[data-testid="install-application"]').click();
    cy.get('[data-testid="save-button"]').scrollIntoView().click();
    cy.get('[data-testid="submit-btn"]').scrollIntoView().click();
    cy.get('[data-testid="cron-type"]').click();
    // selecting day in week
    cy.get('[data-value="5"]').click();
    cy.get('[data-testid="deploy-button"]').click();
    verifyResponseStatusCode('@installApplication', 201);
    verifyResponseStatusCode('@getApplications', 200);
    cy.get('[data-testid="data-insights-report-application-card"]').should(
      'be.visible'
    );
  });

  it('Edit application', () => {
    interceptURL('PATCH', '/api/v1/apps/*', 'updateApplication');
    visitDataInsightReportApplicationPage();
    cy.get('[data-testid="edit-button"]').click();
    cy.get('[data-testid="cron-type"]').click();
    // selecting day in week
    cy.get('[data-value="3"]').click();
    cy.get('[data-testid="hour-options"]').click();
    cy.get('[title="01"]').click();
    cy.get('.ant-modal-body [data-testid="deploy-button"]').click();
    verifyResponseStatusCode('@updateApplication', 200);
    cy.get('[data-testid="cron-string"]').should('contain', 'At 01:00 AM');

    cy.get('[data-testid="configuration"]').click();

    cy.get('#root\\/sendToAdmins').click();
    cy.get('#root\\/sendToTeams').click();

    cy.get('[data-testid="submit-btn"]').click();
    verifyResponseStatusCode('@updateApplication', 200);
  });

  it('Run application', () => {
    interceptURL(
      'GET',
      '/api/v1/apps/name/DataInsightsReportApplication?fields=*',
      'getDataInsightReportApplication'
    );
    interceptURL(
      'POST',
      '/api/v1/apps/trigger/DataInsightsReportApplication',
      'triggerPipeline'
    );
    cy.get(
      '[data-testid="data-insights-report-application-card"] [data-testid="config-btn"]'
    ).click();
    verifyResponseStatusCode('@getDataInsightReportApplication', 200);
    cy.get('[data-testid="run-now-button"]').click();
    verifyResponseStatusCode('@triggerPipeline', 200);

    // check the logs in the history table
    cy.get('[data-testid="recent-runs"]').click();

    logButton();
  });

  it('Uninstall application', () => {
    interceptURL('GET', '/api/v1/apps?limit=*', 'getApplications');
    interceptURL(
      'DELETE',
      '/api/v1/apps/name/DataInsightsReportApplication?hardDelete=true',
      'deleteApplication'
    );
    visitDataInsightReportApplicationPage();
    cy.get('[data-testid="manage-button"]').click();
    cy.get('[data-testid="uninstall-button-title"]').click();
    cy.get('[data-testid="save-button"]').click();
    verifyResponseStatusCode('@deleteApplication', 200);
    verifyResponseStatusCode('@getApplications', 200);
    cy.get('[data-testid="data-insights-report-application-card"]').should(
      'not.exist'
    );
  });
});
