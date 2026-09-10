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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { FeedFilter } from '../../../enums/mydata.enum';
import { getEntityActivityByFqn } from '../../../rest/activityAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ActivityFeedTab } from './ActivityFeedTab.component';
import {
  ActivityFeedLayoutType,
  ActivityFeedTabs,
} from './ActivityFeedTab.interface';

const mockGetFeedData = jest.fn();
const mockGetTaskData = jest.fn();
const mockGetTaskCounts = jest.fn();
const mockListConversations = jest.fn();
const mockUseRequiredParams = jest.fn();
const mockFetchEntityActivity = jest.fn();
const mockFetchUserActivity = jest.fn();
let mockActivityEvents: { id: string; timestamp: number }[] = [];
let mockConversationCount = 0;
let mockActivityCount = 0;
let mockLoading = false;
let mockTasks: { id: string }[] = [];
let mockEntityPaging: { after?: string } = {};
let mockIsInView = false;
let mockLocation: { pathname: string; key: string; state: unknown } = {
  pathname: '/',
  key: 'initial',
  state: null,
};

// Only useLocation is overridden; MemoryRouter and useNavigate stay real so the
// component's own navigate('.', ...) call still works.
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => mockLocation,
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: { id: 'u1', name: 'admin', fullyQualifiedName: 'admin' },
  }),
}));

jest.mock('../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: false }),
}));

jest.mock('../../../hooks/useDomainStore', () => ({
  useDomainStore: (selector: (s: { activeDomain: string }) => string) =>
    selector({ activeDomain: 'All Domains' }),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: 'test.db.table' }),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: () => mockUseRequiredParams(),
}));

jest.mock('../../../hooks/useElementInView', () => ({
  useElementInView: () => [{ current: null }, mockIsInView],
}));

jest.mock('../ActivityFeedProvider/ActivityFeedProvider', () => ({
  useActivityFeedProvider: () => ({
    selectedThread: null,
    setActiveThread: jest.fn(),
    entityThread: [],
    getFeedData: mockGetFeedData,
    getTaskData: mockGetTaskData,
    loading: mockLoading,
    entityPaging: mockEntityPaging,
    tasks: mockTasks,
    selectedTask: null,
    setActiveTask: jest.fn(),
    activityEvents: mockActivityEvents,
    isActivityLoading: false,
    fetchEntityActivity: mockFetchEntityActivity,
    fetchUserActivity: mockFetchUserActivity,
    userId: '',
    selectedActivity: null,
    setActiveActivity: jest.fn(),
  }),
}));

jest.mock('../../../rest/tasksAPI', () => ({
  ...jest.requireActual('../../../rest/tasksAPI'),
  getTaskCounts: (...args: unknown[]) => mockGetTaskCounts(...args),
  TaskStatusGroup: { Open: 'open', Closed: 'closed' },
}));

jest.mock('../../../rest/conversationsAPI', () => ({
  listConversations: (...args: unknown[]) => mockListConversations(...args),
}));

jest.mock('../../../rest/activityAPI', () => ({
  getEntityActivityByFqn: jest.fn(),
}));

jest.mock('../../../utils/EntityDisplayPureUtils', () => ({
  getCountBadge: (count: number) => (
    <span data-testid="filter-count">{count}</span>
  ),
  getEntityUserLink: jest.fn().mockReturnValue(''),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/EntityUtilClassBase', () => ({
  default: { getActivityFeedTabs: jest.fn().mockReturnValue([]) },
}));

jest.mock('../ActivityFeedList/ActivityFeedListV1New.component', () =>
  jest
    .fn()
    .mockImplementation(({ isLoading }) => (
      <div data-loading={String(isLoading)} data-testid="feed-list" />
    ))
);

jest.mock('../ActivityFeedList/TaskListV1.component', () =>
  jest
    .fn()
    .mockImplementation(({ emptyPlaceholderText, isLoading, onAfterClose }) => (
      <div data-loading={String(isLoading)} data-testid="task-list">
        <button
          aria-label="close task"
          data-testid="task-after-close"
          onClick={onAfterClose}
        />
        {emptyPlaceholderText}
      </div>
    ))
);

