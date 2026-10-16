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
import { isAppRunActive, isPipelineRunActive } from './logsPolling';

describe('isPipelineRunActive', () => {
  it('is true only for running/queued pipeline states', () => {
    expect(isPipelineRunActive(PipelineState.Running)).toBe(true);
    expect(isPipelineRunActive(PipelineState.Queued)).toBe(true);
  });

  it('is false for terminal or unknown pipeline states', () => {
    expect(isPipelineRunActive(PipelineState.Success)).toBe(false);
    expect(isPipelineRunActive(PipelineState.PartialSuccess)).toBe(false);
    expect(isPipelineRunActive(PipelineState.Failed)).toBe(false);
    expect(isPipelineRunActive(PipelineState.Stopped)).toBe(false);
    expect(isPipelineRunActive(undefined)).toBe(false);
  });
});

describe('isAppRunActive', () => {
  it('is true only for in-flight app run statuses', () => {
    expect(isAppRunActive(Status.Running)).toBe(true);
    expect(isAppRunActive(Status.Started)).toBe(true);
    expect(isAppRunActive(Status.Pending)).toBe(true);
    expect(isAppRunActive(Status.Active)).toBe(true);
  });

  it('is false for terminal or unknown app run statuses', () => {
    expect(isAppRunActive(Status.Success)).toBe(false);
    expect(isAppRunActive(Status.Completed)).toBe(false);
    expect(isAppRunActive(Status.Failed)).toBe(false);
    expect(isAppRunActive(Status.Stopped)).toBe(false);
    expect(isAppRunActive(Status.ActiveError)).toBe(false);
    expect(isAppRunActive(undefined)).toBe(false);
  });
});
