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

import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import type { Task } from '../../../../../generated/entity/tasks/task';

const mockListTasks = jest.fn();
const mockListVisibleTasks = jest.fn();
const mockSetItems = jest.fn();
const mockSetTotal = jest.fn();
const mockReload = jest.fn();
const mockInvalidateQueries = jest.fn();
let capturedFetchPage: (after?: string) => unknown;
let hookState: { items: Task[]; isLoading: boolean; total: number };
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

jest.mock('../useInboxCounts', () => ({
  INBOX_COUNTS_QUERY_KEY: 'inbox-counts',
}));

jest.mock('../useInboxInfiniteList', () => ({
  useInboxInfiniteList: (fetchPage: (after?: string) => unknown) => {
    capturedFetchPage = fetchPage;

    return {
      items: hookState.items,
      isLoading: hookState.isLoading,
      isLoadingMore: false,
      total: hookState.total,
      scrollRef: { current: null },
      sentinelRef: { current: null },
      reload: mockReload,
      setItems: mockSetItems,
      setTotal: mockSetTotal,
    };
  },
}));

jest.mock('rest/tasksAPI', () => ({
  listTasks: (...a: unknown[]) => mockListTasks(...a),
  listMyVisibleTasks: (...a: unknown[]) => mockListVisibleTasks(...a),
  TaskStatusGroup: { Open: 'open', Closed: 'closed' },
}));

jest.mock('../components/InboxFilterBar', () => ({
  __esModule: true,
  default: ({ left }: { left?: ReactNode }) => <div>{left}</div>,
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
    onResolved?: (...args: unknown[]) => void;
    onTaskUpdated?: (...args: unknown[]) => void;
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
  const TabsItem = ({ id, label }: { id?: string; label?: ReactNode }) => (
    <button
      data-testid={`task-status-${id}`}
      type="button"
      onClick={() => tabsOnChange?.(id)}>
      {label}
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
    Skeleton: () => <div data-testid="skeleton" />,
    Typography: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    EmptyPlaceholder: ({
      title,
      description,
      ...props
    }: {
      title?: ReactNode;
      description?: ReactNode;
      'data-testid'?: string;
    }) => (
      <div data-testid={props['data-testid']}>
        <span>{title}</span>
        <span>{description}</span>
      </div>
    ),
    Tabs,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import TasksTab, { TasksTabProps } from './TasksTab';

// defaultDateRange / onDateRangeChange are required by the shared filter bar;
// the tests only care about scope / aboutEntity / className, so stub the rest.
const renderTab = (props: Partial<TasksTabProps> = {}) =>
  render(
    <TasksTab
      defaultDateRange={{ startTs: 0, endTs: 0 }}
      onDateRangeChange={jest.fn()}
      {...props}
    />
  );

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

  it('shows the skeleton while loading', () => {
    hookState = { items: [], isLoading: true, total: 0 };
    renderTab();

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('reports the in-range visible task count via onCountChange', () => {
    hookState = {
      items: [{ id: 't1' }, { id: 't2' }, { id: 't3' }, { id: 't4' }],
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
      items: [{ id: 't1' }, { id: 't2' }],
      isLoading: false,
      total: 2,
    };

    renderTab();

    expect(screen.getByTestId('detail')).toHaveTextContent('t1');
  });

  it('removes a resolved task and decrements the total when it leaves the filter', () => {
    hookState = { items: [{ id: 't1' }], isLoading: false, total: 1 };

    renderTab();
    fireEvent.click(screen.getByTestId('resolve'));

    expect(mockSetItems).toHaveBeenCalled();
    expect(mockSetTotal).toHaveBeenCalled();
  });

  it('keeps an approved DAR in the Open list without decrementing the total', () => {
    hookState = { items: [{ id: 't1' }], isLoading: false, total: 1 };
    // An approved Data Access Request stays Open (awaiting grant), so it must
    // remain in the default Open list rather than vanish then reappear.
    resolvedPayload = { status: 'Approved', type: 'DataAccessRequest' };

    renderTab();
    fireEvent.click(screen.getByTestId('resolve'));

    expect(mockSetItems).toHaveBeenCalled();
    expect(mockSetTotal).not.toHaveBeenCalled();
  });

  it('reloads the list and invalidates the count caches after an assignee change', () => {
    hookState = { items: [{ id: 't1' }], isLoading: false, total: 1 };

    renderTab();

    fireEvent.click(screen.getByTestId('update'));

    // A reassigned task can leave the current user's visible set, so the list
    // must re-sync with the server rather than being patched client-side.
    expect(mockReload).toHaveBeenCalled();
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
    hookState = { items: [{ id: 't1' }], isLoading: false, total: 1 };

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
  });

  it('invalidates the sidebar open-task count after a task is resolved', () => {
    // The sidebar badge fetches under its own key and never unmounts, so without
    // this invalidation it keeps the pre-approval count until a navigation.
    hookState = { items: [{ id: 't1' }], isLoading: false, total: 1 };

    renderTab();

    fireEvent.click(screen.getByTestId('resolve'));

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['inbox-open-task-count'],
    });
  });
});
