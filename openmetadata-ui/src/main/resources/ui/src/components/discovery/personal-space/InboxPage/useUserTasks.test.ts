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
import { TaskStatusGroup } from '../../../../rest/tasksAPI';
import { fetchUserTasksPage, userTaskCountQuery } from './useUserTasks';

const mockListTasks = jest.fn();

jest.mock('../../../../rest/tasksAPI', () => ({
  listTasks: (...args: unknown[]) => mockListTasks(...args),
  TaskStatusGroup: { Open: 'open', Closed: 'closed' },
}));

const user = {
  id: 'u1',
  name: 'alice',
  teams: [{ id: 'team1', type: 'team', name: 'Finance' }],
} as unknown as User;

const isCreatedQuery = (params: { createdById?: string }) =>
  Boolean(params.createdById);

describe('fetchUserTasksPage', () => {
  beforeEach(() => mockListTasks.mockReset());

  const task = (n: number) => ({ id: `id-${n}`, name: `TASK-0000${n}` });
  const ids = (page: { data: { id?: string }[] }) =>
    page.data.map(({ id }) => id);

  it('merges both sources in server order, once each', async () => {
    mockListTasks.mockImplementation((params) =>
      Promise.resolve(
        isCreatedQuery(params)
          ? { data: [task(1), task(2)], paging: { total: 2 } }
          : { data: [task(1), task(3)], paging: { total: 4 } }
      )
    );

    const page = await fetchUserTasksPage(user, { limit: 25 });

    expect(mockListTasks).toHaveBeenCalledWith(
      expect.objectContaining({ assignee: 'alice,Finance', limit: 25 })
    );
    expect(mockListTasks).toHaveBeenCalledWith(
      expect.objectContaining({ createdById: 'u1', limit: 25 })
    );
    expect(ids(page)).toEqual(['id-1', 'id-2', 'id-3']);
    expect(page.paging).toEqual({ after: undefined, total: 4 });
  });

  // The assigned source still has TASK-00004 on its next page, so the created
  // source's TASK-00005 must wait for it rather than land on page one.
  it('holds back a task a later page of the other source sorts before', async () => {
    mockListTasks.mockImplementation((params) => {
      if (isCreatedQuery(params)) {
        return Promise.resolve({ data: [task(2), task(5)], paging: {} });
      }

      return Promise.resolve(
        params.after
          ? { data: [task(4)], paging: {} }
          : { data: [task(1), task(3)], paging: { after: 'assigned-2' } }
      );
    });

    const first = await fetchUserTasksPage(user, { limit: 2 });

    expect(ids(first)).toEqual(['id-1', 'id-2', 'id-3']);

    mockListTasks.mockClear();
    const second = await fetchUserTasksPage(
      user,
      { limit: 2 },
      first.paging?.after
    );

    // Only the assigned source is asked again; the created one is buffered.
    expect(mockListTasks).toHaveBeenCalledTimes(1);
    expect(mockListTasks).toHaveBeenCalledWith(
      expect.objectContaining({ after: 'assigned-2' })
    );
    expect(ids(second)).toEqual(['id-4', 'id-5']);
    expect(second.paging?.after).toBeUndefined();
  });

  it('stops paging once both sources are exhausted', async () => {
    mockListTasks.mockResolvedValue({ data: [], paging: { total: 0 } });

    const page = await fetchUserTasksPage(user, {});

    expect(page.paging?.after).toBeUndefined();
  });
});

describe('userTaskCountQuery', () => {
  beforeEach(() => mockListTasks.mockReset());

  it('counts a task both assigned to and created by the user once', async () => {
    // 5 assigned, 3 created, 2 of them both.
    const totalFor = (params: { assignee?: string; createdById?: string }) => {
      if (params.assignee && params.createdById) {
        return 2;
      }

      return params.assignee ? 5 : 3;
    };
    mockListTasks.mockImplementation((params) => {
      const total = totalFor(params);

      return Promise.resolve({ data: [], paging: { total } });
    });

    const query = userTaskCountQuery(user, TaskStatusGroup.Open);

    await expect(query.queryFn()).resolves.toBe(6);
    expect(query.queryKey).toEqual([
      'inbox-task-status-counts',
      'user:u1',
      'open',
    ]);
    expect(mockListTasks).toHaveBeenCalledWith(
      expect.objectContaining({ statusGroup: 'open', limit: 1 })
    );
  });

  it('stays idle without a user', () => {
    expect(userTaskCountQuery(undefined).enabled).toBe(false);
  });
});
