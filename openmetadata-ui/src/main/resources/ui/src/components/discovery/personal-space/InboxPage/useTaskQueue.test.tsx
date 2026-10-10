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
import { Task } from '../../../../generated/entity/tasks/task';
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
let capturedCanLoadMore: ((loaded: Task[]) => boolean) | undefined;
let loadedTasks: Task[] = [];
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

jest.mock('./useInboxInfiniteList', () => ({
  useInboxInfiniteList: (
    queryKey: unknown[],
    fetchPage: (after?: string) => unknown,
    canLoadMore?: (loaded: Task[]) => boolean
  ) => {
    capturedQueryKey = queryKey;
    capturedFetchPage = fetchPage;
    capturedCanLoadMore = canLoadMore;

    return {
      items: loadedTasks,
      isLoading: false,
      isLoadingMore: false,
      hasMore: loadedTasks.length > 0,
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

const tasksOf = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `t${index}` } as Task));

describe('useTaskQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadedTasks = [];
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

  // The host's status (an entity page's URL) can change while it is mounted.
  it('follows a status changed by its host', () => {
    const { result, rerender } = renderHook(
      ({ status }) => useTaskQueue({ scope: ENTITY, initialStatus: status }),
      {
        initialProps: { status: 'open' as const } as {
          status: 'open' | 'closed';
        },
      }
    );

    rerender({ status: 'closed' });

    expect(result.current.status).toBe('closed');
  });

  // A narrowed list stops at a bounded scan; "Load more" scans one more.
  it('raises the scan cap by one scan when the cap stopped the list', () => {
    loadedTasks = tasksOf(200);
    const { result } = renderHook(() => useTaskQueue());

    act(() => result.current.setTypeFilter(['Incident']));

    expect(capturedCanLoadMore?.(loadedTasks)).toBe(false);

    act(() => result.current.handleScanFurther());

    expect(capturedCanLoadMore?.(tasksOf(399))).toBe(true);
    expect(capturedCanLoadMore?.(tasksOf(400))).toBe(false);
  });

  // Tasks paged in before the narrowing can exceed the cap many times over;
  // one click must still scan further, not raise a cap still below them.
  it('raises the scan cap past tasks loaded before the narrowing in one click', () => {
    loadedTasks = tasksOf(1000);
    const { result, rerender } = renderHook(() => useTaskQueue());

    act(() => result.current.setTypeFilter(['Incident']));

    expect(capturedCanLoadMore?.(loadedTasks)).toBe(false);

    act(() => result.current.handleScanFurther());

    expect(capturedCanLoadMore?.(loadedTasks)).toBe(true);
    expect(capturedCanLoadMore?.(tasksOf(1200))).toBe(false);

    loadedTasks = tasksOf(1200);
    rerender();
    act(() => result.current.handleScanFurther());

    expect(capturedCanLoadMore?.(loadedTasks)).toBe(true);
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
