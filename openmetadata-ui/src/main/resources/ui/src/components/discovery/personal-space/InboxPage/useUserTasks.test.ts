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

  it('merges the assigned and created pages newest-first, once each', async () => {
    mockListTasks.mockImplementation((params) =>
      Promise.resolve(
        isCreatedQuery(params)
          ? {
              data: [
                { id: 'b', createdAt: 2 },
                { id: 'a', createdAt: 1 },
              ],
              paging: { after: 'created-2', total: 4 },
            }
          : {
              data: [
                { id: 'c', createdAt: 3 },
                { id: 'a', createdAt: 1 },
              ],
              paging: { total: 2 },
            }
      )
    );

    const page = await fetchUserTasksPage(user, { limit: 25 });

    expect(mockListTasks).toHaveBeenCalledWith(
      expect.objectContaining({ assignee: 'alice,Finance', limit: 25 })
    );
    expect(mockListTasks).toHaveBeenCalledWith(
      expect.objectContaining({ createdById: 'u1', limit: 25 })
    );
    expect(page.data.map((task) => task.id)).toEqual(['c', 'b', 'a']);
    expect(page.paging?.after).toBeDefined();

    // The assigned source ran out, so the next page asks only the created one.
    mockListTasks.mockClear();
    const next = await fetchUserTasksPage(
      user,
      { limit: 25 },
      page.paging?.after
    );

    expect(mockListTasks).toHaveBeenCalledTimes(1);
    expect(mockListTasks).toHaveBeenCalledWith(
      expect.objectContaining({ createdById: 'u1', after: 'created-2' })
    );
    expect(next.data.map((task) => task.id)).toEqual(['b', 'a']);
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
