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
const mockShowDrawer = jest.fn();
const mockUpdateEditorFocus = jest.fn();
const mockUpdateFeed = jest.fn();
const mockUseApplicationStore = jest.fn();

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => mockUseApplicationStore(),
}));

jest.mock('../ActivityFeedProvider/ActivityFeedProvider', () => ({
  useActivityFeedProvider: () => ({
    deleteFeed: mockDeleteFeed,
    hideDrawer: mockHideDrawer,
    showDrawer: mockShowDrawer,
    updateEditorFocus: mockUpdateEditorFocus,
    updateFeed: mockUpdateFeed,
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

describe('ActivityFeedActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseApplicationStore.mockReturnValue({
      currentUser: { id: 'author-id', name: 'alice', isAdmin: false },
    });
  });

  it('shows edit and delete actions to a reply author', () => {
    render(
      <ActivityFeedActions
        isReply
        conversation={conversation}
        conversationId={conversation.id}
        reply={reply}
      />
    );

    expect(screen.getByTestId('edit-message')).toBeInTheDocument();
    expect(screen.getByTestId('delete-message')).toBeInTheDocument();
    expect(screen.queryByTestId('add-reply')).not.toBeInTheDocument();
  });

  it('hides author actions from another non-admin user', () => {
    mockUseApplicationStore.mockReturnValue({
      currentUser: { id: 'other-id', name: 'alice', isAdmin: false },
    });

    render(
      <ActivityFeedActions
        isReply
        conversationId={conversation.id}
        reply={reply}
      />
    );

    expect(screen.queryByTestId('edit-message')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-message')).not.toBeInTheDocument();
  });

  it('allows an administrator to edit and delete another users reply', () => {
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

    expect(screen.getByTestId('edit-message')).toBeInTheDocument();
    expect(screen.getByTestId('delete-message')).toBeInTheDocument();
  });

  it('toggles resolution only for a manageable conversation root', () => {
    render(
      <ActivityFeedActions
        conversation={conversation}
        conversationId={conversation.id}
        isReply={false}
      />
    );
    fireEvent.click(screen.getByTestId('toggle-resolved'));

    expect(mockUpdateFeed).toHaveBeenCalledWith(
      conversation.id,
      conversation.id,
      true,
      [{ op: 'replace', path: '/resolved', value: true }]
    );
  });

  it('deletes a reply by conversation and reply id after confirmation', () => {
    render(
      <ActivityFeedActions
        isReply
        conversationId={conversation.id}
        reply={reply}
      />
    );
    fireEvent.click(screen.getByTestId('delete-message'));
    fireEvent.click(screen.getByTestId('confirm-delete'));

    expect(mockDeleteFeed).toHaveBeenCalledWith(
      conversation.id,
      reply.id,
      false
    );
    expect(mockHideDrawer).not.toHaveBeenCalled();
  });

  it('deletes a user conversation root and closes the drawer', () => {
    render(
      <ActivityFeedActions
        conversation={conversation}
        conversationId={conversation.id}
        isReply={false}
      />
    );
    fireEvent.click(screen.getByTestId('delete-message'));
    fireEvent.click(screen.getByTestId('confirm-delete'));

    expect(mockDeleteFeed).toHaveBeenCalledWith(
      conversation.id,
      conversation.id,
      true
    );
    expect(mockHideDrawer).toHaveBeenCalled();
  });

  it('opens a user conversation and focuses its reply editor', () => {
    render(
      <ActivityFeedActions
        conversation={conversation}
        conversationId={conversation.id}
        isReply={false}
      />
    );
    fireEvent.click(screen.getByTestId('add-reply'));

    expect(mockShowDrawer).toHaveBeenCalledWith(conversation);
    expect(mockUpdateEditorFocus).toHaveBeenCalledWith(true);
  });

  it('renders every control as a focusable button with an accessible name', () => {
    render(
      <ActivityFeedActions
        conversation={conversation}
        conversationId={conversation.id}
        isReply={false}
      />
    );

    // The regression this guards: these were `<Icon onClick>`, which Ant
    // renders as `<span role="img">` - not focusable, not announced as a
    // control, and unusable with Enter/Space.
    for (const testId of [
      'add-reply',
      'toggle-resolved',
      'edit-message',
      'delete-message',
    ]) {
      const control = screen.getByTestId(testId);

      expect(control.tagName).toBe('BUTTON');
      expect(control).toHaveAccessibleName();

      control.focus();

      expect(control).toHaveFocus();
    }
  });

  it('groups the actions and never unmounts them on pointer state', () => {
    render(
      <ActivityFeedActions
        isReply
        conversationId={conversation.id}
        reply={reply}
      />
    );

    expect(screen.getByTestId('feed-actions')).toHaveAttribute('role', 'group');
    expect(screen.getByTestId('feed-actions')).toHaveAccessibleName();
  });

  it('merges the reveal class handed down by the owning card', () => {
    render(
      <ActivityFeedActions
        isReply
        className="tw:opacity-0"
        conversationId={conversation.id}
        reply={reply}
      />
    );

    const actions = screen.getByTestId('feed-actions');

    expect(actions).toHaveClass('feed-actions');
    expect(actions).toHaveClass('tw:opacity-0');
  });

  it('honours canEdit and canDelete independently of the author rule', () => {
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

    expect(screen.queryByTestId('edit-message')).not.toBeInTheDocument();
    expect(screen.getByTestId('delete-message')).toBeInTheDocument();
  });

  it('calls onDelete instead of the feed provider when one is supplied', () => {
    const onDelete = jest.fn();

    render(<ActivityFeedActions canDelete isReply onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId('delete-message'));
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
    fireEvent.click(screen.getByTestId('delete-message'));

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
    fireEvent.click(screen.getByTestId('delete-message'));
    fireEvent.click(screen.getByTestId('confirm-delete'));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalled();
    });

    // Closing here would look like the delete had gone through.
    expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
  });

  it('closes the confirmation without deleting', () => {
    render(
      <ActivityFeedActions
        isReply
        conversationId={conversation.id}
        reply={reply}
      />
    );
    fireEvent.click(screen.getByTestId('delete-message'));
    fireEvent.click(screen.getByTestId('cancel-delete'));

    expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
    expect(mockDeleteFeed).not.toHaveBeenCalled();
  });
});
