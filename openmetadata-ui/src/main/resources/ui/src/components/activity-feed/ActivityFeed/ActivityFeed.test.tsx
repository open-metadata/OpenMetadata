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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { TaskStatusGroup } from '../../../rest/tasksAPI';
import ActivityFeed, { ActivityFeedProps } from './ActivityFeed';

const TABLE_LINK = '<#E::table::svc.db.schema.customers>';
// The task totals the server reports per status, as `paging.total`.
const mockTaskTotals: Record<string, number> = { all: 4, open: 3, closed: 1 };
const mockGetActivityByEntityLink = jest.fn();
const mockGetUserActivity = jest.fn();
const mockListTasks = jest.fn();

// The HTTP boundary: the feed's own query hooks and cache run for real.
jest.mock('rest/activityAPI', () => ({
  getActivityByEntityLink: (...args: unknown[]) =>
    mockGetActivityByEntityLink(...args),
  getUserActivity: (...args: unknown[]) => mockGetUserActivity(...args),
}));

jest.mock('rest/conversationsAPI', () => ({
  listConversations: () => Promise.resolve({ data: [] }),
}));

jest.mock('rest/userAPI', () => ({
  getUserByName: () => Promise.resolve({ id: 'user-1' }),
}));

jest.mock('rest/tasksAPI', () => ({
  ...jest.requireActual('rest/tasksAPI'),
  listTasks: (...args: unknown[]) => mockListTasks(...args),
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'viewer-1' } }),
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const { forwardRef } = jest.requireActual('react');
  const Tabs = ({
    children,
    onSelectionChange,
  }: {
    children?: ReactNode;
    onSelectionChange: (key: string) => void;
  }) => (
    <div>
      {children}
      <button onClick={() => onSelectionChange('tasks')}>pick-tasks</button>
    </div>
  );
  Tabs.List = ({ children }: { children?: ReactNode }) => <>{children}</>;
  Tabs.Item = ({
    id,
    badge,
    children,
  }: {
    id: string;
    badge?: string | number;
    children: ReactNode;
  }) => (
    <span data-badge={badge} data-testid={`view-${id}`}>
      {children}
    </span>
  );
  const Container = forwardRef(
    (
      { children, ...props }: { children?: ReactNode },
      ref: React.Ref<HTMLDivElement>
    ) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )
  );

  return { Box: Container, Card: Container, Tabs };
});

// The two views have their own suites; here they report what they were given.
jest.mock('../../discovery/personal-space/InboxPage/tabs/ActivityTab', () => ({
  __esModule: true,
  default: ({
    scope,
    leading,
    dateRange,
    onDatePresetChange,
  }: {
    scope: unknown;
    leading: ReactNode;
    dateRange: { key: string };
    onDatePresetChange: (preset: string) => void;
  }) => (
    <div
      data-date={dateRange.key}
      data-scope={JSON.stringify(scope)}
      data-testid="activity-view">
      {leading}
      <button onClick={() => onDatePresetChange('last7days')}>pick-7</button>
    </div>
  ),
}));

