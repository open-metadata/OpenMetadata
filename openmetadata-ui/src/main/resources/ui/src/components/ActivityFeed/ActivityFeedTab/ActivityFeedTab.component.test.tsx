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
import { getFeedCount } from '../../../rest/feedsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ActivityFeedTab } from './ActivityFeedTab.component';
import {
  ActivityFeedLayoutType,
  ActivityFeedTabs,
} from './ActivityFeedTab.interface';

const mockGetFeedData = jest.fn();
const mockGetTaskData = jest.fn();
const mockGetTaskCounts = jest.fn();
const mockUseRequiredParams = jest.fn();
const mockFetchEntityActivity = jest.fn();
const mockFetchUserActivity = jest.fn();
let mockActivityEvents: { id: string; timestamp: number }[] = [];
let mockConversationCount = 0;
let mockActivityCount = 0;

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
  useElementInView: () => [{ current: null }, false],
}));

jest.mock('../ActivityFeedProvider/ActivityFeedProvider', () => ({
  useActivityFeedProvider: () => ({
    selectedThread: null,
    setActiveThread: jest.fn(),
    entityThread: [],
    getFeedData: mockGetFeedData,
    getTaskData: mockGetTaskData,
    loading: false,
    entityPaging: {},
    tasks: [],
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

jest.mock('../../../rest/feedsAPI', () => ({
  getFeedCount: jest.fn(),
}));

jest.mock('../../../utils/EntityDisplayPureUtils', () => ({
  getCountBadge: (count: number) => (
    <span data-testid="filter-count">{count}</span>
  ),
  getEntityUserLink: jest.fn().mockReturnValue(''),
}));

jest.mock('../../../utils/FeedUtilsPure', () => ({
  // Real implementations — folding the /feed/count array and summing the tab
  // total are the behaviours the tests below exercise.
  aggregateFeedCountResponse: jest.requireActual('../../../utils/FeedUtilsPure')
    .aggregateFeedCountResponse,
  getFeedTotalCount: jest.requireActual('../../../utils/FeedUtilsPure')
    .getFeedTotalCount,
  getFeedCounts: jest.fn((_, __, ___, cb) =>
    cb({
      conversationCount: mockConversationCount,
      activityCount: mockActivityCount,
      mentionCount: 0,
      totalCount: mockConversationCount + mockActivityCount,
      totalTasksCount: 0,
      openTaskCount: 0,
      closedTaskCount: 0,
    })
  ),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/EntityUtilClassBase', () => ({
  default: { getActivityFeedTabs: jest.fn().mockReturnValue([]) },
}));

jest.mock('../ActivityFeedList/ActivityFeedListV1New.component', () =>
  jest.fn().mockReturnValue(<div data-testid="feed-list" />)
);

jest.mock('../ActivityFeedList/TaskListV1.component', () =>
  jest
    .fn()
    .mockImplementation(({ emptyPlaceholderText }) => (
      <div data-testid="task-list">{emptyPlaceholderText}</div>
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
    mockGetTaskCounts.mockResolvedValue({
      open: 0,
      inProgress: 0,
      completed: 0,
      total: 0,
    });
    mockGetFeedData.mockResolvedValue(undefined);
    mockGetTaskData.mockResolvedValue(undefined);
    (getFeedCount as jest.Mock).mockResolvedValue([
      {
        entityLink: '<#E::user::admin>',
        conversationCount: 0,
        mentionCount: 0,
      },
    ]);
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

  describe('User entity feed counts tolerate an empty /feed/count response', () => {
    it('still renders the tab when the feed count response is empty', async () => {
      // A user with no threads gets back [] — indexing res[0] threw here, which
      // was swallowed by the catch and left the whole tab unrendered.
      (getFeedCount as jest.Mock).mockResolvedValue([]);

      renderUserComponent(ActivityFeedTabs.TASKS);

      await waitFor(() => expect(getFeedCount).toHaveBeenCalled());

      expect(showErrorToast).not.toHaveBeenCalled();
      expect(screen.getByTestId('task-list')).toBeInTheDocument();
    });
  });

  describe('Bug 1 — feedFilter uses ActivityFeedTabs.MENTIONS enum', () => {
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
  });
});
