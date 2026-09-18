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

import {
  EntityReference,
  Task,
  TaskCategory,
  TaskStatus,
} from '../../../../generated/entity/tasks/task';
import { TaskComment } from '../../../../rest/tasksAPI';

/** Colour of an event row: an outcome reads green, a denial red. */
export type TaskTimelineTone = 'default' | 'error' | 'success';

/** Icon slot for an event row; the renderer maps the key to a component. */
export type TaskTimelineIcon =
  | 'approved'
  | 'created'
  | 'incident'
  | 'rejected'
  | 'resolved';

export interface TaskTimelineEvent {
  kind: 'event';
  id: string;
  actor?: EntityReference;
  /** i18n key interpolating `user`. */
  textKey: string;
  icon: TaskTimelineIcon;
  timestamp?: number;
  tone: TaskTimelineTone;
}

export interface TaskTimelineComment {
  kind: 'comment';
  id: string;
  comment: TaskComment;
  timestamp?: number;
}

export type TaskTimelineEntry = TaskTimelineEvent | TaskTimelineComment;

// A closed task's terminal status decides how its resolution event reads. Only
// statuses that are genuinely negative get the error tone; an expiry or a
// cancellation is neutral.
const RESOLUTION_EVENT: Partial<
  Record<
    TaskStatus,
    { textKey: string; icon: TaskTimelineIcon; tone: TaskTimelineTone }
  >
> = {
  [TaskStatus.Approved]: {
    textKey: 'message.task-event-approved',
    icon: 'approved',
    tone: 'success',
  },
  [TaskStatus.Granted]: {
    textKey: 'message.task-event-granted',
    icon: 'approved',
    tone: 'success',
  },
  [TaskStatus.Completed]: {
    textKey: 'message.task-event-completed',
    icon: 'resolved',
    tone: 'success',
  },
  [TaskStatus.Rejected]: {
    textKey: 'message.task-event-rejected',
    icon: 'rejected',
    tone: 'error',
  },
  [TaskStatus.Revoked]: {
    textKey: 'message.task-event-revoked',
    icon: 'rejected',
    tone: 'error',
  },
  [TaskStatus.Cancelled]: {
    textKey: 'message.task-event-cancelled',
    icon: 'rejected',
    tone: 'default',
  },
  [TaskStatus.Expired]: {
    textKey: 'message.task-event-expired',
    icon: 'rejected',
    tone: 'default',
  },
};

const getCreatedEvent = (task: Task): TaskTimelineEvent => {
  const isIncident = task.category === TaskCategory.Incident;

  return {
    kind: 'event',
    id: 'created',
    actor: task.createdBy,
    textKey: isIncident
      ? 'message.task-event-incident-opened'
      : 'message.task-event-created',
    icon: isIncident ? 'incident' : 'created',
    timestamp: task.createdAt,
    tone: isIncident ? 'error' : 'default',
  };
};

// `approvedBy` marks an approval the task survived (a granted access request is
// approved first, granted later). Skipped when the terminal event already says
// "approved", which would otherwise render the same moment twice.
const getApprovalEvent = (
  task: Task,
  resolutionEvents: TaskTimelineEvent[]
): TaskTimelineEvent[] => {
  const isCoveredByResolution = resolutionEvents.some(
    (event) => event.textKey === 'message.task-event-approved'
  );
  if (!task.approvedBy || isCoveredByResolution) {
    return [];
  }

  return [
    {
      kind: 'event',
      id: 'approved',
      actor: task.approvedBy,
      textKey: 'message.task-event-approved',
      icon: 'approved',
      timestamp: task.approvedAt,
      tone: 'success',
    },
  ];
};

const getResolutionEvent = (task: Task): TaskTimelineEvent[] => {
  const resolution = task.resolution;
  const event = task.status ? RESOLUTION_EVENT[task.status] : undefined;
  if (!resolution || !event) {
    return [];
  }

  return [
    {
      kind: 'event',
      id: 'resolved',
      actor: resolution.resolvedBy,
      textKey: event.textKey,
      icon: event.icon,
      timestamp: resolution.resolvedAt,
      tone: event.tone,
    },
  ];
};

/**
 * The task's lifecycle as one oldest-first stream of events and comments,
 * synthesized from the task's own fields — there is no per-task event endpoint.
 *
 * Only moments the task actually timestamps appear. Assignment is deliberately
 * absent: the task records who holds it but never when they were given it, and
 * dating that to creation would place a reassignment before comments that
 * really came first. The current assignee is shown in the summary rows instead.
 * Reassignments and reopens are likewise unrepresented; only
 * `GET /v1/tasks/{id}/versions` records those.
 */
export const buildTaskTimeline = (task: Task): TaskTimelineEntry[] => {
  const comments: TaskTimelineEntry[] = (task.comments ?? []).map(
    (comment) => ({
      kind: 'comment',
      id: `comment-${comment.id}`,
      comment,
      timestamp: comment.createdAt,
    })
  );

  const resolutionEvents = getResolutionEvent(task);

  return [
    getCreatedEvent(task),
    ...getApprovalEvent(task, resolutionEvents),
    ...resolutionEvents,
    ...comments,
  ].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
};
