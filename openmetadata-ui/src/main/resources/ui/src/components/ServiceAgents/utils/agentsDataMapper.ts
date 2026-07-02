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

import { AgentStatus } from '../../../enums/ServiceInsights.enum';
import {
  IngestionPipeline,
  PipelineState,
  PipelineStatus,
  PipelineType,
  StepSummary,
} from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { IngestionPipelineLogByIdInterface } from '../../../pages/LogsViewerPage/LogsViewerPage.interfaces';
import { getAgentStatusLabelFromStatus } from '../../../utils/AgentsStatusWidgetPureUtils';
import {
  customFormatDateTime,
  getShortRelativeTime,
} from '../../../utils/date-time/DateTimeUtils';
import {
  Agent,
  AgentRun,
  AgentStatus as UiAgentStatus,
  LogLevel,
  LogLine,
  RunAttention,
  RunStatus,
  RunStep,
  RunTotals,
} from '../AgentsPage.interface';

const RUN_STARTED_AT_FORMAT = 'MMM dd, yyyy · HH:mm';

const PIPELINE_TYPE_TO_AGENT_TYPE: Record<PipelineType, string> = {
  [PipelineType.Metadata]: 'Metadata',
  [PipelineType.Usage]: 'Usage',
  [PipelineType.Lineage]: 'Lineage',
  [PipelineType.Profiler]: 'Profiler',
  [PipelineType.AutoClassification]: 'Auto Classification',
  [PipelineType.Dbt]: 'dbt',
  [PipelineType.Application]: 'Metadata',
  [PipelineType.DataInsight]: 'Metadata',
  [PipelineType.ElasticSearchReindex]: 'Metadata',
  [PipelineType.PolicyAgent]: 'Metadata',
  [PipelineType.TestSuite]: 'Data Quality',
};

const PIPELINE_TYPE_TO_UNIT_VERB: Record<
  string,
  { unit: string; verb: string }
> = {
  [PipelineType.Usage]: { unit: 'queries', verb: 'scanned' },
  [PipelineType.Lineage]: { unit: 'queries', verb: 'processed' },
  [PipelineType.Metadata]: { unit: 'assets', verb: 'ingested' },
  [PipelineType.Profiler]: { unit: 'assets', verb: 'profiled' },
  [PipelineType.Dbt]: { unit: 'models', verb: 'parsed' },
};

const DEFAULT_UNIT_VERB = { unit: 'assets', verb: 'ingested' };

const AGENT_STATUS_TO_UI_STATUS: Record<AgentStatus, UiAgentStatus> = {
  [AgentStatus.Running]: 'running',
  [AgentStatus.Successful]: 'success',
  [AgentStatus.Failed]: 'failed',
  [AgentStatus.Pending]: 'queued',
};

const PIPELINE_STATE_TO_RUN_STATUS: Record<PipelineState, RunStatus> = {
  [PipelineState.Success]: 'success',
  [PipelineState.PartialSuccess]: 'partial',
  [PipelineState.Failed]: 'failed',
  [PipelineState.Running]: 'running',
  [PipelineState.Queued]: 'skipped',
  [PipelineState.Stopped]: 'skipped',
};

const LOG_LEVEL_PATTERN = /\b(INFO|WARNING|WARN|ERROR|DEBUG)\b/i;
const LOG_TIMESTAMP_PATTERN =
  /^\[?(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)\]?/;

const LOG_LEVEL_TOKEN_TO_LEVEL: Record<string, LogLevel> = {
  INFO: 'info',
  WARN: 'warn',
  WARNING: 'warn',
  ERROR: 'error',
  DEBUG: 'debug',
};

const PIPELINE_TYPE_TO_LOG_TASK_FIELD: Record<
  PipelineType,
  keyof IngestionPipelineLogByIdInterface
> = {
  [PipelineType.Metadata]: 'ingestion_task',
  [PipelineType.Application]: 'application_task',
  [PipelineType.Profiler]: 'profiler_task',
  [PipelineType.Usage]: 'usage_task',
  [PipelineType.Lineage]: 'lineage_task',
  [PipelineType.Dbt]: 'dbt_task',
  [PipelineType.TestSuite]: 'test_suite_task',
  [PipelineType.DataInsight]: 'data_insight_task',
  [PipelineType.ElasticSearchReindex]: 'elasticsearch_reindex_task',
  [PipelineType.AutoClassification]: 'auto_classification_task',
  [PipelineType.PolicyAgent]: 'ingestion_task',
};

