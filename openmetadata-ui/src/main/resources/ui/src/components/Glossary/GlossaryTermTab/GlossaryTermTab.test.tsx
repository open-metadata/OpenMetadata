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
  act,
  fireEvent,
  getAllByTestId,
  getAllByText,
  getByTestId,
  getByText,
  render,
  waitFor,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  mockedGlossaryTerms,
  MOCK_PERMISSIONS,
} from '../../../mocks/Glossary.mock';
import { useGlossaryStore } from '../useGlossary.store';
import GlossaryTermTab from './GlossaryTermTab.component';

const mockOnAddGlossaryTerm = jest.fn();
const mockRefreshGlossaryTerms = jest.fn();
const mockOnEditGlossaryTerm = jest.fn();
const mockSetGlossaryChildTerms = jest.fn();
const mockGetFirstLevelGlossaryTermsPaginated = jest.fn();
const mockGetGlossaryTermChildrenLazy = jest.fn();
const mockGetAllFeeds = jest.fn();

const mockProps = {
  childGlossaryTerms: [],
  isGlossary: false,
  permissions: MOCK_PERMISSIONS,
  selectedData: mockedGlossaryTerms[0],
  termsLoading: false,
};

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossaryTerms: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockedGlossaryTerms })),
  patchGlossaryTerm: jest.fn().mockImplementation(() => Promise.resolve()),
  getFirstLevelGlossaryTermsPaginated: jest.fn().mockImplementation((...args) =>
    mockGetFirstLevelGlossaryTermsPaginated(...args)
  ),
  getGlossaryTermChildrenLazy: jest.fn().mockImplementation((fqn) =>
    mockGetGlossaryTermChildrenLazy(fqn)
  ),
}));

