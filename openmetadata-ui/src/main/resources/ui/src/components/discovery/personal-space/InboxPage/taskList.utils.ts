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

import {
  Task,
  TaskAvailableTransition,
  TaskStatus,
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { TaskResolutionType, TaskStatusGroup } from '../../../../rest/tasksAPI';
import { isTaskOpen } from './inbox.utils';
import { getTaskTypeKey } from './taskDetail.utils';

export const formatEntityType = (type?: string): string => {
  if (!type) {
    return '';
  }

  return type
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
};

export const isApproveTransition = (
  transition: TaskAvailableTransition
): boolean =>
  transition.resolutionType === TaskResolutionType.Approved ||
  transition.resolutionType === TaskResolutionType.AutoApproved ||
  transition.id === 'approve';

export const isRejectTransition = (
  transition: TaskAvailableTransition
): boolean =>
  transition.resolutionType === TaskResolutionType.Rejected ||
  transition.resolutionType === TaskResolutionType.AutoRejected ||
  transition.id === 'reject';

// Grouping order: what a reviewer should look at first. An incident is a live
// failure, an access request blocks someone's work, the rest are metadata
// hygiene. Anything unlisted falls to the end in its own group.
const TASK_TYPE_ORDER: readonly TaskType[] = [
  TaskType.TestCaseResolution,
  TaskType.IncidentResolution,
  TaskType.DataAccessRequest,
  TaskType.GlossaryApproval,
  TaskType.RequestApproval,
  TaskType.TagUpdate,
  TaskType.DescriptionUpdate,
  TaskType.OwnershipUpdate,
  TaskType.TierUpdate,
  TaskType.DomainUpdate,
  TaskType.Suggestion,
];

export interface TaskTypeGroup {
  // What the group reads as (see getTaskTypeKey); several types can share it.
  key: string;
  count: number;
  items: Task[];
}

const getTypeRank = (type: TaskType): number => {
  const rank = TASK_TYPE_ORDER.indexOf(type);

  return rank === -1 ? TASK_TYPE_ORDER.length : rank;
};

// A group sits where its most urgent member type would.
const getGroupRank = (items: Task[]) =>
  Math.min(...items.map((task) => getTypeRank(task.type)));

/**
 * Buckets tasks by what they read as (getTaskTypeKey) for the list's group
 * headers, keeping each bucket in the server's order so the newest task stays
 * at the top of its group. Types that share a label share one header.
 *
 * Only the pages loaded so far are grouped — the server paginates by cursor,
 * not by type, so a later page can reopen a group that already appeared.
 */
export const groupTasksByType = (tasks: Task[]): TaskTypeGroup[] => {
  const groups = new Map<string, Task[]>();
  tasks.forEach((task) => {
    const key = getTaskTypeKey(task);
    const items = groups.get(key);
    items ? items.push(task) : groups.set(key, [task]);
  });

  return Array.from(groups, ([key, items]) => ({
    key,
    count: items.length,
    items,
  })).sort((a, b) => getGroupRank(a.items) - getGroupRank(b.items));
};

/** Narrows the loaded tasks to the chosen kinds; an empty choice means all. */
export const filterTasksByTypes = (tasks: Task[], keys: string[]): Task[] =>
  keys.length === 0
    ? tasks
    : tasks.filter((task) => keys.includes(getTaskTypeKey(task)));

/**
 * The Status filter's options. "Pending approval" is the viewer's own queue —
 * derived from who holds the task, not a backend status — and the rest group
 * the backend statuses the way the queue reads them.
 */
export enum TaskStatusBucket {
  Open = 'open',
  PendingApproval = 'pending-approval',
  InReview = 'in-review',
  Approved = 'approved',
  Rejected = 'rejected',
}

export const TASK_STATUS_BUCKET_OPTIONS: {
  value: TaskStatusBucket;
  labelKey: string;
}[] = [
  { value: TaskStatusBucket.Open, labelKey: 'label.open' },
  {
    value: TaskStatusBucket.PendingApproval,
    labelKey: 'label.pending-approval',
  },
  { value: TaskStatusBucket.InReview, labelKey: 'label.in-review' },
  { value: TaskStatusBucket.Approved, labelKey: 'label.approved' },
  { value: TaskStatusBucket.Rejected, labelKey: 'label.rejected' },
];

/** The queue opens on work still in flight. */
export const DEFAULT_TASK_STATUS_BUCKETS: TaskStatusBucket[] = [
  TaskStatusBucket.Open,
  TaskStatusBucket.PendingApproval,
  TaskStatusBucket.InReview,
];

const OPEN_BUCKETS = new Set<TaskStatusBucket>(DEFAULT_TASK_STATUS_BUCKETS);

const OUTCOME_BUCKET: Partial<Record<TaskStatus, TaskStatusBucket>> = {
  [TaskStatus.Approved]: TaskStatusBucket.Approved,
  [TaskStatus.Granted]: TaskStatusBucket.Approved,
  [TaskStatus.Completed]: TaskStatusBucket.Approved,
  [TaskStatus.Rejected]: TaskStatusBucket.Rejected,
  [TaskStatus.Revoked]: TaskStatusBucket.Rejected,
};

const IN_REVIEW_STATUSES = new Set<TaskStatus>([
  TaskStatus.InProgress,
  TaskStatus.Pending,
  TaskStatus.ManualRevoke,
]);

/**
 * Which Status option a task falls under, or none (Cancelled, Expired, Failed).
 *
 * The outcome comes first, so an access request approved but not yet granted
 * reads Approved even though it is still open. Among open tasks, one the viewer
 * holds is theirs to act on, which outranks the stage it is in.
 */
export const getTaskStatusBucket = (
  task: Pick<Task, 'status' | 'type' | 'assignees'>,
  currentUserIds: ReadonlySet<string>
): TaskStatusBucket | undefined => {
  const outcome = OUTCOME_BUCKET[task.status];
  if (outcome || !isTaskOpen(task)) {
    return outcome;
  }
  if ((task.assignees ?? []).some(({ id }) => currentUserIds.has(id))) {
    return TaskStatusBucket.PendingApproval;
  }

  return IN_REVIEW_STATUSES.has(task.status)
    ? TaskStatusBucket.InReview
    : TaskStatusBucket.Open;
};

/** Tasks under any of the chosen options; no choice keeps every task. */
export const filterTasksByStatus = (
  tasks: Task[],
  buckets: TaskStatusBucket[],
  currentUserIds: ReadonlySet<string>
): Task[] => {
  if (buckets.length === 0) {
    return tasks;
  }
  const chosen = new Set(buckets);

  return tasks.filter((task) => {
    const bucket = getTaskStatusBucket(task, currentUserIds);

    return bucket !== undefined && chosen.has(bucket);
  });
};

/**
 * The server-side status group that covers the chosen options, so the list
 * fetches only what the filter can show. Approved spans both groups — an
 * approved access request stays open until granted — so it fetches all.
 */
export const getStatusGroupForBuckets = (
  buckets: TaskStatusBucket[]
): TaskStatusGroup | undefined => {
  if (buckets.length === 0) {
    return undefined;
  }
  if (buckets.every((bucket) => OPEN_BUCKETS.has(bucket))) {
    return TaskStatusGroup.Open;
  }

  return buckets.every((bucket) => bucket === TaskStatusBucket.Rejected)
    ? TaskStatusGroup.Closed
    : undefined;
};
