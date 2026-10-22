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
import { useQuery } from '@tanstack/react-query';
import { orderBy, uniqBy } from 'lodash';
import { Task } from '../../../../generated/entity/tasks/task';
import { User } from '../../../../generated/entity/teams/user';
import {
  listTasks,
  ListTasksParams,
  TaskStatusGroup,
} from '../../../../rest/tasksAPI';
import { TASK_STATUS_COUNTS_QUERY_KEY } from '../inbox.constants';
import { InboxListPage } from './useInboxInfiniteList';

const USER_TASK_COUNT_STALE_TIME = 30_000;

type UserTaskListParams = Omit<
  ListTasksParams,
  'after' | 'assignee' | 'createdById'
>;

// Per-source cursor; null marks a source with no pages left.
interface MergedCursor {
  assigned?: string | null;
  created?: string | null;
}

/** The task-list cache scope for a user's tasks, shared by list and counts. */
export const getUserTaskScope = (userId: string) => `user:${userId}`;

// The backend ANDs its filters, so "assigned to OR created by" is two queries.
// A task assigned to one of the user's teams is theirs too, as in the Inbox.
const getAssigneeParam = (user: User) =>
  [user.name, ...(user.teams ?? []).map((team) => team.name)]
    .filter(Boolean)
    .join(',');

// A source past its last page (null cursor) is not asked again.
const fetchSource = (
  cursor: string | null | undefined,
  params: ListTasksParams
) => (cursor === null ? undefined : listTasks({ ...params, after: cursor }));

/**
 * One page of the tasks assigned to or created by `user`: a page from each
 * source, merged newest-first and deduped. `after` carries both cursors.
 */
export const fetchUserTasksPage = async (
  user: User,
  params: UserTaskListParams,
  after?: string
): Promise<InboxListPage<Task>> => {
  const cursor: MergedCursor = after ? JSON.parse(after) : {};
  const [assigned, created] = await Promise.all([
    fetchSource(cursor.assigned, {
      ...params,
      assignee: getAssigneeParam(user),
    }),
    fetchSource(cursor.created, { ...params, createdById: user.id }),
  ]);
  const next: MergedCursor = {
    assigned: assigned?.paging?.after ?? null,
    created: created?.paging?.after ?? null,
  };
  const pages = [assigned, created];

  // ponytail: each page is ordered on its own, so a later page can hold a task
  // newer than this page's last; a server-side OR filter would fix the order.
  return {
    data: orderBy(
      uniqBy(
        pages.flatMap((page) => page?.data ?? []),
        'id'
      ),
      'createdAt',
      'desc'
    ),
    paging: {
      after: next.assigned || next.created ? JSON.stringify(next) : undefined,
      // A lower bound: the overlap between the two sources is unknown here.
      total: Math.max(...pages.map((page) => page?.paging?.total ?? 0)),
    },
  };
};

const countTasks = (params: ListTasksParams) =>
  listTasks({ ...params, limit: 1 }).then((res) => res.paging?.total ?? 0);

/**
 * React Query options for the number of a user's tasks in a status group:
 * |assigned| + |created| − |both|, so a task they assigned to themselves counts
 * once. Keyed like the Tasks tab's badge totals, so one invalidation covers both.
 */
export const userTaskCountQuery = (
  user: User | undefined,
  statusGroup?: TaskStatusGroup
) => ({
  queryKey: [
    TASK_STATUS_COUNTS_QUERY_KEY,
    getUserTaskScope(user?.id ?? ''),
    statusGroup ?? 'all',
  ],
  queryFn: async () => {
    if (!user) {
      return 0;
    }
    const assignee = getAssigneeParam(user);
    const [assigned, created, both] = await Promise.all([
      countTasks({ statusGroup, assignee }),
      countTasks({ statusGroup, createdById: user.id }),
      countTasks({ statusGroup, assignee, createdById: user.id }),
    ]);

    return assigned + created - both;
  },
  enabled: Boolean(user?.id),
  staleTime: USER_TASK_COUNT_STALE_TIME,
});

/** The user's open tasks (assigned to or created by them), for a tab badge. */
export const useUserOpenTaskCount = (user: User | undefined) =>
  useQuery(userTaskCountQuery(user, TaskStatusGroup.Open)).data;
