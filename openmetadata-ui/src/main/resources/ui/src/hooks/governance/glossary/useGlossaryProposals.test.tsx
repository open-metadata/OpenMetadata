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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  EntityStatus,
  GlossaryTerm,
  ProviderType,
} from '../../../generated/entity/data/glossaryTerm';
import { getMemoryDerivations } from '../../../rest/contextMemoryAPI';
import { getGlossaryTermsById } from '../../../rest/glossaryAPI';
import {
  listTasks,
  resolveTask,
  Task,
  TaskEntityStatus,
} from '../../../rest/tasksAPI';
import {
  useDecideProposal,
  useGlossaryProposal,
  useTermDerivations,
} from './useGlossaryProposals';

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossaryTermsById: jest.fn(),
}));

jest.mock('../../../rest/contextMemoryAPI', () => ({
  ...jest.requireActual('../../../rest/contextMemoryAPI'),
  getMemoryDerivations: jest.fn(),
}));

jest.mock('../../../rest/tasksAPI', () => ({
  ...jest.requireActual('../../../rest/tasksAPI'),
  listTasks: jest.fn(),
  resolveTask: jest.fn(),
}));

const aiDraft = {
  id: 'ai-id',
  name: 'Churn Risk',
  fullyQualifiedName: 'Customers.Churn Risk',
  provider: ProviderType.Automation,
  entityStatus: EntityStatus.InReview,
} as GlossaryTerm;

const personDraft = {
  id: 'person-id',
  name: 'Escrow',
  fullyQualifiedName: 'Customers.Escrow',
  entityStatus: EntityStatus.InReview,
} as GlossaryTerm;

const approvedTerm = {
  id: 'approved-id',
  name: 'Revenue',
  fullyQualifiedName: 'Customers.Revenue',
  entityStatus: EntityStatus.Approved,
} as GlossaryTerm;

const derivation = {
  entity: { id: 'ai-id', type: 'glossaryTerm' },
  memory: { id: 'memory-id', type: 'contextMemory' },
  evidence: { confidence: 0.9, reasons: ['A metric'] },
};

const approvalTask = {
  id: 'task-id',
  about: { fullyQualifiedName: 'Customers.Escrow', type: 'glossaryTerm' },
  assignees: [{ id: 'reviewer-id', type: 'user' }],
} as Task;

const aiTask = {
  ...approvalTask,
  id: 'ai-task-id',
  about: { fullyQualifiedName: 'Customers.Churn Risk', type: 'glossaryTerm' },
} as Task;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

let terms: GlossaryTerm[];