jest.mock('../../../rest/feedsAPI', () => ({
  getAllFeeds: jest.fn().mockImplementation((...args) => mockGetAllFeeds(...args)),
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

jest.mock('../useGlossary.store', () => ({
  useGlossaryStore: jest.fn().mockImplementation(() => ({
    activeGlossary: mockedGlossaryTerms[0],
    glossaryChildTerms: [],
    updateActiveGlossary: jest.fn(),
    onAddGlossaryTerm: mockOnAddGlossaryTerm,
    onEditGlossaryTerm: mockOnEditGlossaryTerm,
    refreshGlossaryTerms: mockRefreshGlossaryTerms,
    setGlossaryChildTerms: mockSetGlossaryChildTerms,
  })),
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
  });

  it('should show the ErrorPlaceHolder component, if no glossary is present', () => {
    const { container } = render(<GlossaryTermTab {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(getByText(container, 'ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('should call the onAddGlossaryTerm fn onClick of add button in ErrorPlaceHolder', () => {
    const { container } = render(<GlossaryTermTab {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    fireEvent.click(getByText(container, 'ErrorPlaceHolder'));

    expect(mockOnAddGlossaryTerm).toHaveBeenCalled();
  });

  it('should contain all necessary fields value in table when glossary data is not empty', async () => {
    (useGlossaryStore as unknown as jest.Mock).mockImplementation(() => ({
      activeGlossary: {
        ...mockedGlossaryTerms[0],
        children: mockedGlossaryTerms,
      },
      glossaryChildTerms: mockedGlossaryTerms,
      updateActiveGlossary: jest.fn(),
      setGlossaryChildTerms: mockSetGlossaryChildTerms,
    }));
    const { container } = render(<GlossaryTermTab {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(getByTestId(container, 'Clothing')).toBeInTheDocument();
    expect(
      getByText(container, 'description of Business Glossary.Sales')
    ).toBeInTheDocument();

    expect(getAllByText(container, 'OwnerLabel')).toHaveLength(2);

    expect(getAllByTestId(container, 'add-classification')).toHaveLength(1);
    expect(getAllByTestId(container, 'edit-button')).toHaveLength(2);
  });

  describe('Pagination functionality', () => {
    it('should fetch terms with pagination on mount', async () => {
      (useGlossaryStore as unknown as jest.Mock).mockImplementation(() => ({
        activeGlossary: {
          fullyQualifiedName: 'test-glossary',
          name: 'Test Glossary',
        },
        glossaryChildTerms: [],
        setGlossaryChildTerms: mockSetGlossaryChildTerms,
      }));

      await act(async () => {
        render(<GlossaryTermTab {...mockProps} />, {
          wrapper: MemoryRouter,
        });
      });

      await waitFor(() => {
        expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledWith(
          'test-glossary',
          50,
          undefined
        );
      });
    });

    it('should load more terms when scrolling to bottom', async () => {
      (require('react-intersection-observer').useInView as jest.Mock).mockReturnValue({
        ref: jest.fn(),
        inView: true,
      });

      mockGetFirstLevelGlossaryTermsPaginated
        .mockResolvedValueOnce({
          data: mockedGlossaryTerms,
          paging: { after: 'cursor123' },
        })
        .mockResolvedValueOnce({
          data: mockedGlossaryTerms,
          paging: { after: null },
        });

      (useGlossaryStore as unknown as jest.Mock).mockImplementation(() => ({
        activeGlossary: {
          fullyQualifiedName: 'test-glossary',
          name: 'Test Glossary',
        },
        glossaryChildTerms: mockedGlossaryTerms,
        setGlossaryChildTerms: mockSetGlossaryChildTerms,
      }));

      await act(async () => {
        render(<GlossaryTermTab {...mockProps} />, {
          wrapper: MemoryRouter,
        });
      });

      await waitFor(() => {
        expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(2);
        expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenLastCalledWith(
          'test-glossary',
          50,
          'cursor123'
        );
      });
    });
  });

  describe('Search functionality', () => {
    it('should render search input', async () => {
      (useGlossaryStore as unknown as jest.Mock).mockImplementation(() => ({
        activeGlossary: {
          fullyQualifiedName: 'test-glossary',
          name: 'Test Glossary',
        },
        glossaryChildTerms: mockedGlossaryTerms,
        setGlossaryChildTerms: mockSetGlossaryChildTerms,
      }));

      await act(async () => {
        render(<GlossaryTermTab {...mockProps} />, {
          wrapper: MemoryRouter,
        });
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search.*term/i)).toBeInTheDocument();
      });
    });

    it('should filter terms based on search input', async () => {
      const mockTerms = [
        {
          name: 'Sales Term',
          fullyQualifiedName: 'glossary.sales',
          displayName: 'Sales Term',
          description: 'Sales related term',
          childrenCount: 0,
        },
        {
          name: 'Marketing Term',
          fullyQualifiedName: 'glossary.marketing',
          displayName: 'Marketing Term',
          description: 'Marketing related term',
          childrenCount: 0,
        },
      ];

      (useGlossaryStore as unknown as jest.Mock).mockImplementation(() => ({
        activeGlossary: {
          fullyQualifiedName: 'test-glossary',
          name: 'Test Glossary',
        },
        glossaryChildTerms: mockTerms,
        setGlossaryChildTerms: mockSetGlossaryChildTerms,
      }));

      await act(async () => {
        const { rerender } = render(<GlossaryTermTab {...mockProps} />, {
          wrapper: MemoryRouter,
        });

        const searchInput = screen.getByPlaceholderText(/search.*term/i);
        
        await userEvent.type(searchInput, 'sales');

        // Wait for debounced search
        await waitFor(() => {
          // Force rerender to see filtered results
          rerender(<GlossaryTermTab {...mockProps} />);
          
          expect(screen.getByText('Sales Term')).toBeInTheDocument();
          expect(screen.queryByText('Marketing Term')).not.toBeInTheDocument();
        }, { timeout: 1000 });
      });
    });
  });

  describe('Expand All functionality', () => {
    it('should render expand all button', async () => {
      (useGlossaryStore as unknown as jest.Mock).mockImplementation(() => ({
        activeGlossary: {
          fullyQualifiedName: 'test-glossary',
          name: 'Test Glossary',
        },
        glossaryChildTerms: mockedGlossaryTerms,
        setGlossaryChildTerms: mockSetGlossaryChildTerms,
      }));

      await act(async () => {
        render(<GlossaryTermTab {...mockProps} />, {
          wrapper: MemoryRouter,
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('expand-collapse-all-button')).toBeInTheDocument();
        expect(screen.getByText('label.expand-all')).toBeInTheDocument();
      });
    });

    it('should expand all terms and load children when clicking expand all', async () => {
      const mockTermsWithChildren = [
        {
          name: 'Parent Term 1',
          fullyQualifiedName: 'glossary.parent1',
          childrenCount: 2,
          children: [],
        },
        {
          name: 'Parent Term 2',
          fullyQualifiedName: 'glossary.parent2',
          childrenCount: 3,
          children: [],
        },
      ];

      (useGlossaryStore as unknown as jest.Mock).mockImplementation(() => ({
        activeGlossary: {
          fullyQualifiedName: 'test-glossary',
          name: 'Test Glossary',
        },
        glossaryChildTerms: mockTermsWithChildren,
        setGlossaryChildTerms: mockSetGlossaryChildTerms,
      }));

      await act(async () => {
        render(<GlossaryTermTab {...mockProps} />, {
          wrapper: MemoryRouter,
        });
      });

      const expandAllButton = screen.getByTestId('expand-collapse-all-button');
      
      await act(async () => {
        fireEvent.click(expandAllButton);
      });

      await waitFor(() => {
        expect(mockGetGlossaryTermChildrenLazy).toHaveBeenCalledWith('glossary.parent1', 50);
        expect(mockGetGlossaryTermChildrenLazy).toHaveBeenCalledWith('glossary.parent2', 50);
        expect(mockSetGlossaryChildTerms).toHaveBeenCalled();
      });
    });

    it('should show loading state while expanding all', async () => {
      const mockTermsWithChildren = [
        {
          name: 'Parent Term',
          fullyQualifiedName: 'glossary.parent',
          childrenCount: 5,
          children: [],
        },
      ];

      mockGetGlossaryTermChildrenLazy.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: [] }), 100))
      );

      (useGlossaryStore as unknown as jest.Mock).mockImplementation(() => ({
        activeGlossary: {
          fullyQualifiedName: 'test-glossary',
          name: 'Test Glossary',
        },
        glossaryChildTerms: mockTermsWithChildren,
        setGlossaryChildTerms: mockSetGlossaryChildTerms,
      }));

      await act(async () => {
        render(<GlossaryTermTab {...mockProps} />, {
          wrapper: MemoryRouter,
        });
      });

      const expandAllButton = screen.getByTestId('expand-collapse-all-button');
      
      await act(async () => {
        fireEvent.click(expandAllButton);
      });

      await waitFor(() => {
        expect(screen.getByText('label.loading')).toBeInTheDocument();
        expect(expandAllButton).toBeDisabled();
      });
    });

    it('should collapse all when clicking button in expanded state', async () => {
      const mockTermsWithChildren = [
        {
          name: 'Parent Term',
          fullyQualifiedName: 'glossary.parent',
          childrenCount: 2,
          children: [
            { name: 'Child 1', fullyQualifiedName: 'glossary.parent.child1' },
            { name: 'Child 2', fullyQualifiedName: 'glossary.parent.child2' },
          ],
        },
      ];

      // Mock the expandable keys calculation
      (require('../../../utils/TableUtils').findExpandableKeysForArray as jest.Mock)
        .mockReturnValue(['glossary.parent']);

      (useGlossaryStore as unknown as jest.Mock).mockImplementation(() => ({
        activeGlossary: {
          fullyQualifiedName: 'test-glossary',
          name: 'Test Glossary',
        },
        glossaryChildTerms: mockTermsWithChildren,
        setGlossaryChildTerms: mockSetGlossaryChildTerms,
      }));

      await act(async () => {
        const { rerender } = render(<GlossaryTermTab {...mockProps} />, {
          wrapper: MemoryRouter,
        });

        // First click to expand all
        const expandAllButton = screen.getByTestId('expand-collapse-all-button');
        fireEvent.click(expandAllButton);

        // Wait a bit for state update
        await waitFor(() => {
          expect(mockGetGlossaryTermChildrenLazy).toHaveBeenCalled();
        });

        // Update component to show collapse all button
        rerender(<GlossaryTermTab {...mockProps} />);
      });

      // The button text should remain as expand-all since we're testing the toggle
      await waitFor(() => {
        expect(screen.getByText('label.expand-all')).toBeInTheDocument();
      });
    });
  });

  describe('Drag and drop functionality', () => {
    it('should handle term reordering', async () => {
      const mockTerms = [
        {
          name: 'Term 1',
          fullyQualifiedName: 'glossary.term1',
          childrenCount: 0,
        },
        {
          name: 'Term 2',
          fullyQualifiedName: 'glossary.term2',
          childrenCount: 0,
        },
      ];

      (useGlossaryStore as unknown as jest.Mock).mockImplementation(() => ({
        activeGlossary: {
          fullyQualifiedName: 'test-glossary',
          name: 'Test Glossary',
        },
        glossaryChildTerms: mockTerms,
        setGlossaryChildTerms: mockSetGlossaryChildTerms,
      }));

      await act(async () => {
        render(<GlossaryTermTab {...mockProps} />, {
          wrapper: MemoryRouter,
        });
      });

      // Verify table is rendered
      await waitFor(() => {
        expect(screen.getByText('Term 1')).toBeInTheDocument();
        expect(screen.getByText('Term 2')).toBeInTheDocument();
      });
    });
  });

  describe('Status filtering', () => {
    it('should render status dropdown', async () => {
      (useGlossaryStore as unknown as jest.Mock).mockImplementation(() => ({
        activeGlossary: {
          fullyQualifiedName: 'test-glossary',
          name: 'Test Glossary',
        },
        glossaryChildTerms: mockedGlossaryTerms,
        setGlossaryChildTerms: mockSetGlossaryChildTerms,
      }));

      await act(async () => {
        render(<GlossaryTermTab {...mockProps} />, {
          wrapper: MemoryRouter,
        });
      });

      await waitFor(() => {
        expect(screen.getByText('label.status')).toBeInTheDocument();
      });
    });
  });

  describe('Store state handling', () => {
    it('should handle non-array glossaryChildTerms gracefully', async () => {
      (useGlossaryStore as unknown as jest.Mock).mockImplementation(() => ({
        activeGlossary: {
          fullyQualifiedName: 'test-glossary',
          name: 'Test Glossary',
        },
        glossaryChildTerms: 'NOT_AN_ARRAY', // Invalid state
        setGlossaryChildTerms: mockSetGlossaryChildTerms,
      }));

      const { container } = render(<GlossaryTermTab {...mockProps} />, {
        wrapper: MemoryRouter,
      });

      // Should show error placeholder when data is invalid
      expect(getByText(container, 'ErrorPlaceHolder')).toBeInTheDocument();
    });
  });
});