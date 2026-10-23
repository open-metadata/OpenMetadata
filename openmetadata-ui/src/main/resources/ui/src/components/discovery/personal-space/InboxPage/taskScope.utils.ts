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
  listMyVisibleTasks,
  listTasks,
  ListTasksParams,
  TaskStatusGroup,
} from '../../../../rest/tasksAPI';

/**
 * Which tasks a queue holds: the viewer's visible ones (their Inbox), every
 * task about one entity, or the tasks assigned to one user.
 */
export type TaskListScope =
  | { type: 'visible' }
  | { type: 'entity'; aboutEntity: string }
  | { type: 'assignee'; assignee: string };

export const VISIBLE_TASKS: TaskListScope = { type: 'visible' };

export const getTaskScopeKey = (scope: TaskListScope): string => {
  switch (scope.type) {
    case 'entity':
      return `entity:${scope.aboutEntity}`;
    case 'assignee':
      return `assignee:${scope.assignee}`;
    default:
      return 'me';
  }
};

// The visible list is the viewer's own; the others filter every task.
export const listScopedTasks = (
  scope: TaskListScope,
  params: ListTasksParams
) => {
  switch (scope.type) {
    case 'entity':
      return listTasks({ ...params, aboutEntity: scope.aboutEntity });
    case 'assignee':
      return listTasks({ ...params, assignee: scope.assignee });
    default:
      return listMyVisibleTasks(params);
  }
};

export type TaskStatusFilter = 'all' | 'open' | 'closed';

export const STATUS_FILTERS: { id: TaskStatusFilter; labelKey: string }[] = [
  { id: 'all', labelKey: 'label.all' },
  { id: 'open', labelKey: 'label.open' },
  { id: 'closed', labelKey: 'label.closed' },
];

// Pulls the three per-status totals out of the useQueries results array.
export const getStatusCounts = (
  countQueries: { data?: number }[]
): Record<TaskStatusFilter, number> => ({
  all: countQueries[0].data ?? 0,
  open: countQueries[1].data ?? 0,
  closed: countQueries[2].data ?? 0,
});

// The status group each choice asks the API for; "all" sends none.
export const STATUS_COUNT_GROUPS: (TaskStatusGroup | undefined)[] = [
  undefined,
  TaskStatusGroup.Open,
  TaskStatusGroup.Closed,
];
