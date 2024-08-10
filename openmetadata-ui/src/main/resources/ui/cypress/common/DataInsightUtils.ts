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
import { interceptURL, verifyResponseStatusCode } from './common';

const BASE_WAIT_TIME = 5000;
const RETRY_TIMES = 4;

const waitForTimer = (timer: number, count: number) => {
  // retry after waiting with log1 method [4s,8s,16s,32s,64s]
  cy.wait(timer);
  timer *= 2;
  cy.reload();
  verifyResponseStatusCode('@getAppStatus', 200);
  checkDataInsightSuccessStatus(++count, timer * 2);
};

export const checkDataInsightSuccessStatus = (
  count = 1,
  timer = BASE_WAIT_TIME
) => {
  interceptURL(
    'GET',
    '/api/v1/apps/name/DataInsightsApplication/status?*',
    'getAppStatus'
  );

  // the latest run should be success
  cy.get('[data-testid="pipeline-status"]')
    .invoke('text')
    .then((pipelineStatus) => {
      if (pipelineStatus === 'Running' && count <= RETRY_TIMES) {
        waitForTimer(timer, count);
      } else if (pipelineStatus === 'Failed' || pipelineStatus === 'Success') {
        expect(pipelineStatus).eq('Success');
      } else if (count <= RETRY_TIMES) {
        waitForTimer(timer, count);
      }
    });
};
