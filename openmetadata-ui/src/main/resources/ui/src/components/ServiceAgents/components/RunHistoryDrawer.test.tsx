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

import { render, screen } from '@testing-library/react';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Agent, AgentRun } from '../AgentsPage.interface';
import RunHistoryDrawer from './RunHistoryDrawer.component';

jest.mock('./RunStepRow.component', () =>
  jest.fn().mockImplementation(() => <p>RunStepRow</p>)
);

const emptyTotals = {
  records: 0,
  filtered: 0,
  updated: 0,
  warnings: 0,
  errors: 0,
};

const mockRuns: AgentRun[] = [
  {
    id: 'run-latest',
    status: 'success',
    startedAt: 'May 27, 2026 · 08:10',
    duration: 3.8,
    totals: emptyTotals,
    steps: [],
  },
  {
    id: 'run-middle',
    status: 'failed',
    startedAt: 'May 26, 2026 · 08:10',
    duration: 0.7,
    totals: emptyTotals,
    steps: [],
  },
  {
    id: 'run-oldest',
    status: 'partial',
    startedAt: 'May 25, 2026 · 08:10',
    duration: 4.1,
    totals: emptyTotals,
    steps: [],
  },
];

jest.mock('../hooks/useAgentRuns', () => ({
  useAgentRuns: jest.fn().mockImplementation(() => ({
    runs: mockRuns,
    isLoading: false,
  })),
}));

const agent: Agent = {
  id: 'agent-1',
  fqn: 'service.agent-1',
  pipelineType: PipelineType.Metadata,
  name: 'Metadata Agent',
  type: 'Metadata',
  unit: 'assets',
  verb: 'ingested',
  status: 'success',
  pct: 100,
  eta: 0,
  assets: 100,
  target: 100,
  errors: 0,
  warnings: 0,
  recentRuns: [],
};

const renderDrawer = (initialRunId?: string) =>
  render(
    <RunHistoryDrawer
      agent={agent}
      initialRunId={initialRunId}
      onClose={jest.fn()}
      onOpenLogs={jest.fn()}
    />
  );

describe('RunHistoryDrawer', () => {
  it('should pre-select the run matching initialRunId', () => {
    renderDrawer('run-middle');

    expect(
      screen.getByText(/May 26, 2026 · 08:10 \(UTC−07:00\)/)
    ).toBeInTheDocument();
  });

  it('should select the latest run when no initialRunId is given', () => {
    renderDrawer();

    expect(
      screen.getByText(/May 27, 2026 · 08:10 \(UTC−07:00\)/)
    ).toBeInTheDocument();
  });

  it('should fall back to the latest run for an unknown initialRunId', () => {
    renderDrawer('run-evicted');

    expect(
      screen.getByText(/May 27, 2026 · 08:10 \(UTC−07:00\)/)
    ).toBeInTheDocument();
  });
});
