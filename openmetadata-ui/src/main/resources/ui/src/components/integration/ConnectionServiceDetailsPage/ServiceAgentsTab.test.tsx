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
import { ReactNode } from 'react';
import {
  ServiceAgentSubTabs,
  ServiceCategory,
} from '../../../enums/service.enum';
import { IngestionPipeline } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { UsePagingInterface } from '../../../hooks/paging/usePaging';
import { ServicesType } from '../../../interface/service.interface';
import { CollateAgentAutomation } from '../../../rest/applicationAPI';
import {
  AddAgentActionProps,
  AgentRunActionProps,
  AiAgentsWidgetProps,
  EXTENSION_POINTS,
} from '../../../utils/ExtensionPointTypes';
import { Agent, AgentRun } from '../../ServiceAgents/AgentsPage.interface';
import ServiceAgentsTab from './ServiceAgentsTab';
import { ServiceAgentsState } from './useServiceAgents';

const contributionsByPoint: Record<string, unknown[]> = {};

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Code01: () => null,
  Suggestions: () => null,
}));

jest.mock(
  '../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({
      extensionRegistry: {
        getContributions: (id: string) => contributionsByPoint[id] ?? [],
      },
    }),
  })
);

jest.mock('../../common/AirflowMessageBanner/AirflowMessageBanner', () =>
  jest
    .fn()
    .mockImplementation(({ unreachableFallbackMessage }) => (
      <p data-fallback={unreachableFallbackMessage}>AirflowMessageBanner</p>
    ))
);

jest.mock(
  '../../ServiceAgents/components/DeploymentSummaryCard.component',
  () => jest.fn().mockImplementation(() => <p>DeploymentSummaryCard</p>)
);

const mockMetadataAgentsView = jest.fn();
jest.mock('../../ServiceAgents/components/MetadataAgentsView.component', () =>
  jest
    .fn()
    .mockImplementation(
      (props: {
        addAgentSlot?: ReactNode;
        isLoading?: boolean;
        isRefreshing?: boolean;
        renderRunAction?: (
          agent: Agent,
          run: AgentRun,
          onClose: () => void
        ) => ReactNode;
        onRefresh?: () => void;
      }) => {
        mockMetadataAgentsView(props);

        return (
          <div>
            MetadataAgentsView
            {props.isLoading && <p>MetadataAgentsViewLoading</p>}
            {props.addAgentSlot}
            {props.renderRunAction?.(
              { id: 'agent-1' } as Agent,
              { id: 'run-1' } as AgentRun,
              jest.fn()
            )}
            <button
              data-testid="metadata-refresh"
              disabled={props.isRefreshing}
              onClick={props.onRefresh}>
              refresh
            </button>
          </div>
        );
      }
    )
);

const mockAiAgentsWidget = jest.fn();
const AiAgentsWidget = (props: AiAgentsWidgetProps) => {
  mockAiAgentsWidget(props);

  return (
    <div>
      AiAgentsWidget
      <button data-testid="ai-refresh" onClick={props.onRefresh}>
        refresh
      </button>
    </div>
  );
};

const AddAgentAction = ({ serviceName }: AddAgentActionProps) => (
  <p>AddAgentAction {serviceName}</p>
);

const RunAction = ({ run }: AgentRunActionProps) => <p>RunAction {run.id}</p>;

const autoPilotAction = {
  onTrigger: jest.fn(),
  isLoading: false,
  isDisabled: true,
};

const agentsState = {
  agentCounts: {
    [ServiceAgentSubTabs.METADATA]: 3,
    [ServiceAgentSubTabs.COLLATE_AI]: 2,
  },
  autoPilotAction,
  collateAgentPagingInfo: {} as UsePagingInterface,
  collateAgentsList: [
    { id: 'app-1' },
    { id: 'app-2' },
  ] as CollateAgentAutomation[],
  ingestionPipelines: [{ id: 'pipeline-1' }] as IngestionPipeline[],
  isCollateAgentLoading: false,
  isIngestionPipelineLoading: false,
  metadataAgents: [],
  refreshAgentsList: jest.fn(),
  workflowStatesData: undefined,
} as ServiceAgentsState;

const renderTab = (
  overrides: Partial<ServiceAgentsState> = {},
  showAddAgent = true
) =>
  render(
    <ServiceAgentsTab
      agentsState={{ ...agentsState, ...overrides }}
      serviceCategory={ServiceCategory.DATABASE_SERVICES}
      serviceDetails={{ fullyQualifiedName: 'test-service' } as ServicesType}
      showAddAgent={showAddAgent}
    />
  );