jest.mock('../ActivityFeedPanel/FeedPanelBodyV1New', () =>
  jest.fn().mockReturnValue(<div data-testid="feed-panel-body" />)
);

jest.mock('../../Entity/Task/TaskTab/TaskTabNew.component', () => ({
  TaskTabNew: jest.fn().mockReturnValue(<div data-testid="task-tab-new" />),
}));

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew', () =>
  jest.fn().mockReturnValue(<div data-testid="error-placeholder" />)
);

jest.mock('../../common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader" />)
);

jest.mock('../../MyData/Widgets/FeedsWidget/feeds-widget.less', () => ({}));
jest.mock('./activity-feed-tab.less', () => ({}));

const defaultProps = {
  entityType: EntityType.TABLE as EntityType.TABLE,
  onFeedUpdate: jest.fn(),
  layoutType: ActivityFeedLayoutType.THREE_PANEL,
};

const renderComponent = (subTab = ActivityFeedTabs.TASKS) => {
  mockUseRequiredParams.mockReturnValue({ tab: 'activity_feed', subTab });

  return render(
    <MemoryRouter>
      <ActivityFeedTab {...defaultProps} />
    </MemoryRouter>
  );
};

const renderUserComponent = (subTab = ActivityFeedTabs.TASKS) => {
  mockUseRequiredParams.mockReturnValue({ tab: 'activity_feed', subTab });

  return render(
    <MemoryRouter>
      <ActivityFeedTab
        {...defaultProps}
        columns={undefined}
        entityType={EntityType.USER}
      />
    </MemoryRouter>
  );
};

