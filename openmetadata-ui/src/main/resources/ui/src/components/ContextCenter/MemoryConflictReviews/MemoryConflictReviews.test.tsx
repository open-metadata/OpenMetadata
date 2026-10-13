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
import { ResolutionType } from '../../../generated/api/tasks/resolveTask';
import { Task } from '../../../generated/entity/tasks/task';
import { resolveTask } from '../../../rest/tasksAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import MemoryConflictReviews from './MemoryConflictReviews';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

jest.mock('../../../rest/tasksAPI', () => ({
  resolveTask: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
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

  it('marks which claim is newer', () => {
    renderReviews();

    const [reviewedSide, approvedSide] = screen
      .getAllByText(/^label\.(newer|older)$/)
      .map((badge) => badge.textContent);

    expect(reviewedSide).toBe('label.newer');
    expect(approvedSide).toBe('label.older');
  });

  it('says what keeping each side does to the other', () => {
    renderReviews();

    expect(
      screen.getByText(
        /message\.keep-reviewed-memory-hint .*Customers need five orders/
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /message\.keep-approved-memory-hint .*Customers need three orders/
      )
    ).toBeInTheDocument();
  });

  it('names the memory in review when the task records no claim', () => {
    renderReviews([{ ...review, payload: { disputes: [] } } as Task]);

    expect(screen.getByTestId('reviewed-memory')).toHaveTextContent(
      'chat-3a9c'
    );
    expect(screen.queryByTestId('reviewed-memory-claim')).toBeNull();
  });

  it('keeping several approved memories rejects the memory in review', () => {
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

    expect(screen.getByTestId('keep-approved-memories')).toHaveTextContent(
      'label.keep-these'
    );
    expect(
      screen.getByText(/message\.keep-reviewed-memory-hint-plural .*"count":2/)
    ).toBeInTheDocument();
  });

  it('opens either memory by name', () => {
    const { onViewMemory } = renderReviews();

    fireEvent.click(screen.getByTestId('reviewed-memory'));
    fireEvent.click(screen.getByTestId('disputed-memory-memory-five'));

    expect(onViewMemory).toHaveBeenNthCalledWith(1, 'chat-3a9c');
    expect(onViewMemory).toHaveBeenNthCalledWith(2, 'orders.pdf-5f1e');
  });

  it('keeping the memory in review approves it', async () => {
    (resolveTask as jest.Mock).mockResolvedValue({ id: 'task-1' });
    const { onResolved } = renderReviews();

    fireEvent.click(screen.getByTestId('keep-reviewed-memory'));

    await waitFor(() => expect(onResolved).toHaveBeenCalled());

    expect(resolveTask).toHaveBeenCalledWith('task-1', {
      transitionId: 'approve',
      resolutionType: ResolutionType.Approved,
    });
    expect(showSuccessToast).toHaveBeenCalledWith(
      'server.task-resolved-successfully'
    );
  });

  it('keeping the approved memory rejects the memory in review', async () => {
    (resolveTask as jest.Mock).mockResolvedValue({ id: 'task-1' });
    const { onResolved } = renderReviews();

    fireEvent.click(screen.getByTestId('keep-approved-memories'));

    await waitFor(() => expect(onResolved).toHaveBeenCalled());

    expect(resolveTask).toHaveBeenCalledWith('task-1', {
      transitionId: 'reject',
      resolutionType: ResolutionType.Rejected,
    });
  });

  it('a refused decision is reported and keeps the review', async () => {
    const refusal = new Error('changed after the conflict was detected');
    (resolveTask as jest.Mock).mockRejectedValue(refusal);
    const { onResolved } = renderReviews();

    fireEvent.click(screen.getByTestId('keep-reviewed-memory'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(refusal));

    expect(onResolved).not.toHaveBeenCalled();
    expect(screen.getByTestId('keep-reviewed-memory')).not.toBeDisabled();
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
