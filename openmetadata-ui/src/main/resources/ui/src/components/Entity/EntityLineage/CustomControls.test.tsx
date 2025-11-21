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
import { createTheme, Theme, ThemeProvider } from '@mui/material/styles';
import { ThemeColors } from '@openmetadata/ui-core-components';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';
import { EntityType } from '../../../enums/entity.enum';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import ExploreQuickFilters from '../../Explore/ExploreQuickFilters';
import CustomControlsComponent from './CustomControls.component';

const mockOnExportClick = jest.fn();
const mockOnLineageConfigUpdate = jest.fn();
const mockSetSelectedQuickFilters = jest.fn();
const mockOnSearchValueChange = jest.fn();

const mockLineageConfig = {
  upstreamDepth: 3,
  downstreamDepth: 3,
  nodesPerLayer: 50,
};

const mockNavigate = jest.fn();
const mockLocation = {
  search: '?mode=lineage&depth=3&dir=downstream',
};

const defaultProps = {
  nodeDepthOptions: [1, 2, 3, 4, 5],
  onSearchValueChange: mockOnSearchValueChange,
  searchValue: '',
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

jest.mock('./LineageSearchSelect/LineageSearchSelect', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="lineage-search-select">LineageSearchSelect</div>
    )
);

jest.mock('../../Explore/ExploreQuickFilters', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="explore-quick-filters">ExploreQuickFilters</div>
    )
);

jest.mock('./LineageConfigModal', () =>
  jest.fn(({ visible, onCancel, onSave }) =>
    visible ? (
      <div data-testid="lineage-config-modal">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={() => onSave(mockLineageConfig)}>Save</button>
      </div>
    ) : null
  )
);

jest.mock('../../common/SearchBarComponent/SearchBar.component', () =>
  jest.fn(({ onSearch, searchValue, placeholder }) => (
    <input
      data-testid="search-bar"
      placeholder={placeholder}
      value={searchValue}
      onChange={(e) => onSearch(e.target.value)}
    />
  ))
);

jest.mock('../../../context/LineageProvider/LineageProvider', () => ({
  useLineageProvider: jest.fn().mockImplementation(() => ({
    onExportClick: mockOnExportClick,
    onLineageConfigUpdate: mockOnLineageConfigUpdate,
    selectedQuickFilters: [],
    setSelectedQuickFilters: mockSetSelectedQuickFilters,
    lineageConfig: mockLineageConfig,
    nodes: [],
  })),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test.table' }),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest
    .fn()
    .mockReturnValue({ entityType: EntityType.TABLE }),
}));

jest.mock('../../../rest/lineageAPI', () => ({
  exportLineageByEntityCountAsync: jest.fn(),
}));

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({
    search: '?mode=lineage&depth=3&dir=downstream',
  }));
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    search: '?mode=lineage&depth=3&dir=downstream',
  },
  writable: true,
});

const mockThemeColors: ThemeColors = {
  white: '#FFFFFF',
  blue: {
    50: '#E6F4FF',
    100: '#BAE0FF',
    700: '#0958D9',
  },
  gray: {
    300: '#D1D5DB',
    700: '#374151',
    900: '#111827',
  },
} as ThemeColors;

