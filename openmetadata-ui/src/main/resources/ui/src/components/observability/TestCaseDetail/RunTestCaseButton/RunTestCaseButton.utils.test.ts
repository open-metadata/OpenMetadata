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
  PipelineType,
} from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  getRunDisabledReasonKey,
  getRunnablePipeline,
  isRunInProgress,
} from './RunTestCaseButton.utils';

const NOW = 10 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const pipeline = (overrides: Partial<IngestionPipeline> = {}) =>
  ({
    name: 'suite_pipeline',
    pipelineType: PipelineType.TestSuite,
    enabled: true,
    deployed: true,
    airflowConfig: {},
    sourceConfig: {},
    ...overrides,
  } as IngestionPipeline);

const withStatus = (pipelineState: PipelineState, timestamp: number) =>
  pipeline({ pipelineStatuses: [{ pipelineState, timestamp }] });

describe('getRunnablePipeline', () => {
  it('picks the first pipeline that is both enabled and deployed', () => {
    const runnable = pipeline({ name: 'runnable' });

    expect(
      getRunnablePipeline([
        pipeline({ name: 'disabled', enabled: false }),
        pipeline({ name: 'undeployed', deployed: false }),
        runnable,
      ])
    ).toBe(runnable);
  });

  it('returns nothing when no pipeline could be run', () => {
    expect(
      getRunnablePipeline([pipeline({ deployed: false })])
    ).toBeUndefined();
  });
});

describe('isRunInProgress', () => {
  it('treats a queued run as in progress, since the server already dropped stale ones', () => {
    expect(
      isRunInProgress(withStatus(PipelineState.Queued, NOW - 5 * HOUR), NOW)
    ).toBe(true);
  });

  it('treats a recent running run as in progress', () => {
    expect(
      isRunInProgress(withStatus(PipelineState.Running, NOW - HOUR / 2), NOW)
    ).toBe(true);
  });

  it('ignores a running run past the default timeout so a dead worker cannot block runs', () => {
    expect(
      isRunInProgress(withStatus(PipelineState.Running, NOW - 2 * HOUR), NOW)
    ).toBe(false);
  });

  it('uses the pipeline workflow timeout when one is set', () => {
    const longRunning = pipeline({
      airflowConfig: { workflowTimeout: 4 * 60 * 60 },
      pipelineStatuses: [
        { pipelineState: PipelineState.Running, timestamp: NOW - 2 * HOUR },
      ],
    });

    expect(isRunInProgress(longRunning, NOW)).toBe(true);
  });

  it('does not treat finished runs as in progress', () => {
    expect(isRunInProgress(withStatus(PipelineState.Success, NOW), NOW)).toBe(
      false
    );
    expect(isRunInProgress(withStatus(PipelineState.Failed, NOW), NOW)).toBe(
      false
    );
  });
});

describe('getRunDisabledReasonKey', () => {
  it('explains a suite without any pipeline', () => {
    expect(
      getRunDisabledReasonKey({
        pipelines: [],
        canTrigger: true,
        runInProgress: false,
      })
    ).toBe('message.no-pipeline-linked');
  });

  it('explains a suite whose pipelines are not enabled and deployed', () => {
    expect(
      getRunDisabledReasonKey({
        pipelines: [pipeline({ deployed: false })],
        canTrigger: true,
        runInProgress: false,
      })
    ).toBe('message.pipeline-not-deployed');
  });

  it('explains a missing Trigger permission', () => {
    expect(
      getRunDisabledReasonKey({
        pipelines: [pipeline()],
        canTrigger: false,
        runInProgress: false,
      })
    ).toBe('message.no-permission-for-action');
  });

  it('explains a run that is already in progress', () => {
    expect(
      getRunDisabledReasonKey({
        pipelines: [pipeline()],
        canTrigger: true,
        runInProgress: true,
      })
    ).toBe('label.in-progress');
  });

  it('allows the run otherwise', () => {
    expect(
      getRunDisabledReasonKey({
        pipelines: [pipeline()],
        canTrigger: true,
        runInProgress: false,
      })
    ).toBeUndefined();
  });
});
