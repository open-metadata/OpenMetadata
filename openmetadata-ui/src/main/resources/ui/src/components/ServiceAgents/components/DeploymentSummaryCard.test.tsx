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
import DeploymentSummaryCard from './DeploymentSummaryCard.component';

const buildAgent = (overrides: Partial<Agent>): Agent => ({
  id: 'agent-1',
  fqn: 'service.agent-1',
  pipelineType: PipelineType.Metadata,
  name: 'Metadata Agent',
  type: 'Metadata',
  unit: 'assets',
  verb: 'ingested',
  status: 'success',
  pct: 100,
  eta: null,
  assets: 0,
  target: 0,
  errors: 0,
  warnings: 0,
  recentRuns: [],
  ...overrides,
});

describe('DeploymentSummaryCard', () => {
  it('should render nothing when there are no agents', () => {
    const { container } = render(<DeploymentSummaryCard agents={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should show the in-progress title and progress bar while agents run', () => {
    render(
      <DeploymentSummaryCard
        agents={[
          buildAgent({ status: 'running', pct: 40, eta: 120 }),
          buildAgent({ id: 'agent-2', fqn: 'service.agent-2' }),
        ]}
      />
    );

    expect(screen.getByTestId('deployment-summary-title')).toHaveTextContent(
      'message.agents-deploying-ingesting'
    );
    expect(screen.getByTestId('deployment-progress-bar')).toBeInTheDocument();
    expect(screen.getByTestId('summary-eta-remaining')).toBeInTheDocument();
  });

  it('should show the completion title and hide progress when all agents finished', () => {
    render(
      <DeploymentSummaryCard
        agents={[
          buildAgent({}),
          buildAgent({ id: 'agent-2', fqn: 'service.agent-2' }),
        ]}
      />
    );

    expect(screen.getByTestId('deployment-summary-title')).toHaveTextContent(
      'label.deployment-complete'
    );
    expect(
      screen.queryByTestId('deployment-progress-bar')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('summary-eta-remaining')
    ).not.toBeInTheDocument();
  });

  it('should aggregate asset counts from Metadata agents only', () => {
    render(
      <DeploymentSummaryCard
        agents={[
          buildAgent({ assets: 120 }),
          buildAgent({ id: 'agent-2', fqn: 'service.agent-2', assets: 30 }),
          buildAgent({
            id: 'agent-3',
            fqn: 'service.agent-3',
            pipelineType: PipelineType.Profiler,
            unit: 'assets',
            assets: 999,
          }),
          buildAgent({
            id: 'agent-4',
            fqn: 'service.agent-4',
            pipelineType: PipelineType.Usage,
            unit: 'queries',
            assets: 500,
          }),
        ]}
      />
    );

    expect(screen.getByTestId('summary-assets-ingested')).toHaveTextContent(
      '150'
    );
  });

  it('should keep the Metadata agent count while other agents still run', () => {
    render(
      <DeploymentSummaryCard
        agents={[
          buildAgent({ assets: 80 }),
          buildAgent({
            id: 'agent-2',
            fqn: 'service.agent-2',
            pipelineType: PipelineType.Profiler,
            status: 'running',
            pct: 20,
            assets: 10,
          }),
        ]}
      />
    );

    expect(screen.getByTestId('summary-assets-ingested')).toHaveTextContent(
      '80'
    );
  });

  it('should render nothing when all agents have never run', () => {
    const { container } = render(
      <DeploymentSummaryCard
        agents={[
          buildAgent({ status: 'none', pct: 0 }),
          buildAgent({
            id: 'agent-2',
            fqn: 'service.agent-2',
            status: 'none',
            pct: 0,
          }),
        ]}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('should ignore never-run agents and show completion when the rest finished', () => {
    render(
      <DeploymentSummaryCard
        agents={[
          buildAgent({}),
          buildAgent({
            id: 'agent-2',
            fqn: 'service.agent-2',
            status: 'none',
            pct: 0,
          }),
        ]}
      />
    );

    expect(screen.getByTestId('deployment-summary-title')).toHaveTextContent(
      'label.deployment-complete'
    );
    expect(
      screen.queryByTestId('deployment-progress-bar')
    ).not.toBeInTheDocument();
  });

  it('should exclude never-run agents from the overall progress percent', () => {
    render(
      <DeploymentSummaryCard
        agents={[
          buildAgent({ status: 'running', pct: 40, eta: 120 }),
          buildAgent({
            id: 'agent-2',
            fqn: 'service.agent-2',
            status: 'none',
            pct: 0,
          }),
        ]}
      />
    );

    expect(screen.getByTestId('deployment-summary-title')).toHaveTextContent(
      'message.agents-deploying-ingesting'
    );
    expect(screen.getByTestId('deployment-progress-bar')).toHaveTextContent(
      'message.percent-complete-all-agents'
    );
  });

  it('should aggregate error counts across all agents', () => {
    render(
      <DeploymentSummaryCard
        agents={[
          buildAgent({ errors: 2 }),
          buildAgent({ id: 'agent-2', fqn: 'service.agent-2', errors: 3 }),
        ]}
      />
    );

    expect(screen.getByTestId('summary-errors')).toHaveTextContent('5');
  });
});
