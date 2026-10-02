/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is WITHOUT applicable law or "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express, implied.
 *  See the License for the specific language governing permissions or
 *  limitations under the License.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReactNode } from 'react';
import type { Task } from '../../../../../generated/entity/tasks/task';

const mockListTasks = jest.fn();
const mockListVisibleTasks = jest.fn();
const mockShowErrorToast = jest.fn();
const mockCurrentUserIds: ReadonlySet<string> = new Set();

jest.mock('utils/ToastUtils', () => ({
  showErrorToast: mockShowErrorToast,
}));

jest.mock('../useCurrentUserIds', () => ({
  useCurrentUserIds: () => mockCurrentUserIds,
}));

jest.mock('../useInboxCounts', () => ({
  INBOX_COUNTS_QUERY_KEY: 'inbox-counts',
}));

jest.mock('rest/tasksAPI', () => ({
  listTasks: (...a: unknown[]) => mockListTasks(...a),
  listMyVisibleTasks: (...a: unknown[]) => mockListVisibleTasks(...a),
  TaskStatusGroup: { Open: 'open', Closed: 'closed' },
}));

jest.mock('../components/InboxTaskListToolbar', () => ({
  __esModule: true,
  default: ({ statusTabs }: { statusTabs: ReactNode }) => (
    <div data-testid="toolbar">{statusTabs}</div>
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

jest.mock('../components/InboxTaskListSkeleton', () => ({
  __esModule: true,
  default: () => <div data-testid="list-skeleton" />,
}));

jest.mock('../components/TaskDetailPanel', () => ({
  __esModule: true,
  default: ({
    taskId,
    onTaskUpdated,
  }: {
    taskId?: string;
    onTaskUpdated: (...args: unknown[]) => void;
  }) => (
    <div data-testid="detail">
      <span>{taskId}</span>
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

jest.mock('../components/TaskDetailSkeleton', () => ({
  __esModule: true,
  default: () => <div data-testid="detail-skeleton" />,
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
  const TabsItem = ({ id, label }: { id: string; label?: ReactNode }) => (
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

class MockIntersectionObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn();
  root = null;
  rootMargin = '';
  thresholds = [];
  constructor(_cb: IntersectionObserverCallback) {
    // No-op: the real hook drives pagination via this observer, but the
    // integration tests never scroll, so never fire the callback.
  }
}

// Routes the mock by call so the badge totals (limit 1) stay out of the way of
// the list fetches (limit 25), and the Open list can resolve once before a
// later reload (tab switch or task-update refetch) rejects.
const visibleTasksFor = (
  status: 'open' | 'closed',
  firstList: Task,
  openListCalls: { count: number }
) => {
  return (params: { statusGroup?: string; limit?: number; after?: string }) => {
    if (params.limit === 1) {
      // Status-count badges for All/Open/Closed.
      return Promise.resolve({ paging: { total: 0 } });
    }
    if (params.statusGroup === status) {
      openListCalls.count += 1;

      return openListCalls.count === 1
        ? Promise.resolve({ data: [firstList], paging: { total: 1 } })
        : Promise.reject(new Error('boom'));
    }

    // The other tab's list always rejects, so its stale rows must clear.
    return Promise.reject(new Error('boom'));
  };
};

const renderTab = (props: Partial<TasksTabProps> = {}, client: QueryClient) =>
  render(
    <QueryClientProvider client={client}>
      <TasksTab {...props} />
    </QueryClientProvider>
  );

describe('TasksTab (integration with real useInboxInfiniteList)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    (
      global as unknown as { IntersectionObserver: unknown }
    ).IntersectionObserver = MockIntersectionObserver;
    mockListTasks.mockResolvedValue({ paging: { total: 0 } });
    mockListVisibleTasks.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  it('clears stale Open rows and shows the Closed empty state when the Closed-tab reload rejects', async () => {
    const first = { id: 't1' } as Task;
    mockListVisibleTasks.mockImplementation(
      visibleTasksFor('open', first, { count: 0 })
    );

    await act(async () => {
      renderTab({}, queryClient);
    });
    await waitFor(() =>
      expect(screen.getByTestId('task-t1')).toBeInTheDocument()
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('task-status-closed'));
    });
    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());

    await waitFor(() =>
      expect(screen.getByTestId('inbox-tasks-closed-empty')).toBeInTheDocument()
    );

    expect(screen.queryByTestId('task-t1')).toBeNull();
  });

  it('clears the stale row and still invalidates badge counts when the handleTaskUpdated reload rejects', async () => {
    const first = { id: 't1' } as Task;
    mockListVisibleTasks.mockImplementation(
      visibleTasksFor('open', first, { count: 0 })
    );
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      renderTab({}, queryClient);
    });
    await waitFor(() =>
      expect(screen.getByTestId('task-t1')).toBeInTheDocument()
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('task-t1'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('detail')).toBeInTheDocument()
    );

    invalidateSpy.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByTestId('update'));
    });
    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());

    await waitFor(() =>
      expect(screen.getByTestId('inbox-tasks-open-empty')).toBeInTheDocument()
    );

    expect(screen.queryByTestId('task-t1')).toBeNull();
    expect(invalidateSpy).toHaveBeenCalled();
  });
});
