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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ComponentProps } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { ExtractedMemoryApproval } from '../../../generated/api/context/extractedMemoryApproval';
import { User } from '../../../generated/entity/teams/user';
import {
  approveExtractedMemories,
  getExtractedMemoryApproval,
  getListContextMemories,
} from '../../../rest/contextMemoryAPI';
import {
  useEnUsTranslations,
  useKeyEchoTranslations,
} from '../../../test/unit/enUsTranslation';
import {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
} from '../../../utils/ToastUtils';
import ExtractedMemoriesCard from './ExtractedMemoriesCard.component';

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: jest.fn(
    ({
      children,
      'data-testid': testId,
      ...handlers
    }: {
      children: React.ReactNode;
      'data-testid'?: string;
      onClick?: () => void;
      onKeyDown?: (e: React.KeyboardEvent) => void;
    }) => (
      // Spread rather than named props: the real Box carries role/tabIndex that
      // this mock drops, so naming onClick here would trip jsx-a11y.
      <div data-testid={testId} {...handlers}>
        {children}
      </div>
    )
  ),
  Button: jest.fn(
    ({
      children,
      'data-testid': testId,
      isDisabled,
      onClick,
    }: {
      children: React.ReactNode;
      'data-testid'?: string;
      isDisabled?: boolean;
      onClick?: () => void;
    }) => (
      <button data-testid={testId} disabled={isDisabled} onClick={onClick}>
        {children}
      </button>
    )
  ),
  Card: jest.fn(
    ({
      children,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      'data-testid'?: string;
    }) => <div data-testid={testId}>{children}</div>
  ),
  Skeleton: jest.fn(() => <span data-testid="skeleton" />),
  Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

jest.mock('../../common/WidgetCard/WidgetCard', () =>
  jest.fn(
    ({
      children,
      title,
      dataTestId,
    }: {
      children: React.ReactNode;
      title: string;
      dataTestId: string;
    }) => (
      <div data-testid={dataTestId}>
        <span data-testid="widget-card-title">{title}</span>
        {children}
      </div>
    )
  )
);

jest.mock('../CreateMemoryModal/CreateMemoryModal.component', () =>
  jest.fn(
    ({
      isOpen,
      isAdminUser,
      viewOnly,
      canDelete,
      memoryToEdit,
      onDeleted,
      onUpdated,
    }: {
      isOpen: boolean;
      isAdminUser?: boolean;
      viewOnly: boolean;
      canDelete: boolean;
      memoryToEdit?: { title?: string };
      onDeleted: () => void;
      onUpdated: () => void;
    }) =>
      isOpen && viewOnly ? (
        <div
          data-can-delete={canDelete}
          data-is-admin={String(Boolean(isAdminUser))}
          data-testid="view-memory-modal">
          {memoryToEdit?.title}
          <button data-testid="delete-memory-btn" onClick={onDeleted}>
            delete
          </button>
          <button data-testid="decide-memory-btn" onClick={onUpdated}>
            decide
          </button>
        </div>
      ) : null
  )
);

jest.mock('../../../rest/contextMemoryAPI', () => ({
  approveExtractedMemories: jest.fn(),
  getExtractedMemoryApproval: jest.fn(),
  getListContextMemories: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showInfoToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const ALICE: User = {
  id: 'user-alice',
  name: 'alice',
  email: 'alice@example.com',
  isAdmin: false,
};
let mockCurrentUser: User = ALICE;

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({ currentUser: mockCurrentUser })),
}));

const mockGetListContextMemories = getListContextMemories as jest.Mock;
const mockGetExtractedMemoryApproval = getExtractedMemoryApproval as jest.Mock;

const renderCard = (
  props: Partial<ComponentProps<typeof ExtractedMemoriesCard>> = {}
) =>
  render(
    <ExtractedMemoriesCard
      sourceId="page-1"
      sourceType={EntityType.KNOWLEDGE_PAGE}
      {...props}
    />
  );

const memories = [
  {
    id: 'm1',
    name: 'pill-1',
    title: 'VAT policy',
    question: 'What is the VAT rate?',
    lastContentUpdatedAt: 1767225600000,
    owners: [{ id: 'u1', type: 'user', name: 'alice' }],
  },
  {
    id: 'm2',
    name: 'pill-2',
    title: 'Refund window',
    updatedAt: 1767225600001,
  },
];

