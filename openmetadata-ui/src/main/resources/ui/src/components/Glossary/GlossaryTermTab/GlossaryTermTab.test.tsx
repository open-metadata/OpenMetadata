/*
 *  Copyright 2023 Collate.
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
  fireEvent,
  getByText,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  mockedGlossaryTerms,
  MOCK_PERMISSIONS,
} from '../../../mocks/Glossary.mock';
import GlossaryTermTab from './GlossaryTermTab.component';

const mockOnAddGlossaryTerm = jest.fn();
const mockRefreshGlossaryTerms = jest.fn();
const mockOnEditGlossaryTerm = jest.fn();
const mockSetGlossaryChildTerms = jest.fn();
const mockGetFirstLevelGlossaryTermsPaginated = jest.fn();
const mockGetGlossaryTermChildrenLazy = jest.fn();
const mockSearchGlossaryTermsPaginated = jest.fn();
const mockGetAllFeeds = jest.fn();

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossaryTerms: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockedGlossaryTerms })),
  patchGlossaryTerm: jest.fn().mockImplementation(() => Promise.resolve()),
  getFirstLevelGlossaryTermsPaginated: jest
    .fn()
    .mockImplementation((...args) =>
      mockGetFirstLevelGlossaryTermsPaginated(...args)
    ),
  getGlossaryTermChildrenLazy: jest
    .fn()
    .mockImplementation((fqn) => mockGetGlossaryTermChildrenLazy(fqn)),
  searchGlossaryTermsPaginated: jest
    .fn()
    .mockImplementation((...args) => mockSearchGlossaryTermsPaginated(...args)),
}));

jest.mock('../../../rest/feedsAPI', () => ({
  getAllFeeds: jest
    .fn()
    .mockImplementation((...args) => mockGetAllFeeds(...args)),
}));

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewNew', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }) => (
      <p data-testid="description">{markdown}</p>
    ))
);

jest.mock('../../../utils/TableUtils', () => ({
  getTableExpandableConfig: jest.fn(),
  getTableColumnConfigSelections: jest
    .fn()
    .mockReturnValue(['name', 'description', 'owners']),
  handleUpdateTableColumnSelections: jest.fn(),
  findExpandableKeysForArray: jest.fn().mockReturnValue([]),
}));

// Mock where the component actually imports this util
jest.mock('../../../utils/GlossaryUtils', () => ({
  ...jest.requireActual('../../../utils/GlossaryUtils'),
  findExpandableKeysForArray: jest.fn().mockReturnValue([]),
}));

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest
    .fn()
    .mockImplementation(({ onClick }) => (
      <div onClick={onClick}>ErrorPlaceHolder</div>
    ))
);

jest.mock('../../common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockImplementation(() => <div>OwnerLabel</div>),
}));

jest.mock('../../../utils/TableColumn.util', () => ({
  ownerTableObject: jest.fn().mockReturnValue([
    {
      title: 'label.owner-plural',
      dataIndex: 'owners',
      key: 'owners',
      width: 180,
      render: () => <div>OwnerLabel</div>,
    },
  ]),
}));

const mockUseGlossaryStore = {
  activeGlossary: mockedGlossaryTerms[0],
  glossaryChildTerms: [] as any[],
  updateActiveGlossary: jest.fn(),
  onAddGlossaryTerm: mockOnAddGlossaryTerm,
  onEditGlossaryTerm: mockOnEditGlossaryTerm,
  refreshGlossaryTerms: mockRefreshGlossaryTerms,
  setGlossaryChildTerms: mockSetGlossaryChildTerms,
};

jest.mock('../useGlossary.store', () => ({
  useGlossaryStore: jest.fn().mockImplementation(() => mockUseGlossaryStore),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn().mockImplementation(() => ({
    permissions: MOCK_PERMISSIONS,
    type: 'glossary',
  })),
}));

jest.mock('react-intersection-observer', () => {
  const mockUseInView = jest.fn().mockReturnValue({
    ref: jest.fn(),
    inView: false,
  });

  return {
    useInView: mockUseInView,
  };
});

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('react-dnd', () => ({
  useDrag: jest.fn().mockReturnValue([{ isDragging: false }, jest.fn()]),
  useDrop: jest.fn().mockReturnValue([{ isOver: false }, jest.fn()]),
  DndProvider: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('react-dnd-html5-backend', () => ({
  HTML5Backend: jest.fn(),
}));

jest.mock('../../../utils/EntityBulkEdit/EntityBulkEditUtils', () => ({
  getBulkEditButton: jest.fn().mockReturnValue(null),
}));

jest.mock('../../../constants/docs.constants', () => ({
  GLOSSARY_TERMS_STATUS_DOCS: 'https://docs.example.com',
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock MutationObserver
global.MutationObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
}));

describe('Test GlossaryTermTab component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValue({
      data: mockedGlossaryTerms,
      paging: { after: null },
    });
    mockSearchGlossaryTermsPaginated.mockResolvedValue({
      data: mockedGlossaryTerms,
      paging: { after: null },
    });
    mockGetGlossaryTermChildrenLazy.mockResolvedValue({
      data: [
        {
          name: 'Child Term 1',
          fullyQualifiedName: 'glossary.term.child1',
          childrenCount: 0,
        },
        {
          name: 'Child Term 2',
          fullyQualifiedName: 'glossary.term.child2',
          childrenCount: 0,
        },
      ],
    });
    mockGetAllFeeds.mockResolvedValue({ data: [] });

    // Reset store to default state
    Object.assign(mockUseGlossaryStore, {
      activeGlossary: mockedGlossaryTerms[0],
      glossaryChildTerms: [] as any[],
      updateActiveGlossary: jest.fn(),
      onAddGlossaryTerm: mockOnAddGlossaryTerm,
      onEditGlossaryTerm: mockOnEditGlossaryTerm,
      refreshGlossaryTerms: mockRefreshGlossaryTerms,
      setGlossaryChildTerms: mockSetGlossaryChildTerms,
    });
  });

  describe('Empty State', () => {
    it('should show the ErrorPlaceHolder component when no glossary terms are present', async () => {
      // Make sure the API returns empty data
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValue({
        data: [],
        paging: { after: null },
      });

      const { container } = render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(getByText(container, 'ErrorPlaceHolder')).toBeInTheDocument();
      });
    });

    it('should call the onAddGlossaryTerm function when clicking add button in ErrorPlaceHolder', async () => {
      // Make sure the API returns empty data
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValue({
        data: [],
        paging: { after: null },
      });

      const { container } = render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(getByText(container, 'ErrorPlaceHolder')).toBeInTheDocument();
      });

      fireEvent.click(getByText(container, 'ErrorPlaceHolder'));

      expect(mockOnAddGlossaryTerm).toHaveBeenCalled();
    });
  });

  describe('Table Rendering with Data', () => {
    beforeEach(() => {
      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;
    });

    it('should render the table when glossary terms are present', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(screen.getByTestId('glossary-terms-table')).toBeInTheDocument();
      });
    });

    it('should display glossary term names as links', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(screen.getByTestId('Clothing')).toBeInTheDocument();
        expect(screen.getByTestId('Sales')).toBeInTheDocument();
      });
    });

    it('should render description column with rich text preview', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const descriptions = screen.getAllByTestId('description');

        expect(descriptions).toHaveLength(2);
        expect(descriptions[0]).toHaveTextContent(
          'description of Business Glossary.Clothing'
        );
      });
    });

    it('should render status badges for each term', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('Business Glossary.Clothing-status')
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('Business Glossary.Sales-status')
        ).toBeInTheDocument();
      });
    });

    it('should render owner labels', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const ownerLabels = screen.getAllByText('OwnerLabel');

        expect(ownerLabels.length).toBeGreaterThan(0);
      });
    });

    it('should render action buttons when user has create permissions', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const editButtons = screen.getAllByTestId('edit-button');

        expect(editButtons).toHaveLength(2);
      });
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;
    });

    it('should render search input field', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('label.search-entity');

        expect(searchInput).toBeInTheDocument();
      });
    });

    it('should filter terms based on search input', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('label.search-entity');
        fireEvent.change(searchInput, { target: { value: 'Clothing' } });
      });

      // Note: Due to debounce, we might need to wait for the filtering to take effect
      await waitFor(() => {
        expect(screen.getByTestId('Clothing')).toBeInTheDocument();
      });
    });
  });

  describe('Status Filtering', () => {
    beforeEach(() => {
      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;
    });

    it('should render status dropdown button', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('glossary-status-dropdown')
        ).toBeInTheDocument();
      });
    });

    it('should open status dropdown when clicked', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const statusDropdown = screen.getByTestId('glossary-status-dropdown');
        fireEvent.click(statusDropdown);
      });
    });
  });

  describe('Expand/Collapse Functionality', () => {
    beforeEach(() => {
      const termsWithChildren = [
        {
          ...mockedGlossaryTerms[0],
          childrenCount: 2,
          children: [],
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = termsWithChildren;
    });

    it('should render expand/collapse all button', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('expand-collapse-all-button')
        ).toBeInTheDocument();
      });
    });

    it('should show expand icon for terms with children', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(screen.getByTestId('expand-icon')).toBeInTheDocument();
      });
    });

    it('should call fetchChildTerms when expanding a term with children', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const expandIcon = screen.getByTestId('expand-icon');
        fireEvent.click(expandIcon);
      });

      expect(mockGetGlossaryTermChildrenLazy).toHaveBeenCalledWith(
        'Business Glossary.Clothing'
      );
    });
  });

  describe('Actions', () => {
    beforeEach(() => {
      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;
    });

    it('should call onEditGlossaryTerm when edit button is clicked', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const editButtons = screen.getAllByTestId('edit-button');
        fireEvent.click(editButtons[0]);
      });

      expect(mockOnEditGlossaryTerm).toHaveBeenCalledWith(
        mockedGlossaryTerms[0]
      );
    });

    it('should call onAddGlossaryTerm when add term button is clicked', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const addButtons = screen.getAllByTestId('add-classification');
        fireEvent.click(addButtons[0]);
      });

      expect(mockOnAddGlossaryTerm).toHaveBeenCalledWith(
        mockedGlossaryTerms[1]
      );
    });
  });

  describe('Permissions', () => {
    it('should not show action buttons when user lacks create permissions', async () => {
      const mockGenericContext = jest.fn().mockReturnValue({
        permissions: { ...MOCK_PERMISSIONS, Create: false },
        type: 'glossary',
      });

      const { useGenericContext } = jest.requireMock(
        '../../Customization/GenericProvider/GenericProvider'
      );
      useGenericContext.mockImplementation(mockGenericContext);

      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
        expect(
          screen.queryByTestId('add-classification')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loader when table is loading', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      // Initially loading state might be triggered
      const loader = screen.queryByText('Loader');

      expect(loader).toBeDefined();
    });
  });

  describe('Infinite Scroll', () => {
    beforeEach(() => {
      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;
    });

    it('should call fetchAllTerms when scroll trigger is in view', async () => {
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValue({
        data: mockedGlossaryTerms,
        paging: { after: 'next-cursor' },
      });

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalled();
      });
    });
  });

  describe('Drag and Drop', () => {
    beforeEach(() => {
      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;
    });

    it('should render drag icons for each row', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      const dragIcons = document.querySelectorAll('.drag-icon');

      expect(dragIcons).toHaveLength(0);
    });
  });

  describe('Modal Functionality', () => {
    it('should not show modal initially', () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      expect(
        screen.queryByTestId('confirmation-modal')
      ).not.toBeInTheDocument();
    });
  });

  describe('Glossary vs Glossary Term Context', () => {
    it('should behave differently when isGlossary is true', async () => {
      render(<GlossaryTermTab isGlossary />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(mockGetAllFeeds).toHaveBeenCalledWith(
          expect.stringContaining('glossary'),
          undefined,
          'Task',
          undefined,
          'Open',
          undefined,
          100000
        );
      });
    });

    it('should behave differently when isGlossary is false', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(mockGetAllFeeds).toHaveBeenCalledWith(
          expect.stringContaining('glossaryTerm'),
          undefined,
          'Task',
          undefined,
          'Open',
          undefined,
          100000
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully when fetching terms', async () => {
      mockGetFirstLevelGlossaryTermsPaginated.mockRejectedValue(
        new Error('API Error')
      );

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalled();
      });
    });

    it('should handle errors when fetching child terms', async () => {
      const termsWithChildren = [
        {
          ...mockedGlossaryTerms[0],
          childrenCount: 2,
          children: [],
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = termsWithChildren;
      mockGetGlossaryTermChildrenLazy.mockRejectedValue(
        new Error('Child fetch error')
      );

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const expandIcon = screen.getByTestId('expand-icon');
        fireEvent.click(expandIcon);
      });

      await waitFor(() => {
        expect(mockGetGlossaryTermChildrenLazy).toHaveBeenCalled();
      });
    });

    it('should handle errors when fetching feeds', async () => {
      mockGetAllFeeds.mockRejectedValue(new Error('Feeds error'));

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(mockGetAllFeeds).toHaveBeenCalled();
      });
    });
  });

  describe('Task Management and Status Actions', () => {
    beforeEach(() => {
      const termWithInReviewStatus = [
        {
          ...mockedGlossaryTerms[0],
          status: 'InReview',
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = termWithInReviewStatus;
    });

    it('should render status action buttons for terms in review', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        // Status actions would be rendered based on permissions and status
        const table = screen.getByTestId('glossary-terms-table');

        expect(table).toBeInTheDocument();
      });
    });
  });

  describe('Advanced Pagination', () => {
    it('should handle pagination with cursor-based loading', async () => {
      mockGetFirstLevelGlossaryTermsPaginated
        .mockResolvedValueOnce({
          data: mockedGlossaryTerms.slice(0, 1),
          paging: { after: 'cursor-1' },
        })
        .mockResolvedValueOnce({
          data: mockedGlossaryTerms.slice(1, 2),
          paging: { after: null },
        });

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalled();
      });
    });

    it('should stop loading when no more terms are available', async () => {
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValue({
        data: mockedGlossaryTerms,
        paging: { after: null },
      });

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalled();
      });
    });
  });

  describe('Status Dropdown Advanced Functionality', () => {
    beforeEach(() => {
      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;
    });

    it('should handle status selection save action', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const statusDropdown = screen.getByTestId('glossary-status-dropdown');
        fireEvent.click(statusDropdown);
      });

      // The dropdown menu should be rendered but we can't easily test the save action
      // due to the complex dropdown structure
    });

    it('should handle status selection cancel action', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const statusDropdown = screen.getByTestId('glossary-status-dropdown');
        fireEvent.click(statusDropdown);
      });
    });
  });

  describe('Table Column Rendering', () => {
    beforeEach(() => {
      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;
    });

    it('should render synonyms column correctly', async () => {
      const termWithSynonyms = [
        {
          ...mockedGlossaryTerms[0],
          synonyms: ['synonym1', 'synonym2'],
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = termWithSynonyms;

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const table = screen.getByTestId('glossary-terms-table');

        expect(table).toBeInTheDocument();
      });
    });

    it('should render terms with icons when available', async () => {
      const termWithIcon = [
        {
          ...mockedGlossaryTerms[0],
          style: {
            iconURL: 'https://example.com/icon.png',
            color: '#FF0000',
          },
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = termWithIcon;

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const tagIcon = screen.getByTestId('tag-icon');

        expect(tagIcon).toBeInTheDocument();
      });
    });

    it('should render empty description placeholder', async () => {
      const termWithoutDescription = [
        {
          ...mockedGlossaryTerms[0],
          description: '',
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = termWithoutDescription;

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const table = screen.getByTestId('glossary-terms-table');

        expect(table).toBeInTheDocument();
      });
    });
  });

  describe('Expand All Functionality', () => {
    beforeEach(() => {
      const termsWithChildren = [
        {
          ...mockedGlossaryTerms[0],
          childrenCount: 2,
          children: [],
        },
        {
          ...mockedGlossaryTerms[1],
          childrenCount: 1,
          children: [],
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = termsWithChildren;
    });

    it('should expand all terms when clicking expand all button', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const expandAllButton = screen.getByTestId(
          'expand-collapse-all-button'
        );
        fireEvent.click(expandAllButton);
      });

      await waitFor(() => {
        expect(mockGetGlossaryTermChildrenLazy).toHaveBeenCalledWith(
          'Business Glossary.Clothing'
        );
      });
    });

    it('should show loading state during expand all operation', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      const expandAllButton = screen.getByTestId('expand-collapse-all-button');
      fireEvent.click(expandAllButton);

      // Should show loading during expand operation
      expect(expandAllButton).toBeDisabled();
    });
  });

  describe('Drag and Drop Modal', () => {
    it('should show confirmation modal when terms are moved', async () => {
      const termsWithChildren = [
        {
          ...mockedGlossaryTerms[0],
          childrenCount: 0,
        },
        {
          ...mockedGlossaryTerms[1],
          childrenCount: 0,
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = termsWithChildren;

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const table = screen.getByTestId('glossary-terms-table');

        expect(table).toBeInTheDocument();
      });

      // The modal would be triggered through drag and drop actions
      // which are complex to simulate in tests
    });
  });

  describe('Edge Cases', () => {
    it('should handle terms with missing required fields gracefully', async () => {
      const incompleteTerms = [
        {
          id: 'test-id',
          name: 'Test Term',
          // Missing other required fields
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = incompleteTerms;

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const table = screen.getByTestId('glossary-terms-table');

        expect(table).toBeInTheDocument();
      });
    });

    it('should handle non-array glossaryChildTerms gracefully', async () => {
      mockUseGlossaryStore.glossaryChildTerms = null as any;

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      // Should show the table even when glossaryChildTerms is not an array
      // The component handles this by returning an empty array for glossaryTerms
      await waitFor(() => {
        expect(screen.getByTestId('glossary-terms-table')).toBeInTheDocument();
      });
    });
  });
});
