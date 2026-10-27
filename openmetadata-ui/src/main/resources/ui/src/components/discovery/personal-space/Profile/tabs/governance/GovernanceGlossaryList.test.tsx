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

// Import AFTER mocks are defined so jest.requireMock returns the mocked module
import { getRelationTypeUsageCounts } from '../../../../../../rest/glossaryAPI';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
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

  it('cannot delete a system-defined relation type', async () => {
    await renderAndWaitForTable();

    expect(screen.getByTestId('delete-broader-btn')).toBeDisabled();
  });

  it('opens the delete confirmation popover when delete is clicked', async () => {
    await renderAndWaitForTable();
    fireEvent.click(screen.getByTestId('delete-relatedTo-btn'));

    expect(
      await screen.findByTestId('delete-relation-type-popover')
    ).toBeInTheDocument();
  });

  it('deletes the relation type on confirm and drops it from the list', async () => {
    await renderAndWaitForTable();
    fireEvent.click(screen.getByTestId('delete-relatedTo-btn'));
    await act(async () => {
      fireEvent.click(
        await screen.findByTestId('delete-relation-type-popover-confirm')
      );
    });

    expect(mockDeleteRelationshipType).toHaveBeenCalledWith('rt-2');
    expect(
      screen.queryByTestId('relation-name-relatedTo')
    ).not.toBeInTheDocument();
  });

  it('keeps the popover open and the row listed when the delete fails', async () => {
    mockDeleteRelationshipType.mockRejectedValue(new Error('boom'));
    await renderAndWaitForTable();
    fireEvent.click(screen.getByTestId('delete-relatedTo-btn'));
    await act(async () => {
      fireEvent.click(
        await screen.findByTestId('delete-relation-type-popover-confirm')
      );
    });

    expect(showErrorToast).toHaveBeenCalled();
    expect(
      screen.getByTestId('delete-relation-type-popover')
    ).toBeInTheDocument();
    expect(screen.getByTestId('relation-name-relatedTo')).toBeInTheDocument();
  });

  it('does not call deleteRelationshipType on cancel', async () => {
    await renderAndWaitForTable();
    fireEvent.click(screen.getByTestId('delete-relatedTo-btn'));
    fireEvent.click(
      await screen.findByTestId('delete-relation-type-popover-cancel')
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId('delete-relation-type-popover')
      ).not.toBeInTheDocument()
    );

    expect(mockDeleteRelationshipType).not.toHaveBeenCalled();
  });
});
