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
import { getGlossaryTerms, patchGlossaryTerm } from '../../../rest/glossaryAPI';
import { postExactAggregateFieldOptions } from '../../../rest/miscAPI';
import {
  listTasks,
  resolveTask,
  TaskEntityStatus,
} from '../../../rest/tasksAPI';
import {
  useGlossaryPendingCounts,
  useGlossaryProposals,
} from './useGlossaryProposals';

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossaryTerms: jest.fn(),
  patchGlossaryTerm: jest.fn(),
}));

jest.mock('../../../rest/contextMemoryAPI', () => ({
  ...jest.requireActual('../../../rest/contextMemoryAPI'),
  getMemoryDerivations: jest.fn(),
}));

jest.mock('../../../rest/miscAPI', () => ({
  postExactAggregateFieldOptions: jest.fn(),
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
  entityStatus: EntityStatus.Draft,
} as GlossaryTerm;

const personDraft = {
  id: 'person-id',
  name: 'Escrow',
  fullyQualifiedName: 'Customers.Escrow',
  entityStatus: EntityStatus.InReview,
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
};

const scope = {
  id: 'glossary-id',
  fullyQualifiedName: 'Customers',
  isGlossary: true,
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useGlossaryProposals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getGlossaryTerms as jest.Mock).mockResolvedValue({
      data: [aiDraft, personDraft],
      paging: { total: 2 },
    });
    (getMemoryDerivations as jest.Mock).mockResolvedValue([derivation]);
    (listTasks as jest.Mock).mockResolvedValue({ data: [approvalTask] });
  });

  it('loads a glossary pending terms with their evidence and approval requests', async () => {
    const { result } = renderHook(() => useGlossaryProposals(scope), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getGlossaryTerms).toHaveBeenCalledWith(
      expect.objectContaining({
        entityStatus: 'Draft,In Review',
        glossary: 'glossary-id',
      })
    );
    expect(getMemoryDerivations).toHaveBeenCalledWith('glossaryTerm', [
      'ai-id',
    ]);
    expect(result.current.counts).toEqual({ all: 2, ai: 1, person: 1 });
    expect(result.current.proposals[0].derivation).toEqual(derivation);
    expect(result.current.proposals[1].approvalTask).toEqual(approvalTask);
  });

  it('still lists the AI drafts when the caller may not read memories', async () => {
    (getMemoryDerivations as jest.Mock).mockRejectedValue(new Error('403'));
    const { result } = renderHook(() => useGlossaryProposals(scope), {
      wrapper,
    });

    await waitFor(() => expect(result.current.counts.ai).toBe(1));

    expect(result.current.proposals[0].derivation).toBeUndefined();
  });

  it('keeps every proposal when the approval requests cannot be loaded', async () => {
    (listTasks as jest.Mock).mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => useGlossaryProposals(scope), {
      wrapper,
    });

    await waitFor(() => expect(result.current.counts.all).toBe(2));

    expect(result.current.counts).toEqual({ all: 2, ai: 1, person: 1 });
    expect(result.current.proposals[1].approvalTask).toBeUndefined();
  });

  it('includes pending terms and their evidence beyond the first page', async () => {
    const terms = Array.from({ length: 101 }, (_, index) => ({
      ...aiDraft,
      id: `ai-${index}`,
      fullyQualifiedName: `Customers.Term${index}`,
    }));
    (getGlossaryTerms as jest.Mock)
      .mockResolvedValueOnce({
        data: terms.slice(0, 100),
        paging: { after: 'next-terms', total: terms.length },
      })
      .mockResolvedValue({
        data: terms.slice(100),
        paging: { total: terms.length },
      });
    (getMemoryDerivations as jest.Mock).mockImplementation(
      async (_entityType: string, ids: string[]) => {
        if (ids.length > 100) {
          throw new Error('The derivations API accepts at most 100 IDs');
        }

        return ids.map((id) => ({
          ...derivation,
          entity: { id, type: 'glossaryTerm' },
        }));
      }
    );

    const { result } = renderHook(() => useGlossaryProposals(scope), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.counts).toEqual({ all: 101, ai: 101, person: 0 });
    expect(
      result.current.proposals.find(({ term }) => term.id === 'ai-100')
        ?.derivation?.entity.id
    ).toBe('ai-100');
  });

  it('finds approval requests beyond the first task page', async () => {
    (listTasks as jest.Mock)
      .mockResolvedValueOnce({
        data: [
          {
            ...approvalTask,
            id: 'other-task',
            about: {
              fullyQualifiedName: 'Customers.Other',
              type: 'glossaryTerm',
            },
          },
        ],
        paging: { after: 'next-tasks', total: 2 },
      })
      .mockResolvedValue({ data: [approvalTask], paging: { total: 2 } });
    const { result } = renderHook(() => useGlossaryProposals(scope), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(
      result.current.proposals.find(({ term }) => term.id === personDraft.id)
        ?.approvalTask
    ).toEqual(approvalTask);
  });

  it('decides an AI draft on the term and a person proposal through its request', async () => {
    (patchGlossaryTerm as jest.Mock).mockResolvedValue({});
    (resolveTask as jest.Mock).mockResolvedValue({
      id: 'task-id',
      status: TaskEntityStatus.Rejected,
    });
    const { result } = renderHook(() => useGlossaryProposals(scope), {
      wrapper,
    });
    await waitFor(() => expect(result.current.proposals).toHaveLength(2));
    const [ai, person] = result.current.proposals;

    await act(async () => {
      await result.current.decide(ai, EntityStatus.Approved);
      await result.current.decide(person, EntityStatus.Rejected, 'Duplicate');
    });

    expect(patchGlossaryTerm).toHaveBeenCalledWith('ai-id', [
      { op: 'replace', path: '/entityStatus', value: EntityStatus.Approved },
    ]);
    expect(resolveTask).toHaveBeenCalledWith(
      'task-id',
      expect.objectContaining({ comment: 'Duplicate', newValue: 'rejected' })
    );
  });

  it('keeps a proposal pending while its request waits for other reviewers', async () => {
    (resolveTask as jest.Mock).mockResolvedValue({
      id: 'task-id',
      status: TaskEntityStatus.Open,
    });
    const { result } = renderHook(() => useGlossaryProposals(scope), {
      wrapper,
    });
    await waitFor(() => expect(result.current.proposals).toHaveLength(2));

    let isSettled = true;
    await act(async () => {
      isSettled = await result.current.decide(
        result.current.proposals[1],
        EntityStatus.Approved
      );
    });

    expect(isSettled).toBe(false);
  });

  it('asks for nothing without a scope', () => {
    const { result } = renderHook(() => useGlossaryProposals(undefined), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(false);
    expect(getGlossaryTerms).not.toHaveBeenCalled();
  });

  it('counts pending terms per glossary, and the AI ones apart', async () => {
    const buckets = (counts: Record<string, number>) => ({
      data: {
        aggregations: {
          'sterms#glossary.id': {
            buckets: Object.entries(counts).map(([key, doc_count]) => ({
              key,
              doc_count,
            })),
          },
        },
      },
    });
    (postExactAggregateFieldOptions as jest.Mock)
      .mockResolvedValueOnce(buckets({ 'metrics-id': 2, 'success-id': 1 }))
      .mockResolvedValueOnce(buckets({ 'metrics-id': 1 }));

    const { result } = renderHook(() => useGlossaryPendingCounts(), {
      wrapper,
    });

    await waitFor(() => expect(result.current).toBeDefined());

    expect(result.current).toEqual({
      all: { 'metrics-id': 2, 'success-id': 1 },
      ai: { 'metrics-id': 1 },
    });

    const [[allRequest], [aiRequest]] = (
      postExactAggregateFieldOptions as jest.Mock
    ).mock.calls;

    expect(allRequest).toEqual(
      expect.objectContaining({
        fieldName: 'glossary.id',
        fieldValue: '.*',
      })
    );
    expect(aiRequest.query).toContain('provider.keyword');
  });
});