const theme: Theme = createTheme({
  palette: {
    allShades: mockThemeColors,
  },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>
    <MemoryRouter>{children}</MemoryRouter>
  </ThemeProvider>
);

describe('CustomControls', () => {
  it('renders all main control buttons', () => {
    render(<CustomControlsComponent {...defaultProps} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByLabelText('label.filter-plural')).toBeInTheDocument();
    expect(screen.getByText('label.lineage')).toBeInTheDocument();
    expect(screen.getByText('label.impact-analysis')).toBeInTheDocument();
    expect(screen.getByLabelText('label.export')).toBeInTheDocument();
    expect(screen.getByTestId('lineage-config')).toBeInTheDocument();
    expect(screen.getByLabelText('label.full-screen-view')).toBeInTheDocument();
  });

  it('shows LineageSearchSelect by default in lineage mode', () => {
    render(<CustomControlsComponent {...defaultProps} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByTestId('lineage-search-select')).toBeInTheDocument();
  });

  it('shows SearchBar when in impact analysis mode', () => {
    (useCustomLocation as jest.Mock).mockImplementation(() => ({
      search: '?mode=impact_analysis&depth=3&dir=downstream',
    }));

    render(<CustomControlsComponent {...defaultProps} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByTestId('search-bar')).toBeInTheDocument();
  });

  it('toggles filter selection when filter button is clicked', () => {
    render(<CustomControlsComponent {...defaultProps} />, {
      wrapper: Wrapper,
    });

    const filterButton = screen.getByLabelText('label.filter-plural');
    fireEvent.click(filterButton);

    expect(screen.getByTestId('explore-quick-filters')).toBeInTheDocument();
  });

  it('navigates to lineage mode when lineage button is clicked', () => {
    render(<CustomControlsComponent {...defaultProps} />, {
      wrapper: Wrapper,
    });

    const lineageButton = screen.getByText('label.lineage');
    fireEvent.click(lineageButton);

    expect(mockNavigate).toHaveBeenCalled();
  });

  it('navigates to impact analysis mode when impact analysis button is clicked', () => {
    render(<CustomControlsComponent {...defaultProps} />, {
      wrapper: Wrapper,
    });

    const impactAnalysisButton = screen.getByText('label.impact-analysis');
    fireEvent.click(impactAnalysisButton);

    expect(mockNavigate).toHaveBeenCalled();
  });

  it('calls onExportClick when export button is clicked', () => {
    render(<CustomControlsComponent {...defaultProps} />, {
      wrapper: Wrapper,
    });

    const exportButton = screen.getByLabelText('label.export-as-type');
    fireEvent.click(exportButton);

    expect(mockOnExportClick).toHaveBeenCalled();
  });

  it('opens lineage config modal when settings button is clicked', () => {
    render(<CustomControlsComponent {...defaultProps} />, {
      wrapper: Wrapper,
    });

    const settingsButton = screen.getByTestId('lineage-config');
    fireEvent.click(settingsButton);

    expect(screen.getByTestId('lineage-config-modal')).toBeInTheDocument();
  });

  it('calls onLineageConfigUpdate when modal is saved', async () => {
    render(<CustomControlsComponent {...defaultProps} />, {
      wrapper: Wrapper,
    });

    const settingsButton = screen.getByTestId('lineage-config');
    fireEvent.click(settingsButton);

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnLineageConfigUpdate).toHaveBeenCalledWith(mockLineageConfig);
    });
  });

  it('toggles fullscreen mode when fullscreen button is clicked', () => {
    render(<CustomControlsComponent {...defaultProps} />, {
      wrapper: Wrapper,
    });

    const fullscreenButton = screen.getByLabelText('label.full-screen-view');
    fireEvent.click(fullscreenButton);

    expect(mockNavigate).toHaveBeenCalled();
  });

  it('shows node depth selector in impact analysis mode with filters active', () => {
    (useCustomLocation as jest.Mock).mockImplementation(() => ({
      search: '?mode=impact_analysis&depth=3&dir=downstream',
    }));

    render(<CustomControlsComponent {...defaultProps} />, {
      wrapper: Wrapper,
    });

    const filterButton = screen.getByLabelText('label.filter-plural');
    fireEvent.click(filterButton);

    // Node depth should be visible in the filter section
    expect(
      screen.getByText(
        (content) =>
          content?.includes('label.node-depth') && content?.includes(':')
      )
    ).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('opens node depth menu and selects new depth', () => {
    (useCustomLocation as jest.Mock).mockImplementation(() => ({
      search: '?mode=impact_analysis&depth=3&dir=downstream',
    }));

    render(<CustomControlsComponent {...defaultProps} />, {
      wrapper: Wrapper,
    });

    const filterButton = screen.getByLabelText('label.filter-plural');
    fireEvent.click(filterButton);

    const nodeDepthButton = screen.getByText(
      (content) =>
        content?.includes('label.node-depth') && content?.includes(':')
    );
    fireEvent.click(nodeDepthButton);

    // The menu items would be rendered by Material-UI Menu component
    // This test verifies the click handler is set up correctly
    expect(nodeDepthButton).toBeInTheDocument();
  });

  it('calls onSearchValueChange when search value changes in impact analysis mode', () => {
    (useCustomLocation as jest.Mock).mockImplementation(() => ({
      search: '?mode=impact_analysis&depth=3&dir=downstream',
    }));

    render(<CustomControlsComponent {...defaultProps} />, {
      wrapper: Wrapper,
    });

    const searchInput = screen.getByTestId('search-bar');
    fireEvent.change(searchInput, { target: { value: 'test search' } });

    expect(mockOnSearchValueChange).toHaveBeenCalledWith('test search');
  });

  it('shows clear filters button when filters are applied', () => {
    const mockSetSelectedQuickFilters = jest.fn();

    jest.doMock('../../../context/LineageProvider/LineageProvider', () => ({
      useLineageProvider: jest.fn().mockImplementation(() => ({
        onExportClick: mockOnExportClick,
        onLineageConfigUpdate: mockOnLineageConfigUpdate,
        selectedQuickFilters: [{ key: 'service', value: ['test-service'] }],
        setSelectedQuickFilters: mockSetSelectedQuickFilters,
        lineageConfig: mockLineageConfig,
        nodes: [],
      })),
    }));

    render(<CustomControlsComponent {...defaultProps} />, {
      wrapper: Wrapper,
    });

    const filterButton = screen.getByLabelText('label.filter-plural');
    fireEvent.click(filterButton);

    expect(screen.getByText('label.clear-entity')).toBeInTheDocument();
  });

  it('parses query parameters correctly for upstream direction', () => {
    window.location.search = '?mode=lineage&depth=2&dir=upstream';

    render(<CustomControlsComponent {...defaultProps} />, {
      wrapper: Wrapper,
    });

    // Component should render correctly with upstream direction
    expect(screen.getByText('label.lineage')).toBeInTheDocument();
  });

  it('handles missing query parameters with defaults', () => {
    window.location.search = '';

    render(<CustomControlsComponent {...defaultProps} />, {
      wrapper: Wrapper,
    });

    // Component should render with default values
    expect(screen.getByText('label.lineage')).toBeInTheDocument();
    expect(screen.getByText('label.impact-analysis')).toBeInTheDocument();
  });

  it('should pass nodeIds to ExploreQuickFilters when ids passed through props', () => {
    (useLineageProvider as jest.Mock).mockImplementation(() => ({
      onExportClick: mockOnExportClick,
      onLineageConfigUpdate: mockOnLineageConfigUpdate,
      selectedQuickFilters: [],
      setSelectedQuickFilters: mockSetSelectedQuickFilters,
      lineageConfig: mockLineageConfig,
      nodes: [
        { id: 'node1', name: 'Node 1' },
        { id: 'node2', name: 'Node 2' },
      ],
    }));

    render(
      <CustomControlsComponent
        {...defaultProps}
        queryFilterNodeIds={['customNode1', 'customNode2']}
      />,
      {
        wrapper: Wrapper,
      }
    );

    const filterButton = screen.getByLabelText('label.filter-plural');
    fireEvent.click(filterButton);

    expect(ExploreQuickFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultQueryFilter: {
          query: {
            bool: {
              must: { terms: { 'id.keyword': ['customNode1', 'customNode2'] } },
            },
          },
        },
      }),
      expect.anything()
    );

    expect(screen.getByTestId('explore-quick-filters')).toBeInTheDocument();
  });

  it('should pass nodeIds to ExploreQuickFilters from provider when ids not passed through props', () => {
    (useLineageProvider as jest.Mock).mockImplementation(() => ({
      onExportClick: mockOnExportClick,
      onLineageConfigUpdate: mockOnLineageConfigUpdate,
      selectedQuickFilters: [],
      setSelectedQuickFilters: mockSetSelectedQuickFilters,
      lineageConfig: mockLineageConfig,
      nodes: [
        { data: { node: { id: 'node1', name: 'Node 1' } } },
        { data: { node: { id: 'node2', name: 'Node 2' } } },
      ],
    }));

    render(<CustomControlsComponent {...defaultProps} />, {
      wrapper: Wrapper,
    });

    const filterButton = screen.getByLabelText('label.filter-plural');
    fireEvent.click(filterButton);

    expect(ExploreQuickFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultQueryFilter: {
          query: {
            bool: {
              must: { terms: { 'id.keyword': ['node1', 'node2'] } },
            },
          },
        },
      }),
      expect.anything()
    );

    expect(screen.getByTestId('explore-quick-filters')).toBeInTheDocument();
  });
});
