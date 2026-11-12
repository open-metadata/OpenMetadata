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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { ServiceCategory } from '../../../enums/service.enum';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { ServicesType } from '../../../interface/service.interface';
import {
  getErrorPlaceHolder,
  getLogViewerStatusFromRunStatus,
} from '../../../utils/IngestionUtils';
import { Agent, AgentRun } from '../AgentsPage.interface';
import LogViewerModal from '../../common/LogViewerModal/LogViewerModal.component';
import MetadataAgentsView from './MetadataAgentsView.component';

const mockRunAgent = jest.fn();
const mockRedeployAgent = jest.fn();
const mockKillAgent = jest.fn();
const mockToggleAgent = jest.fn();
const mockNavigate = jest.fn();
const mockDeleteIngestionPipelineById = jest.fn();
const mockOnRefresh = jest.fn();

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
  assets: 10,
  target: 10,
  errors: 0,
  warnings: 0,
  recentRuns: [],
  enabled: true,
};

const mockAgentGroup = jest.fn();

jest.mock('./AgentGroup.component', () => ({
  __esModule: true,
  default: (props: {
    agents: Agent[];
    emptyPlaceholder?: React.ReactNode;
    isRefreshing?: boolean;
    onAction: (action: string, agent: Agent) => void;
    onRefresh?: () => void;
    onRunDetails: (agent: Agent) => void;
  }) => {
    const {
      agents,
      emptyPlaceholder,
      isRefreshing,
      onAction,
      onRefresh,
      onRunDetails,
    } = props;

    mockAgentGroup(props);

    return (
      <div>
        {agents.length === 0 && emptyPlaceholder}
        {onRefresh && (
          <button
            data-testid="group-refresh"
            disabled={isRefreshing}
            onClick={onRefresh}>
            refresh
          </button>
        )}
        {['run', 'redeploy', 'kill', 'pause', 'resume', 'edit', 'delete'].map(
          (action) => (
            <button
              data-testid={`dispatch-${action}`}
              key={action}
              onClick={() => onAction(action, baseAgent)}>
              {action}
            </button>
          )
        )}
        <button
          data-testid="dispatch-unknown"
          onClick={() => onAction('unknown', baseAgent)}>
          unknown
        </button>
        <button
          data-testid="dispatch-run-details"
          onClick={() => onRunDetails(agents[0])}>
          run details
        </button>
      </div>
    );
  },
}));

const mockRunHistoryDrawer = jest.fn();

jest.mock('./RunHistoryDrawer.component', () => ({
  __esModule: true,
  default: (props: { agent: Agent }) => {
    mockRunHistoryDrawer(props);

    return <p>RunHistoryDrawer</p>;
  },
}));

jest.mock('../../common/LogViewerModal/LogViewerModal.component', () =>
  jest.fn().mockImplementation(() => <p>LogViewerModal</p>)
);

jest.mock('../../common/DeleteModal/DeleteModal', () => ({
  __esModule: true,
  default: ({ onDelete }: { onDelete: () => void }) => (
    <button data-testid="confirm-delete" onClick={onDelete}>
      DeleteModal
    </button>
  ),
}));

jest.mock(
  '../../Settings/Services/Ingestion/AddIngestionButton.component',
  () => jest.fn().mockImplementation(() => <p>AddIngestionButton</p>)
);

jest.mock('../hooks/useAgentActions', () => ({
  useAgentActions: () => ({
    runAgent: mockRunAgent,
    redeployAgent: mockRedeployAgent,
    killAgent: mockKillAgent,
    toggleAgent: mockToggleAgent,
  }),
}));

const mockUseAgentLogs = jest.fn();

jest.mock('../hooks/useAgentLogs', () => ({
  useAgentLogs: (...args: unknown[]) => mockUseAgentLogs(...args),
}));

jest.mock('../hooks/useAgentPermissions', () => ({
  useAgentPermissions: () => ({ agentPermissions: {} }),
}));

const mockAirflowStatus = jest.fn();

jest.mock(
  '../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: () => mockAirflowStatus(),
  })
);

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ theme: {} }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../rest/ingestionPipelineAPI', () => ({
  deleteIngestionPipelineById: (id: string) =>
    mockDeleteIngestionPipelineById(id),
}));

