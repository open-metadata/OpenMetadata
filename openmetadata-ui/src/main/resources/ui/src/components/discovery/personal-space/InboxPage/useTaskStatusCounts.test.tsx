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
import { renderHook } from '@testing-library/react';
import { TaskListScope } from './taskScope.utils';
import { useTaskStatusCounts } from './useTaskStatusCounts';

const mockListTasks = jest.fn().mockResolvedValue({ data: [], paging: {} });
let capturedCountQueries: { queryKey: unknown[]; queryFn: () => unknown }[];

jest.mock('@tanstack/react-query', () => ({
  useQueries: ({
    queries,
  }: {
    queries: { queryKey: unknown[]; queryFn: () => unknown }[];
  }) => {
    capturedCountQueries = queries;

    return queries.map(() => ({ data: 0 }));
  },
}));

jest.mock('rest/tasksAPI', () => ({
  listTasks: (...a: unknown[]) => mockListTasks(...a),
  listMyVisibleTasks: jest.fn(),
  TaskStatusGroup: { Open: 'open', Closed: 'closed' },
}));

const ENTITY: TaskListScope = {
  type: 'entity',
  aboutEntity: 'svc.db.schema.table',
};

describe('useTaskStatusCounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('counts All, Open and Closed for the scope, one task per request', () => {
    renderHook(() => useTaskStatusCounts(ENTITY));

    capturedCountQueries.forEach((query) => query.queryFn());

    expect(
      capturedCountQueries.map(({ queryKey }) => queryKey.slice(1))
    ).toEqual([
      ['entity:svc.db.schema.table', 'all'],
      ['entity:svc.db.schema.table', 'open'],
      ['entity:svc.db.schema.table', 'closed'],
    ]);
    expect(mockListTasks).toHaveBeenCalledWith(
      expect.objectContaining({
        aboutEntity: 'svc.db.schema.table',
        limit: 1,
        statusGroup: 'open',
      })
    );
  });
});
