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

import { groupBy, isEmpty, reduce } from 'lodash';
import type { AgentsInfo } from '../components/ServiceInsights/AgentsStatusWidget/AgentsStatusWidget.interface';
import { AUTOPILOT_AGENTS_STATUS_ORDERED_LIST } from '../constants/AgentsStatusWidget.constant';
import {
  COLLATE_AUTO_TIER_APP_NAME,
  COLLATE_DATA_QUALITY_APP_NAME,
  COLLATE_DOCUMENTATION_APP_NAME,
} from '../constants/Applications.constant';
import { NO_RUNS_STATUS } from '../constants/ServiceInsightsTab.constants';
import { AgentStatus } from '../enums/ServiceInsights.enum';
import { Status } from '../generated/entity/applications/appRunRecord';
import {
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
