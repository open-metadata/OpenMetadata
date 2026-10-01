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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  OntologyChangeSet,
  OntologyChangeSetState,
  OperationState,
  OperationType,
} from '../../generated/entity/data/ontologyChangeSet';
import {
  applyOntologyChangeSet,
  listOntologyChangeSets,
  submitOntologyChangeSet,
} from '../../rest/ontologyAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import OntologyMemoryReviewPanel from './OntologyMemoryReviewPanel';

jest.mock('../../rest/ontologyAPI', () => ({
  applyOntologyChangeSet: jest.fn(),
  listOntologyChangeSets: jest.fn(),
  submitOntologyChangeSet: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('./hooks/useOntologyEditLease', () => ({
  useOntologyEditLease: () => ({
    isOwned: true,
    lock: { sessionId: 'session-1', version: 2 },
  }),
}));

const draft: OntologyChangeSet = {
  description: 'Derived from an inactive customer memory',
  displayName: 'memory-glossary-16',
  fullyQualifiedName: 'memory-glossary-16',
  glossaries: [{ id: 'business-id', name: 'business', type: 'glossary' }],
  id: 'draft-16',
  name: 'memory-glossary-16',
  operations: [
    {
      confidence: 0.85,
      id: 'operation-1',
      operationType: OperationType.CreateTerm,
      sourceMemoryIds: ['memory-1'],
      state: OperationState.Active,
      term: {
        description: 'A customer inactive for at least three months',
        name: 'inactive_customer',
      } as OntologyChangeSet['operations'][number]['term'],
    },
  ],
  state: OntologyChangeSetState.Draft,
  undoCursor: 1,
  updatedAt: 10,
};

const mockList = listOntologyChangeSets as jest.MockedFunction<
  typeof listOntologyChangeSets
>;
const mockSubmit = submitOntologyChangeSet as jest.MockedFunction<
  typeof submitOntologyChangeSet
>;
const mockApply = applyOntologyChangeSet as jest.MockedFunction<
  typeof applyOntologyChangeSet
>;

describe('OntologyMemoryReviewPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockImplementation(async ({ state } = {}) => ({
      data: state === OntologyChangeSetState.Draft ? [draft] : [],
      paging: { total: 1 },
    }));
  });

  it('shows the persisted glossary, term, and source memory', async () => {
    render(
      <OntologyMemoryReviewPanel canApply canSubmit onApplied={jest.fn()} />
    );

    expect(await screen.findByText('inactive_customer')).toBeInTheDocument();
    expect(screen.getAllByText(/business/).length).toBeGreaterThan(0);
    expect(screen.getByText(/memory-1/)).toBeInTheDocument();
    expect(screen.getByText(/85%/)).toBeInTheDocument();
    expect(mockList).toHaveBeenCalledWith({
      fields: 'operations',
      limit: 100,
      state: OntologyChangeSetState.Draft,
    });
  });

  it('selects the linked draft even when another proposal is newer', async () => {
    const newer = {
      ...draft,
      id: 'draft-17',
      name: 'memory-glossary-17',
      displayName: 'memory-glossary-17',
      updatedAt: 20,
    };
    mockList.mockImplementation(async ({ state } = {}) => ({
      data: state === OntologyChangeSetState.Draft ? [newer, draft] : [],
      paging: { total: 2 },
    }));

    render(
      <OntologyMemoryReviewPanel
        canApply
        canSubmit
        initialDraftId="draft-16"
        onApplied={jest.fn()}
      />
    );

    expect(
      await screen.findByTestId('ontology-memory-draft-draft-16')
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('submits the draft and applies it only after review', async () => {
    const onApplied = jest.fn();
    mockSubmit.mockResolvedValue({
      ...draft,
      state: OntologyChangeSetState.Submitted,
    });
    mockApply.mockResolvedValue({
      ...draft,
      state: OntologyChangeSetState.Applied,
    });

    render(
      <OntologyMemoryReviewPanel canApply canSubmit onApplied={onApplied} />
    );

    fireEvent.click(await screen.findByTestId('ontology-memory-submit'));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));

    expect(mockApply).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByTestId('ontology-memory-apply'));
    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));

    expect(mockApply).toHaveBeenCalledWith('draft-16', {
      lease: { sessionId: 'session-1', version: 2 },
    });
    expect(showSuccessToast).toHaveBeenCalled();
  });

  it('keeps a failed apply available for retry', async () => {
    mockList.mockImplementation(async ({ state } = {}) => ({
      data:
        state === OntologyChangeSetState.Submitted
          ? [{ ...draft, state: OntologyChangeSetState.Submitted }]
          : [],
      paging: { total: 1 },
    }));
    mockApply.mockResolvedValue({
      ...draft,
      state: OntologyChangeSetState.ApplyFailed,
    });

    render(
      <OntologyMemoryReviewPanel canApply canSubmit onApplied={jest.fn()} />
    );

    fireEvent.click(await screen.findByTestId('ontology-memory-apply'));
    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(screen.getByTestId('ontology-memory-apply')).toBeInTheDocument();
  });
});
