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
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { ResolutionType } from '../../../generated/api/tasks/resolveTask';
import { ContextMemory } from '../../../generated/entity/context/contextMemory';
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

const mockMemoryModal = jest.fn(
  ({
    memoryToEdit,
    footer,
  }: {
    memoryToEdit: ContextMemory;
    footer: ReactNode;
  }) => (
    <div data-testid={`memory-panel-${memoryToEdit.id}`}>
      {memoryToEdit.title}
      {footer}
    </div>
  )
);

jest.mock('../CreateMemoryModal/CreateMemoryModal.component', () => ({
  __esModule: true,
  default: (props: { memoryToEdit: ContextMemory; footer: ReactNode }) =>
    mockMemoryModal(props),
}));

const MEMORIES: Record<string, ContextMemory> = {
  'memory-three': {
    id: 'memory-three',
    name: 'chat-3a9c',
    title: 'Customers need three orders',
  } as ContextMemory,
  'memory-five': {
    id: 'memory-five',
    name: 'orders.pdf-5f1e',
    title: 'Customers need five orders',
  } as ContextMemory,
  'memory-first': {
    id: 'memory-first',
    name: 'orders.pdf-1a2b',
    title: 'First order',
  } as ContextMemory,
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
    about: { id: 'memory-three', type: 'contextMemory', name: 'chat-3a9c' },
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
      isAdminUser
      currentUserName="ana"
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

  it('shows both memories in full, side by side, as their own modal does', async () => {
    renderCompare();

    expect(
      await screen.findByTestId('memory-panel-memory-three')
    ).toHaveTextContent('Customers need three orders');
    expect(
      await screen.findByTestId('memory-panel-memory-five')
    ).toHaveTextContent('Customers need five orders');
    expect(mockMemoryModal).toHaveBeenCalledWith(
      expect.objectContaining({ embedded: true, viewOnly: true })
    );
    expect(screen.getByTestId('compare-question')).toHaveTextContent(
      'Who counts as a customer?'
    );
    expect(screen.getByTestId('compare-reason')).toHaveTextContent(
      'Three orders against Customers need five orders'
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
    expect(screen.getByTestId('keep-reviewed-memory')).not.toBeDisabled();
  });

  it('says when a contradicted memory is gone and still lets the reviewer decide', async () => {
    renderCompare(reviewOf('memory-gone'));

    expect(
      await screen.findByText('message.memory-no-longer-exists')
    ).toBeInTheDocument();
    expect(screen.getByTestId('keep-approved-memories')).toBeInTheDocument();
  });

  it('switches between the memories the one in review contradicts', async () => {
    renderCompare(reviewOf('memory-five', 'memory-first'));

    expect(await screen.findByTestId('memory-panel-memory-five')).toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: 'First order' }));

    expect(
      await screen.findByTestId('memory-panel-memory-first')
    ).toBeVisible();
    expect(getContextMemoryById).toHaveBeenCalledWith(
      'memory-first',
      expect.any(String)
    );
    expect(screen.getByTestId('compare-reason')).toHaveTextContent(
      'Three orders against First order'
    );
  });

  it('closes without deciding', async () => {
    const { onClose } = renderCompare();

    fireEvent.click(await screen.findByTestId('close-compare'));

    expect(onClose).toHaveBeenCalled();
    expect(resolveTask).not.toHaveBeenCalled();
  });
});
