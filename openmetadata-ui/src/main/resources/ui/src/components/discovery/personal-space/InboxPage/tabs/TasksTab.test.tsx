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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import type { Task } from '../../../../../generated/entity/tasks/task';

const mockListTasks = jest.fn();
const mockListVisibleTasks = jest.fn();
const mockSetItems = jest.fn();
const mockSetTotal = jest.fn();
const mockInvalidateQueries = jest.fn();
let capturedFetchPage: (after?: string) => unknown;
let capturedQueryKey: unknown[];
let capturedCanLoadMore: ((loaded: unknown[]) => boolean) | undefined;
let hookState: {
  items: Task[];
  isLoading: boolean;
  total: number;
  hasMore?: boolean;
};
// Extra fields merged into the task the mock panel resolves with, so a test can
// simulate resolving into a specific status/type (e.g. an Approved DAR).
let resolvedPayload: Record<string, unknown> = {};

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  // The badge totals come from React Query; return static totals so tests stay
  // synchronous. The fetch/dedup itself is the library's concern — the component
  // contract we assert is that mutations invalidate the counts cache.
  useQueries: () => [{ data: 0 }, { data: 0 }, { data: 0 }],
}));

let mockCurrentUserIds: ReadonlySet<string> = new Set();

jest.mock('../useCurrentUserIds', () => ({
  useCurrentUserIds: () => mockCurrentUserIds,
}));

jest.mock('../useInboxCounts', () => ({
  INBOX_COUNTS_QUERY_KEY: 'inbox-counts',
}));

jest.mock('../useInboxInfiniteList', () => ({
  useInboxInfiniteList: (
    queryKey: unknown[],
    fetchPage: (after?: string) => unknown,
    canLoadMore?: (loaded: unknown[]) => boolean
  ) => {
    capturedQueryKey = queryKey;
    capturedFetchPage = fetchPage;
    capturedCanLoadMore = canLoadMore;

    return {
      items: hookState.items,
      isLoading: hookState.isLoading,
      isLoadingMore: false,
      hasMore: Boolean(hookState.hasMore),
      total: hookState.total,
      scrollRef: { current: null },
      sentinelRef: { current: null },
      setItems: mockSetItems,
      setTotal: mockSetTotal,
    };
  },
}));

jest.mock('rest/tasksAPI', () => ({
  listTasks: (...a: unknown[]) => mockListTasks(...a),
  listMyVisibleTasks: (...a: unknown[]) => mockListVisibleTasks(...a),
  TaskStatusGroup: { Open: 'open', Closed: 'closed' },
  // The task-type titles are keyed by it (constants/Task.constant).
  TaskEntityType: jest.requireActual('generated/entity/tasks/task').TaskType,
}));

// The toolbar has its own suite; here it only has to report what the user
// chose, so the tab's own contract (a searched query reaching the server, a
// type narrowing the list) can be asserted.
jest.mock('../components/InboxTaskListToolbar', () => ({
  __esModule: true,
  default: ({
    statusTabs,
    statusOptions,
    statusFilter,
    onStatusFilterChange,
    onSearchChange,
    onGroupingChange,
    onTypeFilterChange,
  }: {
    statusTabs: ReactNode;
    statusOptions: string[];
    statusFilter: string[];
    onStatusFilterChange: (value: string[]) => void;
    onSearchChange: (value: string) => void;
    onGroupingChange: (value: string) => void;
    onTypeFilterChange: (value: string[]) => void;
  }) => (
    <div
      data-status={statusFilter.join(',')}
      data-status-options={statusOptions.join(',')}
      data-testid="toolbar">
      {statusTabs}
      <button
        data-testid="toolbar-status-pending"
        onClick={() => onStatusFilterChange(['pending-approval'])}>
        pending approval
      </button>
      <button
        data-testid="toolbar-search-title"
        onClick={() => onSearchChange('Request TestCase orders')}>
        search title
      </button>
      <button
        data-testid="toolbar-search"
        onClick={() => onSearchChange('customer')}>
        search
      </button>
      <button
        data-testid="toolbar-group-none"
        onClick={() => onGroupingChange('none')}>
        group none
      </button>
      <button
        data-testid="toolbar-filter-tag"
        onClick={() => onTypeFilterChange(['label.tag-request'])}>
        filter tag
      </button>
    </div>
  ),
}));

