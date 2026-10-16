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
  replaceOntologyChangeOperations,
} from '../../../rest/ontologyAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ProposalDecision } from '../utils/ontologyProposals';
import { useOntologyProposals } from './useOntologyProposals';

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
const mockCreate = mocked(createOntologyChangeSet);
const mockDiscard = mocked(discardOntologyChangeSet);
const mockGet = mocked(getOntologyChangeSet);
const mockList = mocked(listOntologyChangeSets);
const mockReplace = mocked(replaceOntologyChangeOperations);

const operation = (id: string): OntologyChangeOperation =>
  ({
    id,
    operationType: OperationType.CreateTerm,
    sourceMemoryIds: ['memory-1'],
    state: OperationState.Active,
    term: { name: id },
  } as OntologyChangeOperation);

const draft = (
  id: string,
  operations: OntologyChangeOperation[],
  state = OntologyChangeSetState.Draft
): OntologyChangeSet =>
  ({
    description: 'From memories',
    displayName: 'Memory terms',
    fullyQualifiedName: id,
    glossaries: [{ fullyQualifiedName: 'Finance', id: 'finance-id' }],
    id,
    name: id,
    operations,
    state,
    undoCursor: operations.length,
  } as OntologyChangeSet);

const REVENUE = operation('op-revenue');
const MARGIN = operation('op-margin');
const SHARED = draft('cs-shared', [REVENUE, MARGIN]);
const LEASE = { sessionId: expect.any(String), version: 3 };

const decide = (
  changeSetId: string,
  ids: string[],
  extra: Partial<ProposalDecision> = {}
): ProposalDecision => ({ apply: ids, changeSetId, retire: ids, ...extra });

const renderProposals = async () => {
  mockList.mockResolvedValue({ data: [SHARED], paging: { total: 1 } });
  const hook = renderHook(() => useOntologyProposals(true));
  await waitFor(() => expect(hook.result.current.changeSets).toHaveLength(1));

  return hook;
};

describe('useOntologyProposals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked(acquireOntologyEditLock).mockResolvedValue({
      version: 3,
    } as OntologyEditLock);
    mocked(releaseOntologyEditLock).mockResolvedValue(undefined);
    mockGet.mockImplementation(async (id) =>
      id === 'cs-single' ? draft('cs-single', [REVENUE]) : SHARED
    );
    mockApply.mockImplementation(async (id) =>
      draft(id, [], OntologyChangeSetState.Applied)
    );
  });

  it('loads every editable draft so AI relationships are found too', async () => {
    await renderProposals();

    expect(mockList).toHaveBeenCalledWith({
      fields: 'operations',
      limit: 100,
      state: [OntologyChangeSetState.Draft, OntologyChangeSetState.ApplyFailed],
    });
  });

  it('moves part of a shared draft into its own draft and applies that', async () => {
    const { result } = await renderProposals();
    mockCreate.mockResolvedValue(draft('cs-split', [REVENUE]));

    let isDone = false;
    await act(async () => {
      isDone = await result.current.apply([
        decide('cs-shared', ['op-revenue']),
      ]);
    });

    expect(isDone).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        glossaries: ['Finance'],
        operations: [REVENUE],
        state: 'DRAFT',
        undoCursor: 1,
      })
    );
    expect(mockReplace).toHaveBeenCalledWith('cs-shared', {
      lease: LEASE,
      operations: [MARGIN],
      undoCursor: 1,
    });
    expect(mockApply).toHaveBeenCalledWith('cs-split', { lease: LEASE });
  });

  it('applies a whole draft in place, unless an operation was edited', async () => {
    const { result } = await renderProposals();

    await act(async () => {
      await result.current.apply([decide('cs-single', ['op-revenue'])]);
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockApply).toHaveBeenCalledWith('cs-single', { lease: LEASE });
    // The server releases the lease of an applied change set itself.
    expect(releaseOntologyEditLock).not.toHaveBeenCalled();

    const edited = { ...REVENUE, rationale: 'retyped' };
    mockCreate.mockResolvedValue(draft('cs-split', [edited]));
    await act(async () => {
      await result.current.apply([
        decide('cs-single', ['op-revenue'], { edited }),
      ]);
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ operations: [edited] })
    );
  });

  it('reports a failed apply and stops the batch', async () => {
    const { result } = await renderProposals();
    mockApply.mockResolvedValueOnce({
      ...draft('cs-single', [REVENUE], OntologyChangeSetState.ApplyFailed),
      applicationResult: {
        appliedAt: 1,
        appliedBy: 'admin',
        operationsApplied: 0,
        operationsFailed: 1,
        operationsProcessed: 1,
        results: [{ message: 'Term already exists', operationId: 'x' }],
      },
    } as OntologyChangeSet);

    let isDone = true;
    await act(async () => {
      isDone = await result.current.apply([
        decide('cs-single', ['op-revenue']),
        decide('cs-shared', ['op-margin']),
      ]);
    });

    expect(isDone).toBe(false);
    expect(showErrorToast).toHaveBeenCalledWith('Term already exists');
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(releaseOntologyEditLock).toHaveBeenCalledWith(
      'ontologyChangeSet',
      'cs-single',
      expect.any(String)
    );
  });

  it('drops a rejected item from a shared draft and discards an emptied one', async () => {
    const { result } = await renderProposals();

    await act(async () => {
      await result.current.reject([
        decide('cs-shared', ['op-margin']),
        decide('cs-single', ['op-revenue']),
      ]);
    });

    expect(mockReplace).toHaveBeenCalledWith('cs-shared', {
      lease: LEASE,
      operations: [REVENUE],
      undoCursor: 1,
    });
    expect(mockDiscard).toHaveBeenCalledWith('cs-single', { lease: LEASE });
    expect(mockApply).not.toHaveBeenCalled();
  });
});
