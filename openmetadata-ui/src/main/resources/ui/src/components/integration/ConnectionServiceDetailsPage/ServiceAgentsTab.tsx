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

import { Box, Tabs } from '@openmetadata/ui-core-components';
import { Code01, Suggestions } from '@openmetadata/ui-core-components/icons';
import { Key, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ServiceAgentSubTabs,
  ServiceCategory,
} from '../../../enums/service.enum';
import { ServicesType } from '../../../interface/service.interface';
import {
  AddAgentActionContribution,
  AgentRunActionContribution,
  AiAgentsWidgetContribution,
  EXTENSION_POINTS,
} from '../../../utils/ExtensionPointTypes';
import AirflowMessageBanner from '../../common/AirflowMessageBanner/AirflowMessageBanner';
import { RenderRunAction } from '../../ServiceAgents/AgentsPage.interface';
import DeploymentSummaryCard from '../../ServiceAgents/components/DeploymentSummaryCard.component';
import MetadataAgentsView from '../../ServiceAgents/components/MetadataAgentsView.component';
import { useApplicationsProvider } from '../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { ServiceAgentsState } from './useServiceAgents';

interface ServiceAgentsTabProps {
  serviceCategory: ServiceCategory;
  serviceDetails: ServicesType;
  agentsState: ServiceAgentsState;
  showAddAgent: boolean;
}

const ServiceAgentsTab = ({
  serviceCategory,
  serviceDetails,
  agentsState,
  showAddAgent,
}: ServiceAgentsTabProps) => {
  const { t } = useTranslation();
  const { extensionRegistry } = useApplicationsProvider();
  const [subTab, setSubTab] = useState<ServiceAgentSubTabs>(
    ServiceAgentSubTabs.METADATA
  );
  const serviceFqn = serviceDetails.fullyQualifiedName ?? '';

  const {
    agentCounts,
    autoPilotAction,
    collateAgentPagingInfo,
    collateAgentsList,
    ingestionPipelines,
    isCollateAgentLoading,
    isIngestionPipelineLoading,
    metadataAgents,
    refreshAgentsList,
  } = agentsState;

  const [AiAgentsWidget] = extensionRegistry
    .getContributions<AiAgentsWidgetContribution>(
      EXTENSION_POINTS.SERVICE_DETAILS_AI_AGENTS_WIDGET
    )
    .map((contribution) => contribution.component);
  const [AddAgentAction] = extensionRegistry
    .getContributions<AddAgentActionContribution>(
      EXTENSION_POINTS.SERVICE_DETAILS_ADD_AGENT_ACTION
    )
    .map((contribution) => contribution.component);
  const runActions =
    extensionRegistry.getContributions<AgentRunActionContribution>(
      EXTENSION_POINTS.SERVICE_DETAILS_AGENT_RUN_ACTIONS
    );

  const isAiSubTabSelected =
    Boolean(AiAgentsWidget) && subTab === ServiceAgentSubTabs.COLLATE_AI;

  const handleRefresh = useCallback(
    () =>
      refreshAgentsList(
        isAiSubTabSelected
          ? ServiceAgentSubTabs.COLLATE_AI
          : ServiceAgentSubTabs.METADATA
      ),
    [refreshAgentsList, isAiSubTabSelected]
  );

  const renderRunAction: RenderRunAction | undefined = runActions.length
    ? (agent, run, onClose) =>
        runActions.map(({ key, component: Action }) => (
          <Action agent={agent} key={key} run={run} onClose={onClose} />
        ))
    : undefined;

  const subTabItems = useMemo(
    () =>
      Object.values(ServiceAgentSubTabs).map((tabName) => {
        const isAi = tabName === ServiceAgentSubTabs.COLLATE_AI;
        const Icon = isAi ? Suggestions : Code01;

        return (
          <Tabs.Item
            badge={String(agentCounts[tabName])}
            data-testid={`${tabName}-sub-tab`}
            id={tabName}
            key={tabName}>
            <Icon height={16} width={16} />
            {isAi ? t('label.collate-ai') : t('label.metadata')}
          </Tabs.Item>
        );
      }),
    [agentCounts, t]
  );

  return (
    <>
      {/* This tab keeps listing its agents with their controls disabled when the pipeline service
          cannot be reached, and a status call that threw carries no `reason` of its own — so
          without the fallback the disabled controls go unexplained. */}
      <AirflowMessageBanner
        className="tw:mb-4"
        unreachableFallbackMessage={t(
          'message.pipeline-service-unreachable-agent-actions'
        )}
      />
      <Box data-testid="connection-agents-tab" direction="col" gap={4}>
        {/* `agents` is one page of the list; the Metadata badge count is the service's real total.
            Held back until that list is real — its counts read as "0 agents" otherwise. */}
        {!isIngestionPipelineLoading && (
          <DeploymentSummaryCard
            agents={metadataAgents}
            totalAgents={agentCounts[ServiceAgentSubTabs.METADATA]}
          />
        )}

        {AiAgentsWidget && (
          <Tabs
            className="tw:w-full"
            data-testid="agents-sub-tabs-switch"
            selectedKey={subTab}
            onSelectionChange={(key: Key) =>
              setSubTab(key as ServiceAgentSubTabs)
            }>
            <Tabs.List type="underline">{subTabItems}</Tabs.List>
          </Tabs>
        )}

        {isAiSubTabSelected && AiAgentsWidget ? (
          <AiAgentsWidget
            autoPilotAction={autoPilotAction}
            collateAgentPagingInfo={collateAgentPagingInfo}
            collateAgentsList={collateAgentsList}
            isCollateAgentLoading={isCollateAgentLoading}
            serviceCategory={serviceCategory}
            serviceDetails={serviceDetails}
            onCollateAgentPageChange={handleRefresh}
            onRefresh={handleRefresh}
          />
        ) : (
          <MetadataAgentsView
            addAgentSlot={
              showAddAgent && AddAgentAction ? (
                <AddAgentAction
                  ingestionList={ingestionPipelines}
                  serviceCategory={serviceCategory}
                  serviceDetails={serviceDetails}
                  serviceName={serviceFqn}
                />
              ) : undefined
            }
            agents={metadataAgents}
            ingestionPipelineList={ingestionPipelines}
            isLoading={isIngestionPipelineLoading}
            isRefreshing={isIngestionPipelineLoading}
            renderRunAction={renderRunAction}
            serviceCategory={serviceCategory}
            serviceDetails={serviceDetails}
            serviceName={serviceFqn}
            showAddAgent={showAddAgent}
            onRefresh={handleRefresh}
          />
        )}
      </Box>
    </>
  );
};

export default ServiceAgentsTab;
