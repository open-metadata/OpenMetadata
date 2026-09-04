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
import { getListContextMemories } from '../../../rest/contextMemoryAPI';
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
      viewOnly,
      canDelete,
      memoryToEdit,
      onDeleted,
    }: {
      isOpen: boolean;
      viewOnly: boolean;
      canDelete: boolean;
      memoryToEdit?: { title?: string };
      onDeleted: () => void;
    }) =>
      isOpen && viewOnly ? (
        <div data-can-delete={canDelete} data-testid="view-memory-modal">
          {memoryToEdit?.title}
          <button data-testid="delete-memory-btn" onClick={onDeleted}>
            delete
          </button>
        </div>
      ) : null
  )
);

jest.mock('../../../rest/contextMemoryAPI', () => ({
  getListContextMemories: jest.fn(),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: { name: 'alice', isAdmin: false },
  })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockGetListContextMemories = getListContextMemories as jest.Mock;

const memories = [
  {
    id: 'm1',
    name: 'pill-1',
    title: 'VAT policy',
    question: 'What is the VAT rate?',
    owners: [{ id: 'u1', type: 'user', name: 'alice' }],
  },
  { id: 'm2', name: 'pill-2', title: 'Refund window' },
];

describe('ExtractedMemoriesCard', () => {
  beforeEach(() => {
    mockGetListContextMemories.mockResolvedValue({
      data: memories,
      paging: { total: 2 },
    });
  });

  it('requests only the memories extracted from the given source', async () => {
    render(<ExtractedMemoriesCard sourceId="page-1" />);

    await waitFor(() =>
      expect(mockGetListContextMemories).toHaveBeenCalledWith({
        sourceEntityId: 'page-1',
        fields: 'owners,sourceEntity',
        limit: 50,
      })
    );
  });

  it('lists each memory with its title and question', async () => {
    render(<ExtractedMemoriesCard sourceId="page-1" />);

    expect(await screen.findByText('VAT policy')).toBeInTheDocument();
    expect(screen.getByText('What is the VAT rate?')).toBeInTheDocument();
    expect(screen.getByText('Refund window')).toBeInTheDocument();
  });

  it('shows an empty message when the source has no memories', async () => {
    mockGetListContextMemories.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });

    render(<ExtractedMemoriesCard sourceId="page-1" />);

    expect(await screen.findByText('label.no-entity')).toBeInTheDocument();
  });

  it('keeps the card usable when the request fails', async () => {
    mockGetListContextMemories.mockRejectedValue(new Error('boom'));

    render(<ExtractedMemoriesCard sourceId="page-1" />);

    expect(await screen.findByText('label.no-entity')).toBeInTheDocument();
  });

  it('opens the view-only modal for the clicked memory', async () => {
    render(<ExtractedMemoriesCard sourceId="page-1" />);

    fireEvent.click(await screen.findByTestId('extracted-memory-m1'));

    expect(screen.getByTestId('view-memory-modal')).toHaveTextContent(
      'VAT policy'
    );
  });

  it('allows deleting a memory the current user owns', async () => {
    render(<ExtractedMemoriesCard sourceId="page-1" />);

    fireEvent.click(await screen.findByTestId('extracted-memory-m1'));

    expect(screen.getByTestId('view-memory-modal')).toHaveAttribute(
      'data-can-delete',
      'true'
    );
  });

  it('does not allow deleting a memory owned by someone else', async () => {
    render(<ExtractedMemoriesCard sourceId="page-1" />);

    fireEvent.click(await screen.findByTestId('extracted-memory-m2'));

    expect(screen.getByTestId('view-memory-modal')).toHaveAttribute(
      'data-can-delete',
      'false'
    );
  });

  it('refetches and closes the modal after a memory is deleted', async () => {
    render(<ExtractedMemoriesCard sourceId="page-1" />);

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
    render(<ExtractedMemoriesCard collapsible sourceId="page-1" />);

    expect(await screen.findByTestId('widget-card-title')).toHaveTextContent(
      'label.memory-plural (2)'
    );
  });
});
