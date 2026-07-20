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
import { Agent } from '../AgentsPage.interface';
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

jest.mock('./AgentGroup.component', () => ({
  __esModule: true,
  default: ({
    onAction,
  }: {
    onAction: (action: string, agent: Agent) => void;
  }) => (
    <div>
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
    </div>
  ),
}));

jest.mock('./RunHistoryDrawer.component', () =>
  jest.fn().mockImplementation(() => <p>RunHistoryDrawer</p>)
);

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

jest.mock('../hooks/useAgentLogs', () => ({
  useAgentLogs: () => ({ rawText: '', isLoading: false }),
}));

jest.mock('../hooks/useAgentPermissions', () => ({
  useAgentPermissions: () => ({ agentPermissions: {} }),
}));

jest.mock(
  '../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: () => ({ platform: 'Airflow' }),
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
}));

const renderView = () =>
  render(
    <MetadataAgentsView
      showAddAgent
      agents={[baseAgent]}
      ingestionPipelineList={[]}
      serviceCategory={ServiceCategory.DATABASE_SERVICES}
      serviceDetails={{ name: 'service' } as ServicesType}
      serviceName="service"
      onRefresh={mockOnRefresh}
    />
  );

describe('MetadataAgentsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteIngestionPipelineById.mockResolvedValue({});
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

  it('should ignore an unknown action', () => {
    renderView();

    fireEvent.click(screen.getByTestId('dispatch-unknown'));

    expect(mockRunAgent).not.toHaveBeenCalled();
    expect(mockToggleAgent).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('confirm-delete')).not.toBeInTheDocument();
  });
});
