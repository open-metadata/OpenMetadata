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
import {
  IngestionPipeline,
  PipelineState,
} from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';

// The server's default timeout for a run that never reports again; see
// IngestionPipelineRepository.hasRunInProgress, whose rules these mirror so
// the button and the endpoint agree on whether a run is still in progress.
const DEFAULT_RUN_TIMEOUT_MS = 60 * 60 * 1000;

/** The pipeline the run endpoint executes: the suite's first enabled, deployed one. */
export const getRunnablePipeline = (pipelines: IngestionPipeline[]) =>
  pipelines.find((pipeline) => pipeline.enabled && pipeline.deployed);

/**
 * The state of the pipeline's active run, if one is queued or running. The
 * server already drops queued runs that never started; a running one counts
 * only until it outlives the workflow timeout, so a run whose worker died
 * cannot disable the button for good. A running run wins over a queued one.
 */
export const getActiveRunState = (
  pipeline: IngestionPipeline,
  now = Date.now()
) => {
  const runningTimeoutMs = pipeline.airflowConfig?.workflowTimeout
    ? pipeline.airflowConfig.workflowTimeout * 1000
    : DEFAULT_RUN_TIMEOUT_MS;
  const statuses = pipeline.pipelineStatuses ?? [];
  const isRunning = statuses.some(
    ({ pipelineState, timestamp }) =>
      pipelineState === PipelineState.Running &&
      timestamp !== undefined &&
      timestamp >= now - runningTimeoutMs
  );
  if (isRunning) {
    return PipelineState.Running;
  }

  return statuses.some(
    ({ pipelineState }) => pipelineState === PipelineState.Queued
  )
    ? PipelineState.Queued
    : undefined;
};

export const isRunInProgress = (
  pipeline: IngestionPipeline,
  now = Date.now()
) => getActiveRunState(pipeline, now) !== undefined;

/** The translation key explaining why the run is unavailable, if it is. */
export const getRunDisabledReasonKey = ({
  pipelines,
  canTrigger,
  runInProgress,
}: {
  pipelines: IngestionPipeline[];
  canTrigger: boolean;
  runInProgress: boolean;
}) => {
  if (pipelines.length === 0) {
    return 'message.no-pipeline-linked';
  }
  if (!getRunnablePipeline(pipelines)) {
    return 'message.pipeline-not-deployed';
  }
  if (!canTrigger) {
    return 'message.no-permission-for-action';
  }

  return runInProgress ? 'label.in-progress' : undefined;
};
