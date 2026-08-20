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

import { fireEvent, render, screen } from '@testing-library/react';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  Agent,
  AgentActionPermissions,
  AgentRun,
} from '../AgentsPage.interface';
import { useAgentRuns } from '../hooks/useAgentRuns';
import RunHistoryDrawer from './RunHistoryDrawer.component';

jest.mock('./RunStepRow.component', () =>
  jest.fn().mockImplementation(() => <p>RunStepRow</p>)
);

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  getUtcOffsetLabel: jest.fn().mockReturnValue('UTC+05:30'),
}));

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

const mockOnRun = jest.fn();

const TRIGGER_PERMISSION: AgentActionPermissions = {
  trigger: true,
  edit: false,
  delete: false,
};

const renderDrawer = (
  initialRunId?: string,
  agentOverrides?: Partial<Agent>,
  permissions: AgentActionPermissions = TRIGGER_PERMISSION
) =>
  render(
    <RunHistoryDrawer
      open
      agent={{ ...agent, ...agentOverrides }}
      initialRunId={initialRunId}
      permissions={permissions}
      onClose={jest.fn()}
      onOpenLogs={jest.fn()}
      onRun={mockOnRun}
    />
  );

describe('RunHistoryDrawer', () => {
  beforeEach(() => {
    mockOnRun.mockClear();
  });

  it('should pre-select the run matching initialRunId', () => {
    renderDrawer('run-middle');

    expect(
      screen.getByText(/May 26, 2026 · 08:10 \(UTC\+05:30\)/)
    ).toBeInTheDocument();
  });

  it('should select the latest run when no initialRunId is given', () => {
    renderDrawer();

    expect(
      screen.getByText(/May 27, 2026 · 08:10 \(UTC\+05:30\)/)
    ).toBeInTheDocument();
  });

  it('should fall back to the latest run for an unknown initialRunId', () => {
    renderDrawer('run-evicted');

    expect(
      screen.getByText(/May 27, 2026 · 08:10 \(UTC\+05:30\)/)
    ).toBeInTheDocument();
  });

  it('should trigger onRun when the Run now button is clicked', () => {
    renderDrawer();

    fireEvent.click(screen.getByText('label.run-now'));

    expect(mockOnRun).toHaveBeenCalledWith(agent);
  });

  it('should hide the Run now button for a running agent', () => {
    renderDrawer(undefined, { status: 'running' });

    expect(
      screen.queryByTestId('drawer-run-now-button')
    ).not.toBeInTheDocument();
  });

  it('should hide the Run now button for a queued agent to avoid a duplicate run', () => {
    renderDrawer(undefined, { status: 'queued' });

    expect(
      screen.queryByTestId('drawer-run-now-button')
    ).not.toBeInTheDocument();
  });

  it('should hide the Run now button without trigger permission', () => {
    renderDrawer(undefined, undefined, {
      trigger: false,
      edit: true,
      delete: true,
    });

    expect(
      screen.queryByTestId('drawer-run-now-button')
    ).not.toBeInTheDocument();
  });

  it('should hide the Run now button while permissions are unresolved', () => {
    render(
      <RunHistoryDrawer
        open
        agent={agent}
        onClose={jest.fn()}
        onOpenLogs={jest.fn()}
        onRun={mockOnRun}
      />
    );

    expect(
      screen.queryByTestId('drawer-run-now-button')
    ).not.toBeInTheDocument();
  });

  it('should forward fetchRuns to useAgentRuns', () => {
    const fetchRuns = jest.fn().mockResolvedValue([]);
    render(
      <RunHistoryDrawer
        open
        agent={agent}
        fetchRuns={fetchRuns}
        onClose={jest.fn()}
        onOpenLogs={jest.fn()}
        onRun={mockOnRun}
      />
    );

    expect(useAgentRuns).toHaveBeenCalledWith(agent.fqn, true, fetchRuns);
  });
});
