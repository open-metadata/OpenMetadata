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
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ResolutionType } from '../../../generated/api/tasks/resolveTask';
import {
  ContextMemory,
  ContextMemoryStatus,
} from '../../../generated/entity/context/contextMemory';
import { Task } from '../../../generated/entity/tasks/task';
import { getContextMemoryById } from '../../../rest/contextMemoryAPI';
import { resolveTask } from '../../../rest/tasksAPI';
import { renderWithQueryClient } from '../../../test/unit/test-utils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import MemoryConflictCompare from './MemoryConflictCompare';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

jest.mock('../../../rest/contextMemoryAPI', () => ({
  getContextMemoryById: jest.fn(),
}));

jest.mock('../../../rest/tasksAPI', () => ({
  resolveTask: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const memory = (
  id: string,
  title: string,
  answer: string,
  entityStatus: ContextMemoryStatus
) =>
  ({
    id,
    name: `${id}-name`,
    title,
    answer,
    question: 'Who counts as a customer?',
    entityStatus,
  } as ContextMemory);

const MEMORIES: Record<string, ContextMemory> = {
  'memory-three': memory(
    'memory-three',
    'Customers need three orders',
    'A customer has at least three completed orders.',
    ContextMemoryStatus.Draft
  ),
  'memory-five': memory(
    'memory-five',
    'Customers need five orders',
    'A customer has at least five completed orders.',
    ContextMemoryStatus.Approved
  ),
  'memory-first': memory(
    'memory-first',
    'First order',
    'A customer has one completed order.',
    ContextMemoryStatus.Approved
  ),
};

const disputeOf = (id: string) => {
  const title = MEMORIES[id]?.title ?? id;

  return {
    memory: { id, type: 'contextMemory', displayName: title },
    reason: `Three orders against ${title}`,
    claim: { id, status: 'Approved', contentUpdatedAt: 100 },
  };
};

const reviewOf = (...disputed: string[]) =>
  ({
    id: 'task-1',
    displayName: 'Review conflicting memory: Customers need three orders',
    about: { id: 'memory-three', type: 'contextMemory', name: 'memory-three' },
    payload: {
      memoryTitle: 'Customers need three orders',
      claim: {
        id: 'memory-three',
        question: 'Who counts as a customer?',
        status: 'Draft',
        contentUpdatedAt: 200,
      },
      disputes: disputed.map(disputeOf),
    },
  } as unknown as Task);

const renderCompare = (review = reviewOf('memory-five')) => {
  const onClose = jest.fn();
  const onResolved = jest.fn();
  renderWithQueryClient(
    <MemoryConflictCompare
      review={review}
      onClose={onClose}
      onResolved={onResolved}
    />
  );

  return { onClose, onResolved };
};

describe('MemoryConflictCompare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getContextMemoryById as jest.Mock).mockImplementation(async (id) => {
      if (!MEMORIES[id]) {
        throw new Error('not found');
      }

      return MEMORIES[id];
    });
  });

  it('shows both memories in one dialog, the approved one against the one in review', async () => {
    renderCompare();

    expect(
      await screen.findByTestId('compare-current-title')
    ).toHaveTextContent('Customers need five orders');
    expect(
      await screen.findByTestId('compare-proposed-title')
    ).toHaveTextContent('Customers need three orders');
    expect(screen.getByTestId('compare-question')).toHaveTextContent(
      'Who counts as a customer?'
    );
    expect(screen.getByTestId('compare-reason')).toHaveTextContent(
      'Three orders against Customers need five orders'
    );
  });

  it('highlights what the memory in review drops and adds, field by field', async () => {
    renderCompare();

    await waitFor(() =>
      expect(screen.getByTestId('diff-row-memory')).toHaveAttribute(
        'data-changed',
        'true'
      )
    );

    expect(
      within(screen.getByTestId('diff-current-memory')).getByText('five')
    ).toHaveAttribute('data-change', 'removed');
    expect(
      within(screen.getByTestId('diff-proposed-memory')).getByText('three')
    ).toHaveAttribute('data-change', 'added');
    expect(screen.getByTestId('diff-row-question')).toHaveAttribute(
      'data-changed',
      'false'
    );
  });

  it('keeping the memory in review approves it', async () => {
    (resolveTask as jest.Mock).mockResolvedValue({ id: 'task-1' });
    const { onClose, onResolved } = renderCompare();

    fireEvent.click(await screen.findByTestId('keep-reviewed-memory'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(resolveTask).toHaveBeenCalledWith('task-1', {
      transitionId: 'approve',
      resolutionType: ResolutionType.Approved,
    });
    expect(onResolved).toHaveBeenCalled();
    expect(showSuccessToast).toHaveBeenCalledWith(
      'server.task-resolved-successfully'
    );
  });

  it('keeping the approved memory rejects the one in review', async () => {
    (resolveTask as jest.Mock).mockResolvedValue({ id: 'task-1' });
    const { onClose } = renderCompare();

    fireEvent.click(await screen.findByTestId('keep-approved-memories'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(resolveTask).toHaveBeenCalledWith('task-1', {
      transitionId: 'reject',
      resolutionType: ResolutionType.Rejected,
    });
  });

  it('a refused decision stays open and says why', async () => {
    const refusal = new Error('changed after the conflict was detected');
    (resolveTask as jest.Mock).mockRejectedValue(refusal);
    const { onClose, onResolved } = renderCompare();

    fireEvent.click(await screen.findByTestId('keep-reviewed-memory'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(refusal));

    expect(onClose).not.toHaveBeenCalled();
    expect(onResolved).not.toHaveBeenCalled();
  });

  it('says when the approved memory is gone and still lets the reviewer decide', async () => {
    renderCompare(reviewOf('memory-gone'));

    await waitFor(() =>
      expect(screen.getByTestId('compare-current-title')).toHaveTextContent(
        'message.memory-no-longer-exists'
      )
    );

    expect(screen.getByTestId('keep-approved-memories')).toBeInTheDocument();
  });

  it('switches between the approved memories the one in review contradicts', async () => {
    renderCompare(reviewOf('memory-five', 'memory-first'));

    expect(
      await screen.findByTestId('compare-current-title')
    ).toHaveTextContent('Customers need five orders');

    fireEvent.click(screen.getByRole('tab', { name: 'First order' }));

    await waitFor(() =>
      expect(screen.getByTestId('compare-current-title')).toHaveTextContent(
        'First order'
      )
    );

    expect(screen.getByTestId('compare-reason')).toHaveTextContent(
      'Three orders against First order'
    );
    expect(
      screen.getByText(/message\.keep-reviewed-memory-hint-plural .*"count":2/)
    ).toBeInTheDocument();
  });
});
