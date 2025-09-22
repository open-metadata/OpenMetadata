/*
 *  Copyright 2025 Collate.
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

import { Menu } from '@mui/material';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ExportTypes } from '../../constants/Export.constants';
import { useLineageProvider } from '../../context/LineageProvider/LineageProvider';
import { LineageContextType } from '../../context/LineageProvider/LineageProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import { usePaging } from '../../hooks/paging/usePaging';
import { useFqn } from '../../hooks/useFqn';
import {
  getLineageByEntityCount,
  getLineagePagingData,
} from '../../rest/lineageAPI';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { LineageConfig } from '../Entity/EntityLineage/EntityLineage.interface';
import LineageTable from './LineageTable';
import { EImpactLevel } from './LineageTable.interface';
import { useLineageTableState } from './useLineageTableState';

// Mock dependencies
jest.mock('../../context/LineageProvider/LineageProvider');
jest.mock('../../hooks/paging/usePaging');
jest.mock('../../hooks/useFqn');
jest.mock('../../utils/useRequiredParams');
jest.mock('./useLineageTableState');
jest.mock('../../rest/lineageAPI');
jest.mock('./LineageTable.styled', () => {
  return {
    StyledMenu: Menu,
  };
});
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('../../utils/CommonUtils', () => ({
  Transi18next: ({ i18nKey }: { i18nKey: string }) => i18nKey,
  getPartialNameFromTableFQN: jest
    .fn()
    .mockImplementation((fqn: string) => fqn),
}));

jest.mock('lodash', () => {
  const module = jest.requireActual('lodash');
  module.debounce = jest.fn((fn) => fn);

  return module;
});

const mockUseLineageProvider = useLineageProvider as jest.MockedFunction<
  typeof useLineageProvider
>;
const mockUsePaging = usePaging as jest.MockedFunction<typeof usePaging>;
const mockUseFqn = useFqn as jest.MockedFunction<typeof useFqn>;
const mockUseRequiredParams = useRequiredParams as jest.MockedFunction<
  typeof useRequiredParams
>;
const mockUseLineageTableState = useLineageTableState as jest.MockedFunction<
  typeof useLineageTableState
>;
const mockGetLineageByEntityCount =
  getLineageByEntityCount as jest.MockedFunction<
    typeof getLineageByEntityCount
  >;
const mockGetLineagePagingData = getLineagePagingData as jest.MockedFunction<
  typeof getLineagePagingData
>;

const mockLineageNodes = [
  {
    id: 'node1',
    fullyQualifiedName: 'test.table1',
    name: 'table1',
    entityType: EntityType.TABLE,
    nodeDepth: 1,
    owners: [],
    domains: [],
    tags: [],
  },
  {
    id: 'node2',
    fullyQualifiedName: 'test.table2',
    name: 'table2',
    entityType: EntityType.TABLE,
    nodeDepth: 2,
    owners: [],
    domains: [],
    tags: [],
  },
];

const mockLineagePagingInfo = {
  downstreamDepthInfo: [
    { depth: 1, entityCount: 5 },
    { depth: 2, entityCount: 3 },
  ],
  upstreamDepthInfo: [
    { depth: 1, entityCount: 2 },
    { depth: 2, entityCount: 1 },
  ],
  maxDownstreamDepth: 2,
  maxUpstreamDepth: 2,
  totalDownstreamEntities: 8,
  totalUpstreamEntities: 3,
};

const defaultMockState = {
  filterNodes: mockLineageNodes,
  loading: false,
  filterSelectionActive: false,
  searchValue: '',
  dialogVisible: false,
  impactLevel: EImpactLevel.TableLevel,
  upstreamColumnLineageNodes: [],
  downstreamColumnLineageNodes: [],
  lineageDirection: LineageDirection.Downstream,
  lineagePagingInfo: mockLineagePagingInfo,
  nodeDepth: 1,
  setFilterNodes: jest.fn(),
  setLoading: jest.fn(),
  setFilterSelectionActive: jest.fn(),
  setSearchValue: jest.fn(),
  setDialogVisible: jest.fn(),
  setImpactLevel: jest.fn(),
  setUpstreamColumnLineageNodes: jest.fn(),
  setDownstreamColumnLineageNodes: jest.fn(),
  setColumnLineageNodes: jest.fn(),
  setLineageDirection: jest.fn(),
  setLineagePagingInfo: jest.fn(),
  setNodeDepth: jest.fn(),
  resetFilters: jest.fn(),
  toggleFilterSelection: jest.fn(),
} as unknown as ReturnType<typeof useLineageTableState>;

// Remove the custom renderWithRouter function since our test utils handle this

describe('LineageTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseLineageProvider.mockReturnValue({
      selectedQuickFilters: [],
      setSelectedQuickFilters: jest.fn(),
      lineageConfig: {} as LineageConfig,
      onExportClick: jest.fn(),
      onLineageConfigUpdate: jest.fn(),
    } as unknown as LineageContextType);

    mockUsePaging.mockReturnValue({
      currentPage: 1,
      pageSize: 25,
      paging: { total: 10 },
      showPagination: true,
      handlePageChange: jest.fn(),
      handlePagingChange: jest.fn(),
    } as unknown as ReturnType<typeof usePaging>);

    mockUseFqn.mockReturnValue({
      fqn: 'test.table',
      ingestionFQN: '',
      ruleName: '',
    });

    mockUseRequiredParams.mockReturnValue({
      entityType: EntityType.TABLE,
    });

    mockUseLineageTableState.mockReturnValue(defaultMockState);

    mockGetLineageByEntityCount.mockResolvedValue({
      nodes: {
        'test.table1': {
          entity: mockLineageNodes[0],
          paging: {},
          nodeDepth: 1,
        },
        'test.table2': {
          entity: mockLineageNodes[1],
          paging: {},
          nodeDepth: 2,
        },
      },
      upstreamEdges: {},
      downstreamEdges: {},
    });

    mockGetLineagePagingData.mockResolvedValue(mockLineagePagingInfo);

    // Mock location object
    Object.defineProperty(window, 'location', {
      value: {
        search: '?dir=downstream&depth=1',
        pathname: '/test',
      },
      writable: true,
    });
  });

  it('should render the component', () => {
    render(<LineageTable />, { wrapper: MemoryRouter });

    // expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByText('label.lineage')).toBeInTheDocument();
    expect(screen.getByText('label.impact-analysis')).toBeInTheDocument();
  });

  it('should display search bar with correct placeholder', () => {
    render(<LineageTable />, { wrapper: MemoryRouter });

    const searchInput = screen.getByPlaceholderText('label.search-for-type');

    expect(searchInput).toHaveAttribute('placeholder', 'label.search-for-type');
  });

  it('should render toggle buttons for upstream and downstream', () => {
    render(<LineageTable />, { wrapper: MemoryRouter });

    expect(screen.getByText('label.upstream')).toBeInTheDocument();
    expect(screen.getByText('label.downstream')).toBeInTheDocument();
  });

  it('should display impact level dropdown', () => {
    render(<LineageTable />, { wrapper: MemoryRouter });

    const impactButton = screen.getByRole('button', {
      name: /label.impact-on-area/,
    });

    expect(impactButton).toBeInTheDocument();
  });

  it('should handle search input changes', async () => {
    const setSearchValue = jest.fn();
    mockUseLineageTableState.mockReturnValue({
      ...defaultMockState,
      setSearchValue,
    });

    render(<LineageTable />, { wrapper: MemoryRouter });

    const searchInput = screen.getByPlaceholderText('label.search-for-type');
    fireEvent.change(searchInput, { target: { value: 'test search' } });

    expect(setSearchValue).toHaveBeenCalledWith('test search');
  });

  it('should toggle filter selection when filter button is clicked', async () => {
    const toggleFilterSelection = jest.fn();
    mockUseLineageTableState.mockReturnValue({
      ...defaultMockState,
      toggleFilterSelection,
    });

    render(<LineageTable />, { wrapper: MemoryRouter });

    const filterButton = screen.getByTitle('label.filter-plural');
    fireEvent.click(filterButton);

    expect(toggleFilterSelection).toHaveBeenCalled();
  });

  it('should open impact level menu when clicked', async () => {
    render(<LineageTable />, { wrapper: MemoryRouter });

    fireEvent.click(
      screen.getByRole('button', {
        name: /label.impact-on-area/,
      })
    );

    expect(screen.getByText('label.table-level')).toBeInTheDocument();
    expect(screen.getByText('label.column-level')).toBeInTheDocument();
  });

  it('should change impact level when menu item is selected', async () => {
    const setImpactLevel = jest.fn();
    mockUseLineageTableState.mockReturnValue({
      ...defaultMockState,
      setImpactLevel,
    });

    render(<LineageTable />, { wrapper: MemoryRouter });

    const impactButton = screen.getByRole('button', {
      name: /label.impact-on-area/,
    });
    fireEvent.click(impactButton);

    const columnLevelOption = screen.getByText('label.column-level');
    fireEvent.click(columnLevelOption);

    expect(setImpactLevel).toHaveBeenCalledWith(EImpactLevel.ColumnLevel);
  });

  it('should display filter selection controls when filter is active', () => {
    mockUseLineageTableState.mockReturnValue({
      ...defaultMockState,
      filterSelectionActive: true,
    });

    render(<LineageTable />, { wrapper: MemoryRouter });

    expect(screen.getByText(/label.node-depth/)).toBeInTheDocument();
  });

  it('should call export function when export button is clicked', async () => {
    const onExportClick = jest.fn();
    mockUseLineageProvider.mockReturnValue({
      selectedQuickFilters: [],
      setSelectedQuickFilters: jest.fn(),
      lineageConfig: {},
      onExportClick,
      onLineageConfigUpdate: jest.fn(),
    } as unknown as LineageContextType);

    render(<LineageTable />, { wrapper: MemoryRouter });

    const exportButton = screen.getByRole('button', { name: 'Export as CSV' });
    fireEvent.click(exportButton);

    expect(onExportClick).toHaveBeenCalledWith(
      [ExportTypes.CSV],
      expect.any(Function)
    );
  });

  it('should open lineage config dialog when settings button is clicked', async () => {
    const setDialogVisible = jest.fn();
    mockUseLineageTableState.mockReturnValue({
      ...defaultMockState,
      setDialogVisible,
    });

    render(<LineageTable />, { wrapper: MemoryRouter });

    const settingsButton = screen.getByRole('button', { name: 'setting' });
    fireEvent.click(settingsButton);

    expect(setDialogVisible).toHaveBeenCalledWith(true);
  });

  it('should render table with correct data source for table level', () => {
    mockUseLineageTableState.mockReturnValue({
      ...defaultMockState,
      impactLevel: EImpactLevel.TableLevel,
    });

    render(<LineageTable />, { wrapper: MemoryRouter });

    expect(screen.getByText('table1')).toBeInTheDocument();
    expect(screen.getByText('table2')).toBeInTheDocument();
  });

  it('should render table with column level data when impact level is column', () => {
    const columnLineageNodes = [
      {
        id: 'col1',
        fromEntity: { fullyQualifiedName: 'test.table1', name: 'table1' },
        toEntity: { fullyQualifiedName: 'test.table2', name: 'table2' },
        column: { fromColumns: ['col1'], toColumn: ['col2'] },
      },
    ];

    mockUseLineageTableState.mockReturnValue({
      ...defaultMockState,
      impactLevel: EImpactLevel.ColumnLevel,
      downstreamColumnLineageNodes: columnLineageNodes,
    } as unknown as ReturnType<typeof useLineageTableState>);

    render(<LineageTable />, { wrapper: MemoryRouter });

    expect(screen.getByText('Source Table')).toBeInTheDocument();
    expect(screen.getByText('Impacted Table')).toBeInTheDocument();
  });

  it('should fetch nodes on component mount', async () => {
    render(<LineageTable />, { wrapper: MemoryRouter });

    await waitFor(() => {
      expect(mockGetLineageByEntityCount).toHaveBeenCalledWith({
        fqn: 'test.table',
        type: EntityType.TABLE,
        direction: LineageDirection.Downstream,
        nodeDepth: 1,
        from: 0,
        size: 25,
      });
    });
  });

  it('should fetch paging data on component mount', async () => {
    render(<LineageTable />, { wrapper: MemoryRouter });

    await waitFor(() => {
      expect(mockGetLineagePagingData).toHaveBeenCalledWith({
        fqn: 'test.table',
        type: EntityType.TABLE,
      });
    });
  });

  it('should handle loading state correctly', () => {
    mockUseLineageTableState.mockReturnValue({
      ...defaultMockState,
      loading: true,
    });

    render(<LineageTable />, { wrapper: MemoryRouter });

    const table = document.querySelector('.ant-spin-container');

    expect(table).toBeInTheDocument();
  });

  it('should handle error state when API calls fail', async () => {
    const setFilterNodes = jest.fn();
    const setLoading = jest.fn();
    mockUseLineageTableState.mockReturnValue({
      ...defaultMockState,
      setFilterNodes,
      setLoading,
    });

    mockGetLineageByEntityCount.mockRejectedValue(new Error('API Error'));

    render(<LineageTable />, { wrapper: MemoryRouter });

    await waitFor(() => {
      expect(setFilterNodes).toHaveBeenCalledWith([]);
      expect(setLoading).toHaveBeenCalledWith(false);
    });
  });

  it('should update URL params when direction changes', async () => {
    const handlePageChange = jest.fn();
    mockUsePaging.mockReturnValue({
      currentPage: 1,
      pageSize: 25,
      paging: { total: 10 },
      showPagination: true,
      handlePageChange,
      handlePagingChange: jest.fn(),
    } as unknown as ReturnType<typeof usePaging>);

    render(<LineageTable />, { wrapper: MemoryRouter });

    const upstreamButton = screen.getByRole('button', {
      name: /label.upstream/,
    });
    fireEvent.click(upstreamButton);

    expect(handlePageChange).toHaveBeenCalledWith(1);
  });

  it('should display correct counts for upstream and downstream', () => {
    render(<LineageTable />, { wrapper: MemoryRouter });

    expect(screen.getByText('label.upstream')).toHaveTextContent('2'); // upstream count
    expect(screen.getByText('label.downstream')).toHaveTextContent('5'); // downstream count
  });

  it('should render table with pagination props', () => {
    render(<LineageTable />, { wrapper: MemoryRouter });

    const table = document.querySelector('.ant-table');

    expect(table).toBeInTheDocument();
  });

  it('should handle node depth selection', async () => {
    mockUseLineageTableState.mockReturnValue({
      ...defaultMockState,
      filterSelectionActive: true,
    });

    render(<LineageTable />, { wrapper: MemoryRouter });

    const nodeDepthButton = screen.getByRole('button', {
      name: /label.node-depth/,
    });
    fireEvent.click(nodeDepthButton);

    const depthOption = await screen.findByRole('menuitem', { name: '1' });

    expect(depthOption).toBeInTheDocument();
  });

  describe('LineageTable Hooks Integration', () => {
    it('should integrate with useLineageTableState correctly', () => {
      const mockState = {
        ...defaultMockState,
        searchValue: 'test search',
        loading: true,
      };
      mockUseLineageTableState.mockReturnValue(mockState);

      render(<LineageTable />, { wrapper: MemoryRouter });

      expect(screen.getByDisplayValue('test search')).toBeInTheDocument();
    });

    it('should integrate with usePaging correctly', () => {
      const mockPaging = {
        currentPage: 2,
        pageSize: 50,
        paging: { total: 100 },
        showPagination: true,
        handlePageChange: jest.fn(),
        handlePagingChange: jest.fn(),
      } as unknown as ReturnType<typeof usePaging>;
      mockUsePaging.mockReturnValue(mockPaging);

      render(<LineageTable />, { wrapper: MemoryRouter });

      expect(mockUsePaging).toHaveBeenCalledWith(50);
    });
  });
});
