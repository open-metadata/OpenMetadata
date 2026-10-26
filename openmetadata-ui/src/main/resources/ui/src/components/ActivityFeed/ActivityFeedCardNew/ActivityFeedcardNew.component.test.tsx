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
  jest.fn(({ focused, onSave, onTextChange }) => (
    <div data-focused={String(Boolean(focused))} data-testid="reply-editor">
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

jest.mock('../../common/CommentComposer/CommentComposer', () =>
  jest.fn(({ onSave, placeHolder }) => (
    <button data-testid="thread-composer" onClick={() => onSave('hi')}>
      {placeHolder}
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
  default: {
    getEntityLink: jest.fn((type: string, fqn: string) => `/${type}/${fqn}`),
  },
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

  it('keeps root reactions and the actions menu available in the drawer', () => {
    render(
      <MemoryRouter>
        <ActivityFeedCardNew isOpenInDrawer showThread feed={conversation} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('conversation-reaction-footer')).toBeVisible();
    expect(screen.getByTestId('conversation-actions')).toBeVisible();
  });

  // FeedEditor no longer focuses itself on mount, so an editor revealed by a
  // click must ask for focus, or the user clicks twice before typing.
  it('focuses the comment editor its placeholder reveals', async () => {
    render(
      <MemoryRouter>
        <ActivityFeedCardNew isOpenInDrawer showThread feed={conversation} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('comments-input-field'));

    expect(await screen.findByTestId('reply-editor')).toHaveAttribute(
      'data-focused',
      'true'
    );
  });

  it('names the field a conversation was started on after the entity', () => {
    render(
      <MemoryRouter>
        <ActivityFeedCardNew
          showThread
          feed={{
            ...conversation,
            about: '<#E::table::service.table::columns::category::description>',
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('entity-link')).toHaveTextContent('table');
    expect(screen.getByTestId('feed-field-path-column')).toHaveAttribute(
      'href',
      '/table/service.table.category'
    );
    expect(screen.getByTestId('feed-field-path-field')).toHaveTextContent(
      'label.description'
    );
  });

  it('names the column, not the field again, for a column-level activity event', () => {
    render(
      <MemoryRouter>
        <ActivityFeedCardNew
          activity={{
            ...activity,
            about: '<#E::table::service.table::columns::category::description>',
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('feed-field-path-column')).toHaveTextContent(
      'category'
    );
    expect(
      screen.queryByTestId('feed-field-path-field')
    ).not.toBeInTheDocument();
  });

  it('shows no field path for a conversation on the entity itself', () => {
    render(
      <MemoryRouter>
        <ActivityFeedCardNew showThread feed={conversation} />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('feed-field-path')).not.toBeInTheDocument();
  });

  it('falls back to the activity entity when the event carries no about link', () => {
    // `about` is optional on an activity event, and the EntityLink accessors
    // answer '' for a missing link rather than undefined. Reading them with
    // `??` would keep that '' and never reach `activity.entity`, leaving the
    // header pointing at `//` with no entity name.
    render(
      <MemoryRouter>
        <ActivityFeedCardNew isOpenInDrawer activity={activity} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('entity-link')).toHaveAttribute(
      'href',
      '/table/service.table'
    );
  });

  it('reads an activity event entity from its reference without an ANTLR error', () => {
    // The server appends whatever field changed to `about`; `entityStatus` is
    // not in the EntityLink grammar, so parsing it logged an ANTLR error
    // ("no viable alternative at input '::entityStatus'") on every render.
    const errorSpy = jest.spyOn(console, 'error');

    render(
      <MemoryRouter>
        <ActivityFeedCardNew
          isOpenInDrawer
          activity={{
            ...activity,
            about: '<#E::table::service.table::entityStatus>',
            fieldName: 'entityStatus',
          }}
        />
      </MemoryRouter>
    );

    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('no viable alternative')
    );
    expect(screen.getByTestId('entity-link')).toHaveAttribute(
      'href',
      '/table/service.table'
    );

    errorSpy.mockRestore();
  });

  it('reads an activity-sourced conversation entity from its reference without an ANTLR error', () => {
    // The server copies the activity's `about` (with the changed field) into
    // the conversation it creates from it.
    const errorSpy = jest.spyOn(console, 'error');

    render(
      <MemoryRouter>
        <ActivityFeedCardNew
          isOpenInDrawer
          showThread
          feed={{
            ...conversation,
            about: '<#E::table::service.table::entityStatus>',
            source: ConversationSource.Activity,
          }}
        />
      </MemoryRouter>
    );

    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('no viable alternative')
    );
    expect(screen.getByTestId('entity-link')).toHaveAttribute(
      'href',
      '/table/service.table'
    );

    errorSpy.mockRestore();
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

    // The menu opens in a popover outside the reply card.
    const chooseReplyAction = async (
      reply: ReturnType<typeof renderReply>,
      name: string
    ) => {
      fireEvent.click(reply.getByTestId('conversation-actions'));
      fireEvent.click(await screen.findByRole('menuitem', { name }));
    };

    it('offers edit and delete on the authors own reply', async () => {
      const reply = renderReply();

      fireEvent.click(reply.getByTestId('conversation-actions'));

      expect(
        (await screen.findAllByRole('menuitem')).map((item) => item.textContent)
      ).toEqual(['label.edit', 'label.delete']);
    });

    it('patches the reply through updateFeed when the user saves an edit', async () => {
      const reply = renderReply();

      await chooseReplyAction(reply, 'label.edit');

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

      await chooseReplyAction(reply, 'label.delete');
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

  it.each([
    ['an entity Activity tab list', {}],
    ['an activity thread panel', { isThreadPanel: true }],
  ])(
    'puts only Edit and Delete in the conversation menu in %s',
    async (_surface, props) => {
      render(
        <MemoryRouter>
          <ActivityFeedCardNew feed={conversation} {...props} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('conversation-actions'));

      expect(
        (await screen.findAllByRole('menuitem')).map((item) => item.textContent)
      ).toEqual(['label.edit', 'label.delete']);
    }
  );

  it('keeps no menu and no header room for it on a conversation the user cannot manage', () => {
    const { container, rerender } = render(
      <MemoryRouter>
        <ActivityFeedCardNew feed={conversation} />
      </MemoryRouter>
    );

    expect(container.querySelector('.tw\\:pe-8')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ActivityFeedCardNew
          feed={{
            ...conversation,
            createdBy: { id: 'other-id', type: 'user', name: 'bob' },
          }}
        />
      </MemoryRouter>
    );

    expect(
      screen.queryByTestId('conversation-actions')
    ).not.toBeInTheDocument();
    expect(container.querySelector('.tw\\:pe-8')).not.toBeInTheDocument();
  });

  it('drops the "conversation" label only in the activity thread panel', () => {
    const { rerender } = render(
      <MemoryRouter>
        <ActivityFeedCardNew feed={conversation} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('headerText')).toHaveTextContent(
      'label.conversation-lowercase'
    );

    rerender(
      <MemoryRouter>
        <ActivityFeedCardNew isThreadPanel feed={conversation} />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('headerText')).not.toBeInTheDocument();
    expect(screen.getByTestId('entity-link')).toBeInTheDocument();
  });

  it('shows the replies above an open composer in the activity thread panel', async () => {
    render(
      <MemoryRouter>
        <ActivityFeedCardNew
          isOpenInDrawer
          isThreadPanel
          showThread
          feed={{
            ...conversation,
            replies: [
              {
                ...activityReply,
                id: 'newer',
                createdAt: 20,
                message: 'Newer',
              },
              {
                ...activityReply,
                id: 'older',
                createdAt: 10,
                message: 'Older',
              },
            ],
          }}
        />
      </MemoryRouter>
    );

    const composer = await screen.findByTestId('thread-composer');

    expect(composer).toHaveTextContent('label.reply-in-conversation');
    expect(
      screen.queryByTestId('comments-input-field')
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByTestId('reply-message').map((reply) => reply.textContent)
    ).toEqual(['Older', 'Newer']);

    mockProviderValue.postFeed.mockResolvedValueOnce(undefined);
    fireEvent.click(composer);

    expect(mockProviderValue.postFeed).toHaveBeenCalledWith('hi', '');
  });
});
