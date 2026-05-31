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
import {
  Post,
  Thread,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import CommentCard from './CommentCard.component';

const mockUpdateFeed = jest.fn();

jest.mock('../ActivityFeedProvider/ActivityFeedProvider', () => ({
  useActivityFeedProvider: () => ({
    updateFeed: mockUpdateFeed,
  }),
}));

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

jest.mock('../ActivityFeedCardV2/FeedCardFooter/FeedCardFooterNew', () => {
  return jest.fn(() => <div data-testid="feed-card-footer" />);
});

jest.mock('../ActivityFeedEditor/ActivityFeedEditorNew', () => {
  return jest.fn(({ onSave, onTextChange }) => (
    <div data-testid="feed-editor">
      <input
        data-testid="editor-input"
        onChange={(e) => onTextChange(e.target.value)}
      />
      <button
        data-testid="save-button"
        onClick={() => onSave('edited message')}>
        Save
      </button>
    </div>
  ));
});

jest.mock('../Shared/ActivityFeedActions', () => {
  return jest.fn(({ onEditPost }) => (
    <div data-testid="feed-actions">
      <button data-testid="edit-button" onClick={onEditPost}>
        Edit
      </button>
      <button data-testid="delete-button">Delete</button>
    </div>
  ));
});

jest.mock('../../../utils/FeedUtils', () => ({
  getFrontEndFormat: jest.fn((text) => text),
  MarkdownToHTMLConverter: {
    makeHtml: jest.fn((text) => text),
  },
}));

const createMockPost = (from: string, message: string): Post => ({
  id: 'post-123',
  message,
  postTs: 1234567890,
  from,
});

const createMockFeed = (): Thread => ({
  id: 'thread-123',
  href: 'http://test',
  threadTs: 1234567890,
  about: '<#E::table::test>',
  createdBy: 'testuser',
  updatedAt: 1234567890,
  updatedBy: 'testuser',
  type: ThreadType.Conversation,
  message: 'Test thread message',
  postsCount: 1,
  posts: [],
  reactions: [],
});

const renderCommentCard = (
  props?: Partial<{
    feed: Thread;
    post: Post;
    isLastReply: boolean;
    closeFeedEditor: () => void;
  }>
) => {
  const defaultProps = {
    feed: createMockFeed(),
    post: createMockPost('testuser', 'Test comment message'),
    isLastReply: false,
    closeFeedEditor: jest.fn(),
  };

  return render(
    <MemoryRouter>
      <CommentCard {...defaultProps} {...props} />
    </MemoryRouter>
  );
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

    it('should render feed card footer', () => {
      renderCommentCard();

      expect(screen.getByTestId('feed-card-footer')).toBeInTheDocument();
    });

    it('should render timestamp', () => {
      renderCommentCard();

      expect(screen.getByTestId('timestamp')).toBeInTheDocument();
    });
  });

  describe('Hover Actions', () => {
    it('should show feed actions on hover', async () => {
      renderCommentCard();

      const card = screen.getByTestId('feed-reply-card');
      fireEvent.mouseEnter(card);

      await waitFor(() => {
        expect(screen.getByTestId('feed-actions')).toBeInTheDocument();
      });
    });

    it('should hide feed actions when not hovering', async () => {
      renderCommentCard();

      const card = screen.getByTestId('feed-reply-card');

      fireEvent.mouseEnter(card);
      await waitFor(() => {
        expect(screen.getByTestId('feed-actions')).toBeInTheDocument();
      });

      fireEvent.mouseLeave(card);
      await waitFor(() => {
        expect(screen.queryByTestId('feed-actions')).not.toBeInTheDocument();
      });
    });
  });

  describe('Edit Mode', () => {
    it('should show editor when edit button is clicked', async () => {
      renderCommentCard();

      const card = screen.getByTestId('feed-reply-card');
      fireEvent.mouseEnter(card);

      await waitFor(() => {
        expect(screen.getByTestId('edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('feed-editor')).toBeInTheDocument();
      });
    });

    it('should call closeFeedEditor when entering edit mode', async () => {
      const closeFeedEditor = jest.fn();
      renderCommentCard({ closeFeedEditor });

      const card = screen.getByTestId('feed-reply-card');
      fireEvent.mouseEnter(card);

      await waitFor(() => {
        expect(screen.getByTestId('edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('edit-button'));

      expect(closeFeedEditor).toHaveBeenCalled();
    });

    it('should call updateFeed when saving edited message', async () => {
      renderCommentCard();

      const card = screen.getByTestId('feed-reply-card');
      fireEvent.mouseEnter(card);

      await waitFor(() => {
        expect(screen.getByTestId('edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('feed-editor')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('editor-input'), {
        target: { value: 'updated message' },
      });

      fireEvent.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(mockUpdateFeed).toHaveBeenCalled();
      });
    });

    it('should hide editor and show preview after update', async () => {
      renderCommentCard();

      const card = screen.getByTestId('feed-reply-card');
      fireEvent.mouseEnter(card);

      await waitFor(() => {
        expect(screen.getByTestId('edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('feed-editor')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-button'));

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

      const card = screen.getByTestId('feed-reply-card');
      fireEvent.mouseEnter(card);

      await waitFor(() => {
        expect(screen.getByTestId('edit-button')).toBeInTheDocument();
      });

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