export const getAgentTypeFromPipelineType = (
  pipelineType: PipelineType
): string => PIPELINE_TYPE_TO_AGENT_TYPE[pipelineType] ?? 'Metadata';

export const getAgentUnitVerb = (
  pipelineType: PipelineType
): { unit: string; verb: string } =>
  PIPELINE_TYPE_TO_UNIT_VERB[pipelineType] ?? DEFAULT_UNIT_VERB;

export const toUiAgentStatus = (status: AgentStatus): UiAgentStatus =>
  AGENT_STATUS_TO_UI_STATUS[status] ?? 'queued';

export const toRunStatus = (state?: PipelineState): RunStatus =>
  state ? PIPELINE_STATE_TO_RUN_STATUS[state] ?? 'skipped' : 'skipped';

interface ProgressAggregate {
  assets: number;
  target: number;
  eta: number | null;
}

const aggregateProgress = (steps: StepSummary[]): ProgressAggregate => {
  let assets = 0;
  let target = 0;
  let eta: number | null = null;

  for (const step of steps) {
    const progressByEntity = Object.values(step.progress ?? {});
    for (const progress of progressByEntity) {
      assets += progress.processed ?? 0;
      target += progress.total ?? 0;
      if (progress.estimatedRemainingSeconds !== undefined) {
        eta = Math.max(eta ?? 0, progress.estimatedRemainingSeconds);
      }
    }
  }

  return { assets, target: target > 0 ? target : Math.max(assets, 1), eta };
};

interface StepTotalsAggregate {
  assets: number;
  errors: number;
  warnings: number;
}

const aggregateStepTotals = (steps: StepSummary[]): StepTotalsAggregate => {
  let assets = 0;
  let errors = 0;
  let warnings = 0;

  for (const step of steps) {
    assets += step.records ?? 0;
    errors += step.errors ?? 0;
    warnings += step.warnings ?? 0;
  }

  return { assets, errors, warnings };
};

const findFirstFailedStepName = (steps: StepSummary[]): string | undefined => {
  const failedStep = steps.find((step) => (step.errors ?? 0) > 0);

  return failedStep?.name;
};

const buildRunningAgentFields = (
  steps: StepSummary[]
): Pick<Agent, 'pct' | 'assets' | 'target' | 'eta'> => {
  const { assets, target, eta } = aggregateProgress(steps);
  const pct = target > 0 ? Math.round((assets / target) * 100) : 0;

  return { pct, assets, target, eta };
};

const buildFinishedAgentFields = (
  steps: StepSummary[],
  endDate?: number
): Pick<Agent, 'pct' | 'assets' | 'target' | 'eta' | 'finishedAt'> => {
  const { assets } = aggregateStepTotals(steps);

  return {
    pct: 100,
    assets,
    target: Math.max(assets, 1),
    eta: 0,
    finishedAt: endDate ? getShortRelativeTime(endDate) : undefined,
  };
};

const emptyAgentProgressFields = (): Pick<
  Agent,
  'pct' | 'assets' | 'target' | 'eta'
> => ({
  pct: 0,
  assets: 0,
  target: 0,
  eta: null,
});

export const mapPipelineToAgent = (pipeline: IngestionPipeline): Agent => {
  const agentType = getAgentTypeFromPipelineType(pipeline.pipelineType);
  const { unit, verb } = getAgentUnitVerb(pipeline.pipelineType);
  const latestStatus = pipeline.pipelineStatuses?.[0];
  const agentStatus = getAgentStatusLabelFromStatus(
    latestStatus?.pipelineState
  );
  const uiStatus = toUiAgentStatus(agentStatus);
  const steps = latestStatus?.status ?? [];

  let progressFields: Pick<
    Agent,
    'pct' | 'assets' | 'target' | 'eta' | 'finishedAt'
  >;
  let failStep: string | undefined;
  let errors = 0;
  let warnings = 0;

  if (!latestStatus) {
    progressFields = emptyAgentProgressFields();
  } else if (uiStatus === 'running') {
    progressFields = buildRunningAgentFields(steps);
  } else {
    progressFields = buildFinishedAgentFields(steps, latestStatus.endDate);
  }

  if (latestStatus) {
    const totals = aggregateStepTotals(steps);
    errors = totals.errors;
    warnings = totals.warnings;
    if (uiStatus === 'failed') {
      failStep = findFirstFailedStepName(steps);
    }
  }

  return {
    id: pipeline.id ?? pipeline.fullyQualifiedName ?? pipeline.name,
    fqn: pipeline.fullyQualifiedName ?? pipeline.name,
    pipelineType: pipeline.pipelineType,
    name: pipeline.displayName ?? pipeline.name,
    type: agentType,
    unit,
    verb,
    status: uiStatus,
    errors,
    warnings,
    failStep,
    ...progressFields,
  };
};

