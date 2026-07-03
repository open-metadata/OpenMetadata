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
import { Agent } from '../AgentsPage.interface';
import AgentCard from './AgentCard.component';

jest.mock('./AgentOverflowMenu.component', () =>
  jest.fn().mockImplementation(() => <p>AgentOverflowMenu</p>)
);

jest.mock('./shared/StatusPill.component', () =>
  jest.fn().mockImplementation(() => <p>StatusPill</p>)
);

jest.mock('./shared/ProgressBar.component', () =>
  jest.fn().mockImplementation(() => <p>ProgressBar</p>)
);

jest.mock('./shared/Metric.component', () =>
  jest.fn().mockImplementation(() => <p>Metric</p>)
);

const mockOnAction = jest.fn();
const mockOnLogs = jest.fn();
const mockOnRun = jest.fn();
const mockOnRunDetails = jest.fn();

const baseAgent: Agent = {
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
  recentRuns: [
    { id: 'run-a', status: 'success' },
    { id: 'run-b', status: 'failed' },
    { id: 'run-c', status: 'partial' },
  ],
  finishedAt: '1m ago',
};

const renderCard = (agent: Agent) =>
  render(
    <AgentCard
      agent={agent}
      onAction={mockOnAction}
      onLogs={mockOnLogs}
      onRun={mockOnRun}
      onRunDetails={mockOnRunDetails}
    />
  );

describe('AgentCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render one dot per recent run', () => {
    renderCard(baseAgent);

    expect(screen.getByText('label.recent-runs-sentence')).toBeInTheDocument();
    expect(
      screen.getAllByTitle(/message.run-status-click-details/)
    ).toHaveLength(3);
  });

  it('should show recent runs for a queued agent with run history', () => {
    renderCard({ ...baseAgent, status: 'queued' });

    expect(screen.getByText('label.recent-runs-sentence')).toBeInTheDocument();
  });

  it('should hide the recent runs row when there is no run history', () => {
    renderCard({ ...baseAgent, status: 'queued', recentRuns: [] });

    expect(
      screen.queryByText('label.recent-runs-sentence')
    ).not.toBeInTheDocument();
  });

  it('should hide the recent runs row while the agent is running', () => {
    renderCard({ ...baseAgent, status: 'running' });

    expect(
      screen.queryByText('label.recent-runs-sentence')
    ).not.toBeInTheDocument();
  });

  it('should pass the clicked run id to onRunDetails', () => {
    renderCard(baseAgent);

    const dots = screen.getAllByTitle(/message.run-status-click-details/);
    fireEvent.click(dots[1]);

    expect(mockOnRunDetails).toHaveBeenCalledWith(baseAgent, 'run-b');
  });

  it('should open the latest run when clicking view run history', () => {
    renderCard(baseAgent);

    fireEvent.click(screen.getByText('label.view-run-history'));

    expect(mockOnRunDetails).toHaveBeenCalledWith(baseAgent);
  });

  it('should open the latest run when clicking diagnose on a failed agent', () => {
    renderCard({ ...baseAgent, status: 'failed', failStep: 'Source' });

    fireEvent.click(screen.getByText('label.diagnose'));

    expect(mockOnRunDetails).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
  });
});
