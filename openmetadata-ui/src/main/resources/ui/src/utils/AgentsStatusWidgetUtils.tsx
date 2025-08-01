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
import { ReactComponent as ErrorIcon } from '../assets/svg/ic-close-circle.svg';
import { ReactComponent as UsageIcon } from '../assets/svg/ic-database.svg';
import { ReactComponent as LineageIcon } from '../assets/svg/ic-inherited-roles.svg';
import { ReactComponent as PendingIcon } from '../assets/svg/ic-pending.svg';
import { ReactComponent as RunningIcon } from '../assets/svg/ic-running.svg';

import { ReactComponent as AutoClassificationIcon } from '../assets/svg/ic-auto-classification.svg';
import { ReactComponent as AutoTieringIcon } from '../assets/svg/ic-auto-tiering.svg';
import { ReactComponent as MetadataIcon } from '../assets/svg/ic-empty-doc.svg';
import { ReactComponent as DataQualityIcon } from '../assets/svg/ic-stack-quality.svg';
import { ReactComponent as ProfilerIcon } from '../assets/svg/ic-stack-search.svg';

import { groupBy } from 'lodash';
import { AgentsInfo } from '../components/ServiceInsights/AgentsStatusWidget/AgentsStatusWidget.interface';
import {
  COLLATE_AUTO_TIER_APP_NAME,
  COLLATE_DATA_QUALITY_APP_NAME,
  COLLATE_DOCUMENTATION_APP_NAME,
} from '../constants/Applications.constant';
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
} from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
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
  status?: PipelineState | Status
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
    default:
      return AgentStatus.Pending;
  }
};

export const getFormattedAgentsList = (
  agentsList: IngestionPipeline[],
  recentRunStatuses: Record<string, AppRunRecord[]>,
  collateAIagentsList?: App[]
): AgentsInfo[] => {
  const formattedAgentsList = agentsList.map((agent) => ({
    label: getAgentLabelFromType(agent.pipelineType),
    status: getAgentStatusLabelFromStatus(
      agent.pipelineStatuses?.pipelineState
    ),
    isCollateAgent: false,
    agentIcon: getAgentIconFromType(agent.pipelineType),
  }));

  const collateAIagents = collateAIagentsList?.map((agent) => ({
    label: getAgentLabelFromType(agent.name),
    status: getAgentStatusLabelFromStatus(
      recentRunStatuses?.[agent.name]?.[0]?.status
    ),
    isCollateAgent: true,
    agentIcon: getAgentIconFromType(agent.name),
  }));

  return [...formattedAgentsList, ...(collateAIagents ?? [])];
};

export const getAgentStatusSummary = (agentsList: AgentsInfo[]) => {
  const newlist = groupBy(agentsList, 'status');

  return {
    [AgentStatus.Successful]: newlist[AgentStatus.Successful]?.length,
    [AgentStatus.Failed]: newlist[AgentStatus.Failed]?.length,
    [AgentStatus.Running]: newlist[AgentStatus.Running]?.length,
    [AgentStatus.Pending]: newlist[AgentStatus.Pending]?.length,
  };
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