jest.mock('../components/InboxTaskListItem', () => ({
  __esModule: true,
  default: ({
    task,
    onClick,
  }: {
    task: Task;
    onClick: (task: Task) => void;
  }) => (
    <button data-testid={`task-${task.id}`} onClick={() => onClick(task)}>
      {task.id}
    </button>
  ),
}));

jest.mock('../components/TaskDetailPanel', () => ({
  __esModule: true,
  default: ({
    taskId,
    onResolved,
    onTaskUpdated,
  }: {
    taskId?: string;
    onResolved: (...args: unknown[]) => void;
    onTaskUpdated: (...args: unknown[]) => void;
  }) => (
    <div data-testid="detail">
      <span>{taskId}</span>
      <button
        data-testid="resolve"
        onClick={() => onResolved({ id: taskId, ...resolvedPayload })}>
        resolve
      </button>
      <button
        data-testid="update"
        onClick={() =>
          onTaskUpdated({
            id: taskId,
            assignees: [{ id: 'u2', type: 'user', name: 'bob' }],
          })
        }>
        update
      </button>
    </div>
  ),
}));

jest.mock('components/common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

let tabsOnChange: ((key: string) => void) | undefined;

jest.mock('@openmetadata/ui-core-components', () => {
  const TabsRoot = ({
    onSelectionChange,
    children,
  }: {
    onSelectionChange?: (...args: unknown[]) => void;
    children?: ReactNode;
  }) => {
    tabsOnChange = onSelectionChange;

    return <div>{children}</div>;
  };
  const TabsList = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const TabsItem = ({
    id,
    label,
    children,
  }: {
    id: string;
    label?: ReactNode;
    children?: ReactNode | ((state: { isSelected: boolean }) => ReactNode);
  }) => (
    <button
      data-testid={`task-status-${id}`}
      type="button"
      onClick={() => tabsOnChange?.(id)}>
      {typeof children === 'function'
        ? children({ isSelected: false })
        : children ?? label}
    </button>
  );

  const Tabs = Object.assign(TabsRoot, { List: TabsList, Item: TabsItem });

  return {
    Box: ({
      children,
      className,
      ...props
    }: {
      children?: ReactNode;
      className?: string;
      'data-testid'?: string;
    }) => (
      <div className={className} data-testid={props['data-testid']}>
        {children}
      </div>
    ),
    Badge: ({ children }: { children?: ReactNode }) => (
      <span data-testid="count-badge">{children}</span>
    ),
    Skeleton: () => <div data-testid="skeleton" />,
    Typography: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    EmptyPlaceholder: ({
      title,
      description,
      actions,
      ...props
    }: {
      title?: ReactNode;
      description?: ReactNode;
      actions?: { key: string; label: ReactNode; onPress?: () => void }[];
      'data-testid'?: string;
    }) => (
      <div data-testid={props['data-testid']}>
        <span>{title}</span>
        <span>{description}</span>
        {actions?.map(({ key, label, onPress }) => (
          <button key={key} onClick={onPress}>
            {label}
          </button>
        ))}
      </div>
    ),
    Tabs,
  };
});

// One task type's title prefix is translated, so a title search can name it.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === 'message.request-test-case-failure-resolution-message'
        ? 'Request TestCase Failure Resolution for'
        : key,
  }),
}));

import TasksTab, { TasksTabProps } from './TasksTab';

const renderTab = (props: Partial<TasksTabProps> = {}) =>
  render(<TasksTab {...props} />);

