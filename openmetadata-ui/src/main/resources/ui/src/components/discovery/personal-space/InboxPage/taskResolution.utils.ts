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

import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import {
  EntityReference,
  Task,
  TaskStatus,
} from '../../../../generated/entity/tasks/task';
import { formatDate } from '../../../../utils/date-time/DateTimeUtils';
import { isTaskOpen } from './inbox.utils';

export type TaskStatusTone = 'success' | 'error' | 'warning' | 'gray';

// A task status enum value ("InProgress") → its kebab i18n label key
// ("label.in-progress"). Generic over any TaskStatus, so the status badge needs
// no task-type-specific knowledge.
const toStatusLabelKey = (status: string): string =>
  `label.${status.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;

// An approval-shaped end state reads green, a denial-shaped one red, in-flight
// amber; end states that are neither (expiry, withdrawal) stay neutral.
const STATUS_TONE: Partial<Record<TaskStatus, TaskStatusTone>> = {
  [TaskStatus.Approved]: 'success',
  [TaskStatus.Granted]: 'success',
  [TaskStatus.Completed]: 'success',
  [TaskStatus.Rejected]: 'error',
  [TaskStatus.Revoked]: 'error',
  [TaskStatus.Failed]: 'error',
  [TaskStatus.Open]: 'warning',
  [TaskStatus.Pending]: 'warning',
  [TaskStatus.InProgress]: 'warning',
  [TaskStatus.ManualRevoke]: 'warning',
  [TaskStatus.Expired]: 'gray',
  [TaskStatus.Cancelled]: 'gray',
};

export interface TaskStatusBadge {
  label: string;
  tone: TaskStatusTone;
}

/** The status badge shown beside the task title, for open and closed alike. */
export const getTaskStatusBadge = (
  task: Task,
  t: (key: string) => string
): TaskStatusBadge | undefined =>
  task.status
    ? {
        label: t(toStatusLabelKey(task.status)),
        tone: STATUS_TONE[task.status] ?? 'gray',
      }
    : undefined;

// The comment means something different per outcome. ManualRevoke is absent on
// purpose: it is an OPEN status, so no outcome row renders for it.
const COMMENT_LABEL_KEY: Partial<Record<TaskStatus, string>> = {
  [TaskStatus.Rejected]: 'label.reason-for-rejection',
  [TaskStatus.Revoked]: 'label.reason-for-revocation',
};

export interface TaskResolutionSummary {
  resolvedBy?: EntityReference;
  resolvedByName?: string;
  // Absent when the workflow closed the task itself (e.g. an expiry) and
  // stamped no resolution.
  resolvedOn?: string;
  // NO_DATA_PLACEHOLDER when the resolver left none — mandatory on a
  // rejection/revoke, optional on an approval.
  comment: string;
  commentLabelKey: string;
  hasResolution: boolean;
}

/**
 * Who resolved a closed task, when, and with what comment; `undefined` while it
 * is still open. Bucketing is keyed off `task.status`, not `resolution.type`, so
 * a Data Access Request awaiting its grant still counts as open.
 */
export const getTaskResolutionSummary = (
  task: Task
): TaskResolutionSummary | undefined => {
  // A partially-hydrated row (no status yet) reads as not resolved.
  if (!task.status || isTaskOpen(task)) {
    return undefined;
  }

  const resolution = task.resolution;
  const resolvedBy = resolution?.resolvedBy;
  const comment = resolution?.comment?.trim();

  return {
    resolvedBy,
    resolvedByName: resolvedBy?.displayName ?? resolvedBy?.name,
    resolvedOn: resolution?.resolvedAt
      ? formatDate(resolution.resolvedAt)
      : undefined,
    comment: comment || NO_DATA_PLACEHOLDER,
    commentLabelKey: COMMENT_LABEL_KEY[task.status] ?? 'label.comment',
    hasResolution: Boolean(resolution),
  };
};
