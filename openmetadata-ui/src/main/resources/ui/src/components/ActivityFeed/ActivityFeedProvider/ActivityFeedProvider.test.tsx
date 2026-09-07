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
  DummyActivityCommentComponent,
  DummyActivityFeedComponent,
  DummyActivityFilterSwitchComponent,
  DummyActivityReactionComponent,
  DummyActivityReactionSyncComponent,
  DummyActivityReplyEditComponent,
  DummyChildrenComponent,
  DummyChildrenDeletePostComponent,
  DummyChildrenEntityComponent,
  DummyChildrenTaskCloseComponent,
  DummyEntityActivityFeedComponent,
  DummyFollowingActivityComponent,
  DummySetActiveActivityComponent,
  DummyTaskListStateComponent,
} from '../../../mocks/ActivityFeedProvider.mock';
import { mockUserData } from '../../../mocks/MyDataPage.mock';
import {
  addActivityReaction,
  createActivityReply,
  getActivityEvents,
  getEntityActivityByFqn,
  getFollowingActivityFeed,
  getMyActivityFeed,
  listActivityReplies,
  removeActivityReaction,
} from '../../../rest/activityAPI';
import {
  createConversationReply,
  deleteConversation,
  deleteConversationReply,
  listConversations,
  patchConversationReply,
} from '../../../rest/conversationsAPI';
import { listMyVisibleTasks, listTasks } from '../../../rest/tasksAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import ActivityFeedProvider from './ActivityFeedProvider';

const mockUseApplicationStore = jest.fn(() => ({
  currentUser: mockUserData,
}));
const mockUseDomainStore = jest.fn((selector) =>
  selector({ activeDomain: 'All Domains' })
);

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => mockUseApplicationStore(),
}));

jest.mock('../../../hooks/useDomainStore', () => ({
  useDomainStore: (selector: (state: { activeDomain: string }) => unknown) =>
    mockUseDomainStore(selector),
}));

jest.mock('../ActivityFeedDrawer/ActivityFeedDrawer', () =>
  jest.fn().mockImplementation(() => <p>ActivityFeedDrawer</p>)
);

jest.mock('../../../rest/activityAPI', () => ({
  addActivityReaction: jest.fn().mockResolvedValue({
    id: 'activity-123',
    reactions: [{ reactionType: 'thumbsUp', user: { id: 'user-1' } }],
  }),
  createActivityReply: jest.fn(),
  getActivityEvents: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  getFollowingActivityFeed: jest
    .fn()
    .mockResolvedValue({ data: [], paging: {} }),
  getEntityActivityByFqn: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  getMyActivityFeed: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  getUserActivity: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  listActivityReplies: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
  removeActivityReaction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../rest/conversationsAPI', () => ({
  addConversationReaction: jest.fn(),
  addConversationReplyReaction: jest.fn(),
  createConversationReply: jest.fn(),
  deleteConversation: jest.fn(),
  deleteConversationReply: jest.fn(),
  getConversation: jest.fn(),
  listConversationReplies: jest.fn(),
  listConversations: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  patchConversation: jest.fn(),
  patchConversationReply: jest.fn(),
  removeConversationReaction: jest.fn(),
  removeConversationReplyReaction: jest.fn(),
}));

jest.mock('../../../rest/tasksAPI', () => ({
  addTaskComment: jest.fn(),
  getTaskById: jest.fn(),
  listMyAssignedTasks: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  listMyCreatedTasks: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  listMyVisibleTasks: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  listTasks: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  TaskEntityType: {
    TestCaseResolution: 'TestCaseResolution',
  },
  TaskStatusGroup: {
    Closed: 'closed',
    Open: 'open',
  },
}));

jest.mock('../../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentByStateId: jest.fn(),
}));

