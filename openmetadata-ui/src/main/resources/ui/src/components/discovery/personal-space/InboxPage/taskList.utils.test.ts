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
  Task,
  TaskAvailableTransition,
  TaskStatus,
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { TaskResolutionType } from '../../../../rest/tasksAPI';
import {
  filterTasksByStatus,
  filterTasksByTypes,
  formatEntityType,
  getStatusGroupForBuckets,
  getTaskStatusBucket,
  groupTasksByType,
  isApproveTransition,
  isRejectTransition,
  TaskStatusBucket,
} from './taskList.utils';

const task = (id: string, type: TaskType): Task =>
  ({ id, type } as unknown as Task);

describe('formatEntityType', () => {
  it('spaces out a camel-cased entity type', () => {
    expect(formatEntityType('databaseSchema')).toBe('Database Schema');
  });

  it('returns an empty string when the type is missing', () => {
    expect(formatEntityType(undefined)).toBe('');
  });
});

describe('isApproveTransition / isRejectTransition', () => {
  const transition = (
    overrides: Partial<TaskAvailableTransition>
  ): TaskAvailableTransition =>
    ({ id: 'x', label: 'X', ...overrides } as TaskAvailableTransition);

  it('reads the resolution type before the id', () => {
    expect(
      isApproveTransition(
        transition({ id: 'grant', resolutionType: TaskResolutionType.Approved })
      )
    ).toBe(true);
    expect(
      isRejectTransition(
        transition({ id: 'deny', resolutionType: TaskResolutionType.Rejected })
      )
    ).toBe(true);
  });

  it('falls back to the conventional ids', () => {
    expect(isApproveTransition(transition({ id: 'approve' }))).toBe(true);
    expect(isRejectTransition(transition({ id: 'reject' }))).toBe(true);
  });

  it('leaves an unrelated transition alone', () => {
    expect(isApproveTransition(transition({ id: 'revoke' }))).toBe(false);
    expect(isRejectTransition(transition({ id: 'revoke' }))).toBe(false);
  });
});

describe('groupTasksByType', () => {
  it('counts each type and keeps the server order inside a group', () => {
    const groups = groupTasksByType([
      task('a', TaskType.TagUpdate),
      task('b', TaskType.TagUpdate),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: 'label.tag-request', count: 2 });
    expect(groups[0].items.map((item) => item.id)).toEqual(['a', 'b']);
  });

  // What a reviewer should look at first: a live failure, then a request that
  // blocks someone, then metadata hygiene.
  it('orders the groups by urgency, not by first appearance', () => {
    const groups = groupTasksByType([
      task('a', TaskType.TagUpdate),
      task('b', TaskType.DataAccessRequest),
      task('c', TaskType.TestCaseResolution),
    ]);

    expect(groups.map((group) => group.key)).toEqual([
      'label.incident',
      'label.access-request',
      'label.tag-request',
    ]);
  });

  // Both read "Incident"; two headers with the same label read as a bug.
  it('puts types that share a label under one header', () => {
    const groups = groupTasksByType([
      task('a', TaskType.IncidentResolution),
      task('b', TaskType.TestCaseResolution),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: 'label.incident', count: 2 });
  });

  it('puts an unranked type last rather than dropping it', () => {
    const groups = groupTasksByType([
      task('a', 'SomethingNew' as TaskType),
      task('b', TaskType.TagUpdate),
    ]);

    expect(groups.map((group) => group.key)).toEqual([
      'label.tag-request',
      'label.task',
    ]);
  });

  it('returns nothing for an empty queue', () => {
    expect(groupTasksByType([])).toEqual([]);
  });
});

describe('filterTasksByTypes', () => {
  const tasks = [
    task('a', TaskType.TagUpdate),
    task('b', TaskType.DataAccessRequest),
  ];

  it('keeps only the chosen types', () => {
    expect(
      filterTasksByTypes(tasks, ['label.tag-request']).map((item) => item.id)
    ).toEqual(['a']);
  });

  it('keeps every type that reads as the chosen kind', () => {
    expect(
      filterTasksByTypes(
        [
          task('a', TaskType.IncidentResolution),
          task('b', TaskType.TestCaseResolution),
          task('c', TaskType.TagUpdate),
        ],
        ['label.incident']
      ).map((item) => item.id)
    ).toEqual(['a', 'b']);
  });

  it('treats an empty choice as no filter at all', () => {
    expect(filterTasksByTypes(tasks, [])).toHaveLength(2);
  });
});

describe('getTaskStatusBucket', () => {
  const me = new Set(['u1', 'team-1']);
  const bucketOf = (task: Partial<Task>) =>
    getTaskStatusBucket(task as Task, me);

  it.each([
    [{ status: TaskStatus.Open }, TaskStatusBucket.Open],
    [{ status: TaskStatus.InProgress }, TaskStatusBucket.InReview],
    [{ status: TaskStatus.Pending }, TaskStatusBucket.InReview],
    [{ status: TaskStatus.Approved }, TaskStatusBucket.Approved],
    [{ status: TaskStatus.Granted }, TaskStatusBucket.Approved],
    [{ status: TaskStatus.Completed }, TaskStatusBucket.Approved],
    [{ status: TaskStatus.Rejected }, TaskStatusBucket.Rejected],
    [{ status: TaskStatus.Revoked }, TaskStatusBucket.Rejected],
    [{ status: TaskStatus.Cancelled }, undefined],
    [{ status: TaskStatus.Expired }, undefined],
  ])('files %o under %s', (task, bucket) => {
    expect(bucketOf(task)).toBe(bucket);
  });

  it('files an open task the viewer or their team holds as pending approval', () => {
    expect(
      bucketOf({
        status: TaskStatus.InProgress,
        assignees: [{ id: 'team-1' }],
      } as Partial<Task>)
    ).toBe(TaskStatusBucket.PendingApproval);
  });

  // Approved but not yet granted: open, yet the outcome is what it reads as.
  it('files an approved access request under Approved though it is open', () => {
    expect(
      bucketOf({
        status: TaskStatus.Approved,
        type: TaskType.DataAccessRequest,
        assignees: [{ id: 'u1' }],
      } as Partial<Task>)
    ).toBe(TaskStatusBucket.Approved);
  });
});

describe('filterTasksByStatus', () => {
  const tasks = [
    { id: 'a', status: TaskStatus.Open },
    { id: 'b', status: TaskStatus.Rejected },
    { id: 'c', status: TaskStatus.Cancelled },
  ] as unknown as Task[];

  it('keeps the tasks under the chosen options', () => {
    expect(
      filterTasksByStatus(tasks, [TaskStatusBucket.Rejected], new Set()).map(
        ({ id }) => id
      )
    ).toEqual(['b']);
  });

  it('keeps every task, even those under no option, with nothing chosen', () => {
    expect(filterTasksByStatus(tasks, [], new Set())).toHaveLength(3);
  });
});

describe('getStatusGroupForBuckets', () => {
  it.each([
    [[TaskStatusBucket.Open, TaskStatusBucket.PendingApproval], 'open'],
    [[TaskStatusBucket.Rejected], 'closed'],
    [[TaskStatusBucket.Approved], undefined],
    [[TaskStatusBucket.Open, TaskStatusBucket.Rejected], undefined],
    [[], undefined],
  ])('fetches %o from %s', (buckets, group) => {
    expect(getStatusGroupForBuckets(buckets)).toBe(group);
  });
});
