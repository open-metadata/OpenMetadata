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

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  Task,
  TaskCategory,
  TaskComment,
  TaskStatus,
  TaskType,
} from '../../../generated/entity/tasks/task';
import { deleteTaskComment } from '../../../rest/tasksAPI';
import TaskCommentCard from './TaskCommentCard.component';

// Only the REST boundary is mocked. Every component, hook and utility below the
// card renders for real, so the assertions describe what a user actually sees.
jest.mock('../../../rest/tasksAPI', () => ({
  deleteTaskComment: jest.fn().mockResolvedValue({}),
  editTaskComment: jest.fn().mockResolvedValue({}),
}));

// The other half of that boundary: useUserProfile resolves the comment author
// through this REST module. Stubbing the request rather than the hook keeps the
// real hook and its consumers in the test.
jest.mock('../../../rest/userAPI', () => ({
  getUserByName: jest.fn().mockResolvedValue({
    id: 'user-1',
    name: 'alice',
    displayName: 'Alice Author',
  }),
}));

const NOW = new Date('2025-01-01T12:00:00.000Z').getTime();
const TWO_HOURS_AGO = NOW - 2 * 60 * 60 * 1000;

const mockComment: TaskComment = {
  id: 'comment-1',
  message: 'This is the incident comment body',
  createdAt: TWO_HOURS_AGO,
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

const setup = () =>
  userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

describe('TaskCommentCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.setSystemTime(NOW);
    (deleteTaskComment as jest.Mock).mockResolvedValue({});
  });

  describe('rendering', () => {
    it('should show the author, a relative timestamp and the comment body', async () => {
      renderCard();

      expect(
        await screen.findByText('This is the incident comment body')
      ).toBeInTheDocument();
      expect(screen.getByTestId('comment-time')).toHaveTextContent(/ago/i);
      expect(screen.getByTestId('author-name')).toHaveTextContent(/alice/i);
    });

    it('should link the author to their profile page', () => {
      renderCard();

      expect(screen.getByTestId('author-name')).toHaveAttribute(
        'href',
        '/users/alice'
      );
    });

    it('should render the author as plain text when there is no author name', () => {
      renderCard({
        comment: { ...mockComment, author: { id: 'user-1', type: 'user' } },
      });

      expect(screen.getByTestId('author-name')).not.toHaveAttribute('href');
    });
  });

  describe('delete affordance permissions', () => {
    it('should not offer delete when there is no current user', () => {
      renderCard();

      expect(
        screen.queryByTestId('delete-task-comment')
      ).not.toBeInTheDocument();
    });

    it('should offer delete to the comment author', () => {
      renderCard({ currentUser: { name: 'alice' } });

      expect(screen.getByTestId('delete-task-comment')).toBeInTheDocument();
    });

    it('should offer delete to an admin who is not the author', () => {
      renderCard({ currentUser: { name: 'bob', isAdmin: true } });

      expect(screen.getByTestId('delete-task-comment')).toBeInTheDocument();
    });

    it('should not offer delete to a non-admin who is not the author', () => {
      renderCard({ currentUser: { name: 'bob', isAdmin: false } });

      expect(
        screen.queryByTestId('delete-task-comment')
      ).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should expose the delete action as a button with an accessible name', () => {
      renderCard({ currentUser: { name: 'alice' } });

      expect(
        screen.getByRole('button', { name: 'label.delete' })
      ).toHaveAttribute('data-testid', 'delete-task-comment');
    });

    // The affordance used to be mounted only while the mouse was over the card,
    // which put it permanently out of reach of the keyboard. It now stays mounted
    // and is revealed by CSS on hover or focus.
    it('should reach and trigger the delete action from the keyboard alone', async () => {
      const user = setup();
      renderCard({ currentUser: { name: 'alice' } });

      // Real tab order: the author's profile link, then edit, then delete - all
      // reachable without a pointer.
      await user.tab();

      expect(screen.getByTestId('author-name')).toHaveFocus();

      await user.tab();

      expect(screen.getByTestId('edit-task-comment')).toHaveFocus();

      await user.tab();

      expect(screen.getByTestId('delete-task-comment')).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(await screen.findByTestId('delete-modal')).toBeInTheDocument();
    });

    it('should reveal the actions on card hover via CSS, not by unmounting them', () => {
      renderCard({ currentUser: { name: 'alice' } });

      // The reveal lives on the actions container so the buttons themselves stay
      // mounted and focusable; unmounting them until hover is what put them out
      // of the keyboard's reach.
      expect(screen.getByTestId('task-comment-actions')).toHaveClass(
        'tw:opacity-0',
        'tw:group-hover:opacity-100',
        'tw:focus-within:opacity-100'
      );
      expect(screen.getByTestId('delete-task-comment')).toBeInTheDocument();
    });
  });

  describe('edit permissions and flow', () => {
    it('should offer edit to the comment author', () => {
      renderCard({ currentUser: { name: 'alice' } });

      expect(screen.getByTestId('edit-task-comment')).toBeInTheDocument();
    });

    // Deliberately narrower than delete: an admin may remove someone else's
    // comment but must not rewrite it, matching the server's rules.
    it('should not offer edit to an admin who is not the author', () => {
      renderCard({ currentUser: { name: 'bob', isAdmin: true } });

      expect(screen.queryByTestId('edit-task-comment')).not.toBeInTheDocument();
      expect(screen.getByTestId('delete-task-comment')).toBeInTheDocument();
    });

    it('should not offer edit to a non-author non-admin', () => {
      renderCard({ currentUser: { name: 'bob' } });

      expect(screen.queryByTestId('edit-task-comment')).not.toBeInTheDocument();
    });

    it('should open the inline editor and hide the actions while editing', async () => {
      const user = setup();
      renderCard({ currentUser: { name: 'alice' } });

      await user.click(screen.getByTestId('edit-task-comment'));

      expect(
        await screen.findByTestId('edit-task-comment-editor')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('task-comment-actions')
      ).not.toBeInTheDocument();
    });

    it('should return to the rendered comment when the edit is cancelled', async () => {
      const user = setup();
      renderCard({ currentUser: { name: 'alice' } });

      await user.click(screen.getByTestId('edit-task-comment'));
      await user.click(await screen.findByTestId('cancel-edit-task-comment'));

      await waitFor(() =>
        expect(
          screen.queryByTestId('edit-task-comment-editor')
        ).not.toBeInTheDocument()
      );

      expect(screen.getByTestId('task-comment-actions')).toBeInTheDocument();
    });
  });

  describe('delete flow', () => {
    it('should open a confirmation dialog before deleting anything', async () => {
      const user = setup();
      renderCard({ currentUser: { name: 'alice' } });

      await user.click(screen.getByTestId('delete-task-comment'));

      expect(await screen.findByTestId('delete-modal')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-button')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
      expect(deleteTaskComment).not.toHaveBeenCalled();
    });

    it('should delete the comment and notify the parent when confirmed', async () => {
      const user = setup();
      const onCommentDeleted = jest.fn();
      renderCard({ currentUser: { name: 'alice' }, onCommentDeleted });

      await user.click(screen.getByTestId('delete-task-comment'));
      await user.click(await screen.findByTestId('confirm-button'));

      await waitFor(() =>
        expect(deleteTaskComment).toHaveBeenCalledWith('task-1', 'comment-1')
      );
      await waitFor(() => expect(onCommentDeleted).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument()
      );
    });

    it('should keep the dialog open and not notify the parent when the delete fails', async () => {
      (deleteTaskComment as jest.Mock).mockRejectedValueOnce(
        new Error('delete failed')
      );
      const user = setup();
      const onCommentDeleted = jest.fn();
      renderCard({ currentUser: { name: 'alice' }, onCommentDeleted });

      await user.click(screen.getByTestId('delete-task-comment'));
      await user.click(await screen.findByTestId('confirm-button'));

      await waitFor(() => expect(deleteTaskComment).toHaveBeenCalled());

      expect(onCommentDeleted).not.toHaveBeenCalled();
      expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
    });

    it('should delete nothing when the dialog is cancelled', async () => {
      const user = setup();
      renderCard({ currentUser: { name: 'alice' } });

      await user.click(screen.getByTestId('delete-task-comment'));
      await user.click(await screen.findByTestId('cancel-button'));

      await waitFor(() =>
        expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument()
      );

      expect(deleteTaskComment).not.toHaveBeenCalled();
    });
  });

  // Covers the useLayoutEffect unmount cleanup in TaskCommentCard.component.tsx:
  // when the card that holds focus is removed, focus must move to a sibling card
  // or fall back to the replies container, never to <body>.
  //
  // The parent is modelled on TaskTabNew's real wiring: a tabIndex={-1} replies
  // container holding sibling cards, each handed the same ref. Removal is driven
  // by re-rendering the parent with the comment gone, which is exactly what
  // TaskTabNew does once its post-delete refetch resolves.
  //
  // Deliberately not routed through the delete dialog: in a browser react-aria
  // restores focus to the trigger as the dialog closes, but jsdom does not
  // reproduce that, so the precondition (focus inside the card at unmount) is
  // established directly instead of mocking the real dialog away.
  describe('focus management on delete', () => {
    const secondComment: TaskComment = {
      ...mockComment,
      id: 'comment-2',
      message: 'A sibling comment',
    };

    const CommentList = ({ comments }: { comments: TaskComment[] }) => {
      const repliesContainerRef = useRef<HTMLDivElement>(null);

      return (
        <MemoryRouter>
          <div
            data-testid="feed-replies"
            ref={repliesContainerRef}
            tabIndex={-1}>
            {comments.map((entry, index, arr) => (
              <TaskCommentCard
                comment={entry}
                currentUser={{ name: 'alice' }}
                isLastReply={index === arr.length - 1}
                key={entry.id}
                repliesContainerRef={repliesContainerRef}
                task={mockTask}
              />
            ))}
          </div>
        </MemoryRouter>
      );
    };

    const focusFirstCardsDeleteButton = () => {
      const card = screen.getAllByTestId('task-comment-card')[0];
      const button = within(card).getByTestId('delete-task-comment');

      act(() => button.focus());

      expect(card.contains(document.activeElement)).toBe(true);
    };

    it('should move focus to a sibling comment instead of letting it fall to <body>', () => {
      const { rerender } = render(
        <CommentList comments={[mockComment, secondComment]} />
      );

      focusFirstCardsDeleteButton();

      rerender(<CommentList comments={[secondComment]} />);

      const survivor = screen.getByTestId('task-comment-card');

      expect(survivor).toHaveFocus();
      expect(document.activeElement).not.toBe(document.body);
    });

    it('should fall back to the replies container when the deleted comment has no sibling to focus', () => {
      const { rerender } = render(<CommentList comments={[mockComment]} />);

      focusFirstCardsDeleteButton();

      rerender(<CommentList comments={[]} />);

      expect(screen.queryByTestId('task-comment-card')).not.toBeInTheDocument();
      expect(screen.getByTestId('feed-replies')).toHaveFocus();
      expect(document.activeElement).not.toBe(document.body);
    });
  });
});
