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
import { mockUserData } from '../../../mocks/MyDataPage.mock';
import {
  addActivityReaction,
  deletePostById,
  deleteThread,
  getAllFeeds,
  getMyActivityFeed,
  postFeedById,
  postThread,
  removeActivityReaction,
} from '../../../rest/feedsAPI';
import { listTasks } from '../../../rest/tasksAPI';
import ActivityFeedProvider from './ActivityFeedProvider';
import {
  DummyActivityCommentComponent,
  DummyActivityFeedComponent,
  DummyActivityReactionComponent,
  DummyChildrenComponent,
  DummyChildrenDeletePostComponent,
  DummyChildrenEntityComponent,
  DummyChildrenTaskCloseComponent,
  DummySetActiveActivityComponent,
} from './DummyTestComponent';

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: mockUserData,
  })),
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
  postThread: jest.fn().mockResolvedValue({ id: 'new-thread-123', posts: [] }),
  updatePost: jest.fn(),
  updateThread: jest.fn(),
  getMyActivityFeed: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  addActivityReaction: jest.fn().mockResolvedValue({
    id: 'activity-123',
    reactions: [{ reactionType: 'thumbsUp', user: { id: 'user-1' } }],
  }),
  removeActivityReaction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../rest/tasksAPI', () => ({
  listTasks: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  addTaskComment: jest.fn(),
  getTaskById: jest.fn(),
  tasksToThreads: jest.fn().mockReturnValue([]),
  TaskEntityStatus: {
    Open: 'Open',
    Completed: 'Completed',
  },
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getListTestCaseIncidentByStateId: jest.fn(),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityFeedLink: jest.fn(),
  getEntityReferenceListFromEntities: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/FeedUtils', () => ({
  getUpdatedThread: jest.fn().mockResolvedValue({
    id: '123',
    posts: [],
    postsCount: 0,
  }),
}));

describe('ActivityFeedProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading indicator in initial fetch', async () => {
    render(
      <ActivityFeedProvider>
        <DummyChildrenComponent />
      </ActivityFeedProvider>
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('should call listTasks with open status group for user task feed', async () => {
    await act(async () => {
      render(
        <ActivityFeedProvider>
          <DummyChildrenComponent />
        </ActivityFeedProvider>
      );
    });

    // When entityType is USER, userId is from the 'user' prop (undefined in this test)
    expect(listTasks).toHaveBeenCalledWith({
      statusGroup: 'open',
      assignee: undefined,
      aboutEntity: undefined,
      after: undefined,
      limit: undefined,
      fields: 'assignees,createdBy,about,comments,payload',
    });
  });

  it('should call listTasks with closed status group and after cursor for user', async () => {
    await act(async () => {
      render(
        <ActivityFeedProvider>
          <DummyChildrenTaskCloseComponent />
        </ActivityFeedProvider>
      );
    });

    // When entityType is USER, userId is from the 'user' prop (undefined in this test)
    expect(listTasks).toHaveBeenCalledWith({
      statusGroup: 'closed',
      assignee: undefined,
      aboutEntity: undefined,
      after: 'after-234',
      limit: undefined,
      fields: 'assignees,createdBy,about,comments,payload',
    });
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
      from: 'Test User',
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
  });

  describe('Activity Comments', () => {
    const mockActivity: ActivityEvent = {
      id: 'activity-456',
      timestamp: 1234567890,
      eventType: 'entityUpdated' as ActivityEvent['eventType'],
      actor: { id: 'user-1', type: 'user', name: 'testuser' },
      entity: { id: 'entity-1', type: 'table', name: 'testTable' },
      about: '<#E::table::test>',
      summary: 'Updated description',
    };

    it('should create a new thread when posting first comment on activity', async () => {
      (getAllFeeds as jest.Mock).mockResolvedValueOnce({
        data: [],
        paging: {},
      });

      await act(async () => {
        render(
          <ActivityFeedProvider>
            <DummyActivityCommentComponent activity={mockActivity} />
          </ActivityFeedProvider>
        );
      });

      fireEvent.click(screen.getByTestId('post-comment'));

      await waitFor(() => {
        expect(postThread).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Test comment',
            about: '<#E::table::test>',
          })
        );
      });
    });

    it('should add to existing thread when posting comment on activity with thread', async () => {
      const existingThread = {
        id: 'existing-thread-123',
        posts: [],
      };
      (getAllFeeds as jest.Mock).mockResolvedValue({
        data: [existingThread],
        paging: {},
      });

      await act(async () => {
        render(
          <ActivityFeedProvider>
            <DummySetActiveActivityComponent activity={mockActivity} />
          </ActivityFeedProvider>
        );
      });

      fireEvent.click(screen.getByTestId('set-active'));

      await waitFor(() => {
        expect(getAllFeeds).toHaveBeenCalled();
      });
    });
  });

  describe('Set Active Activity', () => {
    const mockActivity: ActivityEvent = {
      id: 'activity-789',
      timestamp: 1234567890,
      eventType: 'entityUpdated' as ActivityEvent['eventType'],
      actor: { id: 'user-1', type: 'user', name: 'testuser' },
      entity: { id: 'entity-1', type: 'table', name: 'testTable' },
      about: '<#E::table::test>',
      summary: 'Updated tags',
    };

    it('should fetch associated threads when setting active activity', async () => {
      (getAllFeeds as jest.Mock).mockResolvedValue({
        data: [{ id: 'thread-for-activity', posts: [] }],
        paging: {},
      });

      await act(async () => {
        render(
          <ActivityFeedProvider>
            <DummySetActiveActivityComponent activity={mockActivity} />
          </ActivityFeedProvider>
        );
      });

      fireEvent.click(screen.getByTestId('set-active'));

      await waitFor(() => {
        expect(getAllFeeds).toHaveBeenCalledWith(
          '<#E::table::test>',
          undefined,
          'Conversation'
        );
      });
    });

    it('should handle no existing thread for activity', async () => {
      (getAllFeeds as jest.Mock).mockResolvedValue({
        data: [],
        paging: {},
      });

      await act(async () => {
        render(
          <ActivityFeedProvider>
            <DummySetActiveActivityComponent activity={mockActivity} />
          </ActivityFeedProvider>
        );
      });

      fireEvent.click(screen.getByTestId('set-active'));

      await waitFor(() => {
        expect(screen.getByTestId('activity-thread-id')).toHaveTextContent(
          'no-thread'
        );
      });
    });

    it('should clear activity thread when setting active to undefined', async () => {
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
