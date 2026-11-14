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
import { compact, last, orderBy } from 'lodash';
import {
  ApprovalOutcome,
  AutomaticReason,
} from '../../../generated/governance/workflows/approvalOutcome';
import { Type as TriggerType } from '../../../generated/governance/workflows/workflowDefinition';
import { WorkflowInstance } from '../../../generated/governance/workflows/workflowInstance';
import { getEntityVersionHistory } from '../../../rest/entityVersionAPI';
import { getWorkflowInstancesForApplication } from '../../../rest/workflowAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  getApprovalOutcomeMessage,
  getRunApprovals,
} from '../../../utils/WorkflowApprovalOutcomeUtils';
import {
  getReadableDefinitions,
  setsEntityStage,
} from '../../Glossary/GlossaryTerms/tabs/WorkFlowTab/WorkflowHistory.utils';

/** Who set the entity's current status, when, and through which workflow, if any. */
export interface StatusChange {
  status?: string;
  changedBy?: string;
  changedAt?: number;
  workflowName?: string;
  triggeredBy?: string;
  scheduled?: boolean;
  outcome?: ApprovalOutcome;
}

/** A line of the popover: a translation key and the values it interpolates, or plain text. */
export interface StatusChangeLine {
  key?: string;
  values?: Record<string, string | undefined>;
  text?: string;
}

interface FieldChange {
  name?: string;
}

interface EntityVersion {
  entityStatus?: string;
  updatedBy?: string;
  updatedAt?: number;
  changeDescription?: {
    fieldsAdded?: FieldChange[];
    fieldsUpdated?: FieldChange[];
  };
}

const STATUS_FIELD = 'entityStatus';
// The user a workflow writes as when no person started the run, as a periodic run.
const GOVERNANCE_BOT = 'governance-bot';
const RUNS_AROUND_CHANGE = 10;
// A workflow writes the status and ends its run within moments of each other.
const RUN_WINDOW_SLACK_MS = 5_000;
// How far a run's decision may be from the status change it caused.
const DECISION_WINDOW_MS = 60_000;

// The versions endpoint returns each version as a JSON string.
const readVersion = (version: unknown): EntityVersion =>
  typeof version === 'string'
    ? JSON.parse(version)
    : (version as EntityVersion);

const changesStatus = ({ changeDescription }: EntityVersion) =>
  [
    ...(changeDescription?.fieldsAdded ?? []),
    ...(changeDescription?.fieldsUpdated ?? []),
  ].some(({ name }) => name === STATUS_FIELD);

/** The newest version that changed the status, else the version that created the entity. */
const latestStatusVersion = (versions: EntityVersion[]) =>
  versions.find(changesStatus) ?? last(versions);

const ranAt = (run: WorkflowInstance, at: number) =>
  (run.startedAt ?? 0) <= at + RUN_WINDOW_SLACK_MS &&
  (run.endedAt ?? Number.MAX_SAFE_INTEGER) >= at - RUN_WINDOW_SLACK_MS;

// The decision is written once its step commits, which is after the status write in the same
// step, so it can land on either side of the status change: take the one decided closest to it.
const outcomeAt = (run: WorkflowInstance, at: number) =>
  orderBy(
    getRunApprovals(run).filter(
      ({ decidedAt }) => Math.abs(decidedAt - at) <= DECISION_WINDOW_MS
    ),
    ({ decidedAt }) => Math.abs(decidedAt - at)
  )[0];

/**
 * The status-setting workflow run that was running when the status changed. One page of the
 * runs started before then, newest first, is read; only the runs active at that moment have
 * their definition read.
 */
const findRunAt = async (
  entityLink: string,
  at: number
): Promise<
  Pick<StatusChange, 'workflowName' | 'triggeredBy' | 'scheduled' | 'outcome'>
