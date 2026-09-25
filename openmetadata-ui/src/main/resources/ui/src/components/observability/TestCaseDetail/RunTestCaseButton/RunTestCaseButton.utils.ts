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
import { first, isUndefined, sortBy } from 'lodash';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import {
  IngestionPipeline,
  PipelineState,
} from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';

// The server's default timeout for a run that never reports again, so a run
// whose worker died does not show as running, and keep polling, for good.
const DEFAULT_RUN_TIMEOUT_MS = 60 * 60 * 1000;

const ACTIVE_RUN_LABEL_KEYS: Partial<Record<PipelineState, string>> = {
  [PipelineState.Queued]: 'label.queued',
  [PipelineState.Running]: 'label.running',
};

/**
 * The pipeline the run endpoint executes: of the suite's enabled, deployed
 * pipelines, the one with the lowest id - the same rule the endpoint applies,
 * so permission and run state are read from the pipeline a run will use.
 */
export const getRunnablePipeline = (pipelines: IngestionPipeline[]) =>
  first(
    sortBy(
      pipelines.filter((pipeline) => pipeline.enabled && pipeline.deployed),
      'id'
    )
  );

/**
 * The permissions to check Trigger against. Without a runnable pipeline there
 * is nothing entity-level to check, so fall back to the resource-level grant:
 * a user who could never trigger a pipeline should not see the button.
 */
export const getTriggerPermissions = (
  pipeline: IngestionPipeline | undefined,
  pipelinePermissions: OperationPermission,
  resourcePermissions?: OperationPermission
) =>
  pipeline
    ? pipelinePermissions
    : resourcePermissions ?? DEFAULT_ENTITY_PERMISSION;

/** The button label: the active run's state while one is in progress. */
export const getRunButtonLabelKey = (activeRunState?: PipelineState) =>
  (activeRunState && ACTIVE_RUN_LABEL_KEYS[activeRunState]) ?? 'label.run-now';

/**
 * The state of the pipeline's active run, if one is queued or running. The
 * server already drops queued runs that never started; a running one counts
 * only until it outlives the workflow timeout, so a run whose worker died
 * does not show as running for good. A running run wins over a queued one.
 */
export const getActiveRunState = (
  pipeline: IngestionPipeline | undefined,
  now = Date.now()
) => {
  if (!pipeline) {
    return undefined;
  }
  const runningTimeoutMs = pipeline.airflowConfig?.workflowTimeout
    ? pipeline.airflowConfig.workflowTimeout * 1000
    : DEFAULT_RUN_TIMEOUT_MS;
  const statuses = pipeline.pipelineStatuses ?? [];
  const isRunning = statuses.some(
    ({ pipelineState, timestamp }) =>
      pipelineState === PipelineState.Running &&
      !isUndefined(timestamp) &&
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
) => !isUndefined(getActiveRunState(pipeline, now));

/**
 * The translation key explaining why a user who may run the test case cannot
 * run it, if there is nothing to run. Users without the permission never see
 * the button, so a missing permission is not a reason here. A run already in
 * progress is not one either: it may belong to another suite's pipeline, be
 * stuck, or predate the change the user wants to re-check, so that is their
 * call.
 */
export const getRunDisabledReasonKey = (pipelines: IngestionPipeline[]) => {
  if (pipelines.length === 0) {
    return 'message.no-pipeline-linked';
  }

  return getRunnablePipeline(pipelines)
    ? undefined
    : 'message.pipeline-not-deployed';
};
