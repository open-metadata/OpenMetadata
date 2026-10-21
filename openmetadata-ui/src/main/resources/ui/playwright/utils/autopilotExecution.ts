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
import {
  WorkflowInstance,
  WorkflowStatus,
} from '../../src/generated/governance/workflows/workflowInstance';

export const waitForAutoPilotResult = async (
  apiContext: APIRequestContext,
  entityLink: string,
  startedAfter: number,
  timeoutMs: number
) => {
  let execution: WorkflowInstance | undefined;
  try {
    await expect
      .poll(
        async () => {
          const response = await apiContext.get(
            '/api/v1/governance/workflowInstances',
            {
              params: {
                workflowDefinitionName: 'AutoPilotWorkflow',
                entityLink,
                startTs: startedAfter,
                endTs: Date.now(),
                limit: 10,
              },
              timeout: Math.min(timeoutMs, 30_000),
            }
          );
          if (!response.ok()) {
            throw new Error(
              `HTTP ${response.status()} fetching workflow instances`
            );
          }
          const body = await response.json();
          if (!Array.isArray(body.data)) {
            throw new Error('Invalid workflow instances response');
          }
          const instances: WorkflowInstance[] = body.data;
          const candidates = instances.filter(
            (instance) =>
              (instance.timestamp ?? instance.startedAt ?? 0) >= startedAfter
          );
          const current = execution
            ? candidates.find((instance) => instance.id === execution?.id)
            : candidates[0];
          if (!current) {
            if (execution) {
              throw new Error(
                `Execution ${execution.id} disappeared from workflow results`
              );
            }

            return 'no execution';
          }
          if (
            !current.id ||
            !current.status ||
            !Object.values(WorkflowStatus).includes(current.status)
          ) {
            throw new Error(
              `Workflow has a missing ID or invalid status ${current.status}`
            );
          }
          execution = current;
          if (
            [
              WorkflowStatus.Failure,
              WorkflowStatus.Exception,
              WorkflowStatus.Superseded,
            ].includes(current.status)
          ) {
            throw new Error(
              `Execution ${current.id} ended with ${current.status}`
            );
          }

          return current.status;
        },
        { timeout: timeoutMs, intervals: [5_000, 15_000, 30_000] }
      )
      .toBe(WorkflowStatus.Finished);
  } catch (error) {
    throw new Error(
      `AutoPilot ${entityLink}: ${
        execution
          ? `execution ${execution.id}, status ${execution.status}`
          : 'no execution'
      }; ${String(error)}`
    );
  }

  return execution;
};
