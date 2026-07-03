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

import { Agent } from '../components/ServiceAgents/AgentsPage.interface';
import { PipelineType } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  ProgressUpdate,
  ProgressUpdateType,
} from '../generated/entity/services/ingestionPipelines/serviceProgressEvent';
import {
  applyProgressToAgent,
  isTerminalProgressUpdate,
  resetAgentProgress,
  sumGlobalCounters,
  sumLeafProcessed,
} from './AgentsProgressPureUtils';

jest.mock('./date-time/DateTimeUtils', () => ({
  getShortRelativeTime: jest.fn().mockReturnValue('just now'),
}));

const baseAgent: Agent = {
  id: 'agent-1',
  fqn: 'testSnowflake.metadata_agent',
  pipelineType: PipelineType.Metadata,
  name: 'Metadata Agent',
  type: 'Metadata',
  unit: 'assets',
  verb: 'ingested',
  status: 'queued',
  pct: 0,
  eta: null,
  assets: 0,
  target: 0,
  errors: 3,
  warnings: 2,
};

const buildUpdate = (overrides: Partial<ProgressUpdate>): ProgressUpdate => ({
  runId: 'run-1',
  timestamp: 1751500000000,
  updateType: ProgressUpdateType.Processing,
  ...overrides,
});

describe('isTerminalProgressUpdate', () => {
  it('returns true for PIPELINE_COMPLETE and ERROR', () => {
    expect(isTerminalProgressUpdate(ProgressUpdateType.PipelineComplete)).toBe(
      true
    );
    expect(isTerminalProgressUpdate(ProgressUpdateType.Error)).toBe(true);
  });

  it('returns false for non-terminal update types', () => {
    expect(isTerminalProgressUpdate(ProgressUpdateType.Discovery)).toBe(false);
    expect(isTerminalProgressUpdate(ProgressUpdateType.Processing)).toBe(false);
    expect(isTerminalProgressUpdate(ProgressUpdateType.StepComplete)).toBe(
      false
    );
  });
});

describe('sumGlobalCounters', () => {
  it('sums done across counters treating missing done as zero', () => {
    expect(
      sumGlobalCounters([
        { entityType: 'Table', done: 10, total: 20 },
        { entityType: 'Database', done: 2 },
        { entityType: 'Schema' },
      ])
    ).toBe(12);
  });

  it('returns zero for an empty list', () => {
    expect(sumGlobalCounters([])).toBe(0);
  });
});

describe('sumLeafProcessed', () => {
  it('sums processed over leaf nodes only', () => {
    expect(
      sumLeafProcessed({
        processed: 1,
        children: [
          { processed: 3, children: [{ processed: 5 }, { processed: 7 }] },
          { processed: 11 },
        ],
      })
    ).toBe(23);
  });

  it('handles nodes with null expected and missing processed', () => {
    expect(
      sumLeafProcessed({ expected: null, children: [{ expected: null }] })
    ).toBe(0);
  });

  it('returns processed of a childless root', () => {
    expect(sumLeafProcessed({ processed: 4, children: [] })).toBe(4);
  });
});