describe('ActivityFeedTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActivityEvents = [];
    mockConversationCount = 0;
    mockActivityCount = 0;
    mockLoading = false;
    mockTasks = [];
    mockEntityPaging = {};
    mockIsInView = false;
    mockLocation = { pathname: '/', key: 'initial', state: null };
    mockGetTaskCounts.mockResolvedValue({
      open: 0,
      inProgress: 0,
      completed: 0,
      total: 0,
    });
    mockListConversations.mockImplementation(() =>
      Promise.resolve({
        data: [],
        paging: { total: mockConversationCount },
      })
    );
    (getEntityActivityByFqn as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        data: [],
        paging: { total: mockActivityCount },
      })
    );
    mockGetFeedData.mockResolvedValue(undefined);
    mockGetTaskData.mockResolvedValue(undefined);
  });

  describe('Activity fetch is gated by tab', () => {
    it('does NOT fetch entity activity on the Tasks tab', async () => {
      renderComponent(ActivityFeedTabs.TASKS);

      await waitFor(() => {
        expect(mockGetTaskData).toHaveBeenCalled();
      });

      expect(mockFetchEntityActivity).not.toHaveBeenCalled();
    });

    it('fetches entity activity on the All tab', async () => {
      renderComponent(ActivityFeedTabs.ALL);

      await waitFor(() => {
        expect(mockFetchEntityActivity).toHaveBeenCalled();
      });
    });
  });

  describe('All count = conversations + activity events', () => {
    it('sums the server conversationCount and activityCount (not client-loaded length)', async () => {
      mockConversationCount = 3;
      mockActivityCount = 2;
      // Client-loaded list has fewer items than the server activity total; the
      // badge must reflect the SERVER total, so it stays correct under pagination.
      mockActivityEvents = [{ id: 'a1', timestamp: 1 }];

      renderComponent(ActivityFeedTabs.ALL);

      await waitFor(() => {
        const counts = screen
          .getAllByTestId('filter-count')
          .map((el) => el.textContent);

        // All badge must be 3 (conversations) + 2 (activity server total) = 5,
        // NOT 3 + activityEvents.length (1).
        expect(counts).toContain('5');
      });
    });
  });

  describe('User entity feed counts tolerate an empty conversation response', () => {
    it('still renders the tab when no conversations exist', async () => {
      mockListConversations.mockResolvedValue({
        data: [],
        paging: { total: 0 },
      });

      renderUserComponent(ActivityFeedTabs.TASKS);

      await waitFor(() => expect(mockListConversations).toHaveBeenCalled());

      expect(showErrorToast).not.toHaveBeenCalled();
      expect(screen.getByTestId('task-list')).toBeInTheDocument();
    });
  });

  describe('Bug 1 — feedFilter uses ActivityFeedTabs.MENTIONS enum', () => {
    it('fetches conversations alongside activity events on the All tab', async () => {
      renderComponent(ActivityFeedTabs.ALL);

      await waitFor(() =>
        expect(mockGetFeedData).toHaveBeenCalledWith(
          undefined,
          undefined,
          EntityType.TABLE,
          'test.db.table'
        )
      );
    });

    it('calls getFeedData with FeedFilter.MENTIONS when mentions tab is active', async () => {
      renderComponent(ActivityFeedTabs.MENTIONS);

      await waitFor(() => {
        const calls = mockGetFeedData.mock.calls;
        const mentionsCall = calls.find(
          ([feedFilter]) => feedFilter === FeedFilter.MENTIONS
        );

        expect(mentionsCall).toBeDefined();
      });
    });

    it('does not call getFeedData with FeedFilter.MENTIONS when tasks tab is active', async () => {
      renderComponent(ActivityFeedTabs.TASKS);

      await waitFor(() => expect(mockGetTaskData).toHaveBeenCalled());

      const mentionsCall = mockGetFeedData.mock.calls.find(
        ([feedFilter]) => feedFilter === FeedFilter.MENTIONS
      );

      expect(mentionsCall).toBeUndefined();
    });
  });

  describe('Sub-tab changes show the loader, never a stale list', () => {
    it('switches the in-list loader back on for a first-page refetch after paginating', async () => {
      mockTasks = [{ id: 'stale-my-task' }];
      // Scrolled to the bottom with a cursor: the one path that legitimately
      // turns the in-list loader off.
      mockEntityPaging = { after: 'cursor-1' };
      mockIsInView = true;

      renderComponent(ActivityFeedTabs.TASKS);

      await waitFor(() =>
        expect(mockGetTaskData).toHaveBeenCalledWith(
          undefined,
          'cursor-1',
          EntityType.TABLE,
          'test.db.table',
          'open'
        )
      );

      await waitFor(() =>
        expect(screen.getByTestId('task-list')).toHaveAttribute(
          'data-loading',
          'false'
        )
      );

      // onAfterClose refetches the first page, and the provider clears `tasks`
      // for it. Once pagination has cleared isFirstLoad, only switching it back
      // on keeps the loader up — otherwise the emptied list renders the
      // "no tasks" placeholder next to the pagination spinner.
      mockLoading = true;
      fireEvent.click(screen.getByTestId('task-after-close'));

      await waitFor(() =>
        expect(screen.getByTestId('task-list')).toHaveAttribute(
          'data-loading',
          'true'
        )
      );
    });

    it('brings the loader back when a task notification refreshes after paginating', async () => {
      mockTasks = [{ id: 'stale-my-task' }];
      mockEntityPaging = { after: 'cursor-1' };
      mockIsInView = true;

      const { rerender } = renderComponent(ActivityFeedTabs.TASKS);

      // Paginating is what clears isFirstLoad and arms the defect.
      await waitFor(() =>
        expect(mockGetTaskData).toHaveBeenCalledWith(
          undefined,
          'cursor-1',
          EntityType.TABLE,
          'test.db.table',
          'open'
        )
      );

      await waitFor(() =>
        expect(screen.getByTestId('task-list')).toHaveAttribute(
          'data-loading',
          'false'
        )
      );

      mockGetTaskData.mockClear();
      mockLoading = true;
      // Clicking a task notification for the same entity keeps the component
      // mounted and only changes location.state.
      mockLocation = {
        pathname: '/',
        key: 'after-notification',
        state: { tasksRefreshKey: 1 },
      };

      rerender(
        <MemoryRouter>
          <ActivityFeedTab {...defaultProps} />
        </MemoryRouter>
      );

      // The refresh really did start a first-page fetch, and the provider clears
      // the rows for it, so the loader must be on rather than the placeholder.
      await waitFor(() =>
        expect(mockGetTaskData).toHaveBeenCalledWith(
          undefined,
          undefined,
          EntityType.TABLE,
          'test.db.table',
          'open'
        )
      );

      expect(screen.getByTestId('task-list')).toHaveAttribute(
        'data-loading',
        'true'
      );
    });

    it('brings the loader back when the sub-tab changes via the URL', async () => {
      mockTasks = [{ id: 'stale-my-task' }];
      // A scrolled-to-bottom list with a cursor pages in, which is the one path
      // that legitimately turns the in-list loader off.
      mockEntityPaging = { after: 'cursor-1' };
      mockIsInView = true;

      const { rerender } = renderComponent(ActivityFeedTabs.TASKS);

      await waitFor(() =>
        expect(mockGetTaskData).toHaveBeenCalledWith(
          undefined,
          'cursor-1',
          EntityType.TABLE,
          'test.db.table',
          'open'
        )
      );

      mockLoading = true;
      // Entity pages never pass the `subTab` prop — the switch arrives as a URL
      // param, which is why keying the loader reset off `subTab` was a no-op and
      // left the previous sub-tab's list on screen.
      mockUseRequiredParams.mockReturnValue({
        tab: 'activity_feed',
        subTab: ActivityFeedTabs.MENTIONS,
      });

      rerender(
        <MemoryRouter>
          <ActivityFeedTab {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(() =>
        expect(screen.getByTestId('feed-list')).toHaveAttribute(
          'data-loading',
          'true'
        )
      );
    });
  });

  describe('Bug 3/4 — badge and placeholder reflect taskFilter state', () => {
    it('left-panel badge shows openTaskCount in Open filter', async () => {
      mockGetTaskCounts.mockResolvedValue({
        open: 3,
        inProgress: 0,
        completed: 5,
        total: 8,
      });

      renderComponent(ActivityFeedTabs.TASKS);

      await waitFor(() => {
        const badge = screen.getByTestId('left-panel-task-count');

        expect(badge).toHaveTextContent('3');
      });
    });

    it('left-panel badge switches to closedTaskCount when Closed filter is selected', async () => {
      mockGetTaskCounts.mockResolvedValue({
        open: 3,
        inProgress: 0,
        completed: 5,
        total: 8,
      });

      renderComponent(ActivityFeedTabs.TASKS);

      await waitFor(() =>
        expect(screen.getByTestId('left-panel-task-count')).toHaveTextContent(
          '3'
        )
      );

      fireEvent.click(screen.getByTestId('user-profile-page-task-filter-icon'));

      const closedItem = await screen.findByTestId('closed-tasks');

      fireEvent.click(closedItem);

      await waitFor(() =>
        expect(screen.getByTestId('left-panel-task-count')).toHaveTextContent(
          '5'
        )
      );
    });

    it('placeholder shows open tasks message when Open filter is active', async () => {
      renderComponent(ActivityFeedTabs.TASKS);

      await waitFor(() => {
        expect(
          screen.getByText('message.no-open-tasks-title')
        ).toBeInTheDocument();
      });
    });

    it('placeholder shows closed tasks message when Closed filter is selected', async () => {
      renderComponent(ActivityFeedTabs.TASKS);

      await waitFor(() =>
        expect(
          screen.getByTestId('user-profile-page-task-filter-icon')
        ).toBeInTheDocument()
      );

      fireEvent.click(screen.getByTestId('user-profile-page-task-filter-icon'));

      const closedItem = await screen.findByTestId('closed-tasks');

      fireEvent.click(closedItem);

      await waitFor(() => {
        expect(
          screen.getByText('message.no-closed-tasks-title')
        ).toBeInTheDocument();
      });
    });

    it('fires exactly one fetch per task filter change', async () => {
      renderComponent(ActivityFeedTabs.TASKS);

      await waitFor(() => expect(mockGetTaskData).toHaveBeenCalled());

      fireEvent.click(screen.getByTestId('user-profile-page-task-filter-icon'));
      fireEvent.click(await screen.findByTestId('closed-tasks'));

      // The fetch effect already refires on taskFilter, so the handler calling
      // getTaskData itself as well fired two identical requests per click.
      await waitFor(() =>
        expect(
          mockGetTaskData.mock.calls.filter(
            ([, , , , statusGroup]) => statusGroup === 'closed'
          )
        ).toHaveLength(1)
      );
    });
  });
});
