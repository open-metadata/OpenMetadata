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

import { render, screen, waitFor } from '@testing-library/react';
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
import TaskCommentCard from './TaskCommentCard.component';

// Only the REST boundary is mocked. Every component, hook and utility below the
// card renders for real, so the assertions describe what a user actually sees.
jest.mock('../../../rest/tasksAPI', () => ({
  deleteTaskComment: jest.fn().mockResolvedValue({}),
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

    // Regression guard for #33112: the delete affordance overlays the card rather
    // than sharing its flow, so revealing it cannot reflow the comment body. jsdom
    // performs no layout, so the positioning contract is the observable proxy.
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

      // Real tab order: the author's profile link comes first, the delete action
      // second. Both are reachable without a pointer.
      await user.tab();

      expect(screen.getByTestId('author-name')).toHaveFocus();

      await user.tab();

      expect(screen.getByTestId('delete-task-comment')).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(await screen.findByTestId('delete-modal')).toBeInTheDocument();
    });

    it('should reveal the delete action on card hover via CSS, not by unmounting it', () => {
      renderCard({ currentUser: { name: 'alice' } });

      expect(screen.getByTestId('delete-task-comment')).toHaveClass(
        'tw:opacity-0',
        'tw:group-hover:opacity-100'
      );
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
});
