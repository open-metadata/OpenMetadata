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

import { User } from '../../../../generated/entity/teams/user';
import {
  listMyVisibleTasks,
  listTasks,
  ListTasksParams,
  TaskStatusGroup,
} from '../../../../rest/tasksAPI';
import { fetchUserTasksPage, getUserTaskScope } from './useUserTasks';

/**
 * Which tasks a queue holds: the viewer's visible ones (their Inbox), every
 * task about one entity, the tasks assigned to one user (by name, from a
 * link), or the tasks assigned to or created by one user, read from their side.
 */
export type TaskListScope =
  | { type: 'visible' }
  | { type: 'entity'; aboutEntity: string }
  | { type: 'assignee'; assignee: string }
  | { type: 'user'; user: User };

export const VISIBLE_TASKS: TaskListScope = { type: 'visible' };

export const getTaskScopeKey = (scope: TaskListScope): string => {
  switch (scope.type) {
    case 'entity':
      return `entity:${scope.aboutEntity}`;
    case 'assignee':
      return `assignee:${scope.assignee}`;
    case 'user':
      return getUserTaskScope(scope.user.id);
    default:
      return 'me';
  }
};

// The visible list is the viewer's own; the others filter every task. A
// user's list merges two server queries, so its cursor is its own.
export const listScopedTasks = (
  scope: TaskListScope,
  params: ListTasksParams
) => {
  switch (scope.type) {
    case 'entity':
      return listTasks({ ...params, aboutEntity: scope.aboutEntity });
    case 'assignee':
      return listTasks({ ...params, assignee: scope.assignee });
    case 'user': {
      const { after, ...rest } = params;

      return fetchUserTasksPage(scope.user, rest, after);
    }
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

// Pulls the three per-status totals out of the useQueries results array. A
// failed count shows no badge rather than a misleading 0.
export const getStatusCounts = (
  countQueries: { data?: number; isError: boolean }[]
): Record<TaskStatusFilter, number | undefined> => {
  const [all, open, closed] = countQueries.map(({ data, isError }) =>
    isError ? undefined : data ?? 0
  );

  return { all, open, closed };
};

// The status group each choice asks the API for; "all" sends none.
export const STATUS_COUNT_GROUPS: (TaskStatusGroup | undefined)[] = [
  undefined,
  TaskStatusGroup.Open,
  TaskStatusGroup.Closed,
];