jest.mock('../../../utils/ConnectionsRouterClassBase', () => ({
  __esModule: true,
  default: { getEditIngestionPath: () => '/edit-agent-path' },
}));

jest.mock('../../../utils/ServiceUtilClassBase', () => ({
  __esModule: true,
  default: { getExtraIngestionMenuItems: () => [] },
}));

jest.mock('../../../utils/IngestionUtils', () => ({
  getErrorPlaceHolder: jest.fn(),
  getLogViewerStatusFromAgentStatus: jest.fn(),
  getLogViewerStatusFromRunStatus: jest.fn(),
}));

const viewWithAgents = (agents: Agent[], isLoading?: boolean) => (
  <MetadataAgentsView
    showAddAgent
    agents={agents}
    ingestionPipelineList={[]}
    isLoading={isLoading}
    serviceCategory={ServiceCategory.DATABASE_SERVICES}
    serviceDetails={{ name: 'service' } as ServicesType}
    serviceName="service"
    onRefresh={mockOnRefresh}
  />
);

const viewRefreshing = (
  <MetadataAgentsView
    isRefreshing
    showAddAgent
    agents={[baseAgent]}
    ingestionPipelineList={[]}
    serviceCategory={ServiceCategory.DATABASE_SERVICES}
    serviceDetails={{ name: 'service' } as ServicesType}
    serviceName="service"
    onRefresh={mockOnRefresh}
  />
);

const renderView = (agents: Agent[] = [baseAgent]) =>
  render(viewWithAgents(agents));

