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
import { groupBy } from 'lodash';
import { AgentsInfo } from '../components/ServiceInsights/AgentsStatusWidget/AgentsStatusWidget.interface';
import {
  COLLATE_AUTO_TIER_APP_NAME,
  COLLATE_DATA_QUALITY_APP_NAME,
  COLLATE_DOCUMENTATION_APP_NAME,
} from '../constants/Applications.constant';
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

export const getFormattedAgentsList = (
  agentsList: IngestionPipeline[],
  recentRunStatuses: Record<string, AppRunRecord[]>,
  collateAIagentsList?: App[]
): AgentsInfo[] => {
  const formattedAgentsList = agentsList.map((agent) => ({
    label: getAgentLabelFromType(agent.pipelineType),
    status: agent.pipelineStatuses?.pipelineState,
    isCollateAgent: false,
  }));

  const collateAIagents = collateAIagentsList?.map((agent) => ({
    label: getAgentLabelFromType(agent.name),
    status: recentRunStatuses?.[agent.name]?.[0]?.status,
    isCollateAgent: true,
  }));

  return [...formattedAgentsList, ...(collateAIagents ?? [])];
};

export const getAgentStatusSummary = (agentsList: AgentsInfo[]) => {
  const newlist = groupBy(agentsList, 'status');

  return {
    Success: newlist?.success?.length ?? 0,
    Failed: newlist?.failed?.length ?? 0,
    Running: newlist?.running?.length ?? 0,
    Pending:
      (newlist[PipelineState.Queued]?.length ?? 0) +
      (newlist[Status.Pending]?.length ?? 0),
  };
};
