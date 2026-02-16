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

import { fireEvent, render, screen } from '@testing-library/react';
import {
  Post,
  Thread,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import ActivityFeedActions from './ActivityFeedActions';

const mockDeleteFeed = jest.fn().mockResolvedValue(undefined);
const mockShowDrawer = jest.fn();
const mockHideDrawer = jest.fn();
const mockUpdateEditorFocus = jest.fn();

jest.mock('../ActivityFeedProvider/ActivityFeedProvider', () => ({
  useActivityFeedProvider: () => ({
    deleteFeed: mockDeleteFeed,
    showDrawer: mockShowDrawer,
    hideDrawer: mockHideDrawer,
    updateEditorFocus: mockUpdateEditorFocus,
  }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockUseApplicationStore = jest.requireMock(
  '../../../hooks/useApplicationStore'
).useApplicationStore;

const createMockPost = (from: string): Post => ({
  id: 'post-123',
  message: 'Test message',
  postTs: 1234567890,
  from,
});

const createMockFeed = (
  type: ThreadType,
  createdBy: string = 'testuser'
): Thread => ({
  id: 'thread-123',
  href: 'http://test',
  threadTs: 1234567890,
  about: '<#E::table::test>',
  createdBy: createdBy,
  updatedAt: 1234567890,
  updatedBy: createdBy,
  type,
  message: 'Test thread message',
  postsCount: 1,
  posts: [],
  reactions: [],
});

describe('ActivityFeedActions', () => {
  const mockOnEditPost = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseApplicationStore.mockReturnValue({
      currentUser: { name: 'testuser', isAdmin: false },
    });
  });

  describe('Permission Checks - Edit', () => {
    it('should show edit button when user is author of a post', () => {
      const post = createMockPost('testuser');
      const feed = createMockFeed(ThreadType.Conversation);

      render(
        <ActivityFeedActions
          isPost
          feed={feed}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      expect(screen.getByTestId('edit-message')).toBeInTheDocument();
    });

    it('should NOT show edit button when user is not author', () => {
      const post = createMockPost('otheruser');
      const feed = createMockFeed(ThreadType.Conversation);

      render(
        <ActivityFeedActions
          isPost
          feed={feed}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      expect(screen.queryByTestId('edit-message')).not.toBeInTheDocument();
    });

    it('should NOT show edit button for announcement thread (non-post)', () => {
      const post = createMockPost('testuser');
      const feed = createMockFeed(ThreadType.Announcement);

      render(
        <ActivityFeedActions
          feed={feed}
          isPost={false}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      expect(screen.queryByTestId('edit-message')).not.toBeInTheDocument();
    });

    it('should NOT show edit button for task thread (non-post)', () => {
      const post = createMockPost('testuser');
      const feed = createMockFeed(ThreadType.Task);

      render(
        <ActivityFeedActions
          feed={feed}
          isPost={false}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      expect(screen.queryByTestId('edit-message')).not.toBeInTheDocument();
    });

    it('should show edit button for announcement post when user is author', () => {
      const post = createMockPost('testuser');
      const feed = createMockFeed(ThreadType.Announcement);

      render(
        <ActivityFeedActions
          isPost
          feed={feed}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      expect(screen.getByTestId('edit-message')).toBeInTheDocument();
    });

    it('should call onEditPost when edit button is clicked', () => {
      const post = createMockPost('testuser');
      const feed = createMockFeed(ThreadType.Conversation);

      render(
        <ActivityFeedActions
          isPost
          feed={feed}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      fireEvent.click(screen.getByTestId('edit-message'));

      expect(mockOnEditPost).toHaveBeenCalled();
    });
  });

  describe('Permission Checks - Delete', () => {
    it('should show delete button when user is author', () => {
      const post = createMockPost('testuser');
      const feed = createMockFeed(ThreadType.Conversation);

      render(
        <ActivityFeedActions
          isPost
          feed={feed}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      expect(screen.getByTestId('delete-message')).toBeInTheDocument();
    });

    it('should show delete button when user is admin (not author)', () => {
      mockUseApplicationStore.mockReturnValue({
        currentUser: { name: 'adminuser', isAdmin: true },
      });

      const post = createMockPost('otheruser');
      const feed = createMockFeed(ThreadType.Conversation);

      render(
        <ActivityFeedActions
          isPost
          feed={feed}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      expect(screen.getByTestId('delete-message')).toBeInTheDocument();
    });

    it('should NOT show delete button when user is neither author nor admin', () => {
      const post = createMockPost('otheruser');
      const feed = createMockFeed(ThreadType.Conversation);

      render(
        <ActivityFeedActions
          isPost
          feed={feed}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      expect(screen.queryByTestId('delete-message')).not.toBeInTheDocument();
    });

    it('should NOT show delete button for task thread (non-post)', () => {
      const post = createMockPost('testuser');
      const feed = createMockFeed(ThreadType.Task);

      render(
        <ActivityFeedActions
          feed={feed}
          isPost={false}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      expect(screen.queryByTestId('delete-message')).not.toBeInTheDocument();
    });

    it('should show delete button for task post when user is author', () => {
      const post = createMockPost('testuser');
      const feed = createMockFeed(ThreadType.Task);

      render(
        <ActivityFeedActions
          isPost
          feed={feed}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      expect(screen.getByTestId('delete-message')).toBeInTheDocument();
    });
  });

  describe('Delete Confirmation', () => {
    it('should show confirmation modal when delete is clicked', () => {
      const post = createMockPost('testuser');
      const feed = createMockFeed(ThreadType.Conversation);

      render(
        <ActivityFeedActions
          isPost
          feed={feed}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      fireEvent.click(screen.getByTestId('delete-message'));

      expect(
        screen.getByText('message.confirm-delete-message')
      ).toBeInTheDocument();
    });

    it('should call deleteFeed when delete is confirmed for a post', async () => {
      const post = createMockPost('testuser');
      const feed = createMockFeed(ThreadType.Conversation);

      render(
        <ActivityFeedActions
          isPost
          feed={feed}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      fireEvent.click(screen.getByTestId('delete-message'));
      fireEvent.click(screen.getByText('label.delete'));

      expect(mockDeleteFeed).toHaveBeenCalledWith(
        'thread-123',
        'post-123',
        false
      );
    });

    it('should call deleteFeed with isThread=true when deleting a thread', async () => {
      const post = createMockPost('testuser');
      const feed = createMockFeed(ThreadType.Conversation);

      render(
        <ActivityFeedActions
          feed={feed}
          isPost={false}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      fireEvent.click(screen.getByTestId('delete-message'));
      fireEvent.click(screen.getByText('label.delete'));

      expect(mockDeleteFeed).toHaveBeenCalledWith(
        'thread-123',
        'post-123',
        true
      );
      // hideDrawer is called synchronously in handleDelete after deleteFeed is called
      expect(mockHideDrawer).toHaveBeenCalled();
    });

    it('should close modal when cancel is clicked', () => {
      const post = createMockPost('testuser');
      const feed = createMockFeed(ThreadType.Conversation);

      render(
        <ActivityFeedActions
          isPost
          feed={feed}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      fireEvent.click(screen.getByTestId('delete-message'));

      expect(
        screen.getByText('message.confirm-delete-message')
      ).toBeInTheDocument();

      fireEvent.click(screen.getByText('label.cancel'));

      expect(mockDeleteFeed).not.toHaveBeenCalled();
    });
  });

  describe('Reply Button', () => {
    it('should show reply button for non-post (thread)', () => {
      const post = createMockPost('testuser');
      const feed = createMockFeed(ThreadType.Conversation);

      render(
        <ActivityFeedActions
          feed={feed}
          isPost={false}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      expect(screen.getByTestId('add-reply')).toBeInTheDocument();
    });

    it('should NOT show reply button for post', () => {
      const post = createMockPost('testuser');
      const feed = createMockFeed(ThreadType.Conversation);

      render(
        <ActivityFeedActions
          isPost
          feed={feed}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      expect(screen.queryByTestId('add-reply')).not.toBeInTheDocument();
    });

    it('should call showDrawer and updateEditorFocus when reply is clicked', () => {
      const post = createMockPost('testuser');
      const feed = createMockFeed(ThreadType.Conversation);

      render(
        <ActivityFeedActions
          feed={feed}
          isPost={false}
          post={post}
          onEditPost={mockOnEditPost}
        />
      );

      fireEvent.click(screen.getByTestId('add-reply'));

      expect(mockShowDrawer).toHaveBeenCalledWith(feed);
      expect(mockUpdateEditorFocus).toHaveBeenCalledWith(true);
    });
  });
});
