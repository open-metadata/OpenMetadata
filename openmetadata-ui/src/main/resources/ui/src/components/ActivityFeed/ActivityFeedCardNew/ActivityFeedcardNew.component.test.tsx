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
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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

// CommentCard and ActivityFeedActions are deliberately NOT mocked: the point
// of these tests is that a user can actually edit, delete and react through
// the rendered reply. Only true boundaries are stubbed below - the Quill
// editor, the tiptap-backed previewer, the emoji element and the lazily
// imported confirmation modal.
jest.mock('../../common/RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest.fn(({ markdown }) => <div data-testid="reply-message">{markdown}</div>)
);

jest.mock('../ActivityFeedEditor/ActivityFeedEditorNew', () =>
  jest.fn(({ onSave, onTextChange }) => (
    <div data-testid="reply-editor">
      <input
        aria-label="edit"
        data-testid="reply-editor-input"
        onChange={(e) => onTextChange?.(e.target.value)}
      />
      <button data-testid="reply-editor-save" onClick={() => onSave?.()}>
        save
      </button>
    </div>
  ))
);

jest.mock('../Reactions/Reactions', () =>
  jest.fn(({ onReactionSelect }) => (
    <button
      data-testid="reply-reactions"
      onClick={() =>
        onReactionSelect(ReactionType.ThumbsUp, ReactionOperation.ADD)
      }>
      react
    </button>
  ))
);

jest.mock('../../Modals/ConfirmationModal/ConfirmationModal', () =>
  jest.fn(({ visible, onConfirm }) =>
    visible ? (
      <button data-testid="confirm-delete" onClick={onConfirm}>
        confirm
      </button>
    ) : null
  )
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
    expect(screen.getByTestId('feed-actions')).toBeVisible();
    expect(screen.getByTestId('edit-message')).toBeVisible();

    fireEvent.mouseEnter(screen.getByTestId('feed-card-v2-sidebar'));

    expect(screen.getByTestId('feed-actions')).toBeVisible();
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

  describe('reply actions', () => {
    // Drives the real CommentCard / ActivityFeedActions the user sees, and
    // asserts what the feed provider is asked to do as a result.
    const renderReply = () => {
      mockProviderValue.activityReplies = [activityReply];

      render(
        <MemoryRouter>
          <ActivityFeedCardNew isOpenInDrawer activity={activity} />
        </MemoryRouter>
      );

      return within(screen.getByTestId('feed-reply-card'));
    };

    it('offers edit and delete on the authors own reply', () => {
      const reply = renderReply();

      expect(reply.getByTestId('edit-message')).toBeInTheDocument();
      expect(reply.getByTestId('delete-message')).toBeInTheDocument();
    });

    it('patches the reply through updateFeed when the user saves an edit', async () => {
      const reply = renderReply();

      fireEvent.click(reply.getByTestId('edit-message'));

      const editor = await reply.findByTestId('reply-editor');
      fireEvent.change(within(editor).getByTestId('reply-editor-input'), {
        target: { value: 'edited' },
      });
      fireEvent.click(within(editor).getByTestId('reply-editor-save'));

      await waitFor(() => {
        expect(mockProviderValue.updateFeed).toHaveBeenCalledWith(
          activity.id,
          activityReply.id,
          false,
          [{ op: 'replace', path: '/message', value: 'edited' }]
        );
      });
    });

    it('removes the reply through deleteFeed when the user confirms', async () => {
      const reply = renderReply();

      fireEvent.click(reply.getByTestId('delete-message'));
      fireEvent.click(await screen.findByTestId('confirm-delete'));

      await waitFor(() => {
        expect(mockProviderValue.deleteFeed).toHaveBeenCalledWith(
          activity.id,
          activityReply.id,
          false
        );
      });
    });

    it('forwards a reaction on the reply to updateReactions', async () => {
      const reply = renderReply();

      fireEvent.click(reply.getByTestId('reply-reactions'));

      await waitFor(() => {
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
});
