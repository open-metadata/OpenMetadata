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
import { MemoryDerivation } from '../../generated/entity/context/memoryDerivation';
import {
  EntityStatus,
  GlossaryTerm,
  ProviderType,
} from '../../generated/entity/data/glossaryTerm';
import { User } from '../../generated/entity/teams/user';
import { Task } from '../../rest/tasksAPI';
import {
  canDecideProposal,
  countProposals,
  filterProposals,
  getConfidencePercent,
  getDeciders,
  getProposalAuthor,
  getProposalSource,
  toProposals,
} from './GlossaryReview.utils';

const reviewer = { id: 'reviewer-id', name: 'karan', type: 'user' };
const author = { id: 'author-id', name: 'karthick', type: 'user' };

const term = (overrides: Partial<GlossaryTerm>): GlossaryTerm => ({
  id: 'term-id',
  name: 'Churn',
  fullyQualifiedName: 'Customers.Churn',
  description: 'Customers who cancel.',
  glossary: { id: 'glossary-id', type: 'glossary' },
  entityStatus: EntityStatus.Draft,
  updatedBy: 'karthick',
  ...overrides,
});

const aiDraft = term({ id: 'ai-id', provider: ProviderType.Automation });
const personDraft = term({
  id: 'person-id',
  fullyQualifiedName: 'Customers.Escrow',
  entityStatus: EntityStatus.InReview,
});
const approved = term({
  id: 'approved-id',
  entityStatus: EntityStatus.Approved,
});

const derivation: MemoryDerivation = {
  entity: { id: 'ai-id', type: 'glossaryTerm' },
  memory: { id: 'memory-id', type: 'contextMemory', name: 'churn' },
  evidence: {
    agent: 'Glossary Agent',
    confidence: 0.916,
    reasons: ['A metric'],
  },
};

const approvalTask = {
  id: 'task-id',
  about: { fullyQualifiedName: 'Customers.Escrow', type: 'glossaryTerm' },
  assignees: [reviewer],
  createdBy: { ...author, displayName: 'Karthick Sharan' },
} as unknown as Task;

const user = (id: string) => ({ id, name: id, email: `${id}@x.io` } as User);

describe('GlossaryReview utils', () => {
  it('tells an AI agent proposal from a person one, and neither once decided', () => {
    expect(getProposalSource(aiDraft)).toBe('ai');
    expect(getProposalSource(personDraft)).toBe('person');
    expect(getProposalSource(approved)).toBeUndefined();
    expect(
      getProposalSource({ ...aiDraft, entityStatus: EntityStatus.Rejected })
    ).toBeUndefined();
  });

  it('pairs each pending term with its evidence or its approval request', () => {
    const proposals = toProposals(
      [aiDraft, personDraft, approved],
      [derivation],
      [approvalTask]
    );

    expect(proposals.map((proposal) => proposal.term.id)).toEqual([
      'ai-id',
      'person-id',
    ]);
    expect(proposals[0].derivation).toBe(derivation);
    expect(proposals[1].approvalTask).toBe(approvalTask);
    expect(countProposals(proposals)).toEqual({ all: 2, ai: 1, person: 1 });
    expect(filterProposals(proposals, 'person')).toEqual([proposals[1]]);
    expect(filterProposals(proposals, 'all')).toBe(proposals);
  });

  it('reads the confidence as a whole percentage and the author from the request', () => {
    const [ai, person] = toProposals(
      [aiDraft, personDraft],
      [derivation],
      [approvalTask]
    );

    expect(getConfidencePercent(ai.derivation)).toBe(92);
    expect(getConfidencePercent(undefined)).toBeUndefined();
    expect(getProposalAuthor(person)).toBe('Karthick Sharan');
    expect(getProposalAuthor(ai)).toBe('karthick');
  });

  it('lets anyone who can edit decide an AI draft in a glossary without reviewers', () => {
    const [ai] = toProposals([aiDraft], [], []);

    expect(canDecideProposal(ai, user('anyone'), true)).toBe(true);
    expect(canDecideProposal(ai, user('anyone'), false)).toBe(false);
    expect(getDeciders(ai)).toEqual([]);
  });

  it('lets only reviewers decide an AI draft in a reviewed glossary', () => {
    const [ai] = toProposals([{ ...aiDraft, reviewers: [reviewer] }], [], []);

    expect(canDecideProposal(ai, user('reviewer-id'), true)).toBe(true);
    expect(canDecideProposal(ai, user('admin'), true)).toBe(false);
    expect(getDeciders(ai)).toEqual([reviewer]);
  });

  it('lets only the assignees decide a proposal held by its approval request', () => {
    const [person] = toProposals([personDraft], [], [approvalTask]);

    expect(canDecideProposal(person, user('reviewer-id'), false)).toBe(true);
    expect(canDecideProposal(person, user('author-id'), true)).toBe(false);
    expect(canDecideProposal(person, undefined, true)).toBe(false);
    expect(getDeciders(person)).toEqual([reviewer]);
  });
});
