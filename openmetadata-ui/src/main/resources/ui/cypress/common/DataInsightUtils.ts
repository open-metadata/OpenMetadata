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
import { SidebarItem } from '../constants/Entity.interface';
import { interceptURL, verifyResponseStatusCode } from './common';

const BASE_WAIT_TIME = 4000;
const RETRY_TIMES = 3;
let isSuccessStatus = false;

export const checkDataInsightSuccessStatus = (
  count = 1,
  timer = BASE_WAIT_TIME
) => {
  interceptURL(
    'GET',
    '/api/v1/apps/name/DataInsightsApplication/status?*',
    'getAppStatus'
  );
  cy.get('[data-testid="app-run-history-table"]')
    .find('[data-testid="pipeline-status"]')
    .first()
    .as('checkRun');
  // the latest run should be success
  cy.get('@checkRun').then(($ingestionStatus) => {
    if (
      $ingestionStatus.text() !== 'Success' &&
      $ingestionStatus.text() !== 'Failed' &&
      count <= RETRY_TIMES
    ) {
      // retry after waiting with log1 method [4s,8s,16s,32s,64s]
      cy.wait(timer);
      timer *= 2;
      cy.reload();
      verifyResponseStatusCode('@getAppStatus', 200);
      checkDataInsightSuccessStatus(++count, timer * 2);
    } else {
      if ($ingestionStatus.text() !== 'Success') {
        cy.get('@checkRun').should('have.text', 'Success');

        isSuccessStatus = true;
      }

      isSuccessStatus = false;
    }
  });
};

export const verifyKpiChart = () => {
  interceptURL(
    'GET',
    '/api/v1/analytics/dataInsights/charts/aggregate?*',
    'dataInsightsChart'
  );
  checkDataInsightSuccessStatus();

  cy.sidebarClick(SidebarItem.DATA_INSIGHT);
  verifyResponseStatusCode('@dataInsightsChart', 200);
  cy.get('[data-testid="search-dropdown-Team"]').should('be.visible');
  cy.get('[data-testid="search-dropdown-Tier"]').should('be.visible');
  cy.get('[data-testid="summary-card"]').should('be.visible');
  cy.get('[data-testid="kpi-card"]').should('be.visible');
  if (isSuccessStatus) {
    cy.get('#kpi-chart').scrollIntoView().should('be.visible');
  }
};
