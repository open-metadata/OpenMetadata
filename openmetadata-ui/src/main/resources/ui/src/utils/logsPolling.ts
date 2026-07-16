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

import { Status } from '../generated/entity/applications/appRunRecord';
import { PipelineState } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';

// A pipeline/agent/automation run is "live" only while running or queued.
// Everything else (terminal, or unknown/undefined) stops polling so we never
// poll forever when a status can't be determined. Params are typed as `string`
// because the same string values come from several generated enums (ingestion
// PipelineState, ai-automation PipelineState, …) that are structurally distinct.
const ACTIVE_PIPELINE_STATES = new Set<string>([
  PipelineState.Running,
  PipelineState.Queued,
]);

const ACTIVE_APP_STATES = new Set<string>([
  Status.Running,
  Status.Started,
  Status.Pending,
  Status.Active,
]);

export const isPipelineRunActive = (state?: string): boolean =>
  state !== undefined && ACTIVE_PIPELINE_STATES.has(state);

export const isAppRunActive = (status?: string): boolean =>
  status !== undefined && ACTIVE_APP_STATES.has(status);
