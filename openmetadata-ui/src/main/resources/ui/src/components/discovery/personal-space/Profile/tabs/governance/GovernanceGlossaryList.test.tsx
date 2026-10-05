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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

// Use jest.fn() directly in the mock factory — no hoisting-order dependency
jest.mock('../../../../../../rest/ontologyAPI', () => ({
  listRelationshipTypes: jest.fn(),
  deleteRelationshipType: jest.fn(),
}));

jest.mock('../../../../../../rest/glossaryAPI', () => ({
  getRelationTypeUsageCounts: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock(
  '../../../../../../components/common/EmptyPlaceholder/CreatePlaceholder',
  () =>
    jest.fn(({ 'data-testid': testId }: { 'data-testid'?: string }) => (
      <div data-testid={testId} />
    ))
);

jest.mock(
  '../../../../../../pages/GlossaryTermRelationSettings/RelationshipTypeTable',
  () =>
    jest.fn(
      ({
        relationshipTypes,
        onEdit,
        onDelete,
      }: {
        relationshipTypes: Array<{ id: string; name: string }>;
        onEdit: (item: { name: string }) => void;
        onDelete: (item: { id: string; name: string }) => void;
      }) => (
        <div data-testid="relation-types-table">
          {relationshipTypes.map((rt) => (
            <div key={rt.id}>
              <span data-testid={`relation-name-${rt.name}`}>{rt.name}</span>
              <button
                data-testid={`edit-${rt.name}-btn`}
                onClick={() => onEdit(rt)}>
                Edit
              </button>
              <button
                data-testid={`delete-${rt.name}-btn`}
                onClick={() => onDelete(rt)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )
    )
);

jest.mock('@openmetadata/ui-core-components', () => {
  const DialogContent = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  const DialogFooter = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  const Dialog = Object.assign(
    ({
      children,
      title,
      'data-testid': testId,
    }: {
      children?: React.ReactNode;
      title?: string;
      'data-testid'?: string;
    }) => (
      <div data-testid={testId ?? 'dialog'} role="dialog">
        <span>{title}</span>
        {children}
      </div>
    ),
    { Content: DialogContent, Footer: DialogFooter }
  );

  return {
    Button: ({
      children,
      onPress,
      'data-testid': testId,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      'data-testid'?: string;
    }) => (
      <button data-testid={testId} onClick={onPress}>
        {children}
      </button>
    ),
    Dialog,
    Modal: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    ModalOverlay: ({
      children,
      isOpen,
    }: {
      children?: React.ReactNode;
      isOpen?: boolean;
    }) => (isOpen ? <div data-testid="modal-overlay">{children}</div> : null),
    PaginationCardWithControls: () => <div data-testid="pagination-controls" />,
    Typography: ({ children }: { children?: React.ReactNode }) => (
      <span>{children}</span>
    ),
  };
});

// Import AFTER mocks are defined so jest.requireMock returns the mocked module
import { getRelationTypeUsageCounts } from '../../../../../../rest/glossaryAPI';
import {
  deleteRelationshipType,
  listRelationshipTypes,
} from '../../../../../../rest/ontologyAPI';
import GovernanceGlossaryList from './GovernanceGlossaryList';

const mockListRelationshipTypes = listRelationshipTypes as jest.Mock;
const mockGetRelationTypeUsageCounts = getRelationTypeUsageCounts as jest.Mock;
const mockDeleteRelationshipType = deleteRelationshipType as jest.Mock;

const mockRelationshipTypes = [
  {
    id: 'rt-1',
    name: 'broader',
    displayName: 'Broader',
    systemDefined: true,
    category: 'CORE',
    rdfPredicate: '',
    characteristics: [],
    crossGlossaryAllowed: true,
    paletteKey: 'BLUE',
  },
  {
    id: 'rt-2',
    name: 'relatedTo',
    displayName: 'Related To',
    systemDefined: false,
    category: 'CUSTOM',
    rdfPredicate: '',
    characteristics: [],
    crossGlossaryAllowed: true,
    paletteKey: 'VIOLET',
  },
];

const mockOnNavigate = jest.fn();

const renderComponent = () =>
  render(
    <MemoryRouter>
      <GovernanceGlossaryList onNavigate={mockOnNavigate} />
    </MemoryRouter>
  );

describe('GovernanceGlossaryList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListRelationshipTypes.mockResolvedValue({
      data: mockRelationshipTypes,
      paging: {},
    });
    mockGetRelationTypeUsageCounts.mockResolvedValue({});
    mockDeleteRelationshipType.mockResolvedValue({});
  });

  it('shows a loading indicator initially', () => {
    mockListRelationshipTypes.mockReturnValue(new Promise(() => {}));
    renderComponent();

    expect(screen.getByText('label.loading')).toBeInTheDocument();
  });

  const renderAndWaitForTable = async () => {
    renderComponent();
    // Flush microtasks so resolved-Promise state updates reach React
    await act(async () => {});
  };

  it('renders the table after data loads', async () => {
    await renderAndWaitForTable();

    expect(screen.getByTestId('relation-types-table')).toBeInTheDocument();
    expect(screen.getByTestId('relation-name-broader')).toBeInTheDocument();
    expect(screen.getByTestId('relation-name-relatedTo')).toBeInTheDocument();
  });

  it('calls onNavigate with glossary-edit when edit is clicked', async () => {
    await renderAndWaitForTable();
    fireEvent.click(screen.getByTestId('edit-relatedTo-btn'));

    expect(mockOnNavigate).toHaveBeenCalledWith({
      type: 'glossary-edit',
      name: 'relatedTo',
    });
  });

  it('opens the delete confirm dialog when delete is clicked', async () => {
    await renderAndWaitForTable();
    fireEvent.click(screen.getByTestId('delete-relatedTo-btn'));

    expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();
    expect(
      screen.getByTestId('delete-relation-type-confirmation')
    ).toBeInTheDocument();
  });

  it('calls deleteRelationshipType on confirm delete', async () => {
    await renderAndWaitForTable();
    fireEvent.click(screen.getByTestId('delete-relatedTo-btn'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-btn'));
    });

    expect(mockDeleteRelationshipType).toHaveBeenCalledWith('rt-2');
  });

  it('does not call deleteRelationshipType on cancel', async () => {
    await renderAndWaitForTable();
    fireEvent.click(screen.getByTestId('delete-relatedTo-btn'));

    expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();

    fireEvent.click(screen.getByText('label.cancel'));

    expect(mockDeleteRelationshipType).not.toHaveBeenCalled();
  });
});