describe('ExtractedMemoriesCard', () => {
  beforeEach(() => {
    mockGetListContextMemories.mockResolvedValue({
      data: memories,
      paging: { total: 2 },
    });
  });

  it('requests only the memories extracted from the given source', async () => {
    renderCard();

    await waitFor(() =>
      expect(mockGetListContextMemories).toHaveBeenCalledWith({
        sourceEntityId: 'page-1',
        fields: 'owners,sourceEntity,derivedEntities',
        limit: 50,
      })
    );
  });

  it('lists each memory with its title and question', async () => {
    renderCard();

    expect(await screen.findByText('VAT policy')).toBeInTheDocument();
    expect(screen.getByText('What is the VAT rate?')).toBeInTheDocument();
    expect(screen.getByText('Refund window')).toBeInTheDocument();
  });

  it('shows an empty message when the source has no memories', async () => {
    mockGetListContextMemories.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });

    renderCard();

    expect(await screen.findByText('label.no-entity')).toBeInTheDocument();
  });

  it('keeps the card usable when the request fails', async () => {
    mockGetListContextMemories.mockRejectedValue(new Error('boom'));

    renderCard();

    expect(await screen.findByText('label.no-entity')).toBeInTheDocument();
  });

  it('opens the view-only modal for the clicked memory', async () => {
    renderCard();

    fireEvent.click(await screen.findByTestId('extracted-memory-m1'));

    expect(screen.getByTestId('view-memory-modal')).toHaveTextContent(
      'VAT policy'
    );
  });

  it('allows deleting a memory the current user owns', async () => {
    renderCard();

    fireEvent.click(await screen.findByTestId('extracted-memory-m1'));

    expect(screen.getByTestId('view-memory-modal')).toHaveAttribute(
      'data-can-delete',
      'true'
    );
  });

  it('does not allow deleting a memory owned by someone else', async () => {
    renderCard();

    fireEvent.click(await screen.findByTestId('extracted-memory-m2'));

    expect(screen.getByTestId('view-memory-modal')).toHaveAttribute(
      'data-can-delete',
      'false'
    );
  });

  it('refetches and closes the modal after a memory is deleted', async () => {
    renderCard();

    fireEvent.click(await screen.findByTestId('extracted-memory-m1'));
    mockGetListContextMemories.mockResolvedValue({
      data: [memories[1]],
      paging: { total: 1 },
    });
    fireEvent.click(screen.getByTestId('delete-memory-btn'));

    await waitFor(() =>
      expect(screen.queryByTestId('view-memory-modal')).not.toBeInTheDocument()
    );

    expect(mockGetListContextMemories).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('VAT policy')).not.toBeInTheDocument();
  });

  it('renders as a collapsible widget when asked', async () => {
    renderCard({ collapsible: true });

    expect(await screen.findByTestId('widget-card-title')).toHaveTextContent(
      'label.memory-plural (2)'
    );
  });
});

