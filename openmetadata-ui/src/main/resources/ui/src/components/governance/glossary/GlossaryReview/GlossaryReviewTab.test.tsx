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
import { searchTerms } from '../../../../hooks/governance/glossary/useGlossaryProposals.mock';
import { queryClient } from '../../../../queryClient';
import { getMemoryDerivations } from '../../../../rest/contextMemoryAPI';
import {
  patchGlossaryTerm,
  searchGlossaryTermsPaginated,
} from '../../../../rest/glossaryAPI';
import { getEntityPermissionByFqn } from '../../../../rest/permissionAPI';
import { addTaskComment, listTasks } from '../../../../rest/tasksAPI';
import {
  ModifiedGlossary,
  useGlossaryStore,
} from '../../../Glossary/useGlossary.store';
import GlossaryReviewTab from './GlossaryReviewTab';

jest.mock('../../../../rest/glossaryAPI', () => ({
  patchGlossaryTerm: jest.fn(),
  searchGlossaryTermsPaginated: jest.fn(),
}));

jest.mock('../../../../rest/contextMemoryAPI', () => ({
  ...jest.requireActual('../../../../rest/contextMemoryAPI'),
  getMemoryDerivations: jest.fn(),
}));

jest.mock('../../../../rest/tasksAPI', () => ({
  ...jest.requireActual('../../../../rest/tasksAPI'),
  addTaskComment: jest.fn(),
  listTasks: jest.fn(),
  resolveTask: jest.fn(),
}));

jest.mock('../../../../rest/permissionAPI', () => ({
  getEntityPermissionByFqn: jest.fn(),
}));

jest.mock('../../../common/RichTextEditor/RichTextEditorPreviewNew', () =>
  jest.fn(({ markdown }: { markdown: string }) => <div>{markdown}</div>)
);

const mockContext = {
  data: { id: 'glossary-id', fullyQualifiedName: 'Customers' },
  type: EntityType.GLOSSARY,
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
const sureAiDraft = pending('Net Retention', ProviderType.Automation);
const personDraft = pending('Escrow', undefined, EntityStatus.InReview);

const approvalTask = {
  id: 'task-id',
  taskId: 'TASK-00001',
  about: { fullyQualifiedName: 'Customers.Escrow', type: 'glossaryTerm' },
  assignees: [{ id: 'user-id', type: 'user', name: 'admin' }],
  createdBy: { id: 'author-id', type: 'user', name: 'karthick' },
  comments: [
    {
      id: 'comment-id',
      message: 'Mortgage servicing needs this.',
      author: { id: 'author-id', type: 'user', name: 'karthick' },
      createdAt: Date.now(),
    },
  ],
};

const derivationOf = (term: GlossaryTerm, confidence: number) => ({
  entity: { id: term.id, type: 'glossaryTerm' },
  memory: { id: `${term.id}-memory`, type: 'contextMemory', name: term.name },
  evidence: { agent: 'Glossary Agent', confidence, reasons: ['A metric'] },
});

let terms: GlossaryTerm[];

const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);

const renderTab = () => render(<GlossaryReviewTab />, { wrapper: Wrapper });

const queueItems = () => screen.getAllByTestId('review-queue-item');

