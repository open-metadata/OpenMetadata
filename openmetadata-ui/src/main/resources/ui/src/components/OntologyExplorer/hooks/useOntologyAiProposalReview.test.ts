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
import { act, renderHook, waitFor } from '@testing-library/react';
import {
    OntologyChangeOperation,
    OntologyChangeSet,
    OntologyChangeSetState,
    OperationState,
    OperationType,
    Provenance
} from '../../../generated/entity/data/ontologyChangeSet';
import { OntologyEditLock } from '../../../generated/type/ontologyEditLock';
import {
    acquireOntologyEditLock,
    applyOntologyChangeSet,
    createOntologyChangeSet,
    discardOntologyChangeSet,
    getOntologyChangeSet,
    listOntologyChangeSets,
    releaseOntologyEditLock,
    replaceOntologyChangeOperations
} from '../../../rest/ontologyAPI';
import { showSuccessToast } from '../../../utils/ToastUtils';
import { OntologyNode } from '../OntologyExplorer.interface';
import { useOntologyAiProposalReview } from './useOntologyAiProposalReview';

jest.mock('../../../rest/ontologyAPI', () => ({
  acquireOntologyEditLock: jest.fn(),
  applyOntologyChangeSet: jest.fn(),
  createOntologyChangeSet: jest.fn(),
  discardOntologyChangeSet: jest.fn(),
  getOntologyChangeSet: jest.fn(),
  listOntologyChangeSets: jest.fn(),
  releaseOntologyEditLock: jest.fn(),
  replaceOntologyChangeOperations: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mocked = <T extends (...args: never[]) => unknown>(fn: T) =>
  fn as unknown as jest.MockedFunction<T>;
const mockApply = mocked(applyOntologyChangeSet);
const mockGet = mocked(getOntologyChangeSet);
const mockList = mocked(listOntologyChangeSets);

const FINANCE = new Set(['finance-id']);
const ACCOUNT: OntologyNode = {
  fullyQualifiedName: 'Finance.Account',
  glossaryId: 'finance-id',
  id: 'account-id',
  label: 'Account',
  type: 'glossaryTerm',
};
const LEDGER: OntologyNode = {
  fullyQualifiedName: 'Finance.Ledger',
  glossaryId: 'finance-id',
  id: 'ledger-id',
  label: 'Ledger',
  type: 'glossaryTerm',
};
const GRAPH_NODES = [ACCOUNT, LEDGER];

const createTerm = (id: string, name: string): OntologyChangeOperation =>
  ({
    id,
    operationType: OperationType.CreateTerm,
    sourceMemoryIds: ['memory-1'],
    state: OperationState.Active,
    term: {
      fullyQualifiedName: `Finance.${name}`,
      glossary: { id: 'finance-id', name: 'Finance', type: 'glossary' },
      id: `${id}-term`,
      name,
    },
  } as OntologyChangeOperation);

const relate = (id: string): OntologyChangeOperation =>
  ({
    id,
    operationType: OperationType.AddRelationship,
    relationship: {
      fromTerm: { id: 'account-id', type: 'glossaryTerm' },
      id: `${id}-rel`,
      provenance: Provenance.AISuggested,
      relationshipType: { id: 'related-id', name: 'relatedTo', type: 'x' },
      toTerm: { id: 'ledger-id', type: 'glossaryTerm' },
    },
    state: OperationState.Active,
  } as OntologyChangeOperation);

const draft = (
  id: string,
  operations: OntologyChangeOperation[],
  state = OntologyChangeSetState.Draft
): OntologyChangeSet =>
  ({
    displayName: id,
    fullyQualifiedName: id,
    glossaries: [{ fullyQualifiedName: 'Finance', id: 'finance-id' }],
    id,
    name: id,
    operations,
    state,
    undoCursor: operations.length,
  } as OntologyChangeSet);

const REVENUE = draft('cs-revenue', [createTerm('op-revenue', 'Revenue')]);
const MARGIN = draft('cs-margin', [createTerm('op-margin', 'Margin')]);
const LINK = draft('cs-link', [relate('op-link')]);
const DRAFTS = [REVENUE, MARGIN, LINK];

const renderReview = async (changeSets = DRAFTS) => {
  mockList.mockResolvedValue({
    data: changeSets,
    paging: { total: changeSets.length },
  });
  const onApplied = jest.fn();
  const onEditTerm = jest.fn();
  const hook = renderHook(() =>
    useOntologyAiProposalReview({
      glossaryIds: FINANCE,
      graphNodes: GRAPH_NODES,
      isEnabled: true,
      onApplied,
      onEditTerm,
    })
  );
  await waitFor(() =>
    expect(hook.result.current.queue).toHaveLength(
      changeSets === DRAFTS ? 3 : changeSets.length
    )
  );

  return { ...hook, onApplied, onEditTerm };
};

describe('useOntologyAiProposalReview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked(acquireOntologyEditLock).mockResolvedValue({
      version: 1,
    } as OntologyEditLock);
    mocked(releaseOntologyEditLock).mockResolvedValue(undefined);
    mocked(createOntologyChangeSet).mockImplementation(async (body) =>
      draft(`split-${body.name}`, [])
    );
    mocked(discardOntologyChangeSet).mockResolvedValue(
      draft('discarded', [], OntologyChangeSetState.Discarded)
    );
    mocked(replaceOntologyChangeOperations).mockResolvedValue(draft('x', []));
    mockGet.mockImplementation(
      async (id) =>
        DRAFTS.find((changeSet) => changeSet.id === id) ?? draft(id, [])
    );
    mockApply.mockImplementation(async (id) =>
      draft(id, [], OntologyChangeSetState.Applied)
    );
  });

  it('draws proposed terms and relationships and opens the list on terms first', async () => {
    const { result } = await renderReview();

    expect(result.current.proposedNodes.map((node) => node.id)).toEqual([
      'proposed-op-revenue',
      'proposed-op-margin',
    ]);
    expect(result.current.proposedEdges).toEqual([
      expect.objectContaining({ from: 'account-id', to: 'ledger-id' }),
    ]);

    act(() => result.current.openList());

    expect(result.current.view).toEqual({ kind: 'list', tab: 'terms' });
  });

  it('opens the list on relationships when no term is proposed', async () => {
    const { result } = await renderReview([LINK]);

    act(() => result.current.openList());

    expect(result.current.view).toEqual({ kind: 'list', tab: 'relationships' });
  });

  it('marks the open term as the focused canvas node', async () => {
    const { result } = await renderReview();

    act(() =>
      result.current.openProposal({
        changeSetId: 'cs-margin',
        operationId: 'op-margin',
      })
    );

    expect(result.current.focusNodeId).toBe('proposed-op-margin');
  });

  it('adds a term, then hands it to edit mode and closes the drawer on "Add & edit"', async () => {
    const { onApplied, onEditTerm, result } = await renderReview();
    act(() =>
      result.current.openProposal({
        changeSetId: 'cs-revenue',
        operationId: 'op-revenue',
      })
    );

    await act(() =>
      result.current.applyTerm(result.current.proposals.terms[0], new Set(), true)
    );

    expect(mockApply).toHaveBeenCalledWith('cs-revenue', expect.anything());
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(onEditTerm).toHaveBeenCalledWith('Finance.Revenue');
    expect(result.current.view).toBeNull();
  });

  it('moves on to the next proposal after adding a term without editing', async () => {
    const { onEditTerm, result } = await renderReview();
    act(() =>
      result.current.openProposal({
        changeSetId: 'cs-revenue',
        operationId: 'op-revenue',
      })
    );

    await act(() =>
      result.current.applyTerm(
        result.current.proposals.terms[0],
        new Set(),
        false
      )
    );

    expect(onEditTerm).not.toHaveBeenCalled();
    expect(result.current.view).toEqual({ key: 'op-margin', kind: 'item' });
  });

  it('keeps the drawer on the proposal and does not enter edit when the add fails', async () => {
    mockApply.mockRejectedValueOnce(new Error('boom'));
    const { onApplied, onEditTerm, result } = await renderReview();
    const view = { key: 'op-revenue', kind: 'item' } as const;
    act(() => result.current.setView(view));

    await act(() =>
      result.current.applyTerm(result.current.proposals.terms[0], new Set(), true)
    );

    expect(onApplied).not.toHaveBeenCalled();
    expect(onEditTerm).not.toHaveBeenCalled();
    expect(result.current.view).toEqual(view);
  });

  it('dismisses the last proposal by stepping back to the previous one', async () => {
    const { onApplied, result } = await renderReview();
    act(() =>
      result.current.openProposal({
        changeSetId: 'cs-link',
        operationId: 'op-link',
      })
    );

    await act(() =>
      result.current.rejectRelationship(
        result.current.proposals.relationships[0]
      )
    );

    expect(mocked(discardOntologyChangeSet)).toHaveBeenCalledWith(
      'cs-link',
      expect.anything()
    );
    expect(mockApply).not.toHaveBeenCalled();
    expect(onApplied).not.toHaveBeenCalled();
    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.term-proposal-dismissed'
    );
    expect(result.current.view).toEqual({ key: 'op-margin', kind: 'item' });
  });

  it('adds every term at once and leaves the relationships tab open', async () => {
    const { onApplied, result } = await renderReview();
    act(() => result.current.openList());

    await act(() => result.current.applyAllTerms());

    expect(mockApply.mock.calls.map(([id]) => id)).toEqual([
      'cs-revenue',
      'cs-margin',
    ]);
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(result.current.view).toEqual({
      kind: 'list',
      tab: 'relationships',
    });
  });

  it('closes the drawer once the last kind of proposal is accepted in bulk', async () => {
    const { result } = await renderReview([LINK]);
    act(() => result.current.openList());

    await act(() => result.current.applyAllRelationships());

    expect(result.current.view).toBeNull();
  });

  it('loads nothing while proposals are not shown', () => {
    const { result } = renderHook(() =>
      useOntologyAiProposalReview({
        glossaryIds: FINANCE,
        isEnabled: false,
        onApplied: jest.fn(),
        onEditTerm: jest.fn(),
      })
    );

    expect(mockList).not.toHaveBeenCalled();
    expect(result.current.queue).toEqual([]);
  });
});
