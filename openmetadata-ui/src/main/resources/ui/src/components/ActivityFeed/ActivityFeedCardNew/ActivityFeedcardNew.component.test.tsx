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
import { ReactionOperation } from '../../../enums/reactions.enum';
import {
  ActivityEvent,
  ActivityEventType,
} from '../../../generated/entity/activity/activityEvent';
import {
  Conversation,
  ConversationReply,
  ConversationSource,
} from '../../../generated/entity/feed/conversation';
import { ReactionType } from '../../../generated/type/reaction';
import ActivityFeedCardNew from './ActivityFeedcardNew.component';

const mockProviderValue = {
  activityReplies: [] as ConversationReply[],
  isPostsLoading: false,
  postActivityComment: jest.fn(),
  postFeed: jest.fn(),
  selectedThread: undefined,
  updateFeed: jest.fn(),
  deleteFeed: jest.fn(),
  updateReactions: jest.fn(),
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

const mockActivityFeedActionsProps: Record<string, string>[] = [];
jest.mock('../Shared/ActivityFeedActions', () =>
  jest.fn((props) => {
    mockActivityFeedActionsProps.push(props);

    return <div data-testid="conversation-root-actions" />;
  })
);

const mockCommentCardProps: Record<string, unknown>[] = [];
jest.mock('./CommentCard.component', () =>
  jest.fn((props) => {
    mockCommentCardProps.push(props);

    return <div data-testid="feed-reply-card">{props.message}</div>;
  })
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
    jest.clearAllMocks();
    mockProviderValue.activityReplies = [];
    mockCommentCardProps.length = 0;
    mockActivityFeedActionsProps.length = 0;
  });

  it('keeps root reactions and management actions available in the drawer', () => {
    render(
      <MemoryRouter>
        <ActivityFeedCardNew isOpenInDrawer showThread feed={conversation} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('conversation-reaction-footer')).toBeVisible();

    // Mounted before any pointer interaction: hiding these behind a hover
    // state put them out of reach of the keyboard and of screen readers. The
    // hover reveal is presentational, applied by CSS on the owning card.
    expect(screen.getByTestId('conversation-root-actions')).toBeVisible();

    fireEvent.mouseEnter(screen.getByTestId('feed-card-v2-sidebar'));

    expect(screen.getByTestId('conversation-root-actions')).toBeVisible();
  });

  it('hands the card-scoped hover reveal to the root actions', () => {
    render(
      <MemoryRouter>
        <ActivityFeedCardNew isOpenInDrawer showThread feed={conversation} />
      </MemoryRouter>
    );

    // Named group, not a bare `tw:group`: a conversation card contains its
    // reply cards, so an unnamed one would reveal every reply's actions at
    // once when the conversation is hovered.
    expect(screen.getByTestId('feed-card-v2-sidebar').className).toContain(
      'tw:group/feed-card'
    );
    expect(mockActivityFeedActionsProps.at(-1)?.className).toContain(
      'tw:group-hover/feed-card:opacity-100'
    );
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

  describe('reply wiring', () => {
    const renderWithReply = () => {
      mockProviderValue.activityReplies = [activityReply];

      render(
        <MemoryRouter>
          <ActivityFeedCardNew isOpenInDrawer activity={activity} />
        </MemoryRouter>
      );

      return mockCommentCardProps[mockCommentCardProps.length - 1];
    };

    it('grants edit and delete to the reply author', () => {
      expect(renderWithReply()).toEqual(
        expect.objectContaining({ canDelete: true, canEdit: true })
      );
    });

    it('patches the reply through updateFeed on edit', async () => {
      const props = renderWithReply();

      await (props.onEdit as (message: string) => Promise<void>)('edited');

      expect(mockProviderValue.updateFeed).toHaveBeenCalledWith(
        activity.id,
        activityReply.id,
        false,
        [{ op: 'replace', path: '/message', value: 'edited' }]
      );
    });

    it('removes the reply through deleteFeed on delete', async () => {
      const props = renderWithReply();

      await (props.onDelete as () => Promise<void>)();

      expect(mockProviderValue.deleteFeed).toHaveBeenCalledWith(
        activity.id,
        activityReply.id,
        false
      );
    });

    it('forwards reactions to updateReactions', async () => {
      const props = renderWithReply();

      await (
        props.onReaction as (
          type: ReactionType,
          operation: ReactionOperation
        ) => Promise<void>
      )(ReactionType.ThumbsUp, ReactionOperation.ADD);

      expect(mockProviderValue.updateReactions).toHaveBeenCalledWith(
        activityReply,
        activity.id,
        false,
        ReactionType.ThumbsUp,
        ReactionOperation.ADD
      );
    });
  });
});
