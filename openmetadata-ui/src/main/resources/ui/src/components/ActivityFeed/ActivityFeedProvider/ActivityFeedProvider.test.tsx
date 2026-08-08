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
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import { ReactionType } from '../../../generated/type/reaction';
import { mockUserData } from '../../../mocks/MyDataPage.mock';
import {
  addActivityReaction,
  createActivityReply,
  getEntityActivityByFqn,
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
import { listMyVisibleTasks } from '../../../rest/tasksAPI';
import ActivityFeedProvider from './ActivityFeedProvider';
import {
  DummyActivityCommentComponent,
  DummyActivityFeedComponent,
  DummyActivityReactionComponent,
  DummyActivityReplyEditComponent,
  DummyChildrenComponent,
  DummyChildrenDeletePostComponent,
  DummyChildrenEntityComponent,
  DummyChildrenTaskCloseComponent,
  DummyEntityActivityFeedComponent,
  DummySetActiveActivityComponent,
} from './DummyTestComponent';

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
  addActivityReaction: jest.fn(),
  createActivityReply: jest.fn(),
  getActivityEvents: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  getEntityActivityByFqn: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  getMyActivityFeed: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  getUserActivity: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  listActivityReplies: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
  removeActivityReaction: jest.fn(),
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
      expect(screen.getByTestId('activity-reply-messages')).toHaveTextContent(
        'Edited comment'
      );
    });
  });
});