jest.mock('./ActivityFeedTasks', () => ({
  __esModule: true,
  default: ({
    scope,
    leading,
    status,
    onStatusChange,
    onTaskChange,
  }: {
    scope: unknown;
    leading: ReactNode;
    status: string;
    onStatusChange: (status: string) => void;
    onTaskChange: () => void;
  }) => (
    <div
      data-scope={JSON.stringify(scope)}
      data-status={status}
      data-testid="tasks-view">
      {leading}
      <button onClick={() => onStatusChange('closed')}>pick-closed</button>
      <button onClick={onTaskChange}>task-changed</button>
    </div>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Distinct entities, so no two pair up as one field change.
const getEvents = (count: number) => ({
  data: Array.from({ length: count }, (_, index) => ({
    id: `event-${index}`,
    timestamp: Date.now() - 60_000,
    entity: { id: `entity-${index}` },
  })),
});

const renderFeed = (props: Partial<ActivityFeedProps> = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ActivityFeed entityLink={TABLE_LINK} {...props} />
    </QueryClientProvider>
  );
};

describe('ActivityFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTaskTotals.open = 3;
    mockGetActivityByEntityLink.mockResolvedValue(getEvents(5));
    mockGetUserActivity.mockResolvedValue(getEvents(2));
    mockListTasks.mockImplementation(
      ({ statusGroup }: { statusGroup?: TaskStatusGroup }) =>
        Promise.resolve({
          data: [],
          paging: { total: mockTaskTotals[statusGroup ?? 'all'] },
        })
    );
  });

  it("opens on the entity's activity, with both counts on the switch", async () => {
    renderFeed();

    expect(
      JSON.parse(
        screen.getByTestId('activity-view').getAttribute('data-scope') ?? ''
      )
    ).toEqual({ type: 'entity', entityLink: TABLE_LINK });

    await waitFor(() =>
      expect(screen.getByTestId('view-activity')).toHaveAttribute(
        'data-badge',
        '5'
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId('view-tasks')).toHaveAttribute(
        'data-badge',
        '3'
      )
    );

    expect(mockListTasks).toHaveBeenCalledWith(
      expect.objectContaining({ aboutEntity: 'svc.db.schema.customers' })
    );
  });

  it('switches to the tasks about the entity', () => {
    renderFeed();

    fireEvent.click(screen.getByText('pick-tasks'));

    expect(
      JSON.parse(
        screen.getByTestId('tasks-view').getAttribute('data-scope') ?? ''
      )
    ).toEqual({ type: 'entity', aboutEntity: 'svc.db.schema.customers' });
    expect(screen.queryByTestId('activity-view')).not.toBeInTheDocument();
  });

  it('reads a user link as what the user did and their tasks', async () => {
    renderFeed({ defaultView: 'tasks', entityLink: '<#E::user::harsh.vador>' });

    expect(
      JSON.parse(
        screen.getByTestId('tasks-view').getAttribute('data-scope') ?? ''
      )
    ).toEqual({ type: 'assignee', assignee: 'harsh.vador' });

    await waitFor(() =>
      expect(screen.getByTestId('view-activity')).toHaveAttribute(
        'data-badge',
        '2'
      )
    );

    expect(mockGetUserActivity).toHaveBeenCalledWith(
      'user-1',
      expect.anything()
    );
  });

  // The badge counts the Status chosen in the Tasks view, kept across views.
  it('counts the chosen Status on the Tasks badge', async () => {
    renderFeed({ defaultView: 'tasks' });

    expect(screen.getByTestId('tasks-view')).toHaveAttribute(
      'data-status',
      'open'
    );

    fireEvent.click(screen.getByText('pick-closed'));

    await waitFor(() =>
      expect(screen.getByTestId('view-tasks')).toHaveAttribute(
        'data-badge',
        '1'
      )
    );

    expect(screen.getByTestId('tasks-view')).toHaveAttribute(
      'data-status',
      'closed'
    );
  });

  // No open task is nothing to count, not a "0".
  it('drops the Tasks badge when nothing is open', async () => {
    mockTaskTotals.open = 0;
    renderFeed();

    await waitFor(() =>
      expect(screen.getByTestId('view-activity')).toHaveAttribute(
        'data-badge',
        '5'
      )
    );

    expect(screen.getByTestId('view-tasks')).not.toHaveAttribute('data-badge');
  });

  // A host that puts the view in its route controls it.
  it('follows a controlled view and reports a switch', () => {
    const onViewChange = jest.fn();
    renderFeed({ view: 'activity', onViewChange });

    fireEvent.click(screen.getByText('pick-tasks'));

    expect(onViewChange).toHaveBeenCalledWith('tasks');
  });

  // A host that keeps the window in its URL controls it.
  it('follows a controlled date window and reports a change', () => {
    const onDatePresetChange = jest.fn();
    renderFeed({
      dateRange: { startTs: 7, endTs: 8, key: 'yesterday' },
      onDatePresetChange,
    });

    expect(screen.getByTestId('activity-view')).toHaveAttribute(
      'data-date',
      'yesterday'
    );

    fireEvent.click(screen.getByText('pick-7'));

    expect(onDatePresetChange).toHaveBeenCalledWith('last7days');
  });

  // An approved description is a change: the Activity must show it without
  // waiting for its cache to go stale.
  it('shows the activity a task action wrote, then tells the host', async () => {
    const onTaskChange = jest.fn();
    renderFeed({ defaultView: 'tasks', onTaskChange });

    await waitFor(() =>
      expect(screen.getByTestId('view-activity')).toHaveAttribute(
        'data-badge',
        '5'
      )
    );

    // Approving the task wrote one more event about the entity.
    mockGetActivityByEntityLink.mockResolvedValue(getEvents(6));
    fireEvent.click(screen.getByText('task-changed'));

    await waitFor(() =>
      expect(screen.getByTestId('view-activity')).toHaveAttribute(
        'data-badge',
        '6'
      )
    );

    expect(onTaskChange).toHaveBeenCalled();
  });
});
