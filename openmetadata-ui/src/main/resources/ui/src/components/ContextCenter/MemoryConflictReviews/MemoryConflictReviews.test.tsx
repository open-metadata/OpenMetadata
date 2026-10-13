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

jest.mock('../../../rest/tasksAPI', () => ({
  resolveTask: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const review = {
  id: 'task-1',
  about: {
    id: 'memory-three',
    type: 'contextMemory',
    name: 'three-orders',
  },
  payload: {
    memoryVersion: 0.2,
    memoryTitle: 'Customers need three orders',
    disputes: [
      {
        memory: {
          id: 'memory-five',
          type: 'contextMemory',
          name: 'five-orders',
          displayName: 'Customers need five orders',
        },
        reason: 'Five orders against three orders',
      },
    ],
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

  it('shows the reviewed memory and what it conflicts with', () => {
    renderReviews();

    expect(screen.getByTestId('reviewed-memory')).toHaveTextContent(
      'Customers need three orders'
    );
    expect(screen.getByText('label.conflicts-with')).toBeInTheDocument();
    expect(screen.getByTestId('disputed-memory-memory-five')).toHaveTextContent(
      'Customers need five orders'
    );
    expect(
      screen.getByText('Five orders against three orders')
    ).toBeInTheDocument();
  });

  it('names the reviewed memory when the task records no title', () => {
    renderReviews([{ ...review, payload: { disputes: [] } } as Task]);

    expect(screen.getByTestId('reviewed-memory')).toHaveTextContent(
      'three-orders'
    );
  });

  it('opens either memory by name', () => {
    const { onViewMemory } = renderReviews();

    fireEvent.click(screen.getByTestId('reviewed-memory'));
    fireEvent.click(screen.getByTestId('disputed-memory-memory-five'));

    expect(onViewMemory).toHaveBeenNthCalledWith(1, 'three-orders');
    expect(onViewMemory).toHaveBeenNthCalledWith(2, 'five-orders');
  });

  it('approving resolves the task through its approve transition', async () => {
    (resolveTask as jest.Mock).mockResolvedValue({ id: 'task-1' });
    const { onResolved } = renderReviews();

    fireEvent.click(screen.getByTestId('approve-review'));

    await waitFor(() => expect(onResolved).toHaveBeenCalled());

    expect(resolveTask).toHaveBeenCalledWith('task-1', {
      transitionId: 'approve',
      resolutionType: ResolutionType.Approved,
    });
    expect(showSuccessToast).toHaveBeenCalledWith(
      'server.task-resolved-successfully'
    );
  });

  it('rejecting resolves the task through its reject transition', async () => {
    (resolveTask as jest.Mock).mockResolvedValue({ id: 'task-1' });
    const { onResolved } = renderReviews();

    fireEvent.click(screen.getByTestId('reject-review'));

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

    fireEvent.click(screen.getByTestId('approve-review'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(refusal));

    expect(onResolved).not.toHaveBeenCalled();
    expect(screen.getByTestId('approve-review')).not.toBeDisabled();
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
