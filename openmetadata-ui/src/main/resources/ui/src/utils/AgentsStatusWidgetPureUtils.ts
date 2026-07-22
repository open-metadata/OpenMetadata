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
import {
  AUTOPILOT_AGENTS_STATUS_ORDERED_LIST,
  AUTOPILOT_AUTOMATION_TEMPLATES,
} from '../constants/AgentsStatusWidget.constant';
import {
  DATA_QUALITY_AUTOMATION_TEMPLATE,
  DOCUMENTATION_AUTOMATION_TEMPLATE,
  TIER_AUTOMATION_TEMPLATE,
} from '../constants/Applications.constant';
import { NO_RUNS_STATUS } from '../constants/ServiceInsightsTab.constants';
import { AgentStatus } from '../enums/ServiceInsights.enum';
import {
  AppRunRecord,
  Status,
} from '../generated/entity/applications/appRunRecord';
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
    case DOCUMENTATION_AUTOMATION_TEMPLATE:
      return t('label.documentation');
    case DATA_QUALITY_AUTOMATION_TEMPLATE:
      return t('label.data-quality');
    case TIER_AUTOMATION_TEMPLATE:
      return t('label.auto-tier');
    default:
      return '';
  }
};

/**
 * Resolves the AutoPilot template an automation belongs to from its
 * `{serviceName}_{template}` name, e.g. `mysql_prod_TierAutomation` ->
 * `TierAutomation`. Returns undefined for names matching no known template.
 */
export const getAutomationTemplate = (name: string): string | undefined =>
  AUTOPILOT_AUTOMATION_TEMPLATES.find((template) =>
    name.endsWith(`_${template}`)
  );

/** Per-step summary an automation run carries under `status`. */
export interface AutomationRunStep {
  records?: number;
  updated_records?: number;
  warnings?: number;
  errors?: number;
}

/**
 * Minimal run shape the converter needs. Kept structural, and keyed on the state
 * as a plain string, so callers holding their own generated `PipelineState` enum
 * can pass their runs without a cast.
 */
export interface AutomationRunLike {
  pipelineState?: string;
  startDate?: number;
  endDate?: number;
  timestamp?: number;
  runId?: string;
  status?: AutomationRunStep[];
}

const PipelineStateToAppRunStatusMap: Record<string, Status> = {
  [PipelineState.Queued]: Status.Pending,
  [PipelineState.Success]: Status.Success,
  [PipelineState.Failed]: Status.Failed,
  [PipelineState.PartialSuccess]: Status.Failed,
  [PipelineState.Running]: Status.Running,
  [PipelineState.Stopped]: Status.Stopped,
};

const sumStep = (steps: AutomationRunStep[], field: keyof AutomationRunStep) =>
  steps.reduce((total, step) => total + (step[field] ?? 0), 0);

/**
 * Rolls the run's per-step summaries into the `jobStats` the agent cards read.
 * `records` is the processed-asset count the run history also shows, so it feeds
 * both the success and total buckets; errors and warnings sum across steps.
 * Returns undefined when the run carries no steps, leaving the counts blank
 * rather than showing zeros.
 */
const buildSuccessContext = (
  steps: AutomationRunStep[]
): AppRunRecord['successContext'] => {
  if (steps.length === 0) {
    return undefined;
  }
  const records = sumStep(steps, 'records');

  return {
    stats: {
      jobStats: {
        totalRecords: records,
        successRecords: records,
        failedRecords: sumStep(steps, 'errors'),
        warningRecords: sumStep(steps, 'warnings'),
      },
    },
  };
};

/**
 * Maps an automation run onto the `AppRunRecord` shape the agent widgets read.
 * The run carries `pipelineState` and `startDate`/`endDate`; `AppRunRecord` wants
 * a scalar `status` and `startTime`/`endTime`, so the fields are renamed and the
 * state enum mapped. The per-step `status` summaries roll up into `successContext`
 * so the cards show the same asset counts as the run history.
 */
export const automationRunToAppRunRecord = (
  run: AutomationRunLike
): AppRunRecord => ({
  startTime: run.startDate,
  endTime: run.endDate,
  timestamp: run.timestamp,
  executionTime:
    run.startDate === undefined
      ? undefined
      : (run.endDate ?? Date.now()) - run.startDate,
  status: run.pipelineState
    ? PipelineStateToAppRunStatusMap[run.pipelineState]
    : undefined,
  successContext: buildSuccessContext(run.status ?? []),
  properties: run.runId ? { pipelineRunId: run.runId } : undefined,
});

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
