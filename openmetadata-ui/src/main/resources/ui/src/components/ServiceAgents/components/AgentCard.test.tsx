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
import { Agent, AgentActionPermissions } from '../AgentsPage.interface';
import AgentCard from './AgentCard.component';

const mockAgentOverflowMenu = jest.fn();

jest.mock('./AgentOverflowMenu.component', () => ({
  __esModule: true,
  default: (props: { enabled?: boolean }) => {
    mockAgentOverflowMenu(props);

    return <p>AgentOverflowMenu</p>;
  },
}));

jest.mock('./shared/StatusPill.component', () =>
  jest.fn().mockImplementation(() => <p>StatusPill</p>)
);

jest.mock('./shared/ProgressBar.component', () =>
  jest.fn().mockImplementation(() => <p>ProgressBar</p>)
);

jest.mock('./shared/Metric.component', () =>
  jest.fn().mockImplementation(() => <p>Metric</p>)
);

const mockAirflowStatus = jest.fn();

jest.mock(
  '../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: () => mockAirflowStatus(),
  })
);

const mockScheduleTexts = jest.fn();

jest.mock('../../../hooks/useScheduleDescriptionTexts', () => ({
  useScheduleDescriptionTexts: () => mockScheduleTexts(),
}));

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

const renderCard = (agent: Agent, permissions?: AgentActionPermissions) =>
  render(
    <AgentCard
      agent={agent}
      permissions={permissions}
      onAction={mockOnAction}
      onLogs={mockOnLogs}
      onRun={mockOnRun}
      onRunDetails={mockOnRunDetails}
    />
  );

