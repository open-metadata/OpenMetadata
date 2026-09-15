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
import { MemoryRouter } from 'react-router-dom';
import {
  ActivityEvent,
  ActivityEventType,
} from '../../../generated/entity/activity/activityEvent';
import {
  Conversation,
  ConversationReply,
  ConversationSource,
} from '../../../generated/entity/feed/conversation';
import ActivityFeedCardNew from './ActivityFeedcardNew.component';

const mockProviderValue = {
  activityReplies: [] as ConversationReply[],
  isPostsLoading: false,
  postActivityComment: jest.fn(),
  postFeed: jest.fn(),
  selectedThread: undefined,
  updateFeed: jest.fn(),
};

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: { id: 'author-id', name: 'alice' },
  }),
}));

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => [false, undefined, { id: 'author-id', name: 'alice' }],
}));

jest.mock('../../../utils/FeedUtils', () => ({
  getActivityEventHeaderText: jest.fn(() => 'updated description'),
}));

jest.mock('../ActivityFeedProvider/ActivityFeedProvider', () => ({
  useActivityFeedProvider: () => mockProviderValue,
}));

jest.mock('../ActivityFeedCard/FeedCardBody/FeedCardBodyNew', () =>
  jest.fn(({ message }) => <div data-testid="feed-body">{message}</div>)
);

jest.mock('../ActivityFeedCardV2/FeedCardFooter/FeedCardFooterNew', () =>
  jest.fn(() => <div data-testid="conversation-reaction-footer" />)
);

jest.mock('../ActivityFeedCardV2/FeedCardFooter/ActivityEventFooter', () =>
  jest.fn(() => <div data-testid="activity-footer" />)
);

jest.mock('../Shared/ActivityFeedActions', () =>
  jest.fn(() => <div data-testid="conversation-root-actions" />)
);

jest.mock('./CommentCard.component', () =>
  jest.fn(({ reply }) => (
    <div data-testid="feed-reply-card">{reply.message}</div>
  ))
);

jest.mock('../../common/PopOverCard/EntityPopOverCard', () =>
  jest.fn(({ children }) => <>{children}</>)
);

jest.mock('../../common/PopOverCard/UserPopOverCard', () =>
  jest.fn(({ children }) => <>{children}</>)
);

jest.mock('../../common/ProfilePicture/ProfilePicture', () =>
  jest.fn(() => <div data-testid="profile-picture" />)
);

jest.mock('../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: { getEntityIcon: jest.fn() },
}));

jest.mock('../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: { getEntityLink: () => '/table/service.table' },
}));

const conversation: Conversation = {
  id: 'conversation-1',
  about: '<#E::table::service.table>',
  createdAt: 1,
  createdBy: { id: 'author-id', type: 'user', name: 'alice' },
  entityRef: {
    id: 'table-id',
    type: 'table',
    name: 'table',
    fullyQualifiedName: 'service.table',
  },
  message: 'Root message',
  replyCount: 0,
  resolved: false,
  source: ConversationSource.User,
  updatedAt: 1,
};

const activity: ActivityEvent = {
  entity: {
    id: 'table-id',
    type: 'table',
    name: 'table',
    fullyQualifiedName: 'service.table',
  },
  eventType: ActivityEventType.DescriptionUpdated,
  id: 'activity-1',
  summary: 'Description updated',
  timestamp: 1,
};

const activityReply: ConversationReply = {
  author: { id: 'author-id', type: 'user', name: 'alice' },
  conversationId: 'activity-1',
  createdAt: 2,
  id: 'reply-1',
  message: 'Activity reply',
  updatedAt: 2,
};

describe('ActivityFeedCardNew', () => {
  beforeEach(() => {
    mockProviderValue.activityReplies = [];
  });

  it('keeps root reactions and management actions available in the drawer', () => {
    render(
      <MemoryRouter>
        <ActivityFeedCardNew isOpenInDrawer showThread feed={conversation} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('conversation-reaction-footer')).toBeVisible();
    expect(screen.queryByTestId('conversation-root-actions')).toBeNull();

    fireEvent.mouseEnter(screen.getByTestId('feed-card-v2-sidebar'));

    expect(screen.getByTestId('conversation-root-actions')).toBeVisible();
  });

  it('renders activity replies in the open side panel', () => {
    mockProviderValue.activityReplies = [activityReply];

    render(
      <MemoryRouter>
        <ActivityFeedCardNew isOpenInDrawer activity={activity} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('feed-reply-card')).toHaveTextContent(
      activityReply.message
    );
  });
});
