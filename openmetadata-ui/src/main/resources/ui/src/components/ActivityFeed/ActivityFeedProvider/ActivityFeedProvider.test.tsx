/*
 *  Copyright 2023 Collate.
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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import { ReactionType } from '../../../generated/type/reaction';
import {
  DummyActivityFeedComponent,
  DummyActivityFilterSwitchComponent,
  DummyActivityReactionComponent,
  DummyActivityReactionSyncComponent,
  DummyChildrenComponent,
  DummyChildrenDeletePostComponent,
  DummyChildrenEntityComponent,
  DummyChildrenMentionsComponent,
  DummyChildrenTaskCloseComponent,
  DummyEntityActivityFeedComponent,
  DummyFollowingActivityComponent,
  DummySetActiveActivityComponent,
} from '../../../mocks/ActivityFeedProvider.mock';
import { mockUserData } from '../../../mocks/MyDataPage.mock';
import {
  addActivityReaction,
  deletePostById,
  deleteThread,
  getActivityEvents,
  getAllFeeds,
  getEntityActivityByFqn,
  getFollowingActivityFeed,
  getMyActivityFeed,
  postFeedById,
  removeActivityReaction,
} from '../../../rest/feedsAPI';
import { listMyVisibleTasks, listTasks } from '../../../rest/tasksAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import ActivityFeedProvider from './ActivityFeedProvider';

const mockUseApplicationStore = jest.fn(() => ({
  currentUser: mockUserData,
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: (...args: unknown[]) => mockUseApplicationStore(...args),
}));

const mockUseDomainStore = jest.fn((selector) =>
  selector({ activeDomain: 'All Domains' })
);

jest.mock('../../../hooks/useDomainStore', () => ({
  useDomainStore: (...args: unknown[]) => mockUseDomainStore(...args),
}));

jest.mock('../ActivityFeedDrawer/ActivityFeedDrawer', () =>
  jest.fn().mockImplementation(() => <p>Entity ActivityFeedDrawer</p>)
);

const mockActivityEvents: ActivityEvent[] = [
  {
    id: 'activity-123',
    timestamp: 1234567890,
    eventType: 'entityUpdated' as ActivityEvent['eventType'],
    actor: { id: 'user-1', type: 'user', name: 'testuser' },
    entity: { id: 'entity-1', type: 'table', name: 'testTable' },
    about: '<#E::table::test>',
    summary: 'Updated tags',
    reactions: [],
  },
];

jest.mock('../../../rest/feedsAPI', () => ({
  deletePostById: jest.fn().mockResolvedValue(true),
  deleteThread: jest.fn().mockResolvedValue({ id: '123', message: 'deleted' }),
  getAllFeeds: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  getFeedById: jest.fn(),
  postFeedById: jest.fn().mockResolvedValue({ id: 'thread-123', posts: [] }),
  updatePost: jest.fn(),
  updateThread: jest.fn(),
  getActivityEvents: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  getMyActivityFeed: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  getFollowingActivityFeed: jest
    .fn()
    .mockResolvedValue({ data: [], paging: {} }),
  getEntityActivityByFqn: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  addActivityReaction: jest.fn().mockResolvedValue({
    id: 'activity-123',
    reactions: [{ reactionType: 'thumbsUp', user: { id: 'user-1' } }],
  }),
  removeActivityReaction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../rest/tasksAPI', () => ({
  listTasks: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  listMyAssignedTasks: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  listMyCreatedTasks: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  listMyVisibleTasks: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  addTaskComment: jest.fn(),
  getTaskById: jest.fn(),
  tasksToThreads: jest.fn().mockReturnValue([]),
  TaskStatusGroup: {
    Open: 'open',
    Active: 'active',
    Closed: 'closed',
  },
  TaskEntityStatus: {
    Open: 'Open',
    Completed: 'Completed',
  },
  TaskEntityType: {
    CustomTask: 'CustomTask',
    DataAccessRequest: 'DataAccessRequest',
    DataQualityReview: 'DataQualityReview',
    DescriptionUpdate: 'DescriptionUpdate',
    DomainUpdate: 'DomainUpdate',
    GlossaryApproval: 'GlossaryApproval',
    IncidentResolution: 'IncidentResolution',
    OwnershipUpdate: 'OwnershipUpdate',
    PipelineReview: 'PipelineReview',
    RequestApproval: 'RequestApproval',
    Suggestion: 'Suggestion',
    TagUpdate: 'TagUpdate',
    TestCaseResolution: 'TestCaseResolution',
    TierUpdate: 'TierUpdate',
  },
}));

jest.mock('../../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentByStateId: jest.fn(),
}));

jest.mock('../../../utils/EntityPureUtils', () => ({
  getEntityFeedLink: jest.fn(),
}));

jest.mock('../../../utils/EntityReferenceUtils', () => ({
  getEntityReferenceListFromEntities: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/FeedUtilsPure', () => ({
  getUpdatedThread: jest.fn().mockResolvedValue({
    id: '123',
    posts: [],
    postsCount: 0,
  }),
}));

describe('ActivityFeedProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDomainStore.mockImplementation((selector) =>
      selector({ activeDomain: 'All Domains' })
    );
    mockUseApplicationStore.mockReturnValue({
      currentUser: {
        ...mockUserData,
        name: 'admin',
        fullyQualifiedName: 'admin',
      },
    });
  });

  it('should show loading indicator in initial fetch', async () => {
    (listMyVisibleTasks as jest.Mock).mockReturnValueOnce(
      new Promise(() => {})
    );

    render(
      <ActivityFeedProvider>
        <DummyChildrenComponent />
      </ActivityFeedProvider>
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('should call listMyVisibleTasks with open status group for current user task feed', async () => {
    await act(async () => {
      render(
        <ActivityFeedProvider>
          <DummyChildrenComponent />
        </ActivityFeedProvider>
      );
    });

    await waitFor(() =>
      expect(listMyVisibleTasks).toHaveBeenCalledWith({
        statusGroup: 'open',
        after: undefined,
        limit: undefined,
        domain: undefined,
        fields: 'assignees,createdBy,about,comments,payload',
      })
    );
  });

  it('should call listMyVisibleTasks with closed status group and after cursor for user', async () => {
    await act(async () => {
      render(
        <ActivityFeedProvider>
          <DummyChildrenTaskCloseComponent />
        </ActivityFeedProvider>
      );
    });

    await waitFor(() =>
      expect(listMyVisibleTasks).toHaveBeenCalledWith({
        statusGroup: 'closed',
        after: 'after-234',
        limit: undefined,
        domain: undefined,
        fields: 'assignees,createdBy,about,comments,payload',
      })
    );
  });

  it('should use visible task endpoint for current user task feed', async () => {
    mockUseApplicationStore.mockReturnValue({
      currentUser: {
        ...mockUserData,
        name: 'admin',
        fullyQualifiedName: 'admin',
      },
    });

    await act(async () => {
      render(
        <ActivityFeedProvider>
          <DummyChildrenComponent />
        </ActivityFeedProvider>
      );
    });

    await waitFor(() =>
      expect(listMyVisibleTasks).toHaveBeenCalledWith({
        statusGroup: 'open',
        after: undefined,
        limit: undefined,
        domain: undefined,
        fields: 'assignees,createdBy,about,comments,payload',
      })
    );

    expect(listTasks).not.toHaveBeenCalled();
  });

  it('should call getFeedData for table entity', async () => {
    await act(async () => {
      render(
        <ActivityFeedProvider>
          <DummyChildrenEntityComponent />
        </ActivityFeedProvider>
      );
    });

    expect(getAllFeeds).toHaveBeenCalledWith(
      undefined,
      undefined,
      'Conversation',
      'ALL',
      undefined,
      undefined,
      undefined
    );
  });

  it('should pass the active domain to entity activity requests', async () => {
    mockUseDomainStore.mockImplementation((selector) =>
      selector({ activeDomain: 'finance' })
    );

    await act(async () => {
      render(
        <ActivityFeedProvider>
          <DummyEntityActivityFeedComponent />
        </ActivityFeedProvider>
      );
    });

    await waitFor(() =>
      expect(getEntityActivityByFqn).toHaveBeenCalledWith(
        'table',
        'service.db.schema.table',
        {
          days: 7,
          limit: 20,
          domain: 'finance',
        }
      )
    );
  });

  it('should keep mentions on the feed API instead of routing them through task fetches', async () => {
    await act(async () => {
      render(
        <ActivityFeedProvider>
          <DummyChildrenMentionsComponent />
        </ActivityFeedProvider>
      );
    });

    expect(getAllFeeds).toHaveBeenCalledWith(
      undefined,
      undefined,
      'Conversation',
      'MENTIONS',
      undefined,
      undefined,
      undefined
    );
    expect(listTasks).not.toHaveBeenCalledWith(
      expect.objectContaining({ mentionedUser: expect.anything() })
    );
  });

  it('should call postFeed with button click', async () => {
    render(
      <ActivityFeedProvider>
        <DummyChildrenComponent />
      </ActivityFeedProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('post-feed'));

    expect(postFeedById).toHaveBeenCalledWith('123', {
      message: 'New Post Feed added',
    });
  });

  it('should call deleteThread with button click when isThread is true', async () => {
    render(
      <ActivityFeedProvider>
        <DummyChildrenComponent />
      </ActivityFeedProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-feed'));

    expect(deleteThread).toHaveBeenCalledWith('123');
    expect(deletePostById).not.toHaveBeenCalled();
  });

  it('should call deletePostId with button click when isThread is false', async () => {
    render(
      <ActivityFeedProvider>
        <DummyChildrenDeletePostComponent />
      </ActivityFeedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('delete-feed')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-feed'));

    expect(deleteThread).not.toHaveBeenCalled();
    expect(deletePostById).toHaveBeenCalledWith('123', '456');
  });

  describe('Activity Events', () => {
    it('should fetch my activity feed and display activity events', async () => {
      (getMyActivityFeed as jest.Mock).mockResolvedValueOnce({
        data: mockActivityEvents,
        paging: {},
      });

      await act(async () => {
        render(
          <ActivityFeedProvider>
            <DummyActivityFeedComponent />
          </ActivityFeedProvider>
        );
      });

      await waitFor(() => {
        expect(getMyActivityFeed).toHaveBeenCalledWith({ days: 7, limit: 20 });
      });
    });

    it('should show loading state while fetching activity', async () => {
      (getMyActivityFeed as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: [], paging: {} }), 100)
          )
      );

      render(
        <ActivityFeedProvider>
          <DummyActivityFeedComponent />
        </ActivityFeedProvider>
      );

      expect(screen.getByTestId('activity-loading')).toBeInTheDocument();
    });

    it('should fetch the following activity feed and display its events', async () => {
      (getFollowingActivityFeed as jest.Mock).mockResolvedValueOnce({
        data: mockActivityEvents,
        paging: {},
      });

      await act(async () => {
        render(
          <ActivityFeedProvider>
            <DummyFollowingActivityComponent />
          </ActivityFeedProvider>
        );
      });

      await waitFor(() => {
        expect(getFollowingActivityFeed).toHaveBeenCalledWith({
          days: 7,
          limit: 20,
        });
      });

      expect(screen.getByTestId('following-activity-count')).toHaveTextContent(
        '1'
      );
      expect(
        screen.getByTestId('following-activity-summary')
      ).toHaveTextContent('Updated tags');
    });

    // Domain scoping belongs to the withDomainFilter interceptor, which appends
    // `domain` to every GET (see hoc/withDomainFilter.test.tsx). These two guard
    // against anyone reinstating the duplicate resolution in the provider.
    it('should not hand-roll the domain on the following activity request', async () => {
      mockUseDomainStore.mockImplementation((selector) =>
        selector({ activeDomain: 'finance' })
      );

      await act(async () => {
        render(
          <ActivityFeedProvider>
            <DummyFollowingActivityComponent />
          </ActivityFeedProvider>
        );
      });

      await waitFor(() => {
        expect(getFollowingActivityFeed).toHaveBeenCalledWith({
          days: 7,
          limit: 20,
        });
      });

      expect(getFollowingActivityFeed).not.toHaveBeenCalledWith(
        expect.objectContaining({ domain: expect.anything() })
      );
    });

    it('should not hand-roll the domain on the all activity request', async () => {
      mockUseDomainStore.mockImplementation((selector) =>
        selector({ activeDomain: 'finance' })
      );

      await act(async () => {
        render(
          <ActivityFeedProvider>
            <DummyActivityFilterSwitchComponent />
          </ActivityFeedProvider>
        );
      });

      fireEvent.click(screen.getByTestId('fetch-all'));

      await waitFor(() => {
        expect(getActivityEvents).toHaveBeenCalledWith({ limit: 20 });
      });

      expect(getActivityEvents).not.toHaveBeenCalledWith(
        expect.objectContaining({ domain: expect.anything() })
      );
    });

    it('should show an error toast when an activity request fails', async () => {
      const error = new Error('activity request failed');
      (getFollowingActivityFeed as jest.Mock).mockRejectedValueOnce(error);

      await act(async () => {
        render(
          <ActivityFeedProvider>
            <DummyFollowingActivityComponent />
          </ActivityFeedProvider>
        );
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(error);
      });
    });

    it('should ignore a superseded activity response when the filter changes', async () => {
      let resolveSlowRequest: (value: unknown) => void = () => undefined;
      (getMyActivityFeed as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSlowRequest = resolve;
          })
      );
      (getFollowingActivityFeed as jest.Mock).mockResolvedValueOnce({
        data: mockActivityEvents,
        paging: {},
      });

      render(
        <ActivityFeedProvider>
          <DummyActivityFilterSwitchComponent />
        </ActivityFeedProvider>
      );

      fireEvent.click(screen.getByTestId('fetch-owner'));
      fireEvent.click(screen.getByTestId('fetch-following'));

      await waitFor(() => {
        expect(screen.getByTestId('activity-summaries')).toHaveTextContent(
          'Updated tags'
        );
      });

      await act(async () => {
        // eslint-disable-next-line sonarjs/no-extra-arguments -- deferred test resolver
        resolveSlowRequest({
          data: [{ ...mockActivityEvents[0], summary: 'Stale result' }],
          paging: {},
        });
      });

      expect(screen.getByTestId('activity-summaries')).toHaveTextContent(
        'Updated tags'
      );
      expect(screen.getByTestId('activity-summaries')).not.toHaveTextContent(
        'Stale result'
      );
    });
  });

  describe('Activity Reactions', () => {
    it('should call addActivityReaction when adding a reaction', async () => {
      (getMyActivityFeed as jest.Mock).mockResolvedValueOnce({
        data: mockActivityEvents,
        paging: {},
      });

      await act(async () => {
        render(
          <ActivityFeedProvider>
            <DummyActivityReactionComponent />
          </ActivityFeedProvider>
        );
      });

      fireEvent.click(screen.getByTestId('add-reaction'));

      await waitFor(() => {
        expect(addActivityReaction).toHaveBeenCalledWith(
          'activity-123',
          ReactionType.ThumbsUp
        );
      });
    });

    it('should call removeActivityReaction when removing a reaction', async () => {
      (getMyActivityFeed as jest.Mock).mockResolvedValueOnce({
        data: mockActivityEvents,
        paging: {},
      });

      await act(async () => {
        render(
          <ActivityFeedProvider>
            <DummyActivityReactionComponent />
          </ActivityFeedProvider>
        );
      });

      fireEvent.click(screen.getByTestId('remove-reaction'));

      await waitFor(() => {
        expect(removeActivityReaction).toHaveBeenCalledWith(
          'activity-123',
          ReactionType.ThumbsUp
        );
      });
    });

    it('syncs the selected activity so the right panel reflects the reaction', async () => {
      (getMyActivityFeed as jest.Mock).mockResolvedValueOnce({
        data: mockActivityEvents,
        paging: {},
      });

      await act(async () => {
        render(
          <ActivityFeedProvider>
            <DummyActivityReactionSyncComponent />
          </ActivityFeedProvider>
        );
      });

      // Select the activity into the right panel — it starts with no reactions.
      fireEvent.click(screen.getByTestId('select-activity'));
      await waitFor(() => {
        expect(
          screen.getByTestId('selected-activity-reactions')
        ).toHaveTextContent('0');
      });

      // Toggling a reaction must update the SELECTED copy, not just the list.
      fireEvent.click(screen.getByTestId('react'));
      await waitFor(() => {
        expect(
          screen.getByTestId('selected-activity-reactions')
        ).toHaveTextContent('1');
      });
    });
  });

  describe('Set Active Activity (read-only activities)', () => {
    const mockActivity: ActivityEvent = {
      id: 'activity-789',
      timestamp: 1234567890,
      eventType: 'entityUpdated' as ActivityEvent['eventType'],
      actor: { id: 'user-1', type: 'user', name: 'testuser' },
      entity: { id: 'entity-1', type: 'table', name: 'testTable' },
      about: '<#E::table::test>',
      summary: 'Updated tags',
    };

    it('selects the activity WITHOUT adopting any conversation thread', async () => {
      await act(async () => {
        render(
          <ActivityFeedProvider>
            <DummySetActiveActivityComponent activity={mockActivity} />
          </ActivityFeedProvider>
        );
      });

      fireEvent.click(screen.getByTestId('set-active'));

      await waitFor(() => {
        expect(screen.getByTestId('selected-activity-id')).toHaveTextContent(
          'activity-789'
        );
      });

      // Activities are read-only: no conversation thread is fetched/adopted,
      // so replies can never leak across activities sharing an entityLink.
      expect(getAllFeeds).not.toHaveBeenCalledWith(
        '<#E::table::test>',
        undefined,
        'Conversation'
      );
    });

    it('clears the selected activity when set to undefined', async () => {
      await act(async () => {
        render(
          <ActivityFeedProvider>
            <DummySetActiveActivityComponent activity={undefined} />
          </ActivityFeedProvider>
        );
      });

      fireEvent.click(screen.getByTestId('set-active'));

      await waitFor(() => {
        expect(screen.getByTestId('selected-activity-id')).toHaveTextContent(
          'none'
        );
      });
    });
  });
});