describe('useGlossaryProposals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    terms = [aiDraft, personDraft, approvedTerm];
    (getGlossaryTermsById as jest.Mock).mockImplementation(async (id: string) =>
      terms.find((term) => term.id === id)
    );
    (getMemoryDerivations as jest.Mock).mockResolvedValue([derivation]);
    (listTasks as jest.Mock).mockResolvedValue({
      data: [aiTask, approvalTask],
    });
  });

  it('opens an AI proposal with its evidence and approval request', async () => {
    const { result } = renderHook(() => useGlossaryProposal('ai-id'), {
      wrapper,
    });

    await waitFor(() => expect(result.current?.approvalTask).toEqual(aiTask));

    expect(result.current?.source).toBe('ai');
    expect(result.current?.derivation).toEqual(derivation);
    expect(getGlossaryTermsById).toHaveBeenCalledWith('ai-id', {
      fields: 'reviewers,parent',
    });
    expect(listTasks).toHaveBeenCalledWith(
      expect.objectContaining({ aboutEntityIds: 'ai-id' })
    );
  });

  it('opens nothing for a decided term, and asks for nothing without one', async () => {
    const { result } = renderHook(
      () => ({
        decided: useGlossaryProposal('approved-id'),
        none: useGlossaryProposal(undefined),
      }),
      { wrapper }
    );

    await waitFor(() => expect(getGlossaryTermsById).toHaveBeenCalledTimes(1));

    expect(result.current.decided).toBeUndefined();
    expect(result.current.none).toBeUndefined();
  });

  it('finds the approval request for a term whose name contains a comma', async () => {
    const term = {
      ...personDraft,
      fullyQualifiedName: 'Customers.Revenue, net',
    };
    terms = [term];
    const task = {
      ...approvalTask,
      about: {
        ...approvalTask.about,
        fullyQualifiedName: term.fullyQualifiedName,
      },
    };
    (listTasks as jest.Mock).mockResolvedValue({ data: [task] });
    const { result } = renderHook(() => useGlossaryProposal(term.id), {
      wrapper,
    });

    await waitFor(() => expect(result.current?.approvalTask).toEqual(task));
  });

  it('still opens an AI proposal when the caller may not read memories', async () => {
    (getMemoryDerivations as jest.Mock).mockRejectedValue(new Error('403'));
    const { result } = renderHook(() => useGlossaryProposal('ai-id'), {
      wrapper,
    });

    await waitFor(() => expect(result.current?.term.id).toBe('ai-id'));

    expect(result.current?.derivation).toBeUndefined();
  });

  it('still opens a proposal when its approval request cannot be loaded', async () => {
    (listTasks as jest.Mock).mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => useGlossaryProposal('person-id'), {
      wrapper,
    });

    await waitFor(() => expect(result.current?.term.id).toBe('person-id'));

    expect(result.current?.approvalTask).toBeUndefined();
  });

  it('decides AI and person proposals through their approval requests', async () => {
    (resolveTask as jest.Mock).mockImplementation(async (taskId: string) => ({
      id: taskId,
      status: TaskEntityStatus.Approved,
    }));
    const { result } = renderHook(() => useDecideProposal(), { wrapper });

    const decisions: boolean[] = [];
    await act(async () => {
      decisions.push(
        await result.current(
          { term: aiDraft, source: 'ai', approvalTask: aiTask },
          EntityStatus.Approved
        ),
        await result.current(
          { term: personDraft, source: 'person', approvalTask },
          EntityStatus.Rejected,
          'Duplicate'
        )
      );
    });

    expect(decisions).toEqual([true, true]);
    expect(resolveTask).toHaveBeenCalledWith(
      'ai-task-id',
      expect.objectContaining({ newValue: 'approved' })
    );
    expect(resolveTask).toHaveBeenCalledWith(
      'task-id',
      expect.objectContaining({ comment: 'Duplicate', newValue: 'rejected' })
    );
  });

  it('decides no proposal before its approval request opens', async () => {
    const { result } = renderHook(() => useDecideProposal(), { wrapper });

    await expect(
      result.current({ term: aiDraft, source: 'ai' }, EntityStatus.Approved)
    ).rejects.toThrow();
    expect(resolveTask).not.toHaveBeenCalled();
  });

  it('keeps a proposal pending while its request waits for other reviewers', async () => {
    (resolveTask as jest.Mock).mockResolvedValue({
      id: 'task-id',
      status: TaskEntityStatus.Open,
    });
    const { result } = renderHook(() => useDecideProposal(), { wrapper });

    let isSettled = true;
    await act(async () => {
      isSettled = await result.current(
        { term: personDraft, source: 'person', approvalTask },
        EntityStatus.Approved
      );
    });

    expect(isSettled).toBe(false);
  });

  it('reads the evidence of many table rows in chunks the API accepts', async () => {
    const termIds = Array.from({ length: 101 }, (_, index) => `ai-${index}`);
    (getMemoryDerivations as jest.Mock).mockImplementation(
      async (_entityType: string, chunk: string[]) => {
        if (chunk.length > 100) {
          throw new Error('The derivations API accepts at most 100 IDs');
        }

        return chunk.map((id) => ({
          ...derivation,
          entity: { id, type: 'glossaryTerm' },
        }));
      }
    );

    const { result } = renderHook(() => useTermDerivations(termIds), {
      wrapper,
    });

    await waitFor(() => expect(result.current).toHaveLength(101));

    expect(getMemoryDerivations).toHaveBeenCalledTimes(2);
  });
});
