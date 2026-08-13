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

  it('should take the newest Metadata run rather than summing the agents', () => {
    render(
      <DeploymentSummaryCard
        agents={[
          // The older run has the larger count on purpose: a sum reads 150 and a Math.max reads 120,
          // so only "newest run wins" produces 30.
          buildAgent({ assets: 120, lastRunAt: 1_000 }),
          buildAgent({
            assets: 30,
            fqn: 'service.agent-2',
            id: 'agent-2',
            lastRunAt: 2_000,
          }),
          buildAgent({
            assets: 999,
            fqn: 'service.agent-3',
            id: 'agent-3',
            lastRunAt: 3_000,
            pipelineType: PipelineType.Profiler,
            unit: 'assets',
          }),
          buildAgent({
            assets: 500,
            fqn: 'service.agent-4',
            id: 'agent-4',
            lastRunAt: 4_000,
            pipelineType: PipelineType.Usage,
            unit: 'queries',
          }),
        ]}
      />
    );

    expect(screen.getByTestId('summary-assets-ingested')).toHaveTextContent(
      '30'
    );
  });

  it('should prefer a running Metadata agent, whose run is the newest', () => {
    render(
      <DeploymentSummaryCard
        agents={[
          buildAgent({ assets: 900, lastRunAt: 1_000 }),
          buildAgent({
            assets: 12,
            fqn: 'service.agent-2',
            id: 'agent-2',
            lastRunAt: 5_000,
            pct: 10,
            status: 'running',
          }),
        ]}
      />
    );

    expect(screen.getByTestId('summary-assets-ingested')).toHaveTextContent(
      '12'
    );
  });

  it('should keep the last finished count when a newer run is only queued', () => {
    render(
      <DeploymentSummaryCard
        agents={[
          buildAgent({ assets: 50, lastRunAt: 1_000 }),
          buildAgent({
            assets: 0,
            fqn: 'service.agent-2',
            id: 'agent-2',
            lastRunAt: 9_000,
            pct: 0,
            status: 'queued',
          }),
        ]}
      />
    );

    expect(screen.getByTestId('summary-assets-ingested')).toHaveTextContent(
      '50'
    );
  });

  it('should fall back to the first Metadata agent when no run timestamps exist', () => {
    render(
      <DeploymentSummaryCard
        agents={[
          buildAgent({ assets: 42 }),
          buildAgent({ assets: 7, fqn: 'service.agent-2', id: 'agent-2' }),
        ]}
      />
    );

    expect(screen.getByTestId('summary-assets-ingested')).toHaveTextContent(
      '42'
    );
  });

  it('should count agents beyond the current page as unfinished', () => {
    render(
      <DeploymentSummaryCard
        // Two agents on this page, but the service has five: the summary must not claim the page is
        // the whole deployment.
        agents={[
          buildAgent({}),
          buildAgent({ fqn: 'service.agent-2', id: 'agent-2' }),
        ]}
        totalAgents={5}
      />
    );

    expect(screen.getByTestId('deployment-summary-title')).toHaveTextContent(
      'message.agents-deploying-ingesting'
    );
    expect(screen.getByTestId('deployment-progress-bar')).toBeInTheDocument();
  });

  it('should render nothing when the page holds only never-run agents', () => {
    const { container } = render(
      <DeploymentSummaryCard
        agents={[buildAgent({ status: 'none' })]}
        totalAgents={4}
      />
    );

    expect(container).toBeEmptyDOMElement();
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
