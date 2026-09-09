/*
 *  Copyright 2026 Collate.
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
import { APIRequestContext, expect } from '@playwright/test';

const TERMINAL_STATUSES = ['Aborted', 'Success', 'Failed', 'PartialSuccess'];

export const waitForContractResult = async (
  apiContext: APIRequestContext,
  contractId: string,
  resultId: string,
  timeoutMs = 600_000
) => {
  if (!resultId) {
    throw new Error(
      `Contract ${contractId} validation returned no execution ID`
    );
  }

  await expect
    .poll(
      async () => {
        const response = await apiContext.get(
          `/api/v1/dataContracts/${contractId}/results/${resultId}`,
          { timeout: Math.min(timeoutMs, 30_000) }
        );

        if (!response.ok()) {
          throw new Error(
            `Contract ${contractId} execution ${resultId}: HTTP ${response.status()}`
          );
        }

        const result = await response.json();
        if (result.id !== resultId) {
          throw new Error(
            `Contract ${contractId}: received a different execution ID`
          );
        }

        const status: string = result.contractExecutionStatus;
        if (![...TERMINAL_STATUSES, 'Running', 'Queued'].includes(status)) {
          throw new Error(
            `Contract ${contractId} execution ${resultId}: invalid status ${status}`
          );
        }

        return status;
      },
      {
        message: `Contract ${contractId} execution ${resultId} must reach a terminal result`,
        timeout: timeoutMs,
        intervals: [1_000, 3_000, 5_000, 10_000],
      }
    )
    .toMatch(/^(Aborted|Success|Failed|PartialSuccess)$/);
};
