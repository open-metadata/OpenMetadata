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
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import {
  EntityStatus,
  GlossaryTerm,
  ProviderType,
} from '../../../../generated/entity/data/glossaryTerm';
import { useGlossaryProposals } from '../../../../hooks/governance/glossary/useGlossaryProposals';
import { GlossaryProposal } from '../../../../utils/GlossaryReview/GlossaryReview.types';
import {
  ModifiedGlossary,
  useGlossaryStore,
} from '../../../Glossary/useGlossary.store';
import PendingReviewPanel from './PendingReviewPanel';

const mockDecide = jest.fn();

jest.mock('../../../../hooks/governance/glossary/useGlossaryProposals', () => ({
  useGlossaryProposals: jest.fn(),
}));

const mockContext = {
  data: { id: 'glossary-id', fullyQualifiedName: 'Customers' },
  type: EntityType.GLOSSARY,
  permissions: { EditAll: true },
};

jest.mock('../../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(() => mockContext),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: { id: 'user-id', name: 'admin' },
  })),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const pending = (id: string, provider?: ProviderType): GlossaryTerm =>
  ({
    id,
    name: id,
    displayName: id,
    fullyQualifiedName: `Customers.${id}`,
    description: `${id} definition`,
    entityStatus: EntityStatus.Draft,
    provider,
    updatedAt: Date.now(),
    updatedBy: 'karthick',
  } as GlossaryTerm);

const aiProposal: GlossaryProposal = {
  term: pending('Churn Risk', ProviderType.Automation),
  source: 'ai',
};
const personProposal: GlossaryProposal = {
  term: pending('Escrow'),
  source: 'person',
};

const mockProposals = (proposals: GlossaryProposal[]) =>
  (useGlossaryProposals as jest.Mock).mockReturnValue({
    counts: {
      all: proposals.length,
      ai: proposals.filter((proposal) => proposal.source === 'ai').length,
      person: proposals.filter((proposal) => proposal.source === 'person')
        .length,
    },
    decide: mockDecide,
    isLoading: false,
    proposals,
  });

const renderPanel = () =>
  render(<PendingReviewPanel />, {
    wrapper: MemoryRouter,
  });

describe('PendingReviewPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContext.permissions = { EditAll: true };
    useGlossaryStore.getState().setSelectedProposalId(undefined);
    mockDecide.mockResolvedValue(true);
  });

  it('lists every proposal and filters them by who made them', () => {
    mockProposals([aiProposal, personProposal]);
    renderPanel();

    expect(screen.getByText('label.pending-review')).toBeInTheDocument();
    expect(screen.getByTestId('proposal-card-expanded')).toHaveTextContent(
      'Churn Risk'
    );
    expect(screen.getAllByTestId('proposal-card')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('proposal-filter-person'));

    expect(screen.getByTestId('proposal-card-expanded')).toHaveTextContent(
      'Escrow'
    );
    expect(screen.queryByTestId('proposal-card')).not.toBeInTheDocument();
  });

  it('offers no filter while every proposal comes from one source', () => {
    mockProposals([aiProposal]);
    renderPanel();

    expect(screen.getByTestId('proposal-card-expanded')).toHaveTextContent(
      'Churn Risk'
    );
    expect(screen.queryByTestId('proposal-filter-ai')).not.toBeInTheDocument();
  });

  it('lets an assigned approver who cannot edit the term decide it, but not edit it', () => {
    mockContext.permissions = { EditAll: false };
    mockProposals([
      {
        term: {
          ...pending('Churn Risk', ProviderType.Automation),
          entityStatus: EntityStatus.InReview,
        },
        source: 'ai',
        approvalTask: {
          id: 'task-id',
          assignees: [{ id: 'user-id', type: 'user' }],
        } as GlossaryProposal['approvalTask'],
      },
    ]);
    renderPanel();

    expect(screen.getByTestId('approve-proposal')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-proposal')).not.toBeInTheDocument();
  });

  it('lists a decided proposal as resolved and settles its table row', async () => {
    mockProposals([aiProposal]);
    useGlossaryStore
      .getState()
      .setGlossaryChildTerms([aiProposal.term as unknown as ModifiedGlossary]);
    renderPanel();

    await act(async () => {
      fireEvent.click(screen.getByTestId('approve-proposal'));
    });

    expect(mockDecide).toHaveBeenCalledWith(
      aiProposal,
      EntityStatus.Approved,
      undefined
    );
    expect(
      within(screen.getByTestId('resolved-proposals')).getByText(
        'Churn Risk · label.approved-by-you'
      )
    ).toBeInTheDocument();
    expect(useGlossaryStore.getState().glossaryChildTerms[0].entityStatus).toBe(
      EntityStatus.Approved
    );
  });

  it('stays out of the layout while nothing waits, and returns when a proposal arrives', () => {
    mockProposals([]);
    const { rerender } = renderPanel();

    expect(
      screen.queryByTestId('pending-review-panel')
    ).not.toBeInTheDocument();

    mockProposals([personProposal]);
    rerender(<PendingReviewPanel />);

    expect(screen.getByTestId('pending-review-panel')).toBeInTheDocument();
    expect(screen.getByTestId('proposal-card-expanded')).toHaveTextContent(
      'Escrow'
    );
  });

  it('pages a large review queue while keeping every proposal reachable', () => {
    mockProposals(
      Array.from({ length: 20 }, (_, index) => ({
        term: pending(`Term ${index}`, ProviderType.Automation),
        source: 'ai' as const,
      }))
    );
    renderPanel();

    expect(screen.getAllByTestId('proposal-card')).toHaveLength(14);
    expect(screen.queryByText('Term 15')).not.toBeInTheDocument();

    fireEvent.click(
      within(screen.getByTestId('pending-review-panel')).getByTestId('next')
    );

    expect(screen.getByTestId('proposal-card-expanded')).toHaveTextContent(
      'Term 15'
    );
    expect(screen.queryByText('Term 0')).not.toBeInTheDocument();
  });

  it('opens the page containing the proposal selected from the terms table', () => {
    mockProposals(
      Array.from({ length: 20 }, (_, index) => ({
        term: pending(`Term ${index}`, ProviderType.Automation),
        source: 'ai' as const,
      }))
    );
    renderPanel();

    act(() => useGlossaryStore.getState().setSelectedProposalId('Term 18'));

    expect(screen.getByTestId('proposal-card-expanded')).toHaveTextContent(
      'Term 18'
    );
    expect(screen.queryByText('Term 0')).not.toBeInTheDocument();
  });
});
