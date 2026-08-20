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
import { Agent } from '../AgentsPage.interface';
import AgentGroup from './AgentGroup.component';

jest.mock('./AgentCard.component', () =>
  jest.fn().mockImplementation(() => <p>AgentCard</p>)
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

const renderGroup = (agents: Agent[], emptyPlaceholder?: React.ReactNode) =>
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
    />
  );

describe('AgentGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
