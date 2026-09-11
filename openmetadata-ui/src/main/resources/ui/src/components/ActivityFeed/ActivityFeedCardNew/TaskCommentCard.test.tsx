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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  Task,
  TaskCategory,
  TaskComment,
  TaskStatus,
  TaskType,
} from '../../../generated/entity/tasks/task';
import { deleteTaskComment } from '../../../rest/tasksAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import TaskCommentCard from './TaskCommentCard.component';

jest.mock('../../../rest/tasksAPI', () => ({
  deleteTaskComment: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => [
    false,
    false,
    { name: 'alice', displayName: 'Alice Author' },
  ],
}));

jest.mock('../../common/ProfilePicture/ProfilePicture', () => {
  return jest.fn(({ name }) => (
    <div data-testid={`profile-${name}`}>Avatar</div>
  ));
});

jest.mock('../../common/PopOverCard/UserPopOverCard', () => {
  return jest.fn(({ children }) => children);
});

const mockRichTextPreview = jest.fn();
jest.mock('../../common/RichTextEditor/RichTextEditorPreviewNew', () => {
  return jest.fn((props) => {
    mockRichTextPreview(props);

    return <div data-testid="rich-text-preview">{props.markdown}</div>;
  });
});

jest.mock('../../common/DeleteModal/DeleteModal', () => ({
  __esModule: true,
  default: jest.fn(({ open, isDeleting, onDelete, onCancel }) =>
    open ? (
      <div data-testid="delete-modal">
        <span data-testid="is-deleting">{String(isDeleting)}</span>
        <button data-testid="confirm-delete" onClick={onDelete}>
          Delete
        </button>
        <button data-testid="cancel-delete" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null
  ),
}));

jest.mock('../../../utils/FeedUtilsPure', () => ({
  getFrontEndFormat: jest.fn((text) => text),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn(() => 'Jan 01, 2025, 12:00 PM'),
  getRelativeTime: jest.fn(() => '2 hours ago'),
}));

const mockComment: TaskComment = {
  id: 'comment-1',
  message: 'This is the incident comment body',
  createdAt: 1735732800000,
  author: { id: 'user-1', type: 'user', name: 'alice' },
};

const mockTask = {
  id: 'task-1',
  name: 'incident-task',
  category: TaskCategory.Incident,
  type: TaskType.IncidentResolution,
  status: TaskStatus.InProgress,
  createdBy: { id: 'user-1', type: 'user', name: 'alice' },
} as Task;

const renderCard = (
  props: Partial<React.ComponentProps<typeof TaskCommentCard>> = {}
) =>
  render(
    <MemoryRouter>
      <TaskCommentCard comment={mockComment} task={mockTask} {...props} />
    </MemoryRouter>
  );

describe('TaskCommentCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (deleteTaskComment as jest.Mock).mockResolvedValue({});
  });

  describe('rendering', () => {
    it('should render the author name, relative timestamp and comment body', () => {
      renderCard();

      expect(screen.getByTestId('author-name')).toHaveTextContent(
        'Alice Author'
      );
      expect(screen.getByTestId('comment-time')).toHaveTextContent(
        '2 hours ago'
      );
      expect(screen.getByTestId('rich-text-preview')).toHaveTextContent(
        'This is the incident comment body'
      );
    });

    // Regression guard for #33112: passing enableSeeMoreVariant={false} clamped long
    // comments with no way to expand them. The previewer defaults it to true, so the
    // prop must stay unset rather than be re-added as false.
    it('should not disable the see-more variant on the previewer', () => {
      renderCard();

      expect(mockRichTextPreview).toHaveBeenCalled();

      // Every render, not just one of them - toHaveBeenCalledWith would pass as long
      // as a single call happened to omit the prop.
      mockRichTextPreview.mock.calls.forEach(([props]) => {
        expect(props.enableSeeMoreVariant).toBeUndefined();
      });
    });

    // Regression guard for #33112: the delete affordance overlays the card rather than
    // sharing its flow, so revealing it cannot reflow the comment body. jsdom runs no
    // layout, so this asserts the positioning contract that keeps it out of flow.
    it('should overlay the delete action instead of placing it in the flow', () => {
      renderCard({ currentUser: { name: 'alice' } });

      expect(screen.getByTestId('task-comment-card')).toHaveClass(
        'tw:relative',
        'tw:group'
      );
      expect(screen.getByTestId('delete-task-comment')).toHaveClass(
        'tw:absolute'
      );
    });

    it('should link the author name and avatar to their profile', () => {
      renderCard();

      const authorLink = screen.getByTestId('author-name');

      expect(authorLink).toHaveAttribute('href', '/users/alice');
      expect(screen.getByTestId('profile-alice')).toBeInTheDocument();
    });

    it('should fall back to plain text when the comment has no author name', () => {
      renderCard({
        comment: {
          ...mockComment,
          author: { id: 'user-1', type: 'user' },
        },
      });

      const authorName = screen.getByTestId('author-name');

      expect(authorName).not.toHaveAttribute('href');
    });
  });

  describe('delete affordance permissions', () => {
    it('should not show delete when there is no current user', () => {
      renderCard();

      expect(
        screen.queryByTestId('delete-task-comment')
      ).not.toBeInTheDocument();
    });

    it('should show delete to the comment author', () => {
      renderCard({ currentUser: { name: 'alice' } });

      expect(screen.getByTestId('delete-task-comment')).toBeInTheDocument();
    });

    it('should show delete to an admin who is not the author', () => {
      renderCard({ currentUser: { name: 'bob', isAdmin: true } });

      expect(screen.getByTestId('delete-task-comment')).toBeInTheDocument();
    });

    it('should not show delete to a non-admin who is not the author', () => {
      renderCard({ currentUser: { name: 'bob', isAdmin: false } });

      expect(
        screen.queryByTestId('delete-task-comment')
      ).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should expose the delete action as a button with an accessible name', () => {
      renderCard({ currentUser: { name: 'alice' } });

      const deleteButton = screen.getByRole('button', { name: 'label.delete' });

      expect(deleteButton).toHaveAttribute(
        'data-testid',
        'delete-task-comment'
      );
    });

    // The affordance used to be mounted only while the mouse was over the card, which
    // put it permanently out of reach of the keyboard. It now stays in the DOM and is
    // revealed by CSS on hover or focus.
    it('should keep the delete action focusable without a mouse hover', async () => {
      renderCard({ currentUser: { name: 'alice' } });

      const deleteButton = screen.getByTestId('delete-task-comment');
      deleteButton.focus();

      expect(deleteButton).toHaveFocus();
      expect(deleteButton).toHaveClass('tw:focus-visible:opacity-100');
    });

    it('should reveal the delete action on card hover via CSS, not conditional mount', () => {
      renderCard({ currentUser: { name: 'alice' } });

      expect(screen.getByTestId('delete-task-comment')).toHaveClass(
        'tw:opacity-0',
        'tw:group-hover:opacity-100'
      );
    });

    it('should open the confirmation modal from the keyboard alone', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderCard({ currentUser: { name: 'alice' } });

      // Tab order: author-name link (now focusable, see the profile-link tests
      // above) comes before the delete affordance.
      await user.tab();

      expect(screen.getByTestId('author-name')).toHaveFocus();

      await user.tab();

      expect(screen.getByTestId('delete-task-comment')).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
    });
  });

  describe('delete flow', () => {
    const openDeleteModal = (props = { currentUser: { name: 'alice' } }) => {
      renderCard(props);
      fireEvent.click(screen.getByTestId('delete-task-comment'));
    };

    it('should open the confirmation modal from the delete affordance', () => {
      openDeleteModal();

      expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
      expect(deleteTaskComment).not.toHaveBeenCalled();
    });

    it('should delete the comment and notify the parent on confirm', async () => {
      const onCommentDeleted = jest.fn();
      renderCard({ currentUser: { name: 'alice' }, onCommentDeleted });
      fireEvent.click(screen.getByTestId('delete-task-comment'));

      await act(async () => {
        fireEvent.click(screen.getByTestId('confirm-delete'));
      });

      expect(deleteTaskComment).toHaveBeenCalledWith('task-1', 'comment-1');

      await waitFor(() => {
        expect(onCommentDeleted).toHaveBeenCalledTimes(1);
      });

      expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();
    });

    it('should keep the modal open and toast when the delete fails', async () => {
      const error = new Error('delete failed');
      (deleteTaskComment as jest.Mock).mockRejectedValueOnce(error);
      const onCommentDeleted = jest.fn();
      renderCard({ currentUser: { name: 'alice' }, onCommentDeleted });
      fireEvent.click(screen.getByTestId('delete-task-comment'));

      await act(async () => {
        fireEvent.click(screen.getByTestId('confirm-delete'));
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(error);
      });

      expect(onCommentDeleted).not.toHaveBeenCalled();
      expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
      expect(screen.getByTestId('is-deleting')).toHaveTextContent('false');
    });

    it('should not delete anything when the modal is cancelled', () => {
      openDeleteModal();

      fireEvent.click(screen.getByTestId('cancel-delete'));

      expect(deleteTaskComment).not.toHaveBeenCalled();
      expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();
    });
  });

  describe('focus management on delete', () => {
    it('should move focus to a sibling comment instead of letting it fall to <body>', async () => {
      const secondComment: TaskComment = {
        ...mockComment,
        id: 'comment-2',
        message: 'A second comment',
      };

      const rerenderRef: {
        current?: (ui: React.ReactElement) => void;
      } = {};

      const TwoComments = ({ showFirst }: { showFirst: boolean }) => (
        <MemoryRouter>
          <div data-testid="feed-replies">
            {showFirst && (
              <TaskCommentCard
                comment={mockComment}
                currentUser={{ name: 'alice' }}
                task={mockTask}
                onCommentDeleted={() =>
                  rerenderRef.current?.(<TwoComments showFirst={false} />)
                }
              />
            )}
            <TaskCommentCard
              comment={secondComment}
              currentUser={{ name: 'alice' }}
              task={mockTask}
            />
          </div>
        </MemoryRouter>
      );

      const { rerender } = render(<TwoComments showFirst />);
      rerenderRef.current = rerender;

      const deleteButtons = screen.getAllByTestId('delete-task-comment');
      // Simulate react-aria restoring focus to the trigger as the confirm
      // dialog closes, which is what actually happens right before the
      // parent's refetch removes this card in the real app.
      deleteButtons[0].focus();
      fireEvent.click(deleteButtons[0]);

      await act(async () => {
        fireEvent.click(screen.getByTestId('confirm-delete'));
      });

      await waitFor(() => {
        expect(screen.getAllByTestId('task-comment-card')).toHaveLength(1);
      });

      expect(document.body).not.toHaveFocus();
      expect(screen.getByTestId('task-comment-card')).toHaveFocus();
    });
  });
});
