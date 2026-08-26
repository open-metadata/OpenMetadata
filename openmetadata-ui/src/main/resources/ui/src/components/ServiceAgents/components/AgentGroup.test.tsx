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
import { ComponentProps } from 'react';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Agent } from '../AgentsPage.interface';
import AgentGroup from './AgentGroup.component';

jest.mock('./AgentCard.component', () =>
  jest.fn().mockImplementation(() => <p>AgentCard</p>)
);

jest.mock('./AgentCardSkeleton.component', () =>
  jest.fn().mockImplementation(() => <p>AgentCardSkeleton</p>)
);

const mockAirflowStatus = jest.fn();

jest.mock(
  '../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: () => mockAirflowStatus(),
  })
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
  recentRuns: [],
  finishedAt: '1m ago',
};

const mockOnRefresh = jest.fn();

const renderGroup = (
  agents: Agent[],
  emptyPlaceholder?: React.ReactNode,
  extraProps: Partial<ComponentProps<typeof AgentGroup>> = {}
) =>
  render(
    <AgentGroup
      canCreateAgent
      agents={agents}
      descKey="message.metadata-agents-description"
      emptyPlaceholder={emptyPlaceholder}
      icon={<span>icon</span>}
      titleKey="label.metadata-agent-plural"
      onAction={mockOnAction}
      onLogs={mockOnLogs}
      onRun={mockOnRun}
      onRunDetails={mockOnRunDetails}
      {...extraProps}
    />
  );

describe('AgentGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAirflowStatus.mockReturnValue({
      isAirflowAvailable: true,
      isFetchingStatus: false,
      platform: 'Airflow',
    });
  });

  it('should replace the add-agent slot with a placeholder while the status call is in flight', () => {
    mockAirflowStatus.mockReturnValue({
      isAirflowAvailable: false,
      isFetchingStatus: true,
      platform: 'Airflow',
    });

    renderGroup([baseAgent], undefined, {
      addAgentSlot: <button data-testid="add-agent-slot">add</button>,
    });

    expect(screen.getByTestId('add-agent-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('add-agent-slot')).toBeNull();
    // The list itself does not wait on that status.
    expect(screen.getByText('AgentCard')).toBeInTheDocument();
  });

  it('should render the add-agent slot once the status call has answered', () => {
    mockAirflowStatus.mockReturnValue({
      isAirflowAvailable: false,
      isFetchingStatus: false,
      platform: 'Airflow',
    });

    renderGroup([baseAgent], undefined, {
      addAgentSlot: <button data-testid="add-agent-slot">add</button>,
    });

    expect(screen.getByTestId('add-agent-slot')).toBeInTheDocument();
    expect(screen.queryByTestId('add-agent-skeleton')).toBeNull();
  });

  it('should render a card per agent and no empty placeholder', () => {
    renderGroup([baseAgent], <p>no agents</p>);

    expect(screen.getByText('AgentCard')).toBeInTheDocument();
    expect(
      screen.queryByTestId('agent-group-empty-placeholder')
    ).not.toBeInTheDocument();
  });

  it('should render the empty placeholder inside the group when there are no agents', () => {
    renderGroup([], <p>no agents</p>);

    expect(
      screen.getByTestId('agent-group-empty-placeholder')
    ).toBeInTheDocument();
    expect(screen.getByText('no agents')).toBeInTheDocument();
    expect(screen.getByTestId('agent-group')).toBeInTheDocument();
    expect(screen.queryByText('AgentCard')).not.toBeInTheDocument();
  });

  it('should render nothing extra when there are no agents and no placeholder', () => {
    renderGroup([]);

    expect(
      screen.queryByTestId('agent-group-empty-placeholder')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('AgentCard')).not.toBeInTheDocument();
  });

  it('should not render the refresh control when no handler is given', () => {
    renderGroup([baseAgent]);

    expect(screen.queryByTestId('agent-group-refresh')).not.toBeInTheDocument();
  });

  it('should call the handler once per click on the refresh control', () => {
    renderGroup([baseAgent], undefined, { onRefresh: mockOnRefresh });

    fireEvent.click(screen.getByTestId('agent-group-refresh'));

    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });

  it('should disable the refresh control while a refetch is in flight', () => {
    renderGroup([baseAgent], undefined, {
      isRefreshing: true,
      onRefresh: mockOnRefresh,
    });

    const refreshButton = screen.getByTestId('agent-group-refresh');

    expect(refreshButton).toBeDisabled();

    fireEvent.click(refreshButton);

    expect(mockOnRefresh).not.toHaveBeenCalled();
  });

  it('should place the refresh control before the add agent slot', () => {
    renderGroup([baseAgent], undefined, {
      addAgentSlot: <button data-testid="add-agent-slot">add</button>,
      onRefresh: mockOnRefresh,
    });

    const refreshButton = screen.getByTestId('agent-group-refresh');
    const addAgentSlot = screen.getByTestId('add-agent-slot');

    const slotFollowsRefresh = Boolean(
      refreshButton.compareDocumentPosition(addAgentSlot) &
        Node.DOCUMENT_POSITION_FOLLOWING
    );

    expect(slotFollowsRefresh).toBe(true);
  });

  it('should render skeleton cards instead of the empty placeholder while loading', () => {
    renderGroup([], <p>no agents</p>, { isLoading: true });

    expect(screen.getByTestId('agent-group-skeleton')).toBeInTheDocument();
    expect(screen.getAllByText('AgentCardSkeleton')).toHaveLength(3);
    expect(
      screen.queryByTestId('agent-group-empty-placeholder')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('no agents')).not.toBeInTheDocument();
  });

  it('should keep the group header rendered while loading', () => {
    renderGroup([], <p>no agents</p>, { isLoading: true });

    expect(screen.getByTestId('agent-group')).toBeInTheDocument();
  });

  it('should honour skeletonCount', () => {
    renderGroup([], undefined, { isLoading: true, skeletonCount: 5 });

    expect(screen.getAllByText('AgentCardSkeleton')).toHaveLength(5);
  });

  it('should prefer the skeleton over already-loaded agents while loading', () => {
    renderGroup([baseAgent], undefined, { isLoading: true });

    expect(screen.getByTestId('agent-group-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('AgentCard')).not.toBeInTheDocument();
  });
});
