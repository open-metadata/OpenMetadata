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
import { ResolutionType } from '../generated/api/tasks/resolveTask';
import {
  Task,
  TaskCategory,
  TaskStatus,
  TaskType,
} from '../generated/entity/tasks/task';
import {
  getTaskDetailPath,
  getTaskResolveBody,
  isTaskClosed,
} from './TaskUtils';

it('routes a minimal release review reference by UUID while retaining the legacy entity task route', () => {
  const reference = {
    id: 'task-uuid',
    taskId: 'TASK-00042',
    type: TaskType.RequestApproval,
    about: {
      id: 'release',
      type: 'ontologyRelease',
      fullyQualifiedName: 'Sales.release-5',
    },
  };

  expect(getTaskDetailPath(reference)).toBe('/tasks/task-uuid');
  expect(getTaskDetailPath({ ...reference, about: undefined })).toBe(
    '/tasks/task-uuid'
  );
  expect(
    getTaskDetailPath({
      ...reference,
      about: {
        id: 'table',
        type: 'table',
        fullyQualifiedName: 'sales.orders/item',
      },
    })
  ).toBe('/table/sales.orders%2Fitem/activity_feed/tasks/TASK-00042');
});

it('keeps native approval a vote over frozen content and preserves legacy task edits', () => {
  const task: Task = {
    id: 'task',
    name: 'Review',
    category: TaskCategory.Approval,
    createdBy: { id: 'author', type: 'user' },
    status: TaskStatus.Open,
    type: TaskType.RequestApproval,
    about: { id: 'release', type: 'ontologyRelease' },
  };
  const vote = {
    transitionId: 'approve',
    resolutionType: ResolutionType.Approved,
    comment: 'Reviewed',
    newValue: 'cannot replace frozen content',
  };

  expect(getTaskResolveBody(task, vote)).toEqual({
    transitionId: 'approve',
    resolutionType: ResolutionType.Approved,
    comment: 'Reviewed',
  });
  expect(
    getTaskResolveBody({ ...task, about: { id: 'table', type: 'table' } }, vote)
  ).toEqual(vote);
});

it.each([
  TaskStatus.Completed,
  TaskStatus.Approved,
  TaskStatus.Rejected,
  TaskStatus.Cancelled,
])('treats the terminal %s task as closed', (status) => {
  expect(isTaskClosed(status)).toBe(true);
  expect(isTaskClosed(TaskStatus.Open)).toBe(false);
});
