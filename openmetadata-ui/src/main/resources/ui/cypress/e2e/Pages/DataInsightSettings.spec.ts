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

import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import { BASE_URL } from '../../constants/constants';
import { GlobalSettingOptions } from '../../constants/settings.constant';

describe(
  'Data Insight settings page should work properly',
  { tags: 'Settings' },
  () => {
    beforeEach(() => {
      cy.login();

      interceptURL('GET', '/api/v1/apps?limit=*', 'getApplications');

      cy.settingClick(GlobalSettingOptions.APPLICATIONS);

      verifyResponseStatusCode('@getApplications', 200);
    });

    it('Edit data insight application', () => {
      interceptURL(
        'GET',
        '/api/v1/apps/name/DataInsightsApplication?fields=*',
        'getDataInsightDetails'
      );
      interceptURL('PATCH', '/api/v1/apps/*', 'updateApplication');
      cy.get(
        '[data-testid="data-insights-application-card"] [data-testid="config-btn"]'
      ).click();
      verifyResponseStatusCode('@getDataInsightDetails', 200);
      cy.get('[data-testid="edit-button"]').click();
      cy.get('[data-testid="cron-type"]').click();
      cy.get('.rc-virtual-list [title="Day"]').click();
      cy.get('[data-testid="hour-options"]').click();
      cy.get('.ant-select-dropdown [title="06"]').click();
      cy.get('[data-testid="minute-options"]').click();
      cy.get('.ant-select-dropdown [title="00"]').click();
      cy.get('.ant-modal-body [data-testid="deploy-button"]').click();
      verifyResponseStatusCode('@updateApplication', 200);
      cy.get('[data-testid="cron-string"]').should('contain', 'At 06:00 AM');
    });

    it('Uninstall application', () => {
      interceptURL(
        'GET',
        '/api/v1/apps/name/DataInsightsApplication?fields=*',
        'getDataInsightDetails'
      );
      interceptURL('GET', '/api/v1/apps?limit=*', 'getApplications');
      interceptURL(
        'DELETE',
        '/api/v1/apps/name/DataInsightsApplication?hardDelete=true',
        'deleteApplication'
      );
      cy.get(
        '[data-testid="data-insights-application-card"] [data-testid="config-btn"]'
      ).click();
      verifyResponseStatusCode('@getDataInsightDetails', 200);
      cy.get('[data-testid="manage-button"]').click();
      cy.get('[data-testid="uninstall-button-title"]').click();
      cy.get('[data-testid="save-button"]').click();
      verifyResponseStatusCode('@deleteApplication', 200);
      verifyResponseStatusCode('@getApplications', 200);
      cy.get('[data-testid="data-insights-application-card"]').should(
        'not.exist'
      );
    });

    it('Install application', () => {
      interceptURL('GET', '/api/v1/apps/marketplace?limit=*', 'getMarketPlace');
      interceptURL('POST', '/api/v1/apps', 'installApplication');
      cy.get('[data-testid="add-application"]').click();
      verifyResponseStatusCode('@getMarketPlace', 200);
      cy.get(
        '[data-testid="data-insights-application-card"] [data-testid="config-btn"]'
      ).click();
      cy.get('[data-testid="install-application"]').click();
      cy.get('[data-testid="save-button"]').click();
      cy.get('[data-testid="cron-type"]').click();
      cy.get('.rc-virtual-list [title="Day"]').click();
      cy.get('[data-testid="cron-type"]').should('contain', 'Day');
      cy.get('[data-testid="deploy-button"]').click();
      verifyResponseStatusCode('@installApplication', 201);
      verifyResponseStatusCode('@getApplications', 200);
      cy.get('[data-testid="data-insights-application-card"]').should(
        'be.visible'
      );
    });

    it('Deploy & run application', () => {
      interceptURL(
        'GET',
        '/api/v1/apps/name/DataInsightsApplication?fields=*',
        'getDataInsightDetails'
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
      cy.get(
        '[data-testid="data-insights-application-card"] [data-testid="config-btn"]'
      ).click();
      verifyResponseStatusCode('@getDataInsightDetails', 200);
      cy.get('[data-testid="deploy-button"]').click();
      verifyResponseStatusCode('@deploy', 200);
      cy.reload();
      verifyResponseStatusCode('@getDataInsightDetails', 200);

      // Adding a manual wait to allow some time between deploying the pipeline and triggering it
      // eslint-disable-next-line cypress/no-unnecessary-waiting
      cy.wait(2000);
      cy.get('[data-testid="run-now-button"]').click();
      verifyResponseStatusCode('@triggerPipeline', 200);
      cy.reload();

      cy.get('[data-testid="logs"]').click();
      cy.url().should('eq', `${BASE_URL}/apps/DataInsightsApplication/logs`);
    });
  }
);
