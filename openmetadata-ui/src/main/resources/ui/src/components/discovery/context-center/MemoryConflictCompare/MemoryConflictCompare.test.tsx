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
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ResolutionType } from '../../../../generated/api/tasks/resolveTask';
import {
  ContextMemory,
  ContextMemoryStatus,
} from '../../../../generated/entity/context/contextMemory';
import { Task } from '../../../../generated/entity/tasks/task';
import { getContextMemoryById } from '../../../../rest/contextMemoryAPI';
import { resolveTask } from '../../../../rest/tasksAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import { CONTEXT_CENTER_MEMORY_REVIEWS_QUERY_KEY } from '../../../../utils/ContextCenterQueryKeys';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import MemoryConflictCompare from './MemoryConflictCompare';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

jest.mock('../../../../rest/contextMemoryAPI', () => ({
  getContextMemoryById: jest.fn(),
}));

jest.mock('../../../../rest/tasksAPI', () => ({
  resolveTask: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const reference = (id: string) => ({ id, type: 'contextMemory', name: id });

const memory = (
  id: string,
  title: string,
  answer: string,
  entityStatus: ContextMemoryStatus,
  lastContentUpdatedAt: number
) =>
  ({
    id,
    name: `${id}-name`,
    title,
    answer,
    question: 'Who counts as a customer?',
    entityStatus,
    lastContentUpdatedAt,
  } as ContextMemory);

const MEMORIES: Record<string, ContextMemory> = {
  'memory-three': {
    ...memory(
      'memory-three',
      'Customers need three orders',
      'A customer has at least three completed orders.',
      ContextMemoryStatus.Draft,
      200
    ),
    disputes: [
      {
        memory: reference('memory-five'),
        reason: 'Three orders against five',
      },
      {
        memory: reference('memory-first'),
        reason: 'Three orders against one',
      },
    ],
  },
  'memory-five': memory(
    'memory-five',
    'Customers need five orders',
    'A customer has at least five completed orders.',
    ContextMemoryStatus.Approved,
    100
  ),
  'memory-first': memory(
    'memory-first',
    'First order',
    'A customer has one completed order.',
    ContextMemoryStatus.Approved,
    100
  ),
};

const failure = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status } });

const reviewOf = (...disputed: string[]) =>
  ({
    id: 'task-1',
    displayName: 'Review conflicting memory',
    about: reference('memory-three'),
    payload: {
      disputes: disputed.map((id) => ({
        memory: reference(id),
        detectedAt: 1,
      })),
    },
  } as unknown as Task);

const renderCompare = (review = reviewOf('memory-five')) => {
  const onClose = jest.fn();
  const onResolved = jest.fn();
  const { queryClient } = renderWithQueryClient(
    <MemoryConflictCompare
      review={review}
      onClose={onClose}
      onResolved={onResolved}
    />
  );

  return { onClose, onResolved, queryClient };
};

/** Keeping waits until both memories are read. */
const enabledKeep = async (testId: string) => {
  const keep = await screen.findByTestId(testId);
  await waitFor(() => expect(keep).toBeEnabled());

  return keep;
};

