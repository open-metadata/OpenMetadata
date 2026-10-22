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
import {
  patchGlossaryTerm,
  searchGlossaryTermsPaginated,
} from '../../../rest/glossaryAPI';
import {
  listTasks,
  resolveTask,
  Task,
  TaskEntityStatus,
} from '../../../rest/tasksAPI';
import { ProposalCounts } from '../../../utils/GlossaryReview/GlossaryReview.types';
import {
  PROPOSALS_PAGE_SIZE,
  useDecideProposal,
  useGlossaryProposalCounts,
  useGlossaryProposalPage,
  useTermDerivations,
} from './useGlossaryProposals';
import { searchTerms } from './useGlossaryProposals.mock';

jest.mock('../../../rest/glossaryAPI', () => ({
  patchGlossaryTerm: jest.fn(),
  searchGlossaryTermsPaginated: jest.fn(),
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
  entityStatus: EntityStatus.Draft,
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

const scope = {
  id: 'glossary-id',
  fullyQualifiedName: 'Customers',
  isGlossary: true,
};

const twoProposals: ProposalCounts = { all: 2, ai: 1, person: 1 };

const termsOf = (prefix: string, count: number, provider?: ProviderType) =>
  Array.from(
    { length: count },
    (_, index) =>
      ({
        id: `${prefix}-${index}`,
        name: `${prefix} ${index}`,
        fullyQualifiedName: `Customers.${prefix} ${index}`,
        provider,
        entityStatus: EntityStatus.Draft,
      } as GlossaryTerm)
  );

const ids = (items: GlossaryTerm[]) => items.map(({ id }) => id);

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
    (searchGlossaryTermsPaginated as jest.Mock).mockImplementation(
      searchTerms(() => terms)
    );
    (getMemoryDerivations as jest.Mock).mockResolvedValue([derivation]);
    (listTasks as jest.Mock).mockResolvedValue({ data: [approvalTask] });
  });

  it('counts the pending terms of a glossary, and the AI ones apart', async () => {
    const { result } = renderHook(() => useGlossaryProposalCounts(scope), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.counts).toEqual(twoProposals);
    expect(searchGlossaryTermsPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ glossary: 'glossary-id', limit: 1 })
    );
  });

  it('counts the pending children of a term', async () => {
    const { result } = renderHook(
      () => useGlossaryProposalCounts({ ...scope, isGlossary: false }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(searchGlossaryTermsPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ parent: 'glossary-id' })
    );
  });

  it('reads a page of AI proposals then people, with their evidence and approval requests', async () => {
    const { result } = renderHook(
      () =>
        useGlossaryProposalPage(
          scope,
          'all',
          PROPOSALS_PAGE_SIZE,
          twoProposals
        ),
      { wrapper }
    );

    await waitFor(() => expect(result.current.proposals).toHaveLength(2));

    const [ai, person] = result.current.proposals;

    expect(ai.term.id).toBe('ai-id');
    expect(ai.derivation).toEqual(derivation);
    expect(person.term.id).toBe('person-id');
    expect(person.approvalTask).toEqual(approvalTask);
    expect(getMemoryDerivations).toHaveBeenCalledWith('glossaryTerm', [
      'ai-id',
    ]);
    expect(listTasks).toHaveBeenCalledWith(
      expect.objectContaining({ aboutEntityIds: 'person-id' })
    );
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
    (listTasks as jest.Mock).mockImplementation(async ({ aboutEntityIds }) => ({
      data: aboutEntityIds === term.id ? [task] : [],
    }));
    const { result } = renderHook(
      () =>
        useGlossaryProposalPage(scope, 'person', PROPOSALS_PAGE_SIZE, {
          all: 1,
          ai: 0,
          person: 1,
        }),
      { wrapper }
    );

    await waitFor(() =>
      expect(result.current.proposals[0]?.approvalTask).toEqual(task)
    );
  });

  it('loads more proposals, moving on to people where the AI ones run out', async () => {
    const aiTerms = termsOf('ai', 7, ProviderType.Automation);
    const personTerms = termsOf('person', 13);
    terms = [...aiTerms, ...personTerms];
    const counts = { all: 20, ai: 7, person: 13 };
    const { result, rerender } = renderHook(
      ({ shown }) => useGlossaryProposalPage(scope, 'all', shown, counts),
      { initialProps: { shown: PROPOSALS_PAGE_SIZE }, wrapper }
    );

    await waitFor(() => expect(result.current.proposals).toHaveLength(15));

    expect(ids(result.current.proposals.map(({ term }) => term))).toEqual(
      ids([...aiTerms, ...personTerms.slice(0, 8)])
    );

    rerender({ shown: PROPOSALS_PAGE_SIZE * 2 });

    await waitFor(() => expect(result.current.proposals).toHaveLength(20));

    expect(ids(result.current.proposals.map(({ term }) => term))).toEqual(
      ids(terms)
    );
    expect(listTasks).not.toHaveBeenCalled();
  });

  it('counts and lists only the proposals a search matches', async () => {
    terms = [
      aiDraft,
      personDraft,
      ...termsOf('other', 3, ProviderType.Automation),
    ];
    const { result } = renderHook(
      () => {
        const { counts } = useGlossaryProposalCounts(scope, 'churn');

        return {
          counts,
          page: useGlossaryProposalPage(
            scope,
            'all',
            PROPOSALS_PAGE_SIZE,
            counts,
            'churn'
          ),
        };
      },
      { wrapper }
    );

    await waitFor(() => expect(result.current.page.proposals).toHaveLength(1));

    expect(result.current.counts).toEqual({ all: 1, ai: 1, person: 0 });
    expect(result.current.page.proposals[0].term.id).toBe('ai-id');
    expect(searchGlossaryTermsPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'churn' })
    );
  });

  it('still lists the AI drafts when the caller may not read memories', async () => {
    (getMemoryDerivations as jest.Mock).mockRejectedValue(new Error('403'));
    const { result } = renderHook(
      () =>
        useGlossaryProposalPage(
          scope,
          'all',
          PROPOSALS_PAGE_SIZE,
          twoProposals
        ),
      { wrapper }
    );

    await waitFor(() => expect(result.current.proposals).toHaveLength(2));

    expect(result.current.proposals[0].derivation).toBeUndefined();
  });

  it('keeps every proposal when the approval requests cannot be loaded', async () => {
    (listTasks as jest.Mock).mockRejectedValue(new Error('500'));
    const { result } = renderHook(
      () =>
        useGlossaryProposalPage(
          scope,
          'all',
          PROPOSALS_PAGE_SIZE,
          twoProposals
        ),
      { wrapper }
    );

    await waitFor(() => expect(result.current.proposals).toHaveLength(2));

    expect(result.current.proposals[1].approvalTask).toBeUndefined();
  });

  it('decides an AI draft on the term and a person proposal through its request, then recounts', async () => {
    const settleTerm = (id: string, entityStatus: EntityStatus) => {
      terms = terms.map((term) =>
        term.id === id ? { ...term, entityStatus } : term
      );
    };
    (patchGlossaryTerm as jest.Mock).mockImplementation(
      async (id: string, [{ value }]: { value: EntityStatus }[]) =>
        settleTerm(id, value)
    );
    (resolveTask as jest.Mock).mockImplementation(async () => {
      settleTerm('person-id', EntityStatus.Rejected);

      return { id: 'task-id', status: TaskEntityStatus.Rejected };
    });
    const { result } = renderHook(
      () => ({
        counts: useGlossaryProposalCounts(scope).counts,
        decide: useDecideProposal(),
      }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.counts).toEqual(twoProposals));

    const decisions: boolean[] = [];
    await act(async () => {
      decisions.push(
        await result.current.decide(
          { term: aiDraft, source: 'ai' },
          EntityStatus.Approved
        ),
        await result.current.decide(
          { term: personDraft, source: 'person', approvalTask },
          EntityStatus.Rejected,
          'Duplicate'
        )
      );
    });

    await waitFor(() =>
      expect(result.current.counts).toEqual({ all: 0, ai: 0, person: 0 })
    );

    expect(decisions).toEqual([true, true]);
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

  it('asks for nothing without a scope', () => {
    const { result } = renderHook(
      () => ({
        counts: useGlossaryProposalCounts(undefined),
        page: useGlossaryProposalPage(
          undefined,
          'all',
          PROPOSALS_PAGE_SIZE,
          twoProposals
        ),
      }),
      { wrapper }
    );

    expect(result.current.counts.isLoading).toBe(false);
    expect(result.current.page.isLoading).toBe(false);
    expect(searchGlossaryTermsPaginated).not.toHaveBeenCalled();
  });

  it('reads the evidence of many table rows in chunks the API accepts', async () => {
    const termIds = Array.from({ length: 101 }, (_, index) => `ai-${index}`);
    (getMemoryDerivations as jest.Mock).mockImplementation(
      async (_entityType: string, chunk: string[]) =>
        chunk.map((id) => ({
          ...derivation,
          entity: { id, type: 'glossaryTerm' },
        }))
    );

    const { result } = renderHook(() => useTermDerivations(termIds), {
      wrapper,
    });

    await waitFor(() => expect(result.current).toHaveLength(101));

    expect(getMemoryDerivations).toHaveBeenCalledTimes(2);
  });

  it('reads the evidence of a long queue in chunks the API accepts', async () => {
    terms = termsOf('ai', 101, ProviderType.Automation);
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

    const { result } = renderHook(
      () =>
        useGlossaryProposalPage(scope, 'ai', 101, {
          all: 101,
          ai: 101,
          person: 0,
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.proposals).toHaveLength(101));

    expect(result.current.proposals.every(({ derivation }) => derivation)).toBe(
      true
    );
  });
});