describe('AgentCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScheduleTexts.mockReturnValue({
      descriptionFirstPart: '',
      descriptionSecondPart: '',
    });
    mockAirflowStatus.mockReturnValue({
      isAirflowAvailable: true,
      isFetchingStatus: false,
      platform: 'Airflow',
    });
  });

  describe('pipeline service status', () => {
    const permissions: AgentActionPermissions = {
      trigger: true,
      edit: true,
      delete: true,
    };

    it('should replace the action controls with a placeholder while the status call is in flight', () => {
      mockAirflowStatus.mockReturnValue({
        isAirflowAvailable: false,
        isFetchingStatus: true,
        platform: 'Airflow',
      });

      renderCard(baseAgent, permissions);

      expect(
        screen.getByTestId('agent-card-actions-skeleton')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('logs-button')).toBeNull();
      expect(screen.queryByTestId('run-agent-button')).toBeNull();
      expect(mockAgentOverflowMenu).not.toHaveBeenCalled();
    });

    it('should keep the run history reachable while the status call is in flight', () => {
      mockAirflowStatus.mockReturnValue({
        isAirflowAvailable: false,
        isFetchingStatus: true,
        platform: 'Airflow',
      });

      renderCard(baseAgent, permissions);

      fireEvent.click(screen.getByTestId('view-run-history-button'));

      expect(mockOnRunDetails).toHaveBeenCalledWith(baseAgent);
    });

    it('should keep Diagnose enabled on a failed agent while the status call is in flight', () => {
      mockAirflowStatus.mockReturnValue({
        isAirflowAvailable: false,
        isFetchingStatus: true,
        platform: 'Airflow',
      });

      renderCard({ ...baseAgent, status: 'failed' }, permissions);

      fireEvent.click(screen.getByTestId('diagnose-button'));

      expect(mockOnRunDetails).toHaveBeenCalledWith({
        ...baseAgent,
        status: 'failed',
      });
    });

    it('should disable the action controls once the status call reports it unreachable', () => {
      mockAirflowStatus.mockReturnValue({
        isAirflowAvailable: false,
        isFetchingStatus: false,
        platform: 'Airflow',
      });

      renderCard(baseAgent, permissions);

      expect(screen.getByTestId('logs-button')).toBeDisabled();
      expect(screen.getByTestId('run-agent-button')).toBeDisabled();
      expect(mockAgentOverflowMenu).toHaveBeenCalledWith(
        expect.objectContaining({ isDisabled: true })
      );
      expect(screen.queryByTestId('agent-card-actions-skeleton')).toBeNull();
    });

    it('should leave the action controls enabled once the pipeline service answers', () => {
      renderCard(baseAgent, permissions);

      expect(screen.getByTestId('logs-button')).toBeEnabled();
      expect(screen.getByTestId('run-agent-button')).toBeEnabled();
      expect(mockAgentOverflowMenu).toHaveBeenCalledWith(
        expect.objectContaining({ isDisabled: false })
      );
    });
  });

  it('should forward the enabled agent flag to the overflow menu', () => {
    renderCard({ ...baseAgent, enabled: true });

    expect(mockAgentOverflowMenu).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true })
    );
  });

  it('should forward a paused agent flag to the overflow menu', () => {
    renderCard({ ...baseAgent, enabled: false });

    expect(mockAgentOverflowMenu).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });

  it('should show the paused badge instead of the status zone for a paused agent', () => {
    renderCard({ ...baseAgent, enabled: false });

    expect(screen.getByTestId('paused-pipeline-badge')).toBeInTheDocument();
    expect(screen.queryByText('StatusPill')).not.toBeInTheDocument();
  });

  it('should treat an absent enabled flag as enabled, since the schema defaults it to true', () => {
    renderCard(baseAgent);

    expect(
      screen.queryByTestId('paused-pipeline-badge')
    ).not.toBeInTheDocument();
    expect(screen.getByText('StatusPill')).toBeInTheDocument();
  });

  it('should show both schedule parts comma-separated when scheduled', () => {
    mockScheduleTexts.mockReturnValue({
      descriptionFirstPart: 'At 02:00 AM',
      descriptionSecondPart: 'Every day',
    });
    renderCard({ ...baseAgent, schedule: '0 2 * * *' });

    expect(screen.getByTestId('agent-schedule')).toHaveTextContent(
      'At 02:00 AM, Every day'
    );
  });

  it('should hide the schedule line for an unscheduled agent', () => {
    renderCard({ ...baseAgent, schedule: undefined });

    expect(screen.queryByTestId('agent-schedule')).not.toBeInTheDocument();
  });

  it('should render one dot per recent run', () => {
    renderCard(baseAgent);

    expect(screen.getByText('label.recent-runs-sentence')).toBeInTheDocument();
    expect(
      screen.getAllByTitle(/message.run-status-click-details/)
    ).toHaveLength(3);
  });

  it('should render the run dots in the order given, oldest to newest', () => {
    renderCard(baseAgent);

    expect(
      screen
        .getAllByTestId('agent-run-dot')
        .map((dot) => dot.getAttribute('data-run-status'))
    ).toEqual(['success', 'failed', 'partial']);
  });

  it('should highlight the rightmost dot as the latest run', () => {
    const dimmed = 'tw:opacity-[0.55]';
    renderCard(baseAgent);

    const dots = screen.getAllByTestId('agent-run-dot');

    expect(dots[0]).toHaveClass(dimmed);
    expect(dots[1]).toHaveClass(dimmed);
    expect(dots[2]).not.toHaveClass(dimmed);
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

  it('should show the last-run metric for a successful agent with zero assets', () => {
    renderCard({ ...baseAgent, unit: 'queries', assets: 0 });

    expect(screen.getByText('Metric')).toBeInTheDocument();
  });

  it('should show the last-run metric for a none agent that has run data', () => {
    renderCard({ ...baseAgent, status: 'none', unit: 'queries', assets: 0 });

    expect(screen.getByText('Metric')).toBeInTheDocument();
  });

  it('should hide the last-run metric for a none agent without run data', () => {
    renderCard({
      ...baseAgent,
      status: 'none',
      assets: 0,
      recentRuns: [],
      finishedAt: undefined,
    });

    expect(screen.queryByText('Metric')).not.toBeInTheDocument();
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
    renderCard({ ...baseAgent, status: 'failed' });

    fireEvent.click(screen.getByText('label.diagnose'));

    expect(mockOnRunDetails).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
  });

  it('should hide the run button while permissions are unresolved', () => {
    renderCard(baseAgent);

    expect(screen.queryByTestId('run-agent-button')).not.toBeInTheDocument();
  });

  it('should show the run button when the user has trigger permission', () => {
    renderCard(baseAgent, { trigger: true, edit: false, delete: false });

    expect(screen.getByTestId('run-agent-button')).toBeInTheDocument();
  });

  it('should hide the run button for a running agent', () => {
    renderCard(
      { ...baseAgent, status: 'running' },
      { trigger: true, edit: false, delete: false }
    );

    expect(screen.queryByTestId('run-agent-button')).not.toBeInTheDocument();
  });

  it('should hide the run button for a queued agent to avoid a duplicate run', () => {
    renderCard(
      { ...baseAgent, status: 'queued' },
      { trigger: true, edit: false, delete: false }
    );

    expect(screen.queryByTestId('run-agent-button')).not.toBeInTheDocument();
  });
});
