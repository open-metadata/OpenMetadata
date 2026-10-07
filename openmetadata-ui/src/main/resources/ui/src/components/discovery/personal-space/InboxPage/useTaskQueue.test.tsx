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
import { act, renderHook } from '@testing-library/react';
import {
  TaskListScope,
  useTaskQueue,
  useTaskStatusCounts,
} from './useTaskQueue';

const mockListTasks = jest.fn().mockResolvedValue({ data: [], paging: {} });
const mockListVisibleTasks = jest
  .fn()
  .mockResolvedValue({ data: [], paging: {} });
let capturedFetchPage: (after?: string) => unknown;
let capturedQueryKey: unknown[];
let capturedCountQueries: { queryKey: unknown[]; queryFn: () => unknown }[];

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useQueries: ({
    queries,
  }: {
    queries: { queryKey: unknown[]; queryFn: () => unknown }[];
  }) => {
    capturedCountQueries = queries;

    return queries.map(() => ({ data: 0 }));
  },
}));

jest.mock('./useCurrentUserIds', () => ({
  useCurrentUserIds: () => new Set(),
}));

jest.mock('./useInboxCounts', () => ({
  INBOX_COUNTS_QUERY_KEY: 'inbox-counts',
}));

jest.mock('./useInboxInfiniteList', () => ({
  useInboxInfiniteList: (
    queryKey: unknown[],
    fetchPage: (after?: string) => unknown
  ) => {
    capturedQueryKey = queryKey;
    capturedFetchPage = fetchPage;

    return {
      items: [],
      isLoading: false,
      isLoadingMore: false,
      hasMore: false,
      total: 0,
      scrollRef: { current: null },
      sentinelRef: { current: null },
      setItems: jest.fn(),
      setTotal: jest.fn(),
    };
  },
}));

jest.mock('rest/tasksAPI', () => ({
  listTasks: (...a: unknown[]) => mockListTasks(...a),
  listMyVisibleTasks: (...a: unknown[]) => mockListVisibleTasks(...a),
  TaskStatusGroup: { Open: 'open', Closed: 'closed' },
  TaskEntityType: jest.requireActual('generated/entity/tasks/task').TaskType,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const ENTITY: TaskListScope = {
  type: 'entity',
  aboutEntity: 'svc.db.schema.table',
};

describe('useTaskQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists the viewer's visible tasks by default", () => {
    renderHook(() => useTaskQueue());

    capturedFetchPage(undefined);

    expect(mockListVisibleTasks).toHaveBeenCalled();
    expect(mockListTasks).not.toHaveBeenCalled();
  });

  it('lists every task about an entity', () => {
    renderHook(() => useTaskQueue({ scope: ENTITY }));

    capturedFetchPage(undefined);

    expect(mockListTasks).toHaveBeenCalledWith(
      expect.objectContaining({ aboutEntity: 'svc.db.schema.table' })
    );
    expect(mockListVisibleTasks).not.toHaveBeenCalled();
  });

  it("lists a user's assigned tasks", () => {
    renderHook(() =>
      useTaskQueue({ scope: { type: 'assignee', assignee: 'harsh.vador' } })
    );

    capturedFetchPage(undefined);

    expect(mockListTasks).toHaveBeenCalledWith(
      expect.objectContaining({ assignee: 'harsh.vador' })
    );
  });

  // Each scope keeps its own cached pages, so an entity's list never shows
  // the Inbox's.
  it('keys the list by scope', () => {
    renderHook(() => useTaskQueue());
    const inboxKey = capturedQueryKey;
    renderHook(() => useTaskQueue({ scope: ENTITY }));

    expect(capturedQueryKey).not.toEqual(inboxKey);
    expect(capturedQueryKey).toContain('entity:svc.db.schema.table');
  });

  // A host keeps the choice while the queue is unmounted and shows its count.
  it('opens on the given status and reports each choice', () => {
    const onStatusChange = jest.fn();
    const { result } = renderHook(() =>
      useTaskQueue({ scope: ENTITY, initialStatus: 'closed', onStatusChange })
    );

    expect(result.current.status).toBe('closed');
    expect(capturedQueryKey).toContain('closed');

    act(() => result.current.handleStatusChange('all'));

    expect(result.current.status).toBe('all');
    expect(onStatusChange).toHaveBeenCalledWith('all');
  });
});

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