describe('TasksTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolvedPayload = {};
    hookState = { items: [], isLoading: false, total: 0 };
    // The list fetchers resolve with a paging total (used when a test invokes the
    // captured fetchPage). Status-count totals come from the mocked useQueries.
    mockListTasks.mockResolvedValue({ paging: { total: 0 } });
    mockListVisibleTasks.mockResolvedValue({ paging: { total: 0 } });
  });

  it('shows the empty state', () => {
    renderTab();

    // Defaults to the Open filter, so the Open empty state renders.
    expect(screen.getByText('label.no-open-tasks-yet')).toBeInTheDocument();
  });

  // A filter that matches nothing must not claim the queue is empty.
  it('says nothing matches a filter, and clears it on request', () => {
    hookState = {
      items: [{ id: 't2', type: 'TestCaseResolution' } as unknown as Task],
      isLoading: false,
      total: 1,
    };
    renderTab();

    fireEvent.click(screen.getByTestId('toolbar-filter-tag'));

    expect(screen.getByTestId('inbox-tasks-no-match')).toHaveTextContent(
      'message.no-match-found'
    );
    expect(
      screen.queryByText('label.no-open-tasks-yet')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('label.clear-all'));

    expect(screen.getByTestId('task-t2')).toBeInTheDocument();
  });

  // Type and Status narrow loaded pages, so later pages may still match.
  it('waits for the pages still to come before saying nothing matches', () => {
    hookState = {
      items: [{ id: 't2', type: 'TestCaseResolution' } as unknown as Task],
      isLoading: false,
      total: 30,
      hasMore: true,
    };
    renderTab();

    fireEvent.click(screen.getByTestId('toolbar-filter-tag'));

    expect(
      screen.queryByTestId('inbox-tasks-no-match')
    ).not.toBeInTheDocument();
  });

  // A short narrowed list keeps the sentinel in view; the scan must end.
  it('stops paging a narrowed list after a bounded scan', () => {
    renderTab();
    const longScan = new Array(200);

    expect(capturedCanLoadMore?.(longScan)).toBe(true);

    fireEvent.click(screen.getByTestId('toolbar-filter-tag'));

    expect(capturedCanLoadMore?.(longScan)).toBe(false);
    expect(capturedCanLoadMore?.([])).toBe(true);
  });

  // The scan stopped at its cap with pages unread: matches may still exist.
  it('says only the scanned tasks lack a match, and scans further on request', () => {
    const scanned = Array.from(
      { length: 200 },
      (_, index) =>
        ({ id: `t${index}`, type: 'TestCaseResolution' } as unknown as Task)
    );
    hookState = { items: scanned, isLoading: false, total: 500, hasMore: true };
    renderTab();

    fireEvent.click(screen.getByTestId('toolbar-filter-tag'));

    expect(
      screen.getByTestId('inbox-tasks-no-match-scanned')
    ).toHaveTextContent('message.no-match-in-first-tasks');
    expect(
      screen.queryByTestId('inbox-tasks-no-match')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('label.load-more'));

    expect(capturedCanLoadMore?.(scanned)).toBe(true);
  });

  // The raised cap belongs to the narrowing it was raised for.
  it('drops a raised scan cap once the filters change', () => {
    const scanned = Array.from(
      { length: 200 },
      (_, index) =>
        ({ id: `t${index}`, type: 'TestCaseResolution' } as unknown as Task)
    );
    hookState = { items: scanned, isLoading: false, total: 500, hasMore: true };
    renderTab();

    fireEvent.click(screen.getByTestId('toolbar-filter-tag'));
    fireEvent.click(screen.getByText('label.load-more'));

    expect(capturedCanLoadMore?.(scanned)).toBe(true);

    fireEvent.click(screen.getByTestId('toolbar-status-pending'));

    expect(capturedCanLoadMore?.(scanned)).toBe(false);
  });

  it('raises the scan cap past an already-loaded backlog in one Load more click', () => {
    const loaded = Array.from(
      { length: 1000 },
      (_, index) =>
        ({ id: `t${index}`, type: 'TestCaseResolution' } as unknown as Task)
    );
    hookState = { items: loaded, isLoading: false, total: 5000, hasMore: true };
    renderTab();

    fireEvent.click(screen.getByTestId('toolbar-filter-tag'));

    expect(capturedCanLoadMore?.(loaded)).toBe(false);

    fireEvent.click(screen.getByText('label.load-more'));

    expect(capturedCanLoadMore?.(loaded)).toBe(true);
  });

  it('raises the cap again once the scanned backlog grows back to it', () => {
    const initial = Array.from(
      { length: 1000 },
      (_, index) =>
        ({ id: `t${index}`, type: 'TestCaseResolution' } as unknown as Task)
    );
    hookState = {
      items: initial,
      isLoading: false,
      total: 5000,
      hasMore: true,
    };
    const { rerender } = renderTab();

    fireEvent.click(screen.getByTestId('toolbar-filter-tag'));

    expect(capturedCanLoadMore?.(initial)).toBe(false);

    fireEvent.click(screen.getByText('label.load-more'));

    expect(capturedCanLoadMore?.(initial)).toBe(true);

    const grown = Array.from(
      { length: 1200 },
      (_, index) =>
        ({ id: `t${index}`, type: 'TestCaseResolution' } as unknown as Task)
    );
    hookState = { items: grown, isLoading: false, total: 5000, hasMore: true };
    rerender(<TasksTab />);

    expect(capturedCanLoadMore?.(grown)).toBe(false);

    fireEvent.click(screen.getByText('label.load-more'));

    expect(capturedCanLoadMore?.(grown)).toBe(true);
  });

  it('shows the skeleton while loading', () => {
    hookState = { items: [], isLoading: true, total: 0 };
    renderTab();

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('reports the in-range visible task count via onCountChange', () => {
    hookState = {
      items: [
        { id: 't1' },
        { id: 't2' },
        { id: 't3' },
        { id: 't4' },
      ] as unknown as Task[],
      isLoading: false,
      total: 4,
    };
    const onCountChange = jest.fn();

    renderTab({ onCountChange });

    expect(onCountChange).toHaveBeenCalledWith(4);
  });

  it('lists the current user’s visible Open tasks by default (no aboutEntity)', () => {
    renderTab();

    capturedFetchPage('cur');

    expect(mockListVisibleTasks).toHaveBeenCalledWith({
      statusGroup: 'open',
      fields: 'assignees,createdBy,about,comments,payload,resolution',
      limit: 25,
      after: 'cur',
    });
    // Never the unscoped /tasks endpoint for the personal inbox.
    expect(mockListTasks).not.toHaveBeenCalled();
  });

  it('refetches visible tasks with no statusGroup when All is selected', () => {
    renderTab();

    fireEvent.click(screen.getByTestId('task-status-all'));
    capturedFetchPage('cur');

    expect(mockListVisibleTasks).toHaveBeenLastCalledWith({
      statusGroup: undefined,
      fields: 'assignees,createdBy,about,comments,payload,resolution',
      limit: 25,
      after: 'cur',
    });
  });

  // A work queue: an open task must never age out of it.
  it('sends no date window', () => {
    renderTab();

    capturedFetchPage(undefined);

    expect(mockListVisibleTasks.mock.calls[0][0]).not.toHaveProperty('startTs');
    expect(mockListVisibleTasks.mock.calls[0][0]).not.toHaveProperty('endTs');
  });

  it('lists all entity tasks (listTasks) when scoped to an entity', () => {
    renderTab({ aboutEntity: 'svc.db.schema.table.tc' });

    capturedFetchPage(undefined);

    expect(mockListTasks).toHaveBeenCalledWith(
      expect.objectContaining({ aboutEntity: 'svc.db.schema.table.tc' })
    );
    expect(mockListVisibleTasks).not.toHaveBeenCalled();
  });

  it('merges a custom className with the base card classes on the root', () => {
    renderTab({ className: 'tw:-mx-4' });

    const root = screen.getByTestId('inbox-tasks-tab');

    expect(root).toHaveClass('tw:-mx-4');
    expect(root).toHaveClass('tw:flex');
  });

  it('auto-selects the first task and renders its detail', () => {
    hookState = {
      items: [{ id: 't1' }, { id: 't2' }] as unknown as Task[],
      isLoading: false,
      total: 2,
    };

    renderTab();

    expect(screen.getByTestId('detail')).toHaveTextContent('t1');
  });

  it('removes a resolved task and decrements the total when it leaves the filter', () => {
    hookState = {
      items: [{ id: 't1' }] as unknown as Task[],
      isLoading: false,
      total: 1,
    };

    renderTab();
    fireEvent.click(screen.getByTestId('resolve'));

    expect(mockSetItems).toHaveBeenCalled();
    expect(mockSetTotal).toHaveBeenCalled();
  });

  it('keeps an approved DAR in the Open list without decrementing the total', () => {
    hookState = {
      items: [{ id: 't1' }] as unknown as Task[],
      isLoading: false,
      total: 1,
    };
    // An approved Data Access Request stays Open (awaiting grant), so it must
    // remain in the default Open list rather than vanish then reappear.
    resolvedPayload = { status: 'Approved', type: 'DataAccessRequest' };

    renderTab();
    fireEvent.click(screen.getByTestId('resolve'));

    expect(mockSetItems).toHaveBeenCalled();
    expect(mockSetTotal).not.toHaveBeenCalled();
  });

  it('refetches the lists and invalidates the count caches after an assignee change', () => {
    hookState = {
      items: [{ id: 't1' }] as unknown as Task[],
      isLoading: false,
      total: 1,
    };

    renderTab();

    fireEvent.click(screen.getByTestId('update'));

    // A reassigned task can leave the current user's visible set, so the list
    // must re-sync with the server rather than being patched client-side.
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['inbox-task-list', 'me'],
      refetchType: 'active',
    });
    expect(mockSetTotal).not.toHaveBeenCalled();
    // Both the tab-badge and the All/Open/Closed status-count caches are
    // invalidated so their React Query fetches re-run.
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['inbox-counts'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['inbox-task-status-counts'],
    });
  });

  it('invalidates the status-count cache after a task is resolved', () => {
    hookState = {
      items: [{ id: 't1' }] as unknown as Task[],
      isLoading: false,
      total: 1,
    };

    renderTab();

    fireEvent.click(screen.getByTestId('resolve'));

    // handleResolved invalidates the status-count cache so the badges re-sync
    // instead of showing pre-resolution totals...
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['inbox-task-status-counts'],
    });
    // ...and the tab-badge react-query cache.
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['inbox-counts'],
    });
    // The other status lists may now hold or miss this task; they re-read on
    // their next visit while the showing list keeps its in-place edit.
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['inbox-task-list', 'me'],
      refetchType: 'none',
    });
  });

  // Each status and search is its own cached list, so switching back to one
  // reads the cache instead of refetching it.
  it('keys the list on scope, status and search', () => {
    hookState = { items: [], isLoading: false, total: 0 };

    renderTab();

    expect(capturedQueryKey).toEqual(['inbox-task-list', 'me', 'open', '']);
  });

  it('invalidates the sidebar open-task count after a task is resolved', () => {
    // The sidebar badge fetches under its own key and never unmounts, so without
    // this invalidation it keeps the pre-approval count until a navigation.
    hookState = {
      items: [{ id: 't1' }] as unknown as Task[],
      isLoading: false,
      total: 1,
    };

    renderTab();

    fireEvent.click(screen.getByTestId('resolve'));

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['inbox-open-task-count'],
    });
  });

  describe('shaping the queue', () => {
    const TAG_TASK = {
      id: 't1',
      type: 'TagUpdate',
    } as unknown as Task;
    const INCIDENT_TASK = {
      id: 't2',
      type: 'TestCaseResolution',
    } as unknown as Task;

    beforeEach(() => {
      hookState = {
        items: [TAG_TASK, INCIDENT_TASK],
        isLoading: false,
        total: 2,
      };
    });

    it('groups the loaded tasks by type, most urgent type first', () => {
      renderTab();

      const headers = screen.getAllByTestId('inbox-task-group');

      expect(headers).toHaveLength(2);
      expect(headers[0]).toHaveTextContent('label.incident');
      expect(headers[1]).toHaveTextContent('label.tag');
    });

    // The server lists the tag task first, but grouping puts the incident on
    // top; opening the server's first task selected a row mid-list on reload.
    it('opens the top row of the grouped list, not the server’s first task', () => {
      renderTab();

      expect(screen.getByTestId('detail')).toHaveTextContent('t2');
    });

    it('drops the group headers when grouping is turned off', () => {
      renderTab();

      fireEvent.click(screen.getByTestId('toolbar-group-none'));

      expect(screen.queryByTestId('inbox-task-group')).not.toBeInTheDocument();
      expect(screen.getByTestId('task-t1')).toBeInTheDocument();
      expect(screen.getByTestId('task-t2')).toBeInTheDocument();
    });

    // The scoped list endpoints have no `type` param, so the chosen types
    // narrow the pages already loaded.
    it('narrows the list to the chosen type without refetching', () => {
      renderTab();

      fireEvent.click(screen.getByTestId('toolbar-filter-tag'));

      expect(screen.getByTestId('task-t1')).toBeInTheDocument();
      expect(screen.queryByTestId('task-t2')).not.toBeInTheDocument();
      expect(capturedQueryKey).toEqual(['inbox-task-list', 'me', 'open', '']);
    });

    it('sends the search text to the server once typing settles', () => {
      jest.useFakeTimers();
      try {
        renderTab();

        act(() => {
          fireEvent.click(screen.getByTestId('toolbar-search'));
        });
        act(() => {
          jest.advanceTimersByTime(300);
        });
        capturedFetchPage();

        expect(mockListVisibleTasks).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'customer' })
        );
      } finally {
        jest.useRealTimers();
      }
    });

    // The composed title's type words are matched against the shown title;
    // the server only gets the rest, since it never stores the title.
    it('matches a search that opens with a type title against the shown title', () => {
      jest.useFakeTimers();
      try {
        hookState = {
          items: [
            {
              id: 'inc',
              type: 'TestCaseResolution',
              about: { id: 'tc', type: 'testCase', name: 'orders_rows' },
            },
            { id: 'tag', type: 'TagUpdate', displayName: 'Tag the table' },
            // An authored title sharing the words matches whatever its type.
            {
              id: 'doc',
              type: 'DescriptionUpdate',
              displayName: 'Request TestCase docs',
            },
          ] as unknown as Task[],
          isLoading: false,
          total: 2,
        };
        renderTab();

        act(() => {
          fireEvent.click(screen.getByTestId('toolbar-search-title'));
        });
        act(() => {
          jest.advanceTimersByTime(300);
        });
        capturedFetchPage();

        expect(mockListVisibleTasks).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'orders' })
        );
        expect(screen.getByTestId('task-inc')).toBeInTheDocument();
        expect(screen.getByTestId('task-doc')).toBeInTheDocument();
        expect(screen.queryByTestId('task-tag')).not.toBeInTheDocument();
      } finally {
        jest.useRealTimers();
      }
    });

    it('asks for everything again when the search is cleared', () => {
      renderTab();
      capturedFetchPage();

      expect(mockListVisibleTasks).toHaveBeenCalledWith(
        expect.objectContaining({ q: undefined })
      );
    });
  });

  describe('the Status filter', () => {
    const MINE = {
      id: 't1',
      status: 'Open',
      assignees: [{ id: 'u1' }],
    } as unknown as Task;
    const THEIRS = {
      id: 't2',
      status: 'InProgress',
      assignees: [{ id: 'u9' }],
    } as unknown as Task;

    beforeEach(() => {
      mockCurrentUserIds = new Set(['u1']);
      hookState = { items: [MINE, THEIRS], isLoading: false, total: 2 };
    });

    it('shows the whole tab until a status is chosen', () => {
      renderTab();

      expect(screen.getByTestId('task-t1')).toBeInTheDocument();
      expect(screen.getByTestId('task-t2')).toBeInTheDocument();
    });

    it('offers the Open tab only whose move it is', () => {
      renderTab();

      expect(screen.getByTestId('toolbar')).toHaveAttribute(
        'data-status-options',
        'pending-approval,in-review'
      );
    });

    it('narrows the tab to tasks waiting on the viewer', () => {
      renderTab();

      fireEvent.click(screen.getByTestId('toolbar-status-pending'));

      expect(screen.getByTestId('task-t1')).toBeInTheDocument();
      expect(screen.queryByTestId('task-t2')).not.toBeInTheDocument();
    });

    it('offers outcomes on Closed and clears the choice on a tab switch', () => {
      renderTab();

      fireEvent.click(screen.getByTestId('toolbar-status-pending'));
      fireEvent.click(screen.getByTestId('task-status-closed'));

      expect(screen.getByTestId('toolbar')).toHaveAttribute(
        'data-status-options',
        'approved,rejected'
      );
      expect(screen.getByTestId('toolbar')).toHaveAttribute('data-status', '');
    });
  });
});
