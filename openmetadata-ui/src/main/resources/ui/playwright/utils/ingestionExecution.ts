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
  PipelineState,
  PipelineStatus,
} from '../../src/generated/entity/services/ingestionPipelines/ingestionPipeline';
import { okJson } from './apiResponse';

export const triggerIngestionPipeline = async (
  apiContext: APIRequestContext,
  pipelineId: string
): Promise<number> => {
  if (!pipelineId) {
    throw new Error('Ingestion trigger requires a pipeline ID');
  }
  const startedAfter = Date.now();
  const response = await apiContext.post(
    `/api/v1/services/ingestionPipelines/trigger/${pipelineId}`
  );
  if (!response.ok()) {
    throw new Error(
      `Pipeline ${pipelineId} trigger failed (${response.status()}): ${await response.text()}`
    );
  }
  return startedAfter;
};

export const waitForIngestionResult = async (
  apiContext: APIRequestContext,
  pipelineFqn: string,
  startedAfter: number,
  options: { timeout?: number; intervals?: number[] } = {}
): Promise<PipelineStatus> => {
  if (!pipelineFqn || !Number.isFinite(startedAfter) || startedAfter <= 0) {
    throw new Error(
      'Ingestion polling requires a pipeline FQN and trigger timestamp'
    );
  }
  let execution: PipelineStatus | undefined;
  try {
    await expect
      .poll(
        async () => {
          const response = await apiContext.get(
            `/api/v1/services/ingestionPipelines/${encodeURIComponent(
              pipelineFqn
            )}/pipelineStatus`,
            {
              params: { limit: 10 },
            }
          );
          const body = await okJson<{ data: PipelineStatus[] }>(
            response,
            `Ingestion ${pipelineFqn}`
          );
          if (!Array.isArray(body.data)) {
            throw new Error(
              'Invalid pipeline status response: data must be an array'
            );
          }
          const candidate = execution
            ? body.data.find((run) => run.runId === execution?.runId)
            : body.data.find(
                (run) => (run.startDate ?? run.timestamp ?? 0) >= startedAfter
              );
          if (!candidate) {
            if (execution) {
              throw new Error(
                `Execution ${execution.runId} disappeared from pipeline status`
              );
            }

            return undefined;
          }
          if (
            !candidate.runId ||
            !candidate.pipelineState ||
            !Object.values(PipelineState).includes(candidate.pipelineState)
          ) {
            throw new Error('Invalid pipeline execution identity or state');
          }
          execution = candidate;
          if (
            [
              PipelineState.Failed,
              PipelineState.PartialSuccess,
              PipelineState.Stopped,
            ].includes(candidate.pipelineState)
          ) {
            throw new Error(
              `Execution ${candidate.runId} ended with ${candidate.pipelineState}`
            );
          }

          return candidate.pipelineState;
        },
        {
          message: `Wait for ingestion ${pipelineFqn} to succeed`,
          timeout: options.timeout ?? 750_000,
          intervals: options.intervals ?? [5_000, 15_000, 30_000],
        }
      )
      .toBe(PipelineState.Success);
  } catch (error) {
    throw new Error(
      `Ingestion ${pipelineFqn}: ${
        execution
          ? `execution ${execution.runId}, state ${execution.pipelineState}`
          : 'no execution after trigger'
      }; ${String(error)}`
    );
  }

  return execution as PipelineStatus;
};
