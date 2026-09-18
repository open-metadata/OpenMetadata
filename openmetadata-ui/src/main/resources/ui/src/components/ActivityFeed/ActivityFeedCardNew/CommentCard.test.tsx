/*
 *  Copyright 2025 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import { ReactionOperation } from '../../../enums/reactions.enum';
import { ReactionType } from '../../../generated/type/reaction';
import CommentCard from './CommentCard.component';

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => [
    false,
    false,
    { name: 'testuser', displayName: 'Test User' },
  ],
}));

let userPopoverCounter = 0;
jest.mock('../../common/PopOverCard/UserPopOverCard', () => {
  return jest.fn(({ children, userName: _userName }) => {
    userPopoverCounter++;

    return (
      <div data-testid={`user-popover-${userPopoverCounter}`}>{children}</div>
    );
  });
});

jest.mock('../../common/ProfilePicture/ProfilePicture', () => {
  return jest.fn(({ name }) => (
    <div data-testid={`profile-${name}`}>Avatar</div>
  ));
});

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewerV1', () => {
  return jest.fn(({ markdown }) => (
    <div data-testid="rich-text-preview">{markdown}</div>
  ));
});

jest.mock('../Reactions/Reactions', () => {
  return jest.fn(({ reactions, onReactionSelect }) => (
    <button
      data-reaction-count={reactions.length}
      data-testid="reactions"
      onClick={() =>
        onReactionSelect(ReactionType.ThumbsUp, ReactionOperation.ADD)
      }>
      React
    </button>
  ));
});

jest.mock('../ActivityFeedEditor/ActivityFeedEditorNew', () => {
  return jest.fn(({ onSave, onTextChange }) => (
    <div data-testid="feed-editor">
      <input
        aria-label="Editor input"
        data-testid="editor-input"
        onChange={(e) => onTextChange(e.target.value)}
      />
      <button data-testid="send-button" onClick={() => onSave()}>
        Save
      </button>
    </div>
  ));
});

const mockActivityFeedActions = jest.fn();
jest.mock('../Shared/ActivityFeedActions', () => {
  return jest.fn((props) => {
    mockActivityFeedActions(props);

    return (
      <div data-testid="feed-actions">
        <button data-testid="edit-button" onClick={props.onEditPost}>
          Edit
        </button>
        <button data-testid="delete-button" onClick={props.onDelete}>
          Delete
        </button>
      </div>
    );
  });
});

jest.mock('../../../utils/FeedUtilsPure', () => ({
  getFrontEndFormat: jest.fn((text) => text),
  MarkdownToHTMLConverter: {
    makeHtml: jest.fn((text) => text),
  },
}));

const onEdit = jest.fn().mockResolvedValue(undefined);
const onDelete = jest.fn().mockResolvedValue(undefined);
const onReaction = jest.fn().mockResolvedValue(undefined);

const renderCommentCard = (
  props?: Partial<React.ComponentProps<typeof CommentCard>>
) => {
  const defaultProps: React.ComponentProps<typeof CommentCard> = {
    author: { id: 'user-1', type: 'user', name: 'testuser' },
    createdAt: 1234567890,
    message: 'Test comment message',
    isLastReply: false,
    canEdit: true,
    canDelete: true,
    onDelete,
    onEdit,
    closeFeedEditor: jest.fn(),
  };

  return render(
    <MemoryRouter>
      <CommentCard {...defaultProps} {...props} />
    </MemoryRouter>
  );
};

const hoverCard = async () => {
  fireEvent.mouseEnter(screen.getByTestId('feed-reply-card'));

  await waitFor(() => {
    expect(screen.getByTestId('feed-actions')).toBeInTheDocument();
  });
};

describe('CommentCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userPopoverCounter = 0;
  });

  describe('Rendering', () => {
    it('should render comment card with post message', () => {
      renderCommentCard();

      expect(screen.getByTestId('feed-reply-card')).toBeInTheDocument();
      expect(screen.getByTestId('rich-text-preview')).toHaveTextContent(
        'Test comment message'
      );
    });

    it('should render user profile picture', () => {
      renderCommentCard();

      expect(screen.getByTestId('profile-testuser')).toBeInTheDocument();
    });

    it('should render user popovers', () => {
      renderCommentCard();

      // Multiple UserPopOverCard instances are rendered
      expect(screen.getByTestId('user-popover-1')).toBeInTheDocument();
      expect(screen.getByTestId('user-popover-2')).toBeInTheDocument();
    });

    it('should render timestamp', () => {
      renderCommentCard();

      expect(screen.getByTestId('timestamp')).toBeInTheDocument();
    });

    it('should fall back to the fully qualified name when author has no name', () => {
      renderCommentCard({
        author: { id: 'user-1', type: 'user', fullyQualifiedName: 'fqn-user' },
      });

      expect(screen.getByTestId('profile-fqn-user')).toBeInTheDocument();
    });
  });

  describe('Reactions footer', () => {
    it('should render the footer only when onReaction is provided', () => {
      const { rerender } = renderCommentCard();

      expect(screen.queryByTestId('feed-card-footer')).not.toBeInTheDocument();

      rerender(
        <MemoryRouter>
          <CommentCard
            canDelete
            canEdit
            author={{ id: 'user-1', type: 'user', name: 'testuser' }}
            createdAt={1234567890}
            isLastReply={false}
            message="Test comment message"
            onDelete={onDelete}
            onEdit={onEdit}
            onReaction={onReaction}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('feed-card-footer')).toBeInTheDocument();
    });

    it('should forward the reaction selection to onReaction', () => {
      renderCommentCard({ onReaction, reactions: [] });

      fireEvent.click(screen.getByTestId('reactions'));

      expect(onReaction).toHaveBeenCalledWith(
        ReactionType.ThumbsUp,
        ReactionOperation.ADD
      );
    });
  });

  describe('Permissions', () => {
    it('should forward canEdit and canDelete to the actions', async () => {
      renderCommentCard({ canDelete: false, canEdit: true });

      await hoverCard();

      expect(mockActivityFeedActions).toHaveBeenCalledWith(
        expect.objectContaining({ canDelete: false, canEdit: true })
      );
    });

    it('should call onDelete when the delete action fires', async () => {
      renderCommentCard();

      await hoverCard();

      fireEvent.click(screen.getByTestId('delete-button'));

      expect(onDelete).toHaveBeenCalled();
    });
  });

  describe('Hover Actions', () => {
    it('should show feed actions on hover', async () => {
      renderCommentCard();

      await hoverCard();
    });

    it('should keep feed actions mounted when not hovering', () => {
      renderCommentCard();

      // Never unmounted on pointer state: doing that made the edit and delete
      // controls unreachable by keyboard and invisible to screen readers.
      // Hiding them until hover is CSS's job, and it leaves them focusable.
      expect(screen.getByTestId('feed-actions')).toBeInTheDocument();
    });

    it('should hand the comment-scoped hover reveal to the actions', () => {
      renderCommentCard();

      expect(screen.getByTestId('feed-reply-card').className).toContain(
        'tw:group/comment'
      );
      expect(mockActivityFeedActions).toHaveBeenCalledWith(
        expect.objectContaining({
          className: expect.stringContaining(
            'tw:group-hover/comment:opacity-100'
          ),
        })
      );
    });
  });

  describe('Edit Mode', () => {
    it('should show editor when edit button is clicked', async () => {
      renderCommentCard();

      await hoverCard();

      fireEvent.click(screen.getByTestId('edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('feed-editor')).toBeInTheDocument();
      });
    });

    it('should call closeFeedEditor when entering edit mode', async () => {
      const closeFeedEditor = jest.fn();
      renderCommentCard({ closeFeedEditor });

      await hoverCard();

      fireEvent.click(screen.getByTestId('edit-button'));

      expect(closeFeedEditor).toHaveBeenCalled();
    });

    it('should call onEdit with the edited message when saving', async () => {
      renderCommentCard();

      await hoverCard();

      fireEvent.click(screen.getByTestId('edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('feed-editor')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('editor-input'), {
        target: { value: 'updated message' },
      });

      fireEvent.click(screen.getByTestId('send-button'));

      await waitFor(() => {
        expect(onEdit).toHaveBeenCalledWith('updated message');
      });
    });

    it('should keep the editor open when the save fails', async () => {
      onEdit.mockRejectedValueOnce(new Error('boom'));
      renderCommentCard();

      await hoverCard();

      fireEvent.click(screen.getByTestId('edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('feed-editor')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('send-button'));

      await waitFor(() => {
        expect(onEdit).toHaveBeenCalled();
      });

      // Dismissing here would look like the edit had been saved.
      expect(screen.getByTestId('feed-editor')).toBeInTheDocument();
    });

    it('should hide editor and show preview after update', async () => {
      renderCommentCard();

      await hoverCard();

      fireEvent.click(screen.getByTestId('edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('feed-editor')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('send-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('feed-editor')).not.toBeInTheDocument();
        expect(screen.getByTestId('rich-text-preview')).toBeInTheDocument();
      });
    });
  });

  describe('Border Styling', () => {
    it('should apply border class when not last reply', () => {
      renderCommentCard({ isLastReply: false });

      const card = screen.getByTestId('feed-reply-card');

      expect(card).toHaveClass('reply-card-border-bottom');
    });

    it('should not apply border class when last reply', () => {
      renderCommentCard({ isLastReply: true });

      const card = screen.getByTestId('feed-reply-card');

      expect(card).not.toHaveClass('reply-card-border-bottom');
    });
  });

  describe('Click Outside to Close Edit Mode', () => {
    it('should close edit mode when clicking outside', async () => {
      renderCommentCard();

      await hoverCard();

      fireEvent.click(screen.getByTestId('edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('feed-editor')).toBeInTheDocument();
      });

      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByTestId('feed-editor')).not.toBeInTheDocument();
      });
    });
  });
});