describe('GlossaryReviewTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    useGlossaryStore.getState().setSelectedProposalId(undefined);
    (getEntityPermissionByFqn as jest.Mock).mockResolvedValue({
      permissions: [{ operation: Operation.EditAll, access: Access.Allow }],
    });
    terms = [aiDraft, personDraft];
    (searchGlossaryTermsPaginated as jest.Mock).mockImplementation(
      searchTerms(() => terms)
    );
    (patchGlossaryTerm as jest.Mock).mockImplementation(
      async (id: string, [{ value }]: { value: EntityStatus }[]) => {
        terms = terms.map((term) =>
          term.id === id ? { ...term, entityStatus: value } : term
        );
      }
    );
    (getMemoryDerivations as jest.Mock).mockResolvedValue([
      derivationOf(aiDraft, 0.72),
      derivationOf(sureAiDraft, 0.95),
    ]);
    (listTasks as jest.Mock).mockResolvedValue({ data: [approvalTask] });
  });

  it('queues AI proposals before people, opens the first, and filters by who proposed', async () => {
    renderTab();

    expect(await screen.findByTestId('proposal-detail')).toHaveTextContent(
      'Churn Risk'
    );
    expect(queueItems().map((item) => item.textContent)).toEqual([
      expect.stringContaining('Churn Risk'),
      expect.stringContaining('Escrow'),
    ]);
    expect(screen.getByTestId('proposal-evidence')).toHaveTextContent(
      'A metric'
    );

    fireEvent.click(screen.getByTestId('proposal-filter-person'));

    await waitFor(() => expect(queueItems()).toHaveLength(1));

    expect(screen.getByTestId('proposal-detail')).toHaveTextContent(
      'TASK-00001'
    );
  });

  it('opens the proposal picked in the queue', async () => {
    renderTab();
    await screen.findByTestId('proposal-detail');

    fireEvent.click(within(queueItems()[1]).getByRole('button'));

    expect(screen.getByTestId('proposal-detail')).toHaveTextContent('Escrow');
    // The terms table highlights the proposal opened here.
    expect(useGlossaryStore.getState().selectedProposalId).toBe('Escrow');
  });

  it('offers no filter while every proposal comes from one source', async () => {
    terms = [aiDraft];
    renderTab();

    await screen.findByTestId('proposal-detail');

    expect(screen.queryByTestId('proposal-filter-ai')).not.toBeInTheDocument();
  });

  it('lets an assigned approver who cannot edit the term decide it, but not edit it', async () => {
    (getEntityPermissionByFqn as jest.Mock).mockResolvedValue({
      permissions: [{ operation: Operation.EditAll, access: Access.Deny }],
    });
    terms = [personDraft];
    renderTab();

    expect(await screen.findByTestId('approve-proposal')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-proposal')).not.toBeInTheDocument();
  });

  it('does not offer decisions on a term the user cannot edit', async () => {
    (getEntityPermissionByFqn as jest.Mock).mockResolvedValue({
      permissions: [{ operation: Operation.EditAll, access: Access.Deny }],
    });
    terms = [aiDraft];
    renderTab();

    await screen.findByTestId('proposal-detail');
    await waitFor(() => expect(getEntityPermissionByFqn).toHaveBeenCalled());

    expect(screen.queryByTestId('approve-proposal')).not.toBeInTheDocument();
  });

  it('lists a decided proposal as resolved and settles its table row', async () => {
    terms = [aiDraft];
    useGlossaryStore
      .getState()
      .setGlossaryChildTerms([aiDraft as unknown as ModifiedGlossary]);
    renderTab();

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
  });

  it('selects the confident AI proposals and approves them together', async () => {
    terms = [aiDraft, sureAiDraft, personDraft];
    renderTab();
    await screen.findByTestId('proposal-detail');
    await waitFor(() => expect(getEntityPermissionByFqn).toHaveBeenCalled());

    fireEvent.click(await screen.findByTestId('select-high-confidence'));

    expect(screen.getByText('label.n-selected')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('bulk-approve'));

    await waitFor(() => expect(patchGlossaryTerm).toHaveBeenCalledTimes(1));

    expect(patchGlossaryTerm).toHaveBeenCalledWith('Net Retention', [
      { op: 'replace', path: '/entityStatus', value: EntityStatus.Approved },
    ]);
    expect(
      await screen.findByText('Net Retention · label.approved-by-you')
    ).toBeInTheDocument();
  });

  it("shows the comments on a person's approval request and adds one", async () => {
    terms = [personDraft];
    (addTaskComment as jest.Mock).mockResolvedValue(approvalTask);
    renderTab();

    const comments = await screen.findByTestId('proposal-comments');

    expect(comments).toHaveTextContent('Mortgage servicing needs this.');

    fireEvent.change(screen.getByTestId('proposal-comment-input'), {
      target: { value: 'Looks right' },
    });
    fireEvent.click(screen.getByTestId('post-proposal-comment'));

    await waitFor(() =>
      expect(addTaskComment).toHaveBeenCalledWith('task-id', 'Looks right')
    );
  });

  it('loads the queue a page at a time', async () => {
    terms = Array.from({ length: 20 }, (_, index) =>
      pending(`Term ${index}`, ProviderType.Automation)
    );
    renderTab();

    await screen.findByTestId('proposal-detail');

    expect(queueItems()).toHaveLength(15);

    fireEvent.click(screen.getByTestId('review-queue-load-more'));

    await waitFor(() => expect(queueItems()).toHaveLength(20));

    expect(
      screen.queryByTestId('review-queue-load-more')
    ).not.toBeInTheDocument();
  });

  it('searches the queue on the server', async () => {
    renderTab();
    await screen.findByTestId('proposal-detail');

    fireEvent.change(screen.getByTestId('review-queue-search'), {
      target: { value: 'Escrow' },
    });

    await waitFor(() => expect(queueItems()).toHaveLength(1));

    expect(searchGlossaryTermsPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'Escrow' })
    );
  });

  it('says so when nothing waits for review', async () => {
    terms = [];
    renderTab();

    expect(
      await screen.findByText('message.nothing-waiting-for-review')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('review-queue')).not.toBeInTheDocument();
  });
});
