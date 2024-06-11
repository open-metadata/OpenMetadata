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
  BASE_WAIT_TIME,
  interceptURL,
  RETRY_TIMES,
  verifyResponseStatusCode,
} from '../common';

const RETRIES_COUNT = 4;

export const handleIngestionRetry = (count = 0, ingestionType = 'metadata') => {
  let timer = BASE_WAIT_TIME;
  const rowIndex = ingestionType === 'metadata' ? 1 : 2;

  interceptURL(
    'GET',
    '/api/v1/services/ingestionPipelines?*',
    'ingestionPipelines'
  );
  interceptURL(
    'GET',
    '/api/v1/services/ingestionPipelines/*/pipelineStatus?startTs=*&endTs=*',
    'pipelineStatuses'
  );
  interceptURL('GET', '/api/v1/services/*/name/*', 'serviceDetails');
  interceptURL('GET', '/api/v1/permissions?limit=100', 'allPermissions');

  // ingestions page
  let retryCount = count;
  const testIngestionsTab = () => {
    // click on the tab only for the first time
    if (retryCount === 0) {
      cy.get('[data-testid="ingestions"]').should('exist').and('be.visible');
      cy.get('[data-testid="ingestions"] >> [data-testid="count"]').should(
        'have.text',
        rowIndex
      );
      cy.get('[data-testid="ingestions"]').click();

      if (ingestionType === 'metadata') {
        cy.wait('@pipelineStatuses', {
          responseTimeout: 50000,
        });
      }

      cy.contains('td', `${ingestionType}`) // find the element with the text
        .parent('tr') // find the parent 'tr'
        .find('[data-testid="run"]')
        .click();
    }
  };
  const checkSuccessState = () => {
    testIngestionsTab();

    if (retryCount !== 0) {
      cy.wait('@allPermissions').then(() => {
        cy.wait('@serviceDetails').then(() => {
          cy.wait('@ingestionPipelines');
          cy.wait('@pipelineStatuses', {
            responseTimeout: 50000,
          });
        });
      });
    }

    retryCount++;

    cy.contains('td', `${ingestionType}`) // find the element with the text
      .parent('tr') // find the parent 'tr'
      .find('[data-testid="pipeline-status"]') // find the element with '[data-testid="run"]'
      .as('checkRun');
    // the latest run should be success
    cy.get('@checkRun').then(($ingestionStatus) => {
      const text = $ingestionStatus.text();
      if (
        text !== 'Success' &&
        text !== 'Failed' &&
        retryCount <= RETRY_TIMES
      ) {
        // retry after waiting with log1 method [20s,40s,80s,160s,320s]
        cy.wait(timer);
        timer *= 2;
        cy.reload();
        checkSuccessState();
      } else {
        cy.get('@checkRun').should('contain', 'Success');
      }
    });
  };

  checkSuccessState();
};

export const scheduleIngestion = (hasRetryCount = true) => {
  interceptURL(
    'POST',
    '/api/v1/services/ingestionPipelines',
    'createIngestionPipelines'
  );
  interceptURL(
    'POST',
    '/api/v1/services/ingestionPipelines/deploy/*',
    'deployPipeline'
  );
  interceptURL(
    'GET',
    '/api/v1/services/ingestionPipelines/status',
    'getIngestionPipelineStatus'
  );
  // Schedule & Deploy
  cy.get('[data-testid="cron-type"]').should('be.visible').click();
  cy.get('.ant-select-item-option-content').contains('Hour').click();

  if (hasRetryCount) {
    cy.get('#retries')
      .scrollIntoView()
      .clear()
      .type(RETRIES_COUNT + '');
  }

  cy.get('[data-testid="deploy-button"]').should('be.visible').click();

  verifyResponseStatusCode('@createIngestionPipelines', 201);
  verifyResponseStatusCode('@deployPipeline', 200, {
    responseTimeout: 50000,
  });
  verifyResponseStatusCode('@getIngestionPipelineStatus', 200);
  // check success
  cy.get('[data-testid="success-line"]', { timeout: 15000 }).should(
    'be.visible'
  );
  cy.contains('has been created and deployed successfully').should(
    'be.visible'
  );
};
