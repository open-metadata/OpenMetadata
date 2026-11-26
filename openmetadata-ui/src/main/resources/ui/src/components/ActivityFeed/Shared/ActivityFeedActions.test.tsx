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
import {
  Conversation,
  ConversationReply,
  ConversationSource,
} from '../../../generated/entity/feed/conversation';
import ActivityFeedActions from './ActivityFeedActions';

const mockDeleteFeed = jest.fn().mockResolvedValue(undefined);
const mockHideDrawer = jest.fn();
const mockUseApplicationStore = jest.fn();

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => mockUseApplicationStore(),
}));

jest.mock('../ActivityFeedProvider/ActivityFeedProvider', () => ({
  useActivityFeedProvider: () => ({
    deleteFeed: mockDeleteFeed,
    hideDrawer: mockHideDrawer,
  }),
}));

jest.mock('../../Modals/ConfirmationModal/ConfirmationModal', () =>
  jest.fn(({ visible, onCancel, onConfirm }) =>
    visible ? (
      <div data-testid="confirmation-modal">
        <button data-testid="cancel-delete" onClick={onCancel}>
          Cancel
        </button>
        <button data-testid="confirm-delete" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    ) : null
  )
);

const conversation: Conversation = {
  id: 'conversation-1',
  about: '<#E::table::service.table>',
  createdAt: 1,
  createdBy: { id: 'author-id', type: 'user', name: 'alice' },
  entityRef: { id: 'table-id', type: 'table', name: 'table' },
  message: 'Root',
  replyCount: 1,
  resolved: false,
  source: ConversationSource.User,
  updatedAt: 1,
};

const reply: ConversationReply = {
  id: 'reply-1',
  conversationId: conversation.id,
  author: { id: 'author-id', type: 'user', name: 'alice' },
  createdAt: 2,
  message: 'Reply',
  updatedAt: 2,
};

const openMenu = () =>
  fireEvent.click(screen.getByTestId('conversation-actions'));

const getMenuLabels = async () =>
  (await screen.findAllByRole('menuitem')).map((item) => item.textContent);

const selectAction = async (name: string) => {
  openMenu();
  fireEvent.click(await screen.findByRole('menuitem', { name }));
};

describe('ActivityFeedActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseApplicationStore.mockReturnValue({
      currentUser: { id: 'author-id', name: 'alice', isAdmin: false },
    });
  });

  it('offers only Edit and Delete for a conversation', async () => {
    const onEditPost = jest.fn();

    render(
      <ActivityFeedActions
        conversation={conversation}
        conversationId={conversation.id}
        isReply={false}
        onEditPost={onEditPost}
      />
    );
    openMenu();

    expect(await getMenuLabels()).toEqual(['label.edit', 'label.delete']);

    fireEvent.click(screen.getByRole('menuitem', { name: 'label.edit' }));

    expect(onEditPost).toHaveBeenCalled();
  });

  it('offers Edit and Delete to a reply author', async () => {
    render(
      <ActivityFeedActions
        isReply
        conversation={conversation}
        conversationId={conversation.id}
        reply={reply}
      />
    );
    openMenu();

    expect(await getMenuLabels()).toEqual(['label.edit', 'label.delete']);
  });

  it('renders no menu when the user may not act on the post', () => {
    mockUseApplicationStore.mockReturnValue({
      currentUser: { id: 'other-id', name: 'bob', isAdmin: false },
    });

    render(
      <ActivityFeedActions
        isReply
        conversationId={conversation.id}
        reply={reply}
      />
    );

    expect(
      screen.queryByTestId('conversation-actions')
    ).not.toBeInTheDocument();
  });

  it('allows an administrator to edit and delete another users reply', async () => {
    mockUseApplicationStore.mockReturnValue({
      currentUser: { id: 'admin-id', name: 'admin', isAdmin: true },
    });

    render(
      <ActivityFeedActions
        isReply
        conversationId={conversation.id}
        reply={reply}
      />
    );
    openMenu();

    expect(await getMenuLabels()).toEqual(['label.edit', 'label.delete']);
  });

  it('honours canEdit and canDelete independently of the author rule', async () => {
    mockUseApplicationStore.mockReturnValue({
      currentUser: { id: 'other-id', name: 'bob', isAdmin: false },
    });

    render(
      <ActivityFeedActions
        canDelete
        isReply
        canEdit={false}
        conversationId={conversation.id}
        reply={reply}
      />
    );
    openMenu();

    expect(await getMenuLabels()).toEqual(['label.delete']);
  });

  it('places the menu trigger with the class handed down by the owning card', () => {
    render(
      <ActivityFeedActions
        isReply
        className="tw:absolute"
        conversationId={conversation.id}
        reply={reply}
      />
    );

    expect(screen.getByTestId('conversation-actions')).toHaveClass(
      'tw:absolute'
    );
  });

  it('deletes a reply by conversation and reply id after confirmation', async () => {
    render(
      <ActivityFeedActions
        isReply
        conversationId={conversation.id}
        reply={reply}
      />
    );
    await selectAction('label.delete');
    fireEvent.click(screen.getByTestId('confirm-delete'));

    expect(mockDeleteFeed).toHaveBeenCalledWith(
      conversation.id,
      reply.id,
      false
    );
    expect(mockHideDrawer).not.toHaveBeenCalled();
  });

  it('deletes a user conversation root and closes the drawer', async () => {
    render(
      <ActivityFeedActions
        conversation={conversation}
        conversationId={conversation.id}
        isReply={false}
      />
    );
    await selectAction('label.delete');
    fireEvent.click(screen.getByTestId('confirm-delete'));

    expect(mockDeleteFeed).toHaveBeenCalledWith(
      conversation.id,
      conversation.id,
      true
    );
    expect(mockHideDrawer).toHaveBeenCalled();
  });

  it('calls onDelete instead of the feed provider when one is supplied', async () => {
    const onDelete = jest.fn();

    render(<ActivityFeedActions canDelete isReply onDelete={onDelete} />);
    await selectAction('label.delete');
    fireEvent.click(screen.getByTestId('confirm-delete'));

    expect(onDelete).toHaveBeenCalled();
    expect(mockDeleteFeed).not.toHaveBeenCalled();
  });

  it('does not fire a second delete while one is in flight', async () => {
    let settle: () => void = () => undefined;
    const onDelete = jest.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        settle = resolve;
      })
    );

    render(<ActivityFeedActions canDelete isReply onDelete={onDelete} />);
    await selectAction('label.delete');

    // Double click while the request is still outstanding. Without the guard
    // the second click deletes again and 404s against the missing comment.
    fireEvent.click(screen.getByTestId('confirm-delete'));
    fireEvent.click(screen.getByTestId('confirm-delete'));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    settle();
  });

  it('keeps the confirmation open when onDelete rejects', async () => {
    const onDelete = jest.fn().mockRejectedValue(new Error('boom'));

    render(<ActivityFeedActions canDelete isReply onDelete={onDelete} />);
    await selectAction('label.delete');
    fireEvent.click(screen.getByTestId('confirm-delete'));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalled();
    });

    // Closing here would look like the delete had gone through.
    expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
  });

  it('closes the confirmation without deleting', async () => {
    render(
      <ActivityFeedActions
        isReply
        conversationId={conversation.id}
        reply={reply}
      />
    );
    await selectAction('label.delete');
    fireEvent.click(screen.getByTestId('cancel-delete'));

    expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
    expect(mockDeleteFeed).not.toHaveBeenCalled();
  });
});