describe('MetadataAgentsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAgentLogs.mockReturnValue({ rawText: '', isLoading: false });
    mockDeleteIngestionPipelineById.mockResolvedValue({});
    mockAirflowStatus.mockReturnValue({
      isAirflowAvailable: true,
      isFetchingStatus: false,
      platform: 'Airflow',
    });
  });

  it('should request the empty placeholder with the agents card styling', () => {
    renderView();

    const lastCall = (getErrorPlaceHolder as jest.Mock).mock.calls.at(-1);

    expect(lastCall?.[4]).toBe(
      'tw:bg-primary tw:border tw:border-secondary tw:rounded-xl'
    );
  });

  it.each([
    ['unreachable', { isAirflowAvailable: false, isFetchingStatus: false }],
    [
      'still being fetched',
      { isAirflowAvailable: false, isFetchingStatus: true },
    ],
  ])(
    'should use the ordinary empty state when the pipeline service is %s',
    (_label, status) => {
      mockAirflowStatus.mockReturnValue({ ...status, platform: 'Airflow' });

      renderView([]);

      // The list is fetched independently of that status now, so an empty list really is empty.
      // `AirflowMessageBanner` carries the unreachable case.
      expect(getErrorPlaceHolder).toHaveBeenCalled();
    }
  );

  it('should still hand the agents to the group when the pipeline service is unreachable', () => {
    mockAirflowStatus.mockReturnValue({
      isAirflowAvailable: false,
      isFetchingStatus: false,
      platform: 'Airflow',
    });

    renderView();

    expect(mockAgentGroup).toHaveBeenLastCalledWith(
      expect.objectContaining({ agents: [baseAgent] })
    );
  });

  it('should toggle the agent when the pause action is dispatched', () => {
    renderView();

    fireEvent.click(screen.getByTestId('dispatch-pause'));

    expect(mockToggleAgent).toHaveBeenCalledWith(baseAgent);
  });

  it('should toggle the agent when the resume action is dispatched', () => {
    renderView();

    fireEvent.click(screen.getByTestId('dispatch-resume'));

    expect(mockToggleAgent).toHaveBeenCalledWith(baseAgent);
  });

  it('should run the agent when the run action is dispatched', () => {
    renderView();

    fireEvent.click(screen.getByTestId('dispatch-run'));

    expect(mockRunAgent).toHaveBeenCalledWith(baseAgent);
    expect(mockToggleAgent).not.toHaveBeenCalled();
  });

  it('should redeploy the agent when the redeploy action is dispatched', () => {
    renderView();

    fireEvent.click(screen.getByTestId('dispatch-redeploy'));

    expect(mockRedeployAgent).toHaveBeenCalledWith(baseAgent);
  });

  it('should kill the agent when the kill action is dispatched', () => {
    renderView();

    fireEvent.click(screen.getByTestId('dispatch-kill'));

    expect(mockKillAgent).toHaveBeenCalledWith(baseAgent);
  });

  it('should navigate to the edit path when the edit action is dispatched', () => {
    renderView();

    fireEvent.click(screen.getByTestId('dispatch-edit'));

    expect(mockNavigate).toHaveBeenCalledWith('/edit-agent-path');
  });

  it('should open the delete modal and delete the pipeline on confirmation', async () => {
    renderView();

    expect(screen.queryByTestId('confirm-delete')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dispatch-delete'));

    expect(mockDeleteIngestionPipelineById).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete'));
    });

    expect(mockDeleteIngestionPipelineById).toHaveBeenCalledWith(baseAgent.id);
    expect(mockOnRefresh).toHaveBeenCalled();
    expect(screen.queryByTestId('confirm-delete')).not.toBeInTheDocument();
  });

  it('should hand the run history drawer the live agent when its status changes while open', () => {
    const { rerender } = renderView();

    fireEvent.click(screen.getByTestId('dispatch-run-details'));

    expect(mockRunHistoryDrawer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        agent: expect.objectContaining({ status: 'success' }),
      })
    );

    rerender(viewWithAgents([{ ...baseAgent, status: 'queued' }]));

    expect(mockRunHistoryDrawer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        agent: expect.objectContaining({ status: 'queued' }),
      })
    );
  });

  describe('logs of a selected older run', () => {
    const olderRun: AgentRun = {
      id: 'run-old',
      status: 'failed',
      startedAt: 'Nov 1 · 10:00',
      duration: 1,
      totals: { records: 0, filtered: 0, updated: 0, warnings: 0, errors: 1 },
      steps: [],
    };

    const openOlderRunLogs = (agent: Agent) => {
      renderView([agent]);
      fireEvent.click(screen.getByTestId('dispatch-run-details'));
      act(() => {
        mockRunHistoryDrawer.mock.calls.at(-1)[0].onOpenLogs(agent, olderRun);
      });
    };

    it('should describe the selected run in the modal, not the latest one', () => {
      (getLogViewerStatusFromRunStatus as jest.Mock).mockReturnValue({
        label: 'Failed',
        tone: 'error',
      });

      openOlderRunLogs({ ...baseAgent, finishedAt: '2 minutes ago' });

      expect(getLogViewerStatusFromRunStatus).toHaveBeenCalledWith('failed');
      expect(LogViewerModal).toHaveBeenLastCalledWith(
        expect.objectContaining({
          lastRun: 'Nov 1 · 10:00',
          status: { label: 'Failed', tone: 'error' },
        }),
        expect.anything()
      );
    });

    it('should never treat a pinned run as live, even while the agent is running', () => {
      openOlderRunLogs({
        ...baseAgent,
        status: 'running',
        currentRunId: 'run-now',
      });

      expect(mockUseAgentLogs).toHaveBeenLastCalledWith(
        'service.agent-1',
        PipelineType.Metadata,
        true,
        false,
        'run-now',
        'run-old'
      );
    });
  });

  it('should forward the loading flag to the agent group', () => {
    render(viewWithAgents([], true));

    expect(mockAgentGroup).toHaveBeenLastCalledWith(
      expect.objectContaining({ isLoading: true })
    );
  });

  it('should not report loading once the agents have arrived', () => {
    renderView();

    expect(mockAgentGroup).toHaveBeenLastCalledWith(
      expect.objectContaining({ isLoading: undefined })
    );
  });

  it('should ignore an unknown action', () => {
    renderView();

    fireEvent.click(screen.getByTestId('dispatch-unknown'));

    expect(mockRunAgent).not.toHaveBeenCalled();
    expect(mockToggleAgent).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('confirm-delete')).not.toBeInTheDocument();
  });

  it('should hand the refresh handler to the group', () => {
    renderView();

    fireEvent.click(screen.getByTestId('group-refresh'));

    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });

  it('should forward the in-flight state to the group', () => {
    render(viewRefreshing);

    expect(screen.getByTestId('group-refresh')).toBeDisabled();
  });
});