describe('ServiceAgentsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(contributionsByPoint).forEach(
      (key) => delete contributionsByPoint[key]
    );
  });

  it('gives the banner a fallback message for a status call that carries no reason', () => {
    renderTab();

    expect(screen.getByText('AirflowMessageBanner')).toHaveAttribute(
      'data-fallback',
      'message.pipeline-service-unreachable-agent-actions'
    );
  });

  it('lists the metadata agents with no sub-tabs when no AI widget is contributed', () => {
    renderTab();

    expect(screen.getByTestId('connection-agents-tab')).toBeInTheDocument();
    expect(screen.getByText('DeploymentSummaryCard')).toBeInTheDocument();
    expect(screen.getByText('MetadataAgentsView')).toBeInTheDocument();
    expect(
      screen.queryByTestId('agents-sub-tabs-switch')
    ).not.toBeInTheDocument();
  });

  it('hides the summary card until the pipeline list is real', () => {
    renderTab({ isIngestionPipelineLoading: true });

    expect(screen.queryByText('DeploymentSummaryCard')).not.toBeInTheDocument();
    expect(screen.getByText('MetadataAgentsViewLoading')).toBeInTheDocument();
    expect(screen.getByTestId('metadata-refresh')).toBeDisabled();
  });

  it('asks for the metadata list only, from the metadata view', () => {
    renderTab();

    fireEvent.click(screen.getByTestId('metadata-refresh'));

    expect(agentsState.refreshAgentsList).toHaveBeenCalledTimes(1);
    expect(agentsState.refreshAgentsList).toHaveBeenCalledWith(
      ServiceAgentSubTabs.METADATA
    );
  });

  it('leaves the default add-agent control and run actions in place when nothing is contributed', () => {
    renderTab();

    expect(mockMetadataAgentsView).toHaveBeenLastCalledWith(
      expect.objectContaining({
        addAgentSlot: undefined,
        renderRunAction: undefined,
        showAddAgent: true,
      })
    );
  });

  describe('with an AI agents widget contributed', () => {
    beforeEach(() => {
      contributionsByPoint[EXTENSION_POINTS.SERVICE_DETAILS_AI_AGENTS_WIDGET] =
        [{ key: 'ai-agents', component: AiAgentsWidget }];
    });

    it('offers the metadata and AI sub-tabs with their counts', () => {
      renderTab();

      expect(screen.getByTestId('agents-sub-tabs-switch')).toBeInTheDocument();
      expect(screen.getByTestId('metadata-sub-tab')).toHaveTextContent('3');
      expect(screen.getByTestId('collateAI-sub-tab')).toHaveTextContent('2');
      expect(screen.getByText('MetadataAgentsView')).toBeInTheDocument();
    });

    it('switches to the AI widget and hands it the page-owned list and AutoPilot action', () => {
      renderTab();

      fireEvent.click(screen.getByTestId('collateAI-sub-tab'));

      expect(screen.getByText('AiAgentsWidget')).toBeInTheDocument();
      expect(screen.queryByText('MetadataAgentsView')).not.toBeInTheDocument();
      expect(mockAiAgentsWidget).toHaveBeenLastCalledWith(
        expect.objectContaining({
          autoPilotAction,
          collateAgentsList: agentsState.collateAgentsList,
        })
      );
    });

    it('asks for the AI list only, from the AI sub-tab', () => {
      renderTab();

      fireEvent.click(screen.getByTestId('collateAI-sub-tab'));
      fireEvent.click(screen.getByTestId('ai-refresh'));

      expect(agentsState.refreshAgentsList).toHaveBeenCalledTimes(1);
      expect(agentsState.refreshAgentsList).toHaveBeenCalledWith(
        ServiceAgentSubTabs.COLLATE_AI
      );
    });
  });

  it('renders a contributed add-agent control in place of the default one', () => {
    contributionsByPoint[EXTENSION_POINTS.SERVICE_DETAILS_ADD_AGENT_ACTION] = [
      { key: 'add-agent', component: AddAgentAction },
    ];

    renderTab();

    expect(screen.getByText('AddAgentAction test-service')).toBeInTheDocument();
  });

  it('withholds the contributed add-agent control from a user who may not add agents', () => {
    contributionsByPoint[EXTENSION_POINTS.SERVICE_DETAILS_ADD_AGENT_ACTION] = [
      { key: 'add-agent', component: AddAgentAction },
    ];

    renderTab({}, false);

    expect(
      screen.queryByText('AddAgentAction test-service')
    ).not.toBeInTheDocument();
  });

  it('renders each contributed run action for a run', () => {
    contributionsByPoint[EXTENSION_POINTS.SERVICE_DETAILS_AGENT_RUN_ACTIONS] = [
      { key: 'diagnose', component: RunAction },
    ];

    renderTab();

    expect(screen.getByText('RunAction run-1')).toBeInTheDocument();
  });
});
