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
import {
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import { TestCaseResolutionPayload } from '../../../../generated/type/testCaseResolutionPayload';
import { TaskComment } from '../../../../rest/tasksAPI';

/** Colour of an event row: an outcome reads green, a denial red. */
export type TaskTimelineTone = 'default' | 'error' | 'success';

/** Icon slot for an event row; the renderer maps the key to a component. */
export type TaskTimelineIcon =
  | 'approved'
  | 'assigned'
  | 'created'
  | 'incident'
  | 'rejected'
  | 'resolved';

export interface TaskTimelineEvent {
  kind: 'event';
  id: string;
  actor?: EntityReference;
  /** i18n key interpolating `user`, plus any `textParams`. */
  textKey: string;
  /** Further values the text interpolates, e.g. an assignee or a reason. */
  textParams?: Record<string, EntityReference | string | undefined>;
  icon: TaskTimelineIcon;
  /** Shown beside the event. Absent when the task never recorded a time. */
  timestamp?: number;
  /**
   * Where the event sorts, when it differs from `timestamp`. Lets an untimed
   * event hold its place in the stream without displaying a time it lacks.
   */
  sortAt?: number;
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

// The task records who holds it but never when they were given it. The event
// therefore carries no time: it sorts right after creation, where assignment
// almost always happens, and states the current holder without claiming a
// moment. A later reassignment still reads correctly as "assigned to X"; only
// its exact position among comments is unknown.
const getAssignedEvent = (task: Task): TaskTimelineEvent[] => {
  const assignee = task.assignees?.[0];

  return assignee
    ? [
        {
          kind: 'event',
          id: `assigned-${assignee.id}`,
          actor: assignee,
          textKey: 'message.task-event-assigned',
          icon: 'assigned',
          sortAt: task.createdAt,
          tone: 'default',
        },
      ]
    : [];
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

// How each incident status record reads in the stream.
const INCIDENT_STATUS_EVENT: Record<
  TestCaseResolutionStatusTypes,
  { textKey: string; icon: TaskTimelineIcon; tone: TaskTimelineTone }
> = {
  [TestCaseResolutionStatusTypes.New]: {
    textKey: 'message.task-event-incident-opened',
    icon: 'incident',
    tone: 'error',
  },
  [TestCaseResolutionStatusTypes.ACK]: {
    textKey: 'message.task-event-incident-acknowledged',
    icon: 'approved',
    tone: 'default',
  },
  [TestCaseResolutionStatusTypes.Assigned]: {
    textKey: 'message.task-event-incident-assigned',
    icon: 'assigned',
    tone: 'default',
  },
  [TestCaseResolutionStatusTypes.Resolved]: {
    textKey: 'message.task-event-incident-resolved',
    icon: 'resolved',
    tone: 'success',
  },
};

// The opening record also says why the incident was raised, when the task
// carries the test's failure reason.
const getIncidentOpenedText = (task: Task) => {
  const reason = (task.payload as Partial<TestCaseResolutionPayload>)
    ?.failureReason;

  return reason
    ? {
        textKey: 'message.task-event-incident-opened-with-reason',
        textParams: { reason },
      }
    : { textKey: 'message.task-event-incident-opened' };
};

// A status record stores its assignee as it was sent, sometimes a bare id; the
// task's own assignees are hydrated, so they supply the name when they can.
const resolveAssignee = (task: Task, assignee?: EntityReference) =>
  assignee && !assignee.name
    ? task.assignees?.find((ref) => ref.id === assignee.id) ?? assignee
    : assignee;

/**
 * An incident's real history: one event per status record — opened,
 * acknowledged, assigned (to whom), resolved — each with who made the change
 * and when. Replaces the events otherwise guessed from the task's fields.
 */
const getIncidentStatusEvents = (
  task: Task,
  statuses: TestCaseResolutionStatus[]
): TaskTimelineEvent[] =>
  statuses.map((status, index) => {
    const details = status.testCaseResolutionStatusDetails;
    const isOpening =
      index === 0 &&
      status.testCaseResolutionStatusType === TestCaseResolutionStatusTypes.New;
    const opened = isOpening ? getIncidentOpenedText(task) : undefined;
    const event = INCIDENT_STATUS_EVENT[status.testCaseResolutionStatusType];
    const assignee = resolveAssignee(task, details?.assignee);
    // An assignee nobody can name would leave "assigned the incident to" with
    // nothing after it; say it was reassigned instead.
    const isUnnamedAssignee = Boolean(assignee) && !assignee?.name;

    return {
      kind: 'event',
      id: `incident-${status.id ?? index}`,
      actor:
        details?.resolvedBy ??
        status.updatedBy ??
        (isOpening ? task.createdBy : undefined),
      icon: event.icon,
      tone: event.tone,
      textKey:
        opened?.textKey ??
        (isUnnamedAssignee
          ? 'message.task-event-incident-reassigned'
          : event.textKey),
      textParams: { ...opened?.textParams, assignee },
      timestamp: status.timestamp,
    };
  });

/**
 * The task's lifecycle as one oldest-first stream of events and comments,
 * synthesized from the task's own fields — there is no per-task event endpoint.
 *
 * Every event shows a time only when the task recorded one. Assignment has
 * none, so it is placed after creation and shown untimed rather than dated to a
 * moment that did not happen. For an incident, its status records (when
 * fetched) supply the real events instead, reassignments included. Other
 * tasks' reassignments and reopens are unrepresented; only
 * `GET /v1/tasks/{id}/versions` records those.
 */
export const buildTaskTimeline = (
  task: Task,
  incidentStatuses?: TestCaseResolutionStatus[]
): TaskTimelineEntry[] => {
  const comments: TaskTimelineEntry[] = (task.comments ?? []).map(
    (comment) => ({
      kind: 'comment',
      id: `comment-${comment.id}`,
      comment,
      timestamp: comment.createdAt,
    })
  );

  const resolutionEvents = getResolutionEvent(task);

  const sortKey = (entry: TaskTimelineEntry) =>
    (entry.kind === 'event' ? entry.sortAt : undefined) ?? entry.timestamp ?? 0;

  const events = incidentStatuses?.length
    ? getIncidentStatusEvents(task, incidentStatuses)
    : [
        getCreatedEvent(task),
        ...getAssignedEvent(task),
        ...getApprovalEvent(task, resolutionEvents),
        ...resolutionEvents,
      ];

  // Array sort is stable, so events that share a sort key keep this order —
  // which is what puts "assigned" right after "created".
  return [...events, ...comments].sort((a, b) => sortKey(a) - sortKey(b));
};
