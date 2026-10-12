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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  OntologyChangeSet,
  OntologyChangeSetState,
  OperationState,
  OperationType,
} from '../../generated/entity/data/ontologyChangeSet';
import { getContextMemoryById } from '../../rest/contextMemoryAPI';
import {
  applyOntologyChangeSet,
  discardOntologyChangeSet,
  getOntologyChangeSet,
  listOntologyChangeSets,
  submitOntologyChangeSet,
} from '../../rest/ontologyAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import OntologyMemoryReviewPanel from './OntologyMemoryReviewPanel';

jest.mock('../../rest/ontologyAPI', () => ({
  applyOntologyChangeSet: jest.fn(),
  discardOntologyChangeSet: jest.fn(),
  getOntologyChangeSet: jest.fn(),
  listOntologyChangeSets: jest.fn(),
  submitOntologyChangeSet: jest.fn(),
}));

jest.mock('../../rest/contextMemoryAPI', () => ({
  getContextMemoryById: jest.fn(),
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
const mockDiscard = discardOntologyChangeSet as jest.MockedFunction<
  typeof discardOntologyChangeSet
>;
const mockGetChangeSet = getOntologyChangeSet as jest.MockedFunction<
  typeof getOntologyChangeSet
>;
const mockGetMemory = getContextMemoryById as jest.MockedFunction<
  typeof getContextMemoryById
>;

const renderPanel = (panel: ReactElement) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }>
      <MemoryRouter>{panel}</MemoryRouter>
    </QueryClientProvider>
  );

describe('OntologyMemoryReviewPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockResolvedValue({ data: [draft], paging: { total: 1 } });
    mockGetMemory.mockResolvedValue({
      id: 'memory-1',
      name: 'inactive-customer',
      title: 'Inactive customer',
    } as Awaited<ReturnType<typeof getContextMemoryById>>);
  });

  it('shows the persisted glossary, term, and a link to the source memory', async () => {
    renderPanel(
      <OntologyMemoryReviewPanel
        canApply
        canDiscard
        canSubmit
        onApplied={jest.fn()}
      />
    );

    expect(await screen.findByText('inactive_customer')).toBeInTheDocument();
    expect(screen.getAllByText(/business/).length).toBeGreaterThan(0);
    expect(
      await screen.findByRole('link', { name: 'Inactive customer' })
    ).toHaveAttribute(
      'href',
      '/context-center/memories?memory=inactive-customer'
    );
    expect(screen.queryByText(/memory-1/)).not.toBeInTheDocument();
    expect(screen.getByText(/85%/)).toBeInTheDocument();
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(mockList).toHaveBeenCalledWith({
      fields: 'operations',
      limit: 50,
      memorySourced: true,
      state: [
        OntologyChangeSetState.Draft,
        OntologyChangeSetState.Submitted,
        OntologyChangeSetState.ApplyFailed,
      ],
    });
  });

  it('counts source memories the reviewer cannot open without naming them', async () => {
    mockGetMemory.mockRejectedValue(new Error('forbidden'));

    renderPanel(
      <OntologyMemoryReviewPanel
        canApply
        canDiscard
        canSubmit
        onApplied={jest.fn()}
      />
    );

    expect(
      await screen.findByTestId('ontology-memory-sources')
    ).toHaveTextContent('+1');
  });

  it('opens a linked draft that is not on the first page', async () => {
    mockList.mockResolvedValue({ data: [], paging: { total: 0 } });
    mockGetChangeSet.mockResolvedValue(draft);

    renderPanel(
      <OntologyMemoryReviewPanel
        canApply
        canDiscard
        canSubmit
        initialDraftId="draft-16"
        onApplied={jest.fn()}
      />
    );

    expect(
      await screen.findByTestId('ontology-memory-draft-draft-16')
    ).toHaveAttribute('aria-pressed', 'true');
    expect(mockGetChangeSet).toHaveBeenCalledWith('draft-16', 'operations');
  });

  it('loads older reviewable drafts using the server cursor', async () => {
    const older = {
      ...draft,
      id: 'draft-15',
      name: 'memory-glossary-15',
      displayName: 'memory-glossary-15',
      updatedAt: 5,
    };
    mockList
      .mockResolvedValueOnce({
        data: [draft],
        paging: { after: 'older-cursor', total: 2 },
      })
      .mockResolvedValueOnce({ data: [older], paging: { total: 2 } });

    renderPanel(
      <OntologyMemoryReviewPanel
        canApply
        canDiscard
        canSubmit
        onApplied={jest.fn()}
      />
    );

    fireEvent.click(await screen.findByTestId('ontology-memory-load-more'));

    expect(
      await screen.findByTestId('ontology-memory-draft-draft-15')
    ).toBeInTheDocument();
    expect(mockList).toHaveBeenNthCalledWith(2, {
      after: 'older-cursor',
      fields: 'operations',
      limit: 50,
      memorySourced: true,
      state: [
        OntologyChangeSetState.Draft,
        OntologyChangeSetState.Submitted,
        OntologyChangeSetState.ApplyFailed,
      ],
    });
    expect(
      screen.getByTestId('ontology-memory-draft-draft-16')
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.queryByTestId('ontology-memory-load-more')
    ).not.toBeInTheDocument();
  });

  it('discards a draft so its memory can be proposed again', async () => {
    mockDiscard.mockResolvedValue({
      ...draft,
      state: OntologyChangeSetState.Discarded,
    });

    renderPanel(
      <OntologyMemoryReviewPanel
        canApply
        canDiscard
        canSubmit
        onApplied={jest.fn()}
      />
    );

    fireEvent.click(await screen.findByTestId('ontology-memory-discard'));

    expect(await screen.findByText('label.no-data')).toBeInTheDocument();
    expect(mockDiscard).toHaveBeenCalledWith('draft-16', {
      lease: { sessionId: 'session-1', version: 2 },
    });
    expect(showSuccessToast).toHaveBeenCalledWith('message.draft-discarded');
  });

  it('surfaces the server message when an action is rejected', async () => {
    const error = new Error('Glossary already exists: business');
    mockSubmit.mockRejectedValue(error);

    renderPanel(
      <OntologyMemoryReviewPanel
        canApply
        canDiscard
        canSubmit
        onApplied={jest.fn()}
      />
    );

    fireEvent.click(await screen.findByTestId('ontology-memory-submit'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));
  });

  it('selects the linked draft even when another proposal is newer', async () => {
    const newer = {
      ...draft,
      id: 'draft-17',
      name: 'memory-glossary-17',
      displayName: 'memory-glossary-17',
      updatedAt: 20,
    };
    mockList.mockResolvedValue({ data: [newer, draft], paging: { total: 2 } });

    renderPanel(
      <OntologyMemoryReviewPanel
        canApply
        canDiscard
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

    renderPanel(
      <OntologyMemoryReviewPanel
        canApply
        canDiscard
        canSubmit
        onApplied={onApplied}
      />
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
    mockList.mockResolvedValue({
      data: [{ ...draft, state: OntologyChangeSetState.Submitted }],
      paging: { total: 1 },
    });
    mockApply.mockResolvedValue({
      ...draft,
      state: OntologyChangeSetState.ApplyFailed,
    });

    renderPanel(
      <OntologyMemoryReviewPanel
        canApply
        canDiscard
        canSubmit
        onApplied={jest.fn()}
      />
    );

    fireEvent.click(await screen.findByTestId('ontology-memory-apply'));
    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(screen.getByTestId('ontology-memory-apply')).toBeInTheDocument();
  });
});
