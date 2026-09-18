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
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { TaskResolutionType } from '../../../../rest/tasksAPI';
import {
  filterTasksByTypes,
  formatEntityType,
  groupTasksByType,
  isApproveTransition,
  isRejectTransition,
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
    expect(groups[0]).toMatchObject({ type: TaskType.TagUpdate, count: 2 });
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

    expect(groups.map((group) => group.type)).toEqual([
      TaskType.TestCaseResolution,
      TaskType.DataAccessRequest,
      TaskType.TagUpdate,
    ]);
  });

  it('puts an unranked type last rather than dropping it', () => {
    const groups = groupTasksByType([
      task('a', 'SomethingNew' as TaskType),
      task('b', TaskType.TagUpdate),
    ]);

    expect(groups.map((group) => group.type)).toEqual([
      TaskType.TagUpdate,
      'SomethingNew',
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
      filterTasksByTypes(tasks, [TaskType.TagUpdate]).map((item) => item.id)
    ).toEqual(['a']);
  });

  it('treats an empty choice as no filter at all', () => {
    expect(filterTasksByTypes(tasks, [])).toHaveLength(2);
  });
});