describe('ExtractedMemoriesCard — approving the document’s memories', () => {
  const contested = { id: 'm3', type: 'contextMemory', name: 'vat-rate-2' };
  const preview = (
    approved: number,
    needsDecision = [contested]
  ): ExtractedMemoryApproval => ({
    approved,
    needsDecision,
    failed: 0,
    approvable: Array.from({ length: approved }, (_, index) => ({
      id: `m${index + 1}`,
      contentUpdatedAt: 1767225600000 + index,
    })),
  });
  const approveButton = () =>
    screen.queryByTestId('approve-extracted-memories-btn');

  beforeEach(() => {
    mockGetListContextMemories.mockResolvedValue({
      data: [...memories, contested],
      paging: { total: 3 },
    });
    useEnUsTranslations();
  });

  afterEach(() => {
    mockCurrentUser = ALICE;
    useKeyEchoTranslations();
  });

  it('offers an admin to approve the document’s pending memories', async () => {
    mockCurrentUser = { ...ALICE, isAdmin: true };
    mockGetExtractedMemoryApproval.mockResolvedValue(preview(2));

    renderCard({ sourceId: 'file-1', sourceType: 'contextFile' });

    expect(
      await screen.findByRole('button', {
        name: 'Approve extracted memories (3 pending)',
      })
    ).toBeEnabled();
    expect(mockGetExtractedMemoryApproval).toHaveBeenCalledWith(
      'file-1',
      'contextFile'
    );
  });

  it.each([
    ['who owns it', [{ id: 'user-alice', type: 'user', name: 'alice' }], []],
    [
      'whose team owns it',
      [{ id: 'team-finance', type: 'team', name: 'finance' }],
      [{ id: 'team-finance', type: 'team', name: 'finance' }],
    ],
  ])(
    'offers a user %s to approve them',
    async (_owner, sourceOwners, teams) => {
      mockCurrentUser = { ...ALICE, teams };
      mockGetExtractedMemoryApproval.mockResolvedValue(preview(1, []));

      renderCard({ sourceOwners });

      expect(
        await screen.findByRole('button', {
          name: 'Approve extracted memories (1 pending)',
        })
      ).toBeInTheDocument();
      expect(mockGetExtractedMemoryApproval).toHaveBeenCalledWith(
        'page-1',
        'page'
      );
    }
  );

  it('neither previews nor offers approval to someone who neither owns the document nor is an admin', async () => {
    renderCard({
      sourceOwners: [{ id: 'user-bob', type: 'user', name: 'bob' }],
    });

    expect(await screen.findByText('VAT policy')).toBeInTheDocument();
    expect(mockGetExtractedMemoryApproval).not.toHaveBeenCalled();
    expect(approveButton()).not.toBeInTheDocument();
  });

  /** The Documents list loads no owners, so its documents' owners are found by the server. */
  it('lets the server decide for a document whose owners were not loaded', async () => {
    mockGetExtractedMemoryApproval.mockResolvedValue(preview(1, []));

    renderCard({ sourceId: 'file-1', sourceType: 'contextFile' });

    expect(
      await screen.findByRole('button', {
        name: 'Approve extracted memories (1 pending)',
      })
    ).toBeInTheDocument();
    expect(mockGetExtractedMemoryApproval).toHaveBeenCalledWith(
      'file-1',
      'contextFile'
    );
  });

  it.each([
    ['nothing would be approved', () => Promise.resolve(preview(0))],
    [
      'the preview is refused',
      () => Promise.reject(new Error('Request failed with status code 403')),
    ],
  ])('offers nothing when %s', async (_case, respond) => {
    mockCurrentUser = { ...ALICE, isAdmin: true };
    mockGetExtractedMemoryApproval.mockImplementation(respond);

    renderCard();

    expect(await screen.findByText('VAT policy')).toBeInTheDocument();

    await waitFor(() =>
      expect(mockGetExtractedMemoryApproval).toHaveBeenCalledTimes(1)
    );
    await act(async () => undefined);

    expect(approveButton()).not.toBeInTheDocument();
  });

  it('approves the document’s memories, reports each outcome and refetches', async () => {
    mockCurrentUser = { ...ALICE, isAdmin: true };
    mockGetExtractedMemoryApproval.mockResolvedValueOnce(preview(2));
    (approveExtractedMemories as jest.Mock).mockResolvedValue({
      approved: 1,
      needsDecision: [contested],
      failed: 1,
    });
    renderCard();
    const approve = await screen.findByRole('button', {
      name: 'Approve extracted memories (3 pending)',
    });
    mockGetExtractedMemoryApproval.mockResolvedValue(preview(0));

    fireEvent.click(approve);

    await waitFor(() => expect(approveButton()).not.toBeInTheDocument());

    expect(approveExtractedMemories).toHaveBeenCalledWith({
      source: { id: 'page-1', type: 'page' },
      approvable: preview(2).approvable,
    });
    expect(showSuccessToast).toHaveBeenCalledWith('Memories approved: 1');
    expect(showInfoToast).toHaveBeenCalledWith(
      'Memories that need a decision: 1. Each answers a question another memory of this document answers, or resembles a memory already decided.'
    );
    expect(showErrorToast).toHaveBeenCalledWith(
      'Memories not approved: 1. They stay pending.'
    );
    expect(mockGetExtractedMemoryApproval).toHaveBeenCalledTimes(2);
    expect(mockGetListContextMemories).toHaveBeenCalledTimes(2);
  });

  it('approves only the displayed memories as they were displayed, even when the preview read newer claims', async () => {
    mockCurrentUser = { ...ALICE, isAdmin: true };
    mockGetListContextMemories.mockResolvedValue({
      data: [{ ...memories[0], lastContentUpdatedAt: 10, updatedAt: 20 }],
      paging: { total: 2 },
    });
    mockGetExtractedMemoryApproval.mockResolvedValue(preview(2, []));
    (approveExtractedMemories as jest.Mock).mockResolvedValue({
      approved: 0,
      needsDecision: [],
      failed: 1,
    });
    renderCard();

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Approve extracted memories (1 pending)',
      })
    );

    await waitFor(() =>
      expect(approveExtractedMemories).toHaveBeenCalledWith({
        source: { id: 'page-1', type: 'page' },
        approvable: [{ id: 'm1', contentUpdatedAt: 10 }],
      })
    );

    expect(showErrorToast).toHaveBeenCalledWith(
      'Memories not approved: 1. They stay pending.'
    );
  });

  it('waits for the displayed list before offering approval and uses the audit time for a legacy claim', async () => {
    mockCurrentUser = { ...ALICE, isAdmin: true };
    let finishList: (() => void) | undefined;
    mockGetListContextMemories.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishList = () =>
            resolve({
              data: [
                {
                  ...memories[0],
                  lastContentUpdatedAt: undefined,
                  updatedAt: 30,
                },
              ],
              paging: { total: 1 },
            });
        })
    );
    mockGetExtractedMemoryApproval.mockResolvedValue(preview(1, []));
    (approveExtractedMemories as jest.Mock).mockResolvedValue({
      approved: 1,
      needsDecision: [],
      failed: 0,
    });
    renderCard();
    await act(async () => undefined);

    expect(approveButton()).not.toBeInTheDocument();

    await act(async () => finishList?.());
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Approve extracted memories (1 pending)',
      })
    );

    await waitFor(() =>
      expect(approveExtractedMemories).toHaveBeenCalledWith({
        source: { id: 'page-1', type: 'page' },
        approvable: [{ id: 'm1', contentUpdatedAt: 30 }],
      })
    );
  });

  it('offers no approval when the displayed list failed to load', async () => {
    mockCurrentUser = { ...ALICE, isAdmin: true };
    mockGetListContextMemories.mockRejectedValue(new Error('list unavailable'));
    mockGetExtractedMemoryApproval.mockResolvedValue(preview(2, []));
    renderCard();
    await act(async () => undefined);

    expect(approveButton()).not.toBeInTheDocument();
  });

  it('keeps the preview of a document no longer shown off the one shown now', async () => {
    mockCurrentUser = { ...ALICE, isAdmin: true };
    const previews: Record<
      string,
      (approval: ExtractedMemoryApproval) => void
    > = {};
    mockGetExtractedMemoryApproval.mockImplementation(
      (sourceId: string) =>
        new Promise((resolve) => {
          previews[sourceId] = resolve;
        })
    );
    const { rerender } = renderCard({ sourceId: 'file-1' });
    rerender(
      <ExtractedMemoriesCard
        sourceId="file-2"
        sourceType={EntityType.KNOWLEDGE_PAGE}
      />
    );

    await act(async () => previews['file-1'](preview(4, [])));

    expect(approveButton()).not.toBeInTheDocument();

    await act(async () => previews['file-2'](preview(1, [])));

    expect(approveButton()).toHaveTextContent(
      'Approve extracted memories (1 pending)'
    );
  });

  it.each([
    [true, 'true'],
    [false, 'false'],
  ])(
    'opens a memory with the panel’s decisions only for an admin (%s)',
    async (isAdmin, offered) => {
      mockCurrentUser = { ...ALICE, isAdmin };
      mockGetExtractedMemoryApproval.mockResolvedValue(preview(0));
      renderCard();

      fireEvent.click(await screen.findByTestId('extracted-memory-m1'));

      expect(screen.getByTestId('view-memory-modal')).toHaveAttribute(
        'data-is-admin',
        offered
      );
    }
  );

  it('refreshes the approval once a memory is decided in its panel', async () => {
    mockCurrentUser = { ...ALICE, isAdmin: true };
    mockGetExtractedMemoryApproval.mockResolvedValueOnce(preview(2));
    renderCard();
    fireEvent.click(await screen.findByTestId('extracted-memory-m1'));
    mockGetExtractedMemoryApproval.mockResolvedValue(preview(1));

    fireEvent.click(screen.getByTestId('decide-memory-btn'));

    expect(
      await screen.findByRole('button', {
        name: 'Approve extracted memories (2 pending)',
      })
    ).toBeInTheDocument();
    expect(screen.queryByTestId('view-memory-modal')).not.toBeInTheDocument();
    expect(mockGetExtractedMemoryApproval).toHaveBeenCalledTimes(2);
  });
});