> => {
  const { data } = await getWorkflowInstancesForApplication({
    entityLink,
    startTs: 0,
    endTs: at + RUN_WINDOW_SLACK_MS,
    limit: RUNS_AROUND_CHANGE,
  });
  const active = orderBy(
    (data ?? []).filter((run) => ranAt(run, at)),
    ({ startedAt }) => startedAt ?? 0,
    'desc'
  );
  const definitions = await getReadableDefinitions(active);
  const settingRuns = active.filter((candidate) => {
    const definition = definitions[candidate.workflowDefinitionId ?? ''];

    return definition && setsEntityStage(definition);
  });
  // The status write itself can start a short run of the same workflow just after the change, so
  // the run that decided it comes first, then a run already going when the status changed.
  const run =
    settingRuns.find((candidate) => outcomeAt(candidate, at)) ??
    settingRuns.find(({ startedAt }) => (startedAt ?? 0) <= at) ??
    settingRuns[0];

  const definition = definitions[run?.workflowDefinitionId ?? ''];
  const trigger = definition?.trigger;

  return run && definition
    ? {
        workflowName: getEntityName(definition),
        triggeredBy: run.variables?.global_updatedBy,
        scheduled:
          typeof trigger === 'object' &&
          !Array.isArray(trigger) &&
          trigger?.type === TriggerType.PeriodicBatchEntity,
        outcome: outcomeAt(run, at),
      }
    : {};
};

/**
 * Who set the entity's current status: the version history says when and by whom it
 * changed, and the status-setting workflow run active at that moment, if any, says which
 * workflow changed it and how its approval was decided
 * (ADR:2026-11-13-the-status-badge-says-who-set-the-status-from-version-history).
 */
export const getStatusChange = async (
  entityType: string,
  entityId: string,
  entityLink: string
): Promise<StatusChange> => {
  const { versions } = await getEntityVersionHistory(entityType, entityId);
  const version = latestStatusVersion((versions ?? []).map(readVersion));
  const change: StatusChange = {
    status: version?.entityStatus,
    changedBy: version?.updatedBy,
    changedAt: version?.updatedAt,
  };

  return change.changedAt
    ? { ...change, ...(await findRunAt(entityLink, change.changedAt)) }
    : change;
};

const AUTOMATIC_REASONS: Record<AutomaticReason, string> = {
  [AutomaticReason.NoAssignees]: 'message.entity-status-no-one-to-review',
  [AutomaticReason.SubmitterIsReviewer]:
    'message.entity-status-requester-is-reviewer',
};

// How a workflow that set the status without anyone deciding it came to run.
const workflowRunDetail = (
  change: StatusChange
): StatusChangeLine | undefined => {
  let detail: StatusChangeLine | undefined;
  if (change.scheduled) {
    detail = { key: 'message.entity-status-on-schedule' };
  } else if (change.triggeredBy) {
    detail = {
      key: 'message.entity-status-after-change-by',
      values: { user: change.triggeredBy },
    };
  }

  return detail;
};

const decidedLines = (
  change: StatusChange,
  outcome: ApprovalOutcome
): StatusChangeLine[] => {
  const decision = getApprovalOutcomeMessage(outcome);

  return outcome.automaticReason
    ? [
        {
          key: 'message.entity-status-auto-approved-by',
          values: { workflow: change.workflowName },
        },
        { key: AUTOMATIC_REASONS[outcome.automaticReason] },
      ]
    : [
        { key: decision.key, values: { user: decision.users } },
        { text: change.workflowName },
      ];
};

const undecidedLines = (change: StatusChange): StatusChangeLine[] => {
  let lines: StatusChangeLine[] = [
    { key: 'message.entity-status-no-recorded-change' },
  ];
  if (change.workflowName) {
    lines = [
      {
        key: 'message.entity-status-set-by',
        values: { status: change.status, by: change.workflowName },
      },
      ...compact([workflowRunDetail(change)]),
    ];
  } else if (change.changedBy === GOVERNANCE_BOT) {
    lines = [
      {
        key: 'message.entity-status-set-by-a-workflow',
        values: { status: change.status },
      },
    ];
  } else if (change.changedBy) {
    lines = [
      {
        key: 'message.entity-status-set-by',
        values: { status: change.status, by: change.changedBy },
      },
    ];
  }

  return lines;
};

/** What the status badge says about who set the status: a headline, then any detail lines. */
export const getStatusChangeLines = (
  change?: StatusChange
): StatusChangeLine[] =>
  change?.outcome
    ? decidedLines(change, change.outcome)
    : undecidedLines(change ?? {});