describe('MemoryConflictCompare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getContextMemoryById as jest.Mock).mockImplementation(async (id) => {
      if (id === 'memory-hidden') {
        throw failure(403);
      }
      if (id === 'memory-broken') {
        throw failure(500);
      }
      if (!MEMORIES[id]) {
        throw failure(404);
      }

      return MEMORIES[id];
    });
  });

  it('reads both memories and shows them side by side, with why they conflict', async () => {
    renderCompare();

    expect(
      await screen.findByTestId('compare-current-title')
    ).toHaveTextContent('Customers need five orders');
    expect(screen.getByTestId('compare-proposed-title')).toHaveTextContent(
      'Customers need three orders'
    );
    expect(screen.getByTestId('compare-question')).toHaveTextContent(
      'Who counts as a customer?'
    );
    expect(screen.getByTestId('compare-reason')).toHaveTextContent(
      'Three orders against five'
    );
    expect(screen.getByText('label.newer')).toBeInTheDocument();
    expect(screen.getByText('label.older')).toBeInTheDocument();
  });

  it('marks what the memory in review drops and adds, field by field', async () => {
    renderCompare();

    await waitFor(() =>
      expect(screen.getByTestId('diff-row-memory')).toHaveAttribute(
        'data-changed',
        'true'
      )
    );

    const removed = within(screen.getByTestId('diff-current-memory')).getByText(
      'five'
    );
    const added = within(screen.getByTestId('diff-proposed-memory')).getByText(
      'three'
    );

    expect(removed.tagName).toBe('DEL');
    expect(added.tagName).toBe('INS');
    expect(screen.getByTestId('diff-row-question')).toHaveAttribute(
      'data-changed',
      'false'
    );
  });

  it('draws placeholder rows until both memories are read', async () => {
    let release: (value: ContextMemory) => void = jest.fn();
    (getContextMemoryById as jest.Mock).mockImplementation((id) =>
      id === 'memory-five'
        ? new Promise((resolve) => {
            release = resolve;
          })
        : Promise.resolve(MEMORIES[id])
    );
    renderCompare();

    expect(await screen.findAllByTestId('diff-row-skeleton')).not.toHaveLength(
      0
    );
    expect(screen.queryByTestId('diff-row-memory')).toBeNull();

    await act(async () => release(MEMORIES['memory-five']));

    expect(await screen.findByTestId('diff-row-memory')).toBeInTheDocument();
  });

  it('keeping the memory in review approves it', async () => {
    (resolveTask as jest.Mock).mockResolvedValue({ id: 'task-1' });
    const { onClose, onResolved } = renderCompare();

    fireEvent.click(await enabledKeep('keep-reviewed-memory'));

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

    fireEvent.click(await enabledKeep('keep-approved-memories'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(resolveTask).toHaveBeenCalledWith('task-1', {
      transitionId: 'reject',
      resolutionType: ResolutionType.Rejected,
    });
  });

  it('a refused decision stays open, says why and refreshes the reviews', async () => {
    const refusal = new Error('changed after the conflict was detected');
    (resolveTask as jest.Mock).mockRejectedValue(refusal);
    const { onClose, onResolved, queryClient } = renderCompare();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(await enabledKeep('keep-reviewed-memory'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(refusal));

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: CONTEXT_CENTER_MEMORY_REVIEWS_QUERY_KEY,
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(onResolved).not.toHaveBeenCalled();
  });

  it('describes what each keep button does', async () => {
    renderCompare();

    const keep = await screen.findByTestId('keep-reviewed-memory');
    const hint = document.getElementById(
      keep.getAttribute('aria-describedby') ?? ''
    );

    expect(hint).toHaveTextContent(/message\.keep-reviewed-memory-hint /);
  });

  it.each([
    ['memory-gone', /message\.memory-no-longer-exists/],
    ['memory-hidden', /message\.no-permission-to-view/],
  ])(
    'says why %s cannot be shown, marks nothing and still lets the reviewer decide',
    async (id, reason) => {
      renderCompare(reviewOf(id));

      await waitFor(() =>
        expect(screen.getByTestId('compare-current-title')).toHaveTextContent(
          reason
        )
      );

      expect(screen.getByTestId('diff-row-memory')).toHaveAttribute(
        'data-changed',
        'false'
      );
      expect(screen.getByTestId('keep-approved-memories')).toBeEnabled();
    }
  );

  it('holds the decision while a memory failed to load', async () => {
    renderCompare(reviewOf('memory-broken'));

    await waitFor(() =>
      expect(screen.getByTestId('compare-current-title')).toHaveTextContent(
        /server\.entity-fetch-error/
      )
    );

    expect(screen.getByTestId('keep-approved-memories')).toBeDisabled();
    expect(screen.getByTestId('keep-reviewed-memory')).toBeDisabled();
  });

  it('switches between the approved memories the one in review contradicts', async () => {
    renderCompare(reviewOf('memory-five', 'memory-first'));

    expect(
      await screen.findByTestId('compare-current-title')
    ).toHaveTextContent('Customers need five orders');

    fireEvent.click(
      within(screen.getByTestId('disputed-memory-select')).getByRole('button')
    );
    fireEvent.click(await screen.findByRole('option', { name: 'First order' }));

    await waitFor(() =>
      expect(screen.getByTestId('compare-current-title')).toHaveTextContent(
        'First order'
      )
    );

    expect(screen.getByTestId('compare-reason')).toHaveTextContent(
      'Three orders against one'
    );
    expect(
      screen.getByText(/message\.keep-reviewed-memory-hint-plural .*"count":2/)
    ).toBeInTheDocument();
  });
});
