/*
 *  Copyright 2025 Collate.
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

import { ReactComponent as CheckIcon } from '../assets/svg/ic-check-circle-new.svg';
import { ReactComponent as DisabledIcon } from '../assets/svg/ic-circle-pause.svg';
import { ReactComponent as ErrorIcon } from '../assets/svg/ic-close-circle.svg';
import { ReactComponent as UsageIcon } from '../assets/svg/ic-database.svg';
import { ReactComponent as LineageIcon } from '../assets/svg/ic-inherited-roles.svg';
import { ReactComponent as PendingIcon } from '../assets/svg/ic-pending.svg';
import { ReactComponent as RunningIcon } from '../assets/svg/ic-running.svg';
import {
  getAgentLabelFromType,
  getAgentStatusLabelFromStatus,
  getAutomationTemplate,
} from './AgentsStatusWidgetPureUtils';

import { ReactComponent as AutoClassificationIcon } from '../assets/svg/ic-auto-classification.svg';
import { ReactComponent as AutoTieringIcon } from '../assets/svg/ic-auto-tiering.svg';
import { ReactComponent as MetadataIcon } from '../assets/svg/ic-empty-doc.svg';
import { ReactComponent as DataQualityIcon } from '../assets/svg/ic-stack-quality.svg';
import { ReactComponent as ProfilerIcon } from '../assets/svg/ic-stack-search.svg';

import { Skeleton, Typography } from 'antd';
import { isEmpty, isUndefined, reduce } from 'lodash';
import type { AgentsInfo } from '../components/ServiceInsights/AgentsStatusWidget/AgentsStatusWidget.interface';
import type {
  AgentsLiveInfo,
  CollateAgentLiveInfo,
} from '../components/ServiceInsights/ServiceInsightsTab.interface';
import { AUTOPILOT_AGENTS_ORDERED_LIST } from '../constants/AgentsStatusWidget.constant';
import {
  DATA_QUALITY_AUTOMATION_TEMPLATE,
  DOCUMENTATION_AUTOMATION_TEMPLATE,
  TIER_AUTOMATION_TEMPLATE,
} from '../constants/Applications.constant';
import { AgentStatus } from '../enums/ServiceInsights.enum';
import type { AppRunRecord } from '../generated/entity/applications/appRunRecord';
import {
  PipelineType,
  ProviderType,
  type IngestionPipeline,
} from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  WorkflowStatus,
  type WorkflowInstance,
} from '../generated/governance/workflows/workflowInstance';
import type { CollateAgentAutomation } from '../rest/applicationAPI';
import { t } from './i18next/LocalUtil';

export const getAgentIconFromType = (agentType: string) => {
  let Icon: SvgComponent = () => null;
  let className = '';

  switch (agentType) {
    case PipelineType.Metadata:
      Icon = MetadataIcon;

      break;
    case PipelineType.Lineage:
      Icon = LineageIcon;

      break;
    case PipelineType.Usage:
      Icon = UsageIcon;

      break;
    case PipelineType.AutoClassification:
      Icon = AutoClassificationIcon;

      break;
    case PipelineType.Profiler:
      Icon = ProfilerIcon;

      break;
    case DOCUMENTATION_AUTOMATION_TEMPLATE:
      Icon = MetadataIcon;
      className = 'collate-agent-icon';

      break;
    case DATA_QUALITY_AUTOMATION_TEMPLATE:
      Icon = DataQualityIcon;
      className = 'collate-agent-icon';

      break;
    case TIER_AUTOMATION_TEMPLATE:
      Icon = AutoTieringIcon;
      className = 'collate-agent-icon';

      break;
  }

  return (
    <div className="agent-icon-container">
      <Icon className={className} height={20} width={20} />
    </div>
  );
};

// A disabled agent stays on the list — it is still configured, it just will not run until it is
// resumed — but its last run's state describes a run it is no longer going to repeat, so reporting
// it as "Successful" reads as a healthy agent. The disabled state wins over it.
// `enabled` defaults to true in the IngestionPipeline schema, so only an explicit false counts.
const getAgentStatus = (
  enabled: boolean | undefined,
  pipelineState?: Parameters<typeof getAgentStatusLabelFromStatus>[0]
) =>
  enabled === false
    ? AgentStatus.Disabled
    : getAgentStatusLabelFromStatus(pipelineState);

export const getFormattedAgentsList = (
  recentRunStatuses: Record<string, AppRunRecord[]>,
  agentsList: IngestionPipeline[] = [],
  collateAIagentsList: CollateAgentAutomation[] = []
): AgentsInfo[] => {
  const filteredAgentsList = agentsList.filter(
    (agent) => agent.provider === ProviderType.Automation
  );

  const formattedAgentsList = filteredAgentsList.map((agent) => ({
    agentIcon: getAgentIconFromType(agent.pipelineType),
    agentType: agent.pipelineType,
    isCollateAgent: false,
    label: getAgentLabelFromType(agent.pipelineType),
    status: getAgentStatus(
      agent.enabled,
      agent.pipelineStatuses?.[0]?.pipelineState
    ),
  }));

  const collateAIagents = collateAIagentsList.map((agent) => {
    const template = getAutomationTemplate(agent.name) ?? agent.name;

    return {
      agentIcon: getAgentIconFromType(template),
      agentType: template,
      isCollateAgent: true,
      label: getAgentLabelFromType(template),
      status: getAgentStatusLabelFromStatus(
        recentRunStatuses?.[template]?.[0]?.status
      ),
    };
  });

  const allAgentsList: AgentsInfo[] = [
    ...formattedAgentsList,
    ...collateAIagents,
  ];

  const orderedAgentsList = reduce(
    AUTOPILOT_AGENTS_ORDERED_LIST,
    (acc, agentType) => {
      const agent = allAgentsList.find(
        (agent) => agent.agentType === agentType
      );

      return [...acc, ...(isUndefined(agent) ? [] : [agent])];
    },
    [] as AgentsInfo[]
  );

  return orderedAgentsList;
};

// Every list this is handed is authoritative: an empty one means the service has no such agent
// left, so a deleted one drops off the widget. A disabled one does not — the stream reports it like
// any other, and it is shown as disabled. Frames that report nothing at all — the payload-less ones
// that close the stream — are dropped by the caller instead, since there is no way to tell them
// apart from here.
export const getFormattedAgentsListFromAgentsLiveInfo = (
  agentsLiveInfo: AgentsLiveInfo[],
  collateAIagentsLiveInfo: CollateAgentLiveInfo[]
): AgentsInfo[] => {
  const filteredAgentsList = agentsLiveInfo.filter(
    (agent) => agent.provider === ProviderType.Automation
  );

  const formattedAgentsList = filteredAgentsList.map((agent) => ({
    agentIcon: getAgentIconFromType(agent.pipelineType),
    agentType: agent.pipelineType,
    isCollateAgent: false,
    label: getAgentLabelFromType(agent.pipelineType),
    status: getAgentStatus(agent.enabled, agent.status),
  }));

  const liveCollateAgents = collateAIagentsLiveInfo.map((agent) => {
    const template =
      getAutomationTemplate(agent.appName ?? '') ?? agent.appName;

    return {
      agentIcon: getAgentIconFromType(template ?? ''),
      agentType: template ?? '',
      isCollateAgent: true,
      label: getAgentLabelFromType(template ?? ''),
      status: getAgentStatusLabelFromStatus(agent.status),
    };
  });

  const allAgentsList: AgentsInfo[] = [
    ...formattedAgentsList,
    ...liveCollateAgents,
  ];

  const orderedAgentsList = reduce(
    AUTOPILOT_AGENTS_ORDERED_LIST,
    (acc, agentType) => {
      const agent = allAgentsList.find(
        (agent) => agent.agentType === agentType
      );

      return [...acc, ...(isUndefined(agent) ? [] : [agent])];
    },
    [] as AgentsInfo[]
  );

  return orderedAgentsList;
};

export const getIconFromStatus = (status?: string) => {
  let Icon: SvgComponent = () => null;

  switch (status) {
    case AgentStatus.Successful:
      Icon = CheckIcon;

      break;
    case AgentStatus.Failed:
      Icon = ErrorIcon;

      break;
    case AgentStatus.Running:
      Icon = RunningIcon;

      break;
    case AgentStatus.Pending:
      Icon = PendingIcon;

      break;
    case AgentStatus.Disabled:
      Icon = DisabledIcon;

      break;
  }

  return (
    <div className={`status-summary-icon-container ${status}`}>
      <Icon height={14} width={14} />
    </div>
  );
};

export const getAgentRunningStatusMessage = (
  isLoading: boolean,
  agentsInfo: AgentsInfo[],
  liveAutoPilotStatusData?: WorkflowInstance
) => {
  if (isLoading) {
    return (
      <Skeleton active paragraph={{ rows: 1, width: '100%' }} title={false} />
    );
  }

  let message = '';
  let Icon: SvgComponent = () => null;
  const status = liveAutoPilotStatusData?.status ?? '';

  switch (status) {
    case WorkflowStatus.Running:
      message = t('message.auto-pilot-agents-running-message');
      Icon = RunningIcon;

      break;
    case WorkflowStatus.Failure:
      message = t('message.auto-pilot-agents-failed-message');
      Icon = ErrorIcon;

      break;
    case WorkflowStatus.Finished:
      message = t('message.auto-pilot-agents-finished-message');
      Icon = CheckIcon;

      break;
    case WorkflowStatus.Exception:
      message = t('message.auto-pilot-agents-exception-message');
      Icon = ErrorIcon;

      break;
  }

  if (!isLoading && isEmpty(agentsInfo) && !status) {
    message = t('message.auto-pilot-no-agents-message');
  }

  return (
    <div className="flex items-center gap-1">
      <Icon className={status} height={14} width={14} />

      <Typography.Text
        className="text-grey-muted text-sm"
        data-testid="agents-status-message">
        {message}
      </Typography.Text>
    </div>
  );
};