jest.mock('../../../utils/EntityPureUtils', () => ({
  getEntityFeedLink: jest.fn().mockReturnValue('<#E::table::admin>'),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const activity: ActivityEvent = {
  id: 'activity-123',
  timestamp: 1234567890,
  eventType: 'entityUpdated' as ActivityEvent['eventType'],
  actor: { id: 'user-1', type: 'user', name: 'testuser' },
  entity: { id: 'entity-1', type: 'table', name: 'testTable' },
  about: '<#E::table::test>',
  summary: 'Updated tags',
  reactions: [],
};

const activityReply = {
  id: 'reply-1',
  conversationId: activity.id,
  author: { id: 'user-1', type: 'user', name: 'admin' },
  message: 'Test comment',
  createdAt: 123,
  updatedAt: 123,
};

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
    (listActivityReplies as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    (listConversations as jest.Mock).mockResolvedValue({
      data: [],
      paging: {},
    });
  });

  it('shows loading while task data is pending', async () => {
    (listMyVisibleTasks as jest.Mock).mockReturnValueOnce(
      new Promise(() => undefined)
    );

    render(
      <ActivityFeedProvider>
        <DummyChildrenComponent />
      </ActivityFeedProvider>
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('uses the task API for open and closed task filters', async () => {
    const { rerender } = render(
      <ActivityFeedProvider>
        <DummyChildrenComponent />
      </ActivityFeedProvider>
    );

    await waitFor(() => expect(listMyVisibleTasks).toHaveBeenCalled());

    rerender(
      <ActivityFeedProvider>
        <DummyChildrenTaskCloseComponent />
      </ActivityFeedProvider>
    );

    await waitFor(() =>
      expect(listMyVisibleTasks).toHaveBeenCalledWith(
        expect.objectContaining({ after: 'after-234', statusGroup: 'closed' })
      )
    );
  });

  it('lists conversations through the conversation API', async () => {
    render(
      <ActivityFeedProvider>
        <DummyChildrenEntityComponent />
      </ActivityFeedProvider>
    );

    await waitFor(() =>
      expect(listConversations).toHaveBeenCalledWith(
        expect.objectContaining({ entityLink: '<#E::table::admin>' })
      )
    );
  });

  it('posts a conversation reply through the conversation API', async () => {
    (createConversationReply as jest.Mock).mockResolvedValue(activityReply);

    render(
      <ActivityFeedProvider>
        <DummyChildrenComponent />
      </ActivityFeedProvider>
    );
    fireEvent.click(await screen.findByTestId('post-feed'));

    await waitFor(() =>
      expect(createConversationReply).toHaveBeenCalledWith('123', {
        message: 'New Post Feed added',
      })
    );
  });

  it('deletes roots and replies through conversation routes', async () => {
    (deleteConversation as jest.Mock).mockResolvedValue({ id: '123' });
    const { rerender } = render(
      <ActivityFeedProvider>
        <DummyChildrenComponent />
      </ActivityFeedProvider>
    );
    fireEvent.click(await screen.findByTestId('delete-feed'));

    await waitFor(() => expect(deleteConversation).toHaveBeenCalledWith('123'));

    rerender(
      <ActivityFeedProvider>
        <DummyChildrenDeletePostComponent />
      </ActivityFeedProvider>
    );
    fireEvent.click(screen.getByTestId('delete-feed'));

    await waitFor(() =>
      expect(deleteConversationReply).toHaveBeenCalledWith('123', '456')
    );
  });

  it('fetches activity without issuing a conversation request', async () => {
    (getMyActivityFeed as jest.Mock).mockResolvedValue({
      data: [activity],
      paging: {},
    });

    render(
      <ActivityFeedProvider>
        <DummyActivityFeedComponent />
      </ActivityFeedProvider>
    );

    expect(await screen.findByTestId('activity-count')).toHaveTextContent('1');
    expect(listConversations).not.toHaveBeenCalled();
  });

  it('passes the active domain only to the activity endpoint', async () => {
    mockUseDomainStore.mockImplementation((selector) =>
      selector({ activeDomain: 'Engineering' })
    );

    render(
      <ActivityFeedProvider>
        <DummyEntityActivityFeedComponent />
      </ActivityFeedProvider>
    );

    await waitFor(() =>
      expect(getEntityActivityByFqn).toHaveBeenCalledWith(
        'table',
        'service.db.schema.table',
        expect.objectContaining({ domain: 'Engineering' })
      )
    );

    expect(listConversations).not.toHaveBeenCalled();
  });

  it('uses dedicated activity reaction routes', async () => {
    (addActivityReaction as jest.Mock).mockResolvedValue(activity);
    (removeActivityReaction as jest.Mock).mockResolvedValue(activity);

    render(
      <ActivityFeedProvider>
        <DummyActivityReactionComponent />
      </ActivityFeedProvider>
    );
    fireEvent.click(screen.getByTestId('add-reaction'));
    fireEvent.click(screen.getByTestId('remove-reaction'));

    await waitFor(() => {
      expect(addActivityReaction).toHaveBeenCalledWith(
        'activity-123',
        ReactionType.ThumbsUp
      );
      expect(removeActivityReaction).toHaveBeenCalledWith(
        'activity-123',
        ReactionType.ThumbsUp
      );
    });
  });

  describe('a first-page task fetch replaces the previous result set', () => {
    const renderTaskListState = () =>
      render(
        <ActivityFeedProvider>
          <DummyTaskListStateComponent />
        </ActivityFeedProvider>
      );

    it('clears the rows and the paging cursor before the new response lands', async () => {
      (listTasks as jest.Mock).mockResolvedValueOnce({
        data: [{ id: 'task-open', createdAt: 1 }],
        paging: { after: 'cursor-1' },
      });

      renderTaskListState();

      await act(async () => {
        fireEvent.click(screen.getByTestId('fetch-open'));
      });

      expect(screen.getByTestId('task-ids')).toHaveTextContent('task-open');
      expect(screen.getByTestId('paging-after')).toHaveTextContent('cursor-1');

      let resolveClosed!: (value: unknown) => void;
      (listTasks as jest.Mock).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveClosed = resolve;
        })
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('fetch-closed'));
      });

      // Leaving the open rows and `cursor-1` in place is what kept the previous
      // list on screen and let infinite scroll append the new query's next page
      // onto it using the old cursor.
      expect(screen.getByTestId('task-ids')).toBeEmptyDOMElement();
      expect(screen.getByTestId('paging-after')).toHaveTextContent('none');

      await act(async () => {
        resolveClosed({
          data: [{ id: 'task-closed', createdAt: 2 }],
          paging: { after: 'cursor-2' },
        });
      });

      expect(screen.getByTestId('task-ids')).toHaveTextContent('task-closed');
      expect(screen.getByTestId('paging-after')).toHaveTextContent('cursor-2');
    });

    it('ignores a response that resolves after a newer request started', async () => {
      let resolveFirst!: (value: unknown) => void;
      let resolveSecond!: (value: unknown) => void;

      (listTasks as jest.Mock)
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
        )
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
        );

      renderTaskListState();

      await act(async () => {
        fireEvent.click(screen.getByTestId('fetch-open'));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('fetch-closed'));
      });

      await act(async () => {
        resolveSecond({
          data: [{ id: 'task-closed', createdAt: 2 }],
          paging: { after: 'cursor-2' },
        });
      });
      await act(async () => {
        resolveFirst({
          data: [{ id: 'task-open', createdAt: 1 }],
          paging: { after: 'cursor-1' },
        });
      });

      await waitFor(() =>
        expect(screen.getByTestId('task-ids')).toHaveTextContent('task-closed')
      );

      expect(screen.getByTestId('paging-after')).toHaveTextContent('cursor-2');
    });
  });

  it('loads replies by ActivityEvent ID when an activity opens', async () => {
    (listActivityReplies as jest.Mock).mockResolvedValue({
      data: [activityReply],
      paging: { total: 1 },
    });

    render(
      <ActivityFeedProvider>
        <DummySetActiveActivityComponent activity={activity} />
      </ActivityFeedProvider>
    );
    fireEvent.click(screen.getByTestId('set-active'));

    await waitFor(() => {
      expect(listActivityReplies).toHaveBeenCalledWith(activity.id, {
        limit: 100,
      });
      expect(screen.getByTestId('activity-reply-count')).toHaveTextContent('1');
    });
  });

  it('posts the first activity reply exactly once and renders it once', async () => {
    (createActivityReply as jest.Mock).mockResolvedValue(activityReply);

    render(
      <ActivityFeedProvider>
        <DummyActivityCommentComponent activity={activity} />
      </ActivityFeedProvider>
    );
    fireEvent.click(screen.getByTestId('post-comment'));

    await waitFor(() =>
      expect(screen.getByTestId('reply-count')).toHaveTextContent('1')
    );

    expect(createActivityReply).toHaveBeenCalledTimes(1);
    expect(createActivityReply).toHaveBeenCalledWith(activity.id, {
      message: 'Test comment',
    });
    expect(listConversations).not.toHaveBeenCalled();
  });

  it('keeps a posted reply when the initial activity reply request resolves later', async () => {
    let resolveReplies!: (value: unknown) => void;
    (listActivityReplies as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveReplies = resolve;
      })
    );
    (createActivityReply as jest.Mock).mockResolvedValue(activityReply);

    render(
      <ActivityFeedProvider>
        <DummySetActiveActivityComponent activity={activity} />
        <DummyActivityCommentComponent activity={activity} />
      </ActivityFeedProvider>
    );
    fireEvent.click(screen.getByTestId('set-active'));
    await waitFor(() => expect(listActivityReplies).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('post-comment'));

    await waitFor(() =>
      expect(screen.getByTestId('activity-reply-count')).toHaveTextContent('1')
    );

    await act(async () => {
      resolveReplies({ data: [], paging: { total: 0 } });
    });

    expect(screen.getByTestId('activity-reply-count')).toHaveTextContent('1');
  });

  it('uses the same single POST for subsequent activity replies', async () => {
    (listActivityReplies as jest.Mock).mockResolvedValue({
      data: [activityReply],
      paging: { total: 1 },
    });
    (createActivityReply as jest.Mock).mockResolvedValue({
      ...activityReply,
      id: 'reply-2',
    });

    render(
      <ActivityFeedProvider>
        <DummySetActiveActivityComponent activity={activity} />
        <DummyActivityCommentComponent activity={activity} />
      </ActivityFeedProvider>
    );
    fireEvent.click(screen.getByTestId('set-active'));
    await waitFor(() =>
      expect(screen.getByTestId('activity-reply-count')).toHaveTextContent('1')
    );
    fireEvent.click(screen.getByTestId('post-comment'));

    await waitFor(() =>
      expect(screen.getByTestId('activity-reply-count')).toHaveTextContent('2')
    );

    expect(createActivityReply).toHaveBeenCalledTimes(1);
    expect(createActivityReply).toHaveBeenCalledWith(activity.id, {
      message: 'Test comment',
    });
  });

  it('updates an activity reply in place after the drawer becomes active', async () => {
    (listActivityReplies as jest.Mock).mockResolvedValue({
      data: [activityReply],
      paging: { total: 1 },
    });
    (patchConversationReply as jest.Mock).mockResolvedValue({
      ...activityReply,
      message: 'Edited comment',
    });

    render(
      <ActivityFeedProvider>
        <DummySetActiveActivityComponent activity={activity} />
        <DummyActivityReplyEditComponent activity={activity} />
      </ActivityFeedProvider>
    );
    fireEvent.click(screen.getByTestId('set-active'));
    await waitFor(() =>
      expect(screen.getByTestId('activity-reply-messages')).toHaveTextContent(
        'Test comment'
      )
    );
    fireEvent.click(screen.getByTestId('edit-activity-reply'));

    await waitFor(() => {
      expect(patchConversationReply).toHaveBeenCalledWith(
        activity.id,
        activityReply.id,
        [{ op: 'replace', path: '/message', value: 'Edited comment' }]
      );
    });
  });

  describe('Activity requests', () => {
    it('shows loading while an activity request is pending', () => {
      (getMyActivityFeed as jest.Mock).mockReturnValueOnce(
        new Promise(() => undefined)
      );

      render(
        <ActivityFeedProvider>
          <DummyActivityFeedComponent />
        </ActivityFeedProvider>
      );

      expect(screen.getByTestId('activity-loading')).toBeInTheDocument();
    });

    it('fetches and displays the following activity feed', async () => {
      (getFollowingActivityFeed as jest.Mock).mockResolvedValueOnce({
        data: [activity],
        paging: {},
      });

      await act(async () => {
        render(
          <ActivityFeedProvider>
            <DummyFollowingActivityComponent />
          </ActivityFeedProvider>
        );
      });

      await waitFor(() =>
        expect(getFollowingActivityFeed).toHaveBeenCalledWith({
          days: 7,
          limit: 20,
        })
      );

      expect(screen.getByTestId('following-activity-count')).toHaveTextContent(
        '1'
      );
      expect(
        screen.getByTestId('following-activity-summary')
      ).toHaveTextContent('Updated tags');
    });

    it('does not hand-roll the domain on the following activity request', async () => {
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

      await waitFor(() =>
        expect(getFollowingActivityFeed).toHaveBeenCalledWith({
          days: 7,
          limit: 20,
        })
      );

      expect(getFollowingActivityFeed).not.toHaveBeenCalledWith(
        expect.objectContaining({ domain: expect.anything() })
      );
    });

    it('does not hand-roll the domain on the all-activity request', async () => {
      mockUseDomainStore.mockImplementation((selector) =>
        selector({ activeDomain: 'finance' })
      );

      render(
        <ActivityFeedProvider>
          <DummyActivityFilterSwitchComponent />
        </ActivityFeedProvider>
      );
      fireEvent.click(screen.getByTestId('fetch-all'));

      await waitFor(() =>
        expect(getActivityEvents).toHaveBeenCalledWith({ limit: 20 })
      );

      expect(getActivityEvents).not.toHaveBeenCalledWith(
        expect.objectContaining({ domain: expect.anything() })
      );
    });

    it('shows an error toast when an activity request fails', async () => {
      const error = new Error('activity request failed');
      (getFollowingActivityFeed as jest.Mock).mockRejectedValueOnce(error);

      render(
        <ActivityFeedProvider>
          <DummyFollowingActivityComponent />
        </ActivityFeedProvider>
      );

      await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));
    });

    it('should ignore a superseded activity response when the filter changes', async () => {
      let resolveSlowRequest!: (value: unknown) => void;
      (getMyActivityFeed as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSlowRequest = resolve;
          })
      );
      (getFollowingActivityFeed as jest.Mock).mockResolvedValueOnce({
        data: [activity],
        paging: {},
      });

      render(
        <ActivityFeedProvider>
          <DummyActivityFilterSwitchComponent />
        </ActivityFeedProvider>
      );

      fireEvent.click(screen.getByTestId('fetch-owner'));
      fireEvent.click(screen.getByTestId('fetch-following'));

      await waitFor(() =>
        expect(screen.getByTestId('activity-summaries')).toHaveTextContent(
          'Updated tags'
        )
      );

      await act(async () => {
        resolveSlowRequest({
          data: [{ ...activity, summary: 'Stale result' }],
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

  it('syncs the selected activity when its reaction changes', async () => {
    (getMyActivityFeed as jest.Mock).mockResolvedValueOnce({
      data: [activity],
      paging: {},
    });
    (addActivityReaction as jest.Mock).mockResolvedValueOnce({
      ...activity,
      reactions: [
        {
          reactionType: ReactionType.ThumbsUp,
          user: { id: 'user-1', type: 'user' },
        },
      ],
    });

    render(
      <ActivityFeedProvider>
        <DummyActivityReactionSyncComponent />
      </ActivityFeedProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('select-activity')).toBeEnabled()
    );
    fireEvent.click(screen.getByTestId('select-activity'));

    await waitFor(() =>
      expect(
        screen.getByTestId('selected-activity-reactions')
      ).toHaveTextContent('0')
    );

    fireEvent.click(screen.getByTestId('react'));

    await waitFor(() =>
      expect(
        screen.getByTestId('selected-activity-reactions')
      ).toHaveTextContent('1')
    );
  });

  it('clears the selected activity and replies when set to undefined', async () => {
    (listActivityReplies as jest.Mock).mockResolvedValueOnce({
      data: [activityReply],
      paging: { total: 1 },
    });

    const { rerender } = render(
      <ActivityFeedProvider>
        <DummySetActiveActivityComponent activity={activity} />
      </ActivityFeedProvider>
    );
    fireEvent.click(screen.getByTestId('set-active'));

    await waitFor(() =>
      expect(screen.getByTestId('activity-reply-count')).toHaveTextContent('1')
    );

    rerender(
      <ActivityFeedProvider>
        <DummySetActiveActivityComponent activity={undefined} />
      </ActivityFeedProvider>
    );
    fireEvent.click(screen.getByTestId('set-active'));

    await waitFor(() => {
      expect(screen.getByTestId('selected-activity-id')).toHaveTextContent(
        'none'
      );
      expect(screen.getByTestId('activity-reply-count')).toHaveTextContent('0');
    });
  });
});
