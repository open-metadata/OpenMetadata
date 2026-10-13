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
import { fireEvent, render, screen } from '@testing-library/react';
import { Task } from '../../../generated/entity/tasks/task';
import MemoryConflictReviews from './MemoryConflictReviews';
import { MemoryConflictReviewsProps } from './MemoryConflictReviews.types';

const mockCompare = jest.fn(
  ({ review, onClose }: { review: Task; onClose: () => void }) => (
    <div data-testid="memory-compare-modal">
      {review.id}
      <button onClick={onClose}>close-compare</button>
    </div>
  )
);

jest.mock('../MemoryConflictCompare/MemoryConflictCompare', () => ({
  __esModule: true,
  default: (props: { review: Task; onClose: () => void }) => mockCompare(props),
}));

jest.mock(
  '../../discovery/personal-space/InboxPage/components/InboxTaskListItem',
  () => ({
    __esModule: true,
    default: ({
      task,
      onClick,
    }: {
      task: Task;
      onClick: (t: Task) => void;
    }) => (
      <button onClick={() => onClick(task)}>
        {task.displayName} | {task.about?.displayName}
      </button>
    ),
  })
);

jest.mock(
  '../../discovery/personal-space/InboxPage/components/InboxTaskListSkeleton',
  () => ({
    __esModule: true,
    default: () => <div data-testid="inbox-task-list-skeleton" />,
  })
);

const review = {
  id: 'task-1',
  displayName: 'Review conflicting memory: Customers need three orders',
  about: { id: 'memory-three', type: 'contextMemory', name: 'chat-3a9c' },
  payload: { memoryTitle: 'Customers need three orders', disputes: [] },
} as unknown as Task;

const renderReviews = (props: Partial<MemoryConflictReviewsProps> = {}) => {
  const handlers = { onResolved: jest.fn(), onLoadMore: jest.fn() };
  render(
    <MemoryConflictReviews
      hasMore={false}
      isLoading={false}
      isLoadingMore={false}
      reviews={[review]}
      {...handlers}
      {...props}
    />
  );

  return handlers;
};

describe('MemoryConflictReviews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists each review as the task list shows tasks, naming the memory by its title', () => {
    renderReviews();

    expect(screen.getByTestId('memory-review-memory-three')).toHaveTextContent(
      'Review conflicting memory: Customers need three orders | Customers need three orders'
    );
  });

  it('opens the comparison for a review and returns to the list when closed', () => {
    const { onResolved } = renderReviews();

    fireEvent.click(
      screen.getByText(/Review conflicting memory: Customers need three orders/)
    );

    expect(screen.getByTestId('memory-compare-modal')).toHaveTextContent(
      'task-1'
    );
    expect(mockCompare).toHaveBeenLastCalledWith(
      expect.objectContaining({ review, onResolved })
    );

    fireEvent.click(screen.getByText('close-compare'));

    expect(screen.queryByTestId('memory-compare-modal')).toBeNull();
  });

  it('loads more reviews on request while more are open', () => {
    const { onLoadMore } = renderReviews({ hasMore: true });

    fireEvent.click(screen.getByText('label.load-more'));

    expect(onLoadMore).toHaveBeenCalled();
  });

  it('offers no more reviews once all are listed', () => {
    renderReviews();

    expect(screen.queryByText('label.load-more')).toBeNull();
  });

  it('says when nothing is waiting for a decision', () => {
    renderReviews({ reviews: [] });

    expect(screen.getByText('label.nothing-to-review')).toBeInTheDocument();
    expect(
      screen.getByText('message.no-memory-conflicts-to-review')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('memory-conflict-reviews')).toBeNull();
  });

  it('shows the task list skeleton while loading', () => {
    renderReviews({ isLoading: true });

    expect(screen.getByTestId('inbox-task-list-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('memory-review-memory-three')).toBeNull();
  });
});
