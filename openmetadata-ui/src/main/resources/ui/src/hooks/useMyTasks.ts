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
import { useMemo } from 'react';
import { Task } from '../generated/entity/tasks/task';
import { listMyAssignedTasks, TaskStatusGroup } from '../rest/tasksAPI';
import { countMyTaskBuckets, MyTaskBucket } from '../utils/myTaskBuckets';

export const MY_TASKS_QUERY_KEY = ['landingPage', 'widgets', 'myTasks'];
/**
 * One request's worth. The bucket counts are taken over this page, so past it
 * they describe the loaded tasks rather than every task — the card's footer
 * shows the loaded and total counts ("100/250 Tasks") when that happens.
 */
// ADR:2026-10-16-landing-task-and-pipeline-cards-read-one-page
export const MY_TASKS_PAGE_SIZE = 100;
// `payload` is what a legacy approve resolves to; without it an approve from
// the card would apply an empty value.
const MY_TASKS_FIELDS = 'assignees,createdBy,about,payload';
const MY_TASKS_TTL_MS = 60 * 1000;

export interface MyTasks {
  /** The loaded page, newest first as the server orders it. */
  tasks: Task[];
  /** Every open task assigned to the viewer or their teams. */
  total: number;
  /** Per bucket, counted over `tasks`; `ALL` is `total`. */
  counts: Record<MyTaskBucket, number>;
  /** When the loaded page was fetched, for the "Updated …" footer. */
  dataUpdatedAt: number;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
}

const fetchMyTasks = () =>
  listMyAssignedTasks({
    fields: MY_TASKS_FIELDS,
    limit: MY_TASKS_PAGE_SIZE,
    statusGroup: TaskStatusGroup.Open,
  });

/**
 * The viewer's open tasks for the "My tasks" card.
 *
 * `/tasks/assigned` rather than `/tasks?assignee=`: it resolves the viewer's
 * teams server-side, so a task assigned to a team the viewer is on shows up
 * here as it does in the inbox. It cannot filter by category, which is why the
 * buckets are counted over the loaded page.
 */
export const useMyTasks = (): MyTasks => {
  const { data, dataUpdatedAt, isPending, isFetching, isError, refetch } =
    useQuery({
      queryFn: fetchMyTasks,
      queryKey: MY_TASKS_QUERY_KEY,
      staleTime: MY_TASKS_TTL_MS,
    });

  return useMemo(() => {
    const tasks = data?.data ?? [];
    const total = data?.paging?.total ?? tasks.length;

    return {
      counts: countMyTaskBuckets(tasks, total),
      dataUpdatedAt,
      isError,
      isFetching,
      isLoading: isPending,
      refetch: () => {
        void refetch();
      },
      tasks,
      total,
    };
  }, [data, dataUpdatedAt, isPending, isFetching, isError, refetch]);
};
