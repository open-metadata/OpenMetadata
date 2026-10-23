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
import { last, partition, uniqBy } from 'lodash';
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

// One source's place in the merge: its server cursor (null once it has no
// pages left) and the tasks loaded from it but not yet handed out.
interface SourceState {
  after?: string | null;
  buffered: Task[];
  total?: number;
}

interface MergedCursor {
  assigned: SourceState;
  created: SourceState;
}

const START: SourceState = { buffered: [] };

/** The task-list cache scope for a user's tasks, shared by list and counts. */
export const getUserTaskScope = (userId: string) => `user:${userId}`;

// The backend ANDs its filters, so "assigned to OR created by" is two queries.
// A task assigned to one of the user's teams is theirs too, as in the Inbox.
const getAssigneeParam = (user: User) =>
  [user.name, ...(user.teams ?? []).map((team) => team.name)]
    .filter(Boolean)
    .join(',');

// The server pages tasks by (name, id) ascending. Names (TASK-00042) and UUIDs
// are single-case ASCII, so a plain string compare agrees with the DB's order.
const compareKey = (a = '', b = '') => Number(a > b) - Number(a < b);
const compareTasksInServerOrder = (a: Task, b: Task) =>
  compareKey(a.name, b.name) || compareKey(a.id, b.id);

// Fetch a source's next page only once its buffered tasks are used up.
const loadSource = async (
  source: SourceState,
  params: ListTasksParams
): Promise<SourceState> => {
  if (source.buffered.length || source.after === null) {
    return source;
  }
  const page = await listTasks({ ...params, after: source.after });

  return {
    after: page.paging?.after ?? null,
    buffered: page.data ?? [],
    total: page.paging?.total,
  };
};

/**
 * One page of the tasks assigned to or created by `user`, in the server's
 * order across pages: a merge of the two sources that hands out a task only
 * once neither source can still return one that sorts before it. The rest stay
 * buffered in `after`, alongside both server cursors.
 */
export const fetchUserTasksPage = async (
  user: User,
  params: UserTaskListParams,
  after?: string
): Promise<InboxListPage<Task>> => {
  const cursor: MergedCursor = after
    ? JSON.parse(after)
    : { assigned: START, created: START };
  const sources = await Promise.all([
    loadSource(cursor.assigned, {
      ...params,
      assignee: getAssigneeParam(user),
    }),
    loadSource(cursor.created, { ...params, createdById: user.id }),
  ]);

  // A source with pages left only returns tasks after its last loaded one.
  const bounds = sources
    .filter((source) => source.after !== null)
    .map((source) => last(source.buffered));
  const isSettled = (task: Task) =>
    bounds.every(
      (bound) => bound && compareTasksInServerOrder(task, bound) <= 0
    );
  const [assigned, created] = sources.map((source) =>
    partition(source.buffered, isSettled)
  );
  const next: MergedCursor = {
    assigned: { after: sources[0].after, buffered: assigned[1] },
    created: { after: sources[1].after, buffered: created[1] },
  };
  const hasMore = Object.values(next).some(
    (source) => source.after !== null || source.buffered.length > 0
  );

  return {
    // A task both assigned to and created by the user sorts the same in both
    // sources, so its two copies settle together and dedupe here.
    data: uniqBy(
      [...assigned[0], ...created[0]].sort(compareTasksInServerOrder),
      'id'
    ),
    paging: {
      after: hasMore ? JSON.stringify(next) : undefined,
      // A lower bound: the overlap between the two sources is unknown here.
      total: Math.max(...sources.map((source) => source.total ?? 0)),
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