describe('applyProgressToAgent', () => {
  it('does not mutate the input agent', () => {
    const agent = { ...baseAgent };
    applyProgressToAgent(
      agent,
      buildUpdate({
        globalCounters: [{ entityType: 'Table', done: 5, total: 10 }],
      })
    );

    expect(agent).toEqual(baseAgent);
  });

  it('marks the agent running with assets from global counters', () => {
    const result = applyProgressToAgent(
      baseAgent,
      buildUpdate({
        globalCounters: [
          { entityType: 'Table', done: 30, total: 100 },
          { entityType: 'Database', done: 2, total: 4 },
        ],
      })
    );

    expect(result.status).toBe('running');
    expect(result.assets).toBe(32);
    expect(result.target).toBe(104);
    expect(result.pct).toBe(31);
  });

  it('keeps previous target when any counter total is unknown', () => {
    const agent: Agent = { ...baseAgent, target: 50, pct: 10, assets: 5 };
    const result = applyProgressToAgent(
      agent,
      buildUpdate({
        globalCounters: [
          { entityType: 'Table', done: 10, total: null },
          { entityType: 'Database', done: 2, total: 4 },
        ],
      })
    );

    expect(result.target).toBe(50);
    expect(result.assets).toBe(12);
  });

  it('falls back to the progress tree leaf sum when counters are absent', () => {
    const result = applyProgressToAgent(
      baseAgent,
      buildUpdate({
        progress: {
          children: [{ processed: 8 }, { processed: 4, expected: null }],
        },
      })
    );

    expect(result.assets).toBe(12);
    expect(result.target).toBe(12);
  });

  it('keeps assets monotonic within a run', () => {
    const agent: Agent = { ...baseAgent, assets: 40, target: 100, pct: 40 };
    const result = applyProgressToAgent(
      agent,
      buildUpdate({
        globalCounters: [{ entityType: 'Table', done: 25, total: 100 }],
      })
    );

    expect(result.assets).toBe(40);
  });

  it('never decreases pct on non-terminal updates', () => {
    const agent: Agent = { ...baseAgent, assets: 40, target: 50, pct: 80 };
    const result = applyProgressToAgent(
      agent,
      buildUpdate({
        globalCounters: [{ entityType: 'Table', done: 45, total: 100 }],
      })
    );

    expect(result.pct).toBe(80);
  });

  it('retains eta when the field is absent and clears it on explicit null', () => {
    const agent: Agent = { ...baseAgent, eta: 90 };

    expect(applyProgressToAgent(agent, buildUpdate({})).eta).toBe(90);
    expect(
      applyProgressToAgent(
        agent,
        buildUpdate({ estimatedSecondsRemaining: null })
      ).eta
    ).toBeNull();
    expect(
      applyProgressToAgent(
        agent,
        buildUpdate({ estimatedSecondsRemaining: 42 })
      ).eta
    ).toBe(42);
  });

  it('finalizes success on PIPELINE_COMPLETE', () => {
    const agent: Agent = { ...baseAgent, assets: 90, target: 100, pct: 90 };
    const result = applyProgressToAgent(
      agent,
      buildUpdate({
        updateType: ProgressUpdateType.PipelineComplete,
        globalCounters: [{ entityType: 'Table', done: 100, total: 100 }],
      })
    );

    expect(result.status).toBe('success');
    expect(result.pct).toBe(100);
    expect(result.eta).toBe(0);
    expect(result.assets).toBe(100);
    expect(result.target).toBe(100);
    expect(result.finishedAt).toBe('just now');
  });

  it('marks the agent failed with failStep on ERROR', () => {
    const agent: Agent = { ...baseAgent, status: 'running', pct: 55, eta: 30 };
    const result = applyProgressToAgent(
      agent,
      buildUpdate({
        updateType: ProgressUpdateType.Error,
        stepName: 'Source',
      })
    );

    expect(result.status).toBe('failed');
    expect(result.eta).toBeNull();
    expect(result.failStep).toBe('Source');
    expect(result.pct).toBe(55);
  });

  it('leaves errors and warnings untouched', () => {
    const result = applyProgressToAgent(
      baseAgent,
      buildUpdate({
        updateType: ProgressUpdateType.PipelineComplete,
      })
    );

    expect(result.errors).toBe(3);
    expect(result.warnings).toBe(2);
  });
});

describe('resetAgentProgress', () => {
  it('zeroes live progress fields and clears run artifacts', () => {
    const agent: Agent = {
      ...baseAgent,
      pct: 88,
      assets: 400,
      target: 500,
      eta: 12,
      finishedAt: '1m ago',
      failStep: 'Sink',
    };

    expect(resetAgentProgress(agent)).toEqual({
      ...baseAgent,
      pct: 0,
      assets: 0,
      target: 0,
      eta: null,
      finishedAt: undefined,
      failStep: undefined,
    });
  });
});
