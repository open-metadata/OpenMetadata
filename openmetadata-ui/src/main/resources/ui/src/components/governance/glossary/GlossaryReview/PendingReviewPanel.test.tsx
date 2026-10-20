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
import { QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import {
  EntityStatus,
  GlossaryTerm,
  ProviderType,
} from '../../../../generated/entity/data/glossaryTerm';
import { Access } from '../../../../generated/entity/policies/accessControl/resourcePermission';
import { Operation } from '../../../../generated/entity/policies/policy';
import { refreshGlossaryProposals } from '../../../../hooks/governance/glossary/useGlossaryProposals';
import { searchTerms } from '../../../../hooks/governance/glossary/useGlossaryProposals.mock';
import { queryClient } from '../../../../queryClient';
import {
  getGlossaryTermsById,
  patchGlossaryTerm,
  searchGlossaryTermsPaginated,
} from '../../../../rest/glossaryAPI';
import { getEntityPermissionByFqn } from '../../../../rest/permissionAPI';
import { listTasks } from '../../../../rest/tasksAPI';
import {
  ModifiedGlossary,
  useGlossaryStore,
} from '../../../Glossary/useGlossary.store';
import PendingReviewPanel from './PendingReviewPanel';

jest.mock('../../../../rest/glossaryAPI', () => ({
  getGlossaryTermsById: jest.fn(),
  patchGlossaryTerm: jest.fn(),
  searchGlossaryTermsPaginated: jest.fn(),
}));

jest.mock('../../../../rest/contextMemoryAPI', () => ({
  ...jest.requireActual('../../../../rest/contextMemoryAPI'),
  getMemoryDerivations: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../../rest/tasksAPI', () => ({
  ...jest.requireActual('../../../../rest/tasksAPI'),
  listTasks: jest.fn(),
  resolveTask: jest.fn(),
}));

jest.mock('../../../../rest/permissionAPI', () => ({
  getEntityPermissionByFqn: jest.fn(),
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

const pending = (
  name: string,
  provider?: ProviderType,
  entityStatus = EntityStatus.Draft
): GlossaryTerm =>
  ({
    id: name,
    name,
    displayName: name,
    fullyQualifiedName: `Customers.${name}`,
    description: `${name} definition`,
    entityStatus,
    provider,
    updatedAt: Date.now(),
    updatedBy: 'karthick',
  } as GlossaryTerm);

const aiDraft = pending('Churn Risk', ProviderType.Automation);
const personDraft = pending('Escrow');
const manyAiDrafts = Array.from({ length: 20 }, (_, index) =>
  pending(`Term ${index}`, ProviderType.Automation)
);

let terms: GlossaryTerm[];

const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);

const renderPanel = () => render(<PendingReviewPanel />, { wrapper: Wrapper });

describe('PendingReviewPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    mockContext.permissions = { EditAll: true };
    (getEntityPermissionByFqn as jest.Mock).mockResolvedValue({
      permissions: [{ operation: Operation.EditAll, access: Access.Allow }],
    });
    useGlossaryStore.getState().setSelectedProposalId(undefined);
    terms = [aiDraft, personDraft];
    (searchGlossaryTermsPaginated as jest.Mock).mockImplementation(
      searchTerms(() => terms)
    );
    (getGlossaryTermsById as jest.Mock).mockImplementation(async (id: string) =>
      terms.find((term) => term.id === id)
    );
    (patchGlossaryTerm as jest.Mock).mockImplementation(
      async (id: string, [{ value }]: { value: EntityStatus }[]) => {
        terms = terms.map((term) =>
          term.id === id ? { ...term, entityStatus: value } : term
        );
      }
    );
    (listTasks as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('lists every proposal and filters them by who made them', async () => {
    renderPanel();

    expect(
      await screen.findByTestId('proposal-card-expanded')
    ).toHaveTextContent('Churn Risk');
    expect(screen.getByText('label.pending-review')).toBeInTheDocument();
    expect(screen.getAllByTestId('proposal-card')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('proposal-filter-person'));

    await waitFor(() =>
      expect(screen.queryByTestId('proposal-card')).not.toBeInTheDocument()
    );

    expect(screen.getByTestId('proposal-card-expanded')).toHaveTextContent(
      'Escrow'
    );
  });

  it('offers no filter while every proposal comes from one source', async () => {
    terms = [aiDraft];
    renderPanel();

    expect(
      await screen.findByTestId('proposal-card-expanded')
    ).toHaveTextContent('Churn Risk');
    expect(screen.queryByTestId('proposal-filter-ai')).not.toBeInTheDocument();
  });

  it('lets an assigned approver who cannot edit the term decide it, but not edit it', async () => {
    mockContext.permissions = { EditAll: false };
    (getEntityPermissionByFqn as jest.Mock).mockResolvedValue({
      permissions: [{ operation: Operation.EditAll, access: Access.Deny }],
    });
    terms = [pending('Escrow', undefined, EntityStatus.InReview)];
    (listTasks as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'task-id',
          about: {
            fullyQualifiedName: 'Customers.Escrow',
            type: 'glossaryTerm',
          },
          assignees: [{ id: 'user-id', type: 'user' }],
        },
      ],
    });
    renderPanel();

    expect(await screen.findByTestId('approve-proposal')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-proposal')).not.toBeInTheDocument();
  });

  it('lets a term owner review their AI draft without permission to edit its glossary', async () => {
    mockContext.permissions = { EditAll: false };
    terms = [aiDraft];
    renderPanel();

    expect(await screen.findByTestId('approve-proposal')).toBeInTheDocument();
    expect(screen.getByTestId('edit-proposal')).toBeInTheDocument();
  });

  it('does not offer decisions on a term the glossary editor cannot edit', async () => {
    (getEntityPermissionByFqn as jest.Mock).mockResolvedValue({
      permissions: [{ operation: Operation.EditAll, access: Access.Deny }],
    });
    terms = [aiDraft];
    renderPanel();

    await screen.findByTestId('proposal-card-expanded');
    await waitFor(() => expect(getEntityPermissionByFqn).toHaveBeenCalled());

    expect(screen.queryByTestId('approve-proposal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-proposal')).not.toBeInTheDocument();
  });

  it('lists a decided proposal as resolved and settles its table row', async () => {
    terms = [aiDraft];
    useGlossaryStore
      .getState()
      .setGlossaryChildTerms([aiDraft as unknown as ModifiedGlossary]);
    renderPanel();

    fireEvent.click(await screen.findByTestId('approve-proposal'));

    expect(
      await within(await screen.findByTestId('resolved-proposals')).findByText(
        'Churn Risk · label.approved-by-you'
      )
    ).toBeInTheDocument();
    expect(patchGlossaryTerm).toHaveBeenCalledWith('Churn Risk', [
      { op: 'replace', path: '/entityStatus', value: EntityStatus.Approved },
    ]);
    expect(useGlossaryStore.getState().glossaryChildTerms[0].entityStatus).toBe(
      EntityStatus.Approved
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId('proposal-card-expanded')
      ).not.toBeInTheDocument()
    );
  });

  it('stays out of the layout while nothing waits, and returns when a proposal arrives', async () => {
    terms = [];
    renderPanel();

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(
      screen.queryByTestId('pending-review-panel')
    ).not.toBeInTheDocument();

    terms = [personDraft];
    await act(() => refreshGlossaryProposals());

    expect(
      await screen.findByTestId('proposal-card-expanded')
    ).toHaveTextContent('Escrow');
  });

  it('reads a large review queue a page at a time from the server', async () => {
    terms = manyAiDrafts;
    renderPanel();

    expect(
      await screen.findByTestId('proposal-card-expanded')
    ).toHaveTextContent('Term 0');
    expect(screen.getAllByTestId('proposal-card')).toHaveLength(14);
    expect(screen.queryByText('Term 15')).not.toBeInTheDocument();

    fireEvent.click(
      within(screen.getByTestId('pending-review-panel')).getByTestId('next')
    );

    await waitFor(() =>
      expect(screen.getByTestId('proposal-card-expanded')).toHaveTextContent(
        'Term 15'
      )
    );

    expect(screen.queryByText('Term 0')).not.toBeInTheDocument();
    expect(searchGlossaryTermsPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 15, provider: ProviderType.Automation })
    );
  });

  it('shows the proposal selected in the terms table first, wherever its page is', async () => {
    terms = manyAiDrafts;
    renderPanel();
    await screen.findByTestId('proposal-card-expanded');

    act(() => useGlossaryStore.getState().setSelectedProposalId('Term 18'));

    await waitFor(() =>
      expect(screen.getByTestId('proposal-card-expanded')).toHaveTextContent(
        'Term 18'
      )
    );

    expect(screen.getAllByTestId('proposal-card')).toHaveLength(15);
    expect(screen.getByText('Term 0')).toBeInTheDocument();
  });

  it('clears the selected proposal when the reviewer filters the queue', async () => {
    terms = [...manyAiDrafts, personDraft];
    renderPanel();
    await screen.findByTestId('proposal-card-expanded');
    act(() => useGlossaryStore.getState().setSelectedProposalId('Term 18'));
    await waitFor(() =>
      expect(screen.getByTestId('proposal-card-expanded')).toHaveTextContent(
        'Term 18'
      )
    );

    fireEvent.click(screen.getByTestId('proposal-filter-person'));

    await waitFor(() =>
      expect(screen.getByTestId('proposal-card-expanded')).toHaveTextContent(
        'Escrow'
      )
    );

    expect(screen.queryByText('Term 18')).not.toBeInTheDocument();
  });
});
