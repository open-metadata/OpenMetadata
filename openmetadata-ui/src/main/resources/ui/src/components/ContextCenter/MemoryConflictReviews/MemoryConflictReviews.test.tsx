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
  default: (props: { review: Task; onClose: () => void }) =>
    mockCompare(props, {}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

const FIVE_ORDERS = {
  id: 'memory-five',
  name: 'orders.pdf-5f1e',
  title: 'Customers need five orders',
  question: 'Who counts as a customer?',
  answer: 'A customer has at least five completed orders.',
  status: 'Approved',
  contentUpdatedAt: 100,
  anchor: { id: 'table-1', type: 'table', name: 'dim_customer' },
  source: 'orders.pdf',
  author: 'Ana',
};

const disputeOf = (claim: typeof FIVE_ORDERS) => ({
  memory: {
    id: claim.id,
    type: 'contextMemory',
    name: claim.name,
    displayName: claim.title,
  },
  reason: 'Five orders against three orders',
  claim,
});

const review = {
  id: 'task-1',
  about: { id: 'memory-three', type: 'contextMemory', name: 'chat-3a9c' },
  payload: {
    memoryVersion: 0.2,
    memoryTitle: 'Customers need three orders',
    claim: {
      id: 'memory-three',
      name: 'chat-3a9c',
      title: 'Customers need three orders',
      question: 'Who counts as a customer?',
      answer: 'A customer has at least three completed orders.',
      status: 'Draft',
      contentUpdatedAt: 200,
    },
    disputes: [disputeOf(FIVE_ORDERS)],
  },
} as unknown as Task;

const renderReviews = (reviews: Task[] = [review], isLoading = false) => {
  const onResolved = jest.fn();
  const onViewMemory = jest.fn();
  render(
    <MemoryConflictReviews
      isAdminUser
      currentUserName="ana"
      isLoading={isLoading}
      reviews={reviews}
      onResolved={onResolved}
      onViewMemory={onViewMemory}
    />
  );

  return { onResolved, onViewMemory };
};

describe('MemoryConflictReviews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('compares what the memory in review and the approved memory claim', () => {
    renderReviews();

    expect(screen.getByTestId('review-question')).toHaveTextContent(
      'Who counts as a customer?'
    );
    expect(screen.getByTestId('reviewed-memory')).toHaveTextContent(
      'Customers need three orders'
    );
    expect(screen.getByTestId('reviewed-memory-claim')).toHaveTextContent(
      'A customer has at least three completed orders.'
    );
    expect(screen.getByTestId('disputed-memory-memory-five')).toHaveTextContent(
      'Customers need five orders'
    );
    expect(
      screen.getByTestId('disputed-memory-memory-five-claim')
    ).toHaveTextContent('A customer has at least five completed orders.');
    expect(
      screen.getByText(/message\.why-they-conflict.*Five orders against three/)
    ).toBeInTheDocument();
    expect(screen.getByText(/dim_customer · orders\.pdf · Ana/)).toBeVisible();
  });

  it('marks which claim is newer and where each stands', () => {
    renderReviews();

    expect(screen.getByTestId('reviewed-memory-status')).toHaveTextContent(
      'label.draft'
    );
    expect(
      screen.getByTestId('disputed-memory-memory-five-status')
    ).toHaveTextContent('label.approved');

    const [reviewedSide, approvedSide] = screen
      .getAllByText(/^label\.(newer|older)$/)
      .map((badge) => badge.textContent);

    expect(reviewedSide).toBe('label.newer');
    expect(approvedSide).toBe('label.older');
  });

  it('names the memory in review when the task records no claim', () => {
    renderReviews([{ ...review, payload: { disputes: [] } } as Task]);

    expect(screen.getByTestId('reviewed-memory')).toHaveTextContent(
      'chat-3a9c'
    );
    expect(screen.queryByTestId('reviewed-memory-claim')).toBeNull();
  });

  it('lists every memory the one in review contradicts', () => {
    const second = { ...FIVE_ORDERS, id: 'memory-first', title: 'First order' };
    renderReviews([
      {
        ...review,
        payload: {
          ...(review.payload as object),
          disputes: [disputeOf(FIVE_ORDERS), disputeOf(second)],
        },
      } as Task,
    ]);

    expect(screen.getByTestId('disputed-memory-memory-five')).toBeVisible();
    expect(
      screen.getByTestId('disputed-memory-memory-first')
    ).toHaveTextContent('First order');
  });

  it('opens either memory by name', () => {
    const { onViewMemory } = renderReviews();

    fireEvent.click(screen.getByTestId('reviewed-memory'));
    fireEvent.click(screen.getByTestId('disputed-memory-memory-five'));

    expect(onViewMemory).toHaveBeenNthCalledWith(1, 'chat-3a9c');
    expect(onViewMemory).toHaveBeenNthCalledWith(2, 'orders.pdf-5f1e');
  });

  it('compares a review in full and returns to the list when closed', () => {
    const { onResolved } = renderReviews();

    fireEvent.click(screen.getByTestId('compare-review'));

    expect(screen.getByTestId('memory-compare-modal')).toHaveTextContent(
      'task-1'
    );
    expect(mockCompare).toHaveBeenLastCalledWith(
      expect.objectContaining({
        currentUserName: 'ana',
        isAdminUser: true,
        onResolved,
      }),
      expect.anything()
    );

    fireEvent.click(screen.getByText('close-compare'));

    expect(screen.queryByTestId('memory-compare-modal')).toBeNull();
  });

  it('says when nothing is waiting for a decision', () => {
    renderReviews([]);

    expect(screen.getByText('label.nothing-to-review')).toBeInTheDocument();
    expect(
      screen.getByText('message.no-memory-conflicts-to-review')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('memory-conflict-reviews')).toBeNull();
  });

  it('shows no review while loading', () => {
    renderReviews([review], true);

    expect(screen.queryByTestId('reviewed-memory')).toBeNull();
  });
});
