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
import { BASE_WAIT_TIME, RETRY_TIMES } from './common';

export const checkDataInsightSuccessStatus = (
  count = 1,
  timer = BASE_WAIT_TIME
) => {
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
      // retry after waiting with log1 method [20s,40s,80s,160s,320s]
      cy.wait(timer);
      timer *= 2;
      cy.reload();
      checkDataInsightSuccessStatus(++count, timer * 2);
    } else {
      cy.get('@checkRun').should('have.text', 'Success');
    }
  });
};
