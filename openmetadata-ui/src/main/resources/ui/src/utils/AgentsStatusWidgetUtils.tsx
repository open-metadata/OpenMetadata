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
import CheckIcon from '../assets/svg/ic-check-circle-new.svg?react';
import ErrorIcon from '../assets/svg/ic-close-circle.svg?react';
import UsageIcon from '../assets/svg/ic-database.svg?react';
import LineageIcon from '../assets/svg/ic-inherited-roles.svg?react';
import PendingIcon from '../assets/svg/ic-pending.svg?react';
import RunningIcon from '../assets/svg/ic-running.svg?react';

import AutoClassificationIcon from '../assets/svg/ic-auto-classification.svg?react';
import AutoTieringIcon from '../assets/svg/ic-auto-tiering.svg?react';
import MetadataIcon from '../assets/svg/ic-empty-doc.svg?react';
import DataQualityIcon from '../assets/svg/ic-stack-quality.svg?react';
import ProfilerIcon from '../assets/svg/ic-stack-search.svg?react';

import { Skeleton, Typography } from 'antd';
import { groupBy, isEmpty, isUndefined, reduce } from 'lodash';
import { AgentsInfo } from '../components/ServiceInsights/AgentsStatusWidget/AgentsStatusWidget.interface';
import {
  AgentsLiveInfo,
  CollateAgentLiveInfo,
} from '../components/ServiceInsights/ServiceInsightsTab.interface';
import {
  AUTOPILOT_AGENTS_ORDERED_LIST,
  AUTOPILOT_AGENTS_STATUS_ORDERED_LIST,
} from '../constants/AgentsStatusWidget.constant';
import {
  COLLATE_AUTO_TIER_APP_NAME,
  COLLATE_DATA_QUALITY_APP_NAME,
  COLLATE_DOCUMENTATION_APP_NAME,
} from '../constants/Applications.constant';
import { NO_RUNS_STATUS } from '../constants/ServiceInsightsTab.constants';
import { AgentStatus } from '../enums/ServiceInsights.enum';
import { App } from '../generated/entity/applications/app';
import {
  AppRunRecord,
  Status,
} from '../generated/entity/applications/appRunRecord';
import {
  IngestionPipeline,
  PipelineState,
  PipelineType,
  ProviderType,
} from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  WorkflowInstance,
  WorkflowStatus,
} from '../generated/governance/workflows/workflowInstance';
import { t } from './i18next/LocalUtil';

export const getAgentLabelFromType = (agentType: string) => {
  switch (agentType) {
    case PipelineType.Metadata:
      return t('label.metadata');
    case PipelineType.Lineage:
      return t('label.lineage');
    case PipelineType.Usage:
      return t('label.usage');
    case PipelineType.AutoClassification:
      return t('label.auto-classification');
    case PipelineType.Profiler:
      return t('label.profiler');
    case COLLATE_DOCUMENTATION_APP_NAME:
      return t('label.documentation');
    case COLLATE_DATA_QUALITY_APP_NAME:
      return t('label.data-quality');
    case COLLATE_AUTO_TIER_APP_NAME:
      return t('label.auto-tier');
    default:
      return '';
  }
};

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
    case COLLATE_DOCUMENTATION_APP_NAME:
      Icon = MetadataIcon;
      className = 'collate-agent-icon';

      break;
    case COLLATE_DATA_QUALITY_APP_NAME:
      Icon = DataQualityIcon;
      className = 'collate-agent-icon';

      break;
    case COLLATE_AUTO_TIER_APP_NAME:
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

export const getAgentStatusLabelFromStatus = (
  status?: PipelineState | Status | typeof NO_RUNS_STATUS
) => {
  switch (status) {
    case PipelineState.Success:
    case PipelineState.PartialSuccess:
    case Status.Active:
    case Status.ActiveError:
    case Status.Completed:
      return AgentStatus.Successful;
    case PipelineState.Failed:
    case Status.Failed:
      return AgentStatus.Failed;
    case PipelineState.Running:
    case Status.Running:
    case Status.Started:
    case Status.StopInProgress:
      return AgentStatus.Running;
    case PipelineState.Queued:
    case Status.Pending:
    case NO_RUNS_STATUS:
    default:
      return AgentStatus.Pending;
  }
};

export const getFormattedAgentsList = (
  recentRunStatuses: Record<string, AppRunRecord[]>,
  agentsList: IngestionPipeline[] = [],
  collateAIagentsList: App[] = []
): AgentsInfo[] => {
  const filteredAgentsList = agentsList.filter(
    (agent) => agent.provider === ProviderType.Automation
  );

  const formattedAgentsList = filteredAgentsList.map((agent) => ({
    agentIcon: getAgentIconFromType(agent.pipelineType),
    agentType: agent.pipelineType,
    isCollateAgent: false,
    label: getAgentLabelFromType(agent.pipelineType),
    status: getAgentStatusLabelFromStatus(
      agent.pipelineStatuses?.pipelineState
    ),
  }));

  const collateAIagents = collateAIagentsList.map((agent) => ({
    agentIcon: getAgentIconFromType(agent.name),
    agentType: agent.name,
    isCollateAgent: true,
    label: getAgentLabelFromType(agent.name),
    status: getAgentStatusLabelFromStatus(
      recentRunStatuses?.[agent.name]?.[0]?.status
    ),
  }));

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
    status: getAgentStatusLabelFromStatus(agent.status),
  }));

  const collateAIagents = collateAIagentsLiveInfo.map((agent) => ({
    agentIcon: getAgentIconFromType(agent.appName ?? ''),
    agentType: agent.appName ?? '',
    isCollateAgent: true,
    label: getAgentLabelFromType(agent.appName ?? ''),
    status: getAgentStatusLabelFromStatus(agent.status),
  }));

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

export const getAgentStatusSummary = (agentsList: AgentsInfo[]) => {
  const newList = groupBy(agentsList, 'status');

  const orderedStatusList = reduce(
    AUTOPILOT_AGENTS_STATUS_ORDERED_LIST,
    (acc, status) => {
      if (isEmpty(newList[status])) {
        return acc;
      }

      return {
        ...acc,
        [status]: newList[status].length,
      };
    },
    {} as Record<string, number>
  );

  return orderedStatusList;
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

  if (!isLoading && isEmpty(agentsInfo)) {
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
