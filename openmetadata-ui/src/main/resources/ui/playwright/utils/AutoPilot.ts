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

export const checkAutoPilotStatus = async (
  page: Page,
  service: ServiceBaseClass
) => {
  let consecutiveErrors = 0;

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

          return response.data[0]?.status;
        } catch (error) {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            throw new Error(
              `Failed to get pipeline status after ${MAX_CONSECUTIVE_ERRORS} consecutive attempts`
            );
          }

          return 'RUNNING';
        }
      },
      {
        // Custom expect message for reporting, optional.
        message: 'Wait for workflow to be successful',
        timeout: 750_000,
        intervals: [5_000, 15_000, 30_000],
      }
    )
    .toMatch(/FINISHED|EXCEPTION|FAILURE/);
};
