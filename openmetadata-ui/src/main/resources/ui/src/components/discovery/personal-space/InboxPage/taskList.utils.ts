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
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { TaskResolutionType } from '../../../../rest/tasksAPI';

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
  type: TaskType;
  count: number;
  items: Task[];
}

const getTypeRank = (type: TaskType): number => {
  const rank = TASK_TYPE_ORDER.indexOf(type);

  return rank === -1 ? TASK_TYPE_ORDER.length : rank;
};

/**
 * Buckets tasks by type for the list's group headers, keeping each bucket in
 * the server's order so the newest task stays at the top of its group.
 *
 * Only the pages loaded so far are grouped — the server paginates by cursor,
 * not by type, so a later page can reopen a group that already appeared.
 */
export const groupTasksByType = (tasks: Task[]): TaskTypeGroup[] => {
  const groups = new Map<TaskType, Task[]>();
  tasks.forEach((task) => {
    const items = groups.get(task.type);
    items ? items.push(task) : groups.set(task.type, [task]);
  });

  return Array.from(groups, ([type, items]) => ({
    type,
    count: items.length,
    items,
  })).sort((a, b) => getTypeRank(a.type) - getTypeRank(b.type));
};

/** Narrows the loaded tasks to the chosen types; an empty choice means all. */
export const filterTasksByTypes = (tasks: Task[], types: TaskType[]): Task[] =>
  types.length === 0
    ? tasks
    : tasks.filter((task) => types.includes(task.type));