const sumStepField = (steps: StepSummary[], field: keyof StepSummary): number =>
  steps.reduce((sum, step) => sum + ((step[field] as number) ?? 0), 0);

const buildRunTotals = (steps: StepSummary[]): RunTotals => ({
  records: sumStepField(steps, 'records'),
  filtered: sumStepField(steps, 'filtered'),
  updated: sumStepField(steps, 'updated_records'),
  warnings: sumStepField(steps, 'warnings'),
  errors: sumStepField(steps, 'errors'),
});

const resolveRunStepStatus = (
  records: number,
  filtered: number,
  errors: number,
  warnings: number
): RunStatus => {
  let result: RunStatus;
  if (errors > 0) {
    result = records > 0 ? 'partial' : 'failed';
  } else if (warnings > 0) {
    result = 'partial';
  } else if (records === 0 && filtered === 0) {
    result = 'skipped';
  } else {
    result = 'success';
  }

  return result;
};

const buildStepAttention = (step: StepSummary): RunAttention | undefined => {
  const firstFailure = step.failures?.[0];

  return firstFailure
    ? {
        severity: 'error',
        title: firstFailure.name,
        message: firstFailure.error,
        hint: undefined,
        stackTrace: firstFailure.stackTrace,
      }
    : undefined;
};

export const mapStepSummaryToRunStep = (step: StepSummary): RunStep => {
  const records = step.records ?? 0;
  const filtered = step.filtered ?? 0;
  const updated = step.updated_records ?? 0;
  const warnings = step.warnings ?? 0;
  const errors = step.errors ?? 0;

  return {
    name: step.name,
    status: resolveRunStepStatus(records, filtered, errors, warnings),
    records,
    filtered,
    updated,
    warnings,
    errors,
    attention: buildStepAttention(step),
  };
};

export const mapPipelineStatusToRun = (status: PipelineStatus): AgentRun => {
  const steps = status.status ?? [];
  const startedAtMillis = status.startDate ?? status.timestamp;
  const duration =
    status.endDate && status.startDate
      ? Math.round(((status.endDate - status.startDate) / 60000) * 10) / 10
      : 0;

  return {
    id: status.runId ?? String(status.timestamp),
    status: toRunStatus(status.pipelineState),
    startedAt: startedAtMillis
      ? customFormatDateTime(startedAtMillis, RUN_STARTED_AT_FORMAT)
      : '',
    duration,
    totals: buildRunTotals(steps),
    steps: steps.map(mapStepSummaryToRunStep),
  };
};

const LOG_LEADING_LEVEL_PATTERN = /^\[?(INFO|WARNING|WARN|ERROR|DEBUG)\]?\s*/i;

const parseLogLine = (line: string): LogLine => {
  const timestampMatch = line.match(LOG_TIMESTAMP_PATTERN);
  const time = timestampMatch ? timestampMatch[1] : '';
  const levelMatch = line.match(LOG_LEVEL_PATTERN);
  const level: LogLevel = levelMatch
    ? LOG_LEVEL_TOKEN_TO_LEVEL[levelMatch[1].toUpperCase()] ?? 'info'
    : 'info';
  const afterTimestamp = timestampMatch
    ? line.slice(timestampMatch[0].length).trim()
    : line.trim();
  const remainder = afterTimestamp.replace(LOG_LEADING_LEVEL_PATTERN, '');

  return { time, level, text: remainder || line };
};

export const parseLogLines = (raw: string): LogLine[] =>
  raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map(parseLogLine);

export const getLogTaskFieldForType = (
  log: IngestionPipelineLogByIdInterface,
  pipelineType: PipelineType
): string => {
  const fieldKey =
    PIPELINE_TYPE_TO_LOG_TASK_FIELD[pipelineType] ?? 'ingestion_task';

  return log[fieldKey] ?? '';
};
