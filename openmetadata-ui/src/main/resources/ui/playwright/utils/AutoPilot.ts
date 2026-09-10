/*
 *  Copyright 2025 Collate.
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
import { expect, Page } from '@playwright/test';
import { MAX_CONSECUTIVE_ERRORS } from '../constant/service';
import ServiceBaseClass from '../support/entity/ingestion/ServiceBaseClass';
import { getCurrentMillis, getDayAgoStartGMTinMillis } from './dateTime';
import { getEncodedFqn } from './entity';
import {
  getServiceCategoryFromService,
  makeRetryRequest,
} from './serviceIngestion';

const AUTOPILOT_SUCCESS_STATUS = 'FINISHED';
const AUTOPILOT_TERMINAL_STATUSES = new Set([
  AUTOPILOT_SUCCESS_STATUS,
  'EXCEPTION',
  'FAILURE',
]);

/**
 * Wait for the AutoPilot workflow for `service` to reach a terminal state,
 * then assert that state is `FINISHED`.
 *
 * The previous implementation matched any terminal state (`FINISHED`,
 * `EXCEPTION`, `FAILURE`) as satisfying the poll, so a failed AutoPilot run
 * passed this helper and only surfaced further down when the "run completed"
 * banner failed to appear — blaming the assertion, not the underlying
 * ingestion failure. Splitting the wait (reach terminal) from the assertion
 * (terminal was success) makes the failure land at the actual cause with
 * the actual state name in the message.
 */
export const checkAutoPilotStatus = async (
  page: Page,
  service: ServiceBaseClass
) => {
  let consecutiveErrors = 0;
  let terminalStatus: string | undefined;

  await expect
    .poll(
      async () => {
        try {
          const startTs = getDayAgoStartGMTinMillis(1);
          const endTs = getCurrentMillis();
          const response = await makeRetryRequest({
            url: `/api/v1/governance/workflowInstances?startTs=${startTs}&endTs=${endTs}&workflowDefinitionName=AutoPilotWorkflow&entityLink=%3C%23E%3A%3A${getServiceCategoryFromService(
              service.category
            )}%3A%3A${getEncodedFqn(service.getServiceName())}%3E`,
            page,
          });
          consecutiveErrors = 0; // Reset error counter on success

          const status = response.data[0]?.status;
          if (status && AUTOPILOT_TERMINAL_STATUSES.has(status)) {
            terminalStatus = status;

            return true;
          }

          return false;
        } catch (error) {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            throw new Error(
              `Failed to get AutoPilot workflow status after ${MAX_CONSECUTIVE_ERRORS} consecutive attempts`
            );
          }

          return false;
        }
      },
      {
        message: `Wait for AutoPilot workflow for "${service.getServiceName()}" to reach a terminal state`,
        timeout: 750_000,
        intervals: [5_000, 15_000, 30_000],
      }
    )
    .toBe(true);

  // Fail fast — a non-success terminal state is the actual defect, and
  // pointing the report at it beats surfacing a downstream banner-visibility
  // timeout that reads as though the UI is broken.
  expect(
    terminalStatus,
    `AutoPilot workflow for "${service.getServiceName()}" ended in "${terminalStatus}" instead of "${AUTOPILOT_SUCCESS_STATUS}" — the ingestion failed; check the workflow instance in the backend for the underlying error.`
  ).toBe(AUTOPILOT_SUCCESS_STATUS);
};
