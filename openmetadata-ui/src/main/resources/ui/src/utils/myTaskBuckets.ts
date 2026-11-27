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

import { Task, TaskCategory } from '../generated/entity/tasks/task';

/** The chips above the "My tasks" list. */
export enum MyTaskBucket {
  ALL = 'all',
  INCIDENTS = 'incidents',
  ACCESS = 'access',
  APPROVALS = 'approvals',
}

// Custom tasks sit in no bucket: they only show under All.
const BUCKET_BY_CATEGORY: Partial<Record<TaskCategory, MyTaskBucket>> = {
  [TaskCategory.Incident]: MyTaskBucket.INCIDENTS,
  [TaskCategory.DataAccess]: MyTaskBucket.ACCESS,
  [TaskCategory.Approval]: MyTaskBucket.APPROVALS,
  [TaskCategory.Review]: MyTaskBucket.APPROVALS,
  [TaskCategory.MetadataUpdate]: MyTaskBucket.APPROVALS,
};

export const getMyTaskBucket = (task: Task): MyTaskBucket | undefined =>
  BUCKET_BY_CATEGORY[task.category];

/** Per-bucket counts over `tasks`; `ALL` is the server's `total`. */
export const countMyTaskBuckets = (
  tasks: Task[],
  total: number
): Record<MyTaskBucket, number> =>
  tasks.reduce(
    (counts, task) => {
      const bucket = getMyTaskBucket(task);
      if (bucket) {
        counts[bucket] += 1;
      }

      return counts;
    },
    {
      [MyTaskBucket.ALL]: total,
      [MyTaskBucket.INCIDENTS]: 0,
      [MyTaskBucket.ACCESS]: 0,
      [MyTaskBucket.APPROVALS]: 0,
    }
  );

export const filterMyTasks = (tasks: Task[], bucket: MyTaskBucket): Task[] =>
  bucket === MyTaskBucket.ALL
    ? tasks
    : tasks.filter((task) => getMyTaskBucket(task) === bucket);

/**
 * What the selection bar offers for the selected tasks.
 *
 * Only access requests and approvals resolve from the card: both are a plain
 * approve-or-reject. An incident needs a root cause and a custom task a form,
 * so a selection holding either sends the viewer to the tasks page instead of
 * resolving anything blind.
 */
export type BulkTaskAction =
  | { kind: 'resolve'; approveLabelKey: string; rejectLabelKey: string }
  | { kind: 'open' };

export const getBulkTaskAction = (tasks: Task[]): BulkTaskAction => {
  const buckets = tasks.map(getMyTaskBucket);
  const isResolvable =
    buckets.length > 0 &&
    buckets.every(
      (bucket) =>
        bucket === MyTaskBucket.ACCESS || bucket === MyTaskBucket.APPROVALS
    );

  if (!isResolvable) {
    return { kind: 'open' };
  }

  const isAllAccess = buckets.every((bucket) => bucket === MyTaskBucket.ACCESS);

  return {
    approveLabelKey: isAllAccess ? 'label.grant' : 'label.approve',
    kind: 'resolve',
    rejectLabelKey: isAllAccess ? 'label.deny' : 'label.reject',
  };
};
