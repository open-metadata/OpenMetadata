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
import {
  listTasks,
  resolveTask,
  TaskEntityStatus,
} from '../../../rest/tasksAPI';
import { useGlossaryProposals } from './useGlossaryProposals';

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossaryTerms: jest.fn(),
  patchGlossaryTerm: jest.fn(),
}));

jest.mock('../../../rest/contextMemoryAPI', () => ({
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
});
