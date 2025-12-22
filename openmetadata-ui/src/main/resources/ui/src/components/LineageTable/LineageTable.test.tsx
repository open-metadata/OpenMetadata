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

import { IconButton, ToggleButtonGroup } from '@mui/material';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useLineageProvider } from '../../context/LineageProvider/LineageProvider';
import { LineageContextType } from '../../context/LineageProvider/LineageProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import { usePaging } from '../../hooks/paging/usePaging';
import { useFqn } from '../../hooks/useFqn';
import {
  getLineageByEntityCount,
  getLineageDataByFQN,
  getLineagePagingData,
} from '../../rest/lineageAPI';
import {
  prepareDownstreamColumnLevelNodesFromDownstreamEdges,
  prepareUpstreamColumnLevelNodesFromUpstreamEdges,
} from '../../utils/Lineage/LineageUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import CustomControlsComponent from '../Entity/EntityLineage/CustomControls.component';
import { LineageConfig } from '../Entity/EntityLineage/EntityLineage.interface';
import { ColumnLevelLineageNode } from '../Lineage/Lineage.interface';
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
jest.mock('../../utils/StringsUtils', () => ({
  ...jest.requireActual('../../utils/StringsUtils'),
  stringToHTML: jest.fn((str: string) => str),
}));
jest.mock('../../utils/Lineage/LineageUtils');
jest.mock('./LineageTable.styled', () => {
  const { Menu: MuiMenu } = jest.requireActual('@mui/material');

  return {
    StyledMenu: (props: React.ComponentProps<typeof MuiMenu>) => (
      <MuiMenu {...props} />
    ),
    StyledToggleButtonGroup: ToggleButtonGroup,
    StyledIconButton: IconButton,
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

jest.mock('../../utils/Fqn', () => ({
  split: jest.fn().mockReturnValue(['mockGlossary']),
}));

jest.mock('lodash', () => {
  const module = jest.requireActual('lodash');
  module.debounce = jest.fn((fn) => fn);

  return module;
});
jest.mock('../Entity/EntityLineage/CustomControls.component', () => {
  return jest.fn().mockReturnValue(<div>CustomControls</div>);
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
const mockGetLineageDataByFQN = getLineageDataByFQN as jest.MockedFunction<
  typeof getLineageDataByFQN
>;
const mockPrepareUpstreamColumnLevelNodesFromUpstreamEdges =
  prepareUpstreamColumnLevelNodesFromUpstreamEdges as jest.MockedFunction<
    typeof prepareUpstreamColumnLevelNodesFromUpstreamEdges
  >;
const mockPrepareDownstreamColumnLevelNodesFromDownstreamEdges =
  prepareDownstreamColumnLevelNodesFromDownstreamEdges as jest.MockedFunction<
    typeof prepareDownstreamColumnLevelNodesFromDownstreamEdges
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
    type: 'table',
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
    type: 'table',
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

const mockEntity = {
  id: 'entity1',
  fullyQualifiedName: 'test.table',
  name: 'table',
  entityType: EntityType.TABLE,
  description: 'Test table entity',
  owner: null,
  tags: [],
  domain: null,
};

describe('LineageTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseLineageProvider.mockReturnValue({
      selectedQuickFilters: [],
      setSelectedQuickFilters: jest.fn(),
      lineageConfig: {
        downstreamDepth: 2,
        upstreamDepth: 2,
      } as LineageConfig,
      updateEntityData: jest.fn(),
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
        search: '?dir=Downstream&depth=1',
        pathname: '/test',
      },
      writable: true,
    });
  });

  it('should render the CustomControls component', () => {
    render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

    expect(screen.getByText('CustomControls')).toBeInTheDocument();
  });

  it('should render toggle buttons for upstream and downstream', () => {
    render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

    expect(screen.getByText('label.upstream')).toBeInTheDocument();
    expect(screen.getByText('label.downstream')).toBeInTheDocument();
  });

  it('should display impact level dropdown', () => {
    render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

    const impactButton = screen.getByRole('button', {
      name: /label.impact-on-area/,
    });

    expect(impactButton).toBeInTheDocument();
  });

  it('should open impact level menu when clicked', async () => {
    render(<LineageTable entity={mockEntity} />, {
      wrapper: MemoryRouter,
    });

    const impactButton = screen.getByRole('button', {
      name: /label.impact-on-area/,
    });

    expect(impactButton).toBeInTheDocument();

    fireEvent.click(impactButton);

    await waitFor(() => {
      const menu = screen.getByRole('menu');

      expect(menu).toBeInTheDocument();
    });
  });

  it('should change impact level when impact level state changes', async () => {
    const setImpactLevel = jest.fn();
    const { rerender } = render(<LineageTable entity={mockEntity} />, {
      wrapper: MemoryRouter,
    });

    mockUseLineageTableState.mockReturnValue({
      ...defaultMockState,
      impactLevel: EImpactLevel.ColumnLevel,
      setImpactLevel,
    });

    rerender(<LineageTable entity={mockEntity} />);

    await waitFor(() => {
      expect(mockGetLineageDataByFQN).toHaveBeenCalled();
    });
  });

  it('should display filter selection controls when filter is active', () => {
    mockUseLineageTableState.mockReturnValue({
      ...defaultMockState,
      filterSelectionActive: true,
    });

    render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

    expect(screen.getByText(/label.node-depth/)).toBeInTheDocument();
  });

  it('should render table with correct data source for table level', () => {
    mockUseLineageTableState.mockReturnValue({
      ...defaultMockState,
      impactLevel: EImpactLevel.TableLevel,
    });

    render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

    expect(screen.getByText('table1')).toBeInTheDocument();
    expect(screen.getByText('table2')).toBeInTheDocument();
  });

  it('should render table with column level data when impact level is column', () => {
    const columnLineageNodes = [
      {
        id: 'col1',
        fromEntity: { fullyQualifiedName: 'test.table1', name: 'table1' },
        toEntity: { fullyQualifiedName: 'test.table2', name: 'table2' },
        columns: { fromColumns: ['col1'], toColumn: ['col2'] },
      },
    ];

    mockUseLineageTableState.mockReturnValue({
      ...defaultMockState,
      impactLevel: EImpactLevel.ColumnLevel,
      downstreamColumnLineageNodes: columnLineageNodes,
    } as unknown as ReturnType<typeof useLineageTableState>);

    render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

    expect(screen.getByText('label.source')).toBeInTheDocument();
    expect(screen.getByText('label.impacted')).toBeInTheDocument();
  });

  it('should fetch nodes on component mount', async () => {
    render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

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
    render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

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

    render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

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

    render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

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

    render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

    const upstreamButton = screen.getByRole('button', {
      name: /label.upstream/,
    });
    fireEvent.click(upstreamButton);

    expect(handlePageChange).toHaveBeenCalledWith(1);
  });

  it('should display correct counts for upstream and downstream', () => {
    render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

    expect(screen.getByText('label.upstream')).toHaveTextContent('2'); // upstream count
    expect(screen.getByText('label.downstream')).toHaveTextContent('5'); // downstream count
  });

  it('should render table with pagination props', () => {
    render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

    const table = document.querySelector('.ant-table');

    expect(table).toBeInTheDocument();
  });

  describe('LineageTable Hooks Integration', () => {
    it('should integrate with useLineageTableState correctly', () => {
      const mockState = {
        ...defaultMockState,
        searchValue: 'test search',
        loading: true,
      };
      mockUseLineageTableState.mockReturnValue(mockState);

      render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

      expect(CustomControlsComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          searchValue: 'test search',
        }),
        {}
      );
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

      render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

      expect(mockUsePaging).toHaveBeenCalledWith(50);
    });
  });

  describe('fetchNodes - Column Level Impact', () => {
    const mockColumnLevelNodes = [
      {
        id: 'col-node-1',
        fullyQualifiedName: 'test.table1.column1',
        name: 'column1',
        entityType: EntityType.TABLE,
      },
      {
        id: 'col-node-2',
        fullyQualifiedName: 'test.table2.column2',
        name: 'column2',
        entityType: EntityType.TABLE,
      },
    ];
    const mockUpstreamEdges = {
      'test.table1-->test.table': {
        fromEntity: {
          fullyQualifiedName: 'test.table1',
          id: 'entity1',
          type: 'table',
        },
        toEntity: {
          fullyQualifiedName: 'test.table',
          id: 'entity2',
          type: 'table',
        },
      },
    };

    const mockDownstreamEdges = {
      'test.table-->test.table2': {
        fromEntity: {
          fullyQualifiedName: 'test.table',
          id: 'entity2',
          type: 'table',
        },
        toEntity: {
          fullyQualifiedName: 'test.table2',
          id: 'entity3',
          type: 'table',
        },
      },
    };

    beforeEach(() => {
      mockGetLineageDataByFQN.mockResolvedValue({
        // entity: mockEntity,
        nodes: {
          'test.table1': {
            entity: mockLineageNodes[0],
            paging: {},
            nodeDepth: 1,
          },
          'test.table2': {
            entity: mockLineageNodes[1],
            paging: {},
            nodeDepth: 1,
          },
        },
        upstreamEdges: mockUpstreamEdges,
        downstreamEdges: mockDownstreamEdges,
      });

      mockPrepareUpstreamColumnLevelNodesFromUpstreamEdges.mockReturnValue([
        mockColumnLevelNodes[0] as unknown as ColumnLevelLineageNode,
      ]);

      mockPrepareDownstreamColumnLevelNodesFromDownstreamEdges.mockReturnValue([
        mockColumnLevelNodes[1] as unknown as ColumnLevelLineageNode,
      ]);
    });

    it('should fetch column-level lineage data when impact level is ColumnLevel', async () => {
      const setColumnLineageNodes = jest.fn();
      mockUseLineageTableState.mockReturnValue({
        ...defaultMockState,
        impactLevel: EImpactLevel.ColumnLevel,
        setColumnLineageNodes,
      });

      render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(mockGetLineageDataByFQN).toHaveBeenCalledWith({
          fqn: 'test.table',
          entityType: EntityType.TABLE,
          config: {
            downstreamDepth: 2,
            upstreamDepth: 2,
          },
          queryFilter: undefined,
        });
      });
    });

    it('should process upstream edges and prepare upstream column-level nodes', async () => {
      const setColumnLineageNodes = jest.fn();
      mockUseLineageTableState.mockReturnValue({
        ...defaultMockState,
        impactLevel: EImpactLevel.ColumnLevel,
        setColumnLineageNodes,
      });

      render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(
          mockPrepareUpstreamColumnLevelNodesFromUpstreamEdges
        ).toHaveBeenCalledWith(Object.values(mockUpstreamEdges), {
          'test.table1': {
            entity: mockLineageNodes[0],
            paging: {},
            nodeDepth: 1,
          },
          'test.table2': {
            entity: mockLineageNodes[1],
            paging: {},
            nodeDepth: 1,
          },
        });
      });
    });

    it('should process downstream edges and prepare downstream column-level nodes', async () => {
      const setColumnLineageNodes = jest.fn();
      mockUseLineageTableState.mockReturnValue({
        ...defaultMockState,
        impactLevel: EImpactLevel.ColumnLevel,
        setColumnLineageNodes,
      });

      render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(
          mockPrepareDownstreamColumnLevelNodesFromDownstreamEdges
        ).toHaveBeenCalledWith(Object.values(mockDownstreamEdges), {
          'test.table1': {
            entity: mockLineageNodes[0],
            paging: {},
            nodeDepth: 1,
          },
          'test.table2': {
            entity: mockLineageNodes[1],
            paging: {},
            nodeDepth: 1,
          },
        });
      });
    });

    it('should call setColumnLineageNodes with upstream and downstream nodes', async () => {
      const setColumnLineageNodes = jest.fn();
      mockUseLineageTableState.mockReturnValue({
        ...defaultMockState,
        impactLevel: EImpactLevel.ColumnLevel,
        setColumnLineageNodes,
      });

      render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(setColumnLineageNodes).toHaveBeenCalledWith(
          [mockColumnLevelNodes[0]],
          [mockColumnLevelNodes[1]]
        );
      });
    });

    it('should update paging with upstream nodes length when direction is Upstream', async () => {
      const handlePagingChange = jest.fn();
      const setColumnLineageNodes = jest.fn();
      mockUseLineageTableState.mockReturnValue({
        ...defaultMockState,
        impactLevel: EImpactLevel.ColumnLevel,
        lineageDirection: LineageDirection.Upstream,
        setColumnLineageNodes,
      });
      mockUsePaging.mockReturnValue({
        currentPage: 1,
        pageSize: 25,
        paging: { total: 10 },
        showPagination: true,
        handlePageChange: jest.fn(),
        handlePagingChange,
      } as unknown as ReturnType<typeof usePaging>);

      render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(handlePagingChange).toHaveBeenCalledWith({
          total: 1,
        });
      });
    });

    it('should update paging with downstream nodes length when direction is Downstream', async () => {
      const handlePagingChange = jest.fn();
      const setColumnLineageNodes = jest.fn();
      mockUseLineageTableState.mockReturnValue({
        ...defaultMockState,
        impactLevel: EImpactLevel.ColumnLevel,
        lineageDirection: LineageDirection.Downstream,
        setColumnLineageNodes,
      });
      mockUsePaging.mockReturnValue({
        currentPage: 1,
        pageSize: 25,
        paging: { total: 10 },
        showPagination: true,
        handlePageChange: jest.fn(),
        handlePagingChange,
      } as unknown as ReturnType<typeof usePaging>);

      render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(handlePagingChange).toHaveBeenCalledWith({
          total: 1,
        });
      });
    });

    it('should handle empty upstream edges for column-level lineage', async () => {
      const setColumnLineageNodes = jest.fn();
      mockGetLineageDataByFQN.mockResolvedValue({
        nodes: {},
        upstreamEdges: {},
        downstreamEdges: {},
      });

      mockPrepareUpstreamColumnLevelNodesFromUpstreamEdges.mockReturnValue([]);
      mockPrepareDownstreamColumnLevelNodesFromDownstreamEdges.mockReturnValue(
        []
      );

      mockUseLineageTableState.mockReturnValue({
        ...defaultMockState,
        impactLevel: EImpactLevel.ColumnLevel,
        setColumnLineageNodes,
      });

      render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(setColumnLineageNodes).toHaveBeenCalledWith([], []);
      });
    });
  });

  describe('fetchNodes - Table Level Impact', () => {
    it('should fetch table-level lineage data when impact level is TableLevel', async () => {
      const setFilterNodes = jest.fn();
      mockUseLineageTableState.mockReturnValue({
        ...defaultMockState,
        impactLevel: EImpactLevel.TableLevel,
        setFilterNodes,
      });

      render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(mockGetLineageByEntityCount).toHaveBeenCalledWith({
          fqn: 'test.table',
          type: EntityType.TABLE,
          direction: LineageDirection.Downstream,
          nodeDepth: 1,
          from: 0,
          size: 25,
          query_filter: undefined,
        });
      });
    });

    it('should delete current entity from nodes before processing', async () => {
      const setFilterNodes = jest.fn();
      mockUseLineageTableState.mockReturnValue({
        ...defaultMockState,
        impactLevel: EImpactLevel.TableLevel,
        setFilterNodes,
      });

      mockGetLineageByEntityCount.mockResolvedValue({
        nodes: {
          'test.table': {
            entity: mockEntity,
            paging: {},
            nodeDepth: 0,
          },
          'test.table1': {
            entity: mockLineageNodes[0],
            paging: {},
            nodeDepth: 1,
          },
        },
        upstreamEdges: {},
        downstreamEdges: {},
      });

      render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(setFilterNodes).toHaveBeenCalledWith([
          {
            ...mockLineageNodes[0],
            nodeDepth: 1,
          },
        ]);
      });
    });

    it('should map nodes to LineageNode format with entity and paging data', async () => {
      const setFilterNodes = jest.fn();
      mockUseLineageTableState.mockReturnValue({
        ...defaultMockState,
        impactLevel: EImpactLevel.TableLevel,
        setFilterNodes,
      });

      const mockPaging = { entityDownstreamCount: 5 };
      mockGetLineageByEntityCount.mockResolvedValue({
        nodes: {
          'test.table1': {
            entity: mockLineageNodes[0],
            paging: mockPaging,
            nodeDepth: 1,
          },
        },
        upstreamEdges: {},
        downstreamEdges: {},
      });

      render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(setFilterNodes).toHaveBeenCalledWith([
          {
            ...mockLineageNodes[0],
            ...mockPaging,
            nodeDepth: 1,
          },
        ]);
      });
    });

    it('should sort nodes by nodeDepth', async () => {
      const setFilterNodes = jest.fn();
      mockUseLineageTableState.mockReturnValue({
        ...defaultMockState,
        impactLevel: EImpactLevel.TableLevel,
        setFilterNodes,
      });

      mockGetLineageByEntityCount.mockResolvedValue({
        nodes: {
          'test.table2': {
            entity: mockLineageNodes[1],
            paging: {},
            nodeDepth: 2,
          },
          'test.table1': {
            entity: mockLineageNodes[0],
            paging: {},
            nodeDepth: 1,
          },
        },
        upstreamEdges: {},
        downstreamEdges: {},
      });

      render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(setFilterNodes).toHaveBeenCalledWith([
          {
            ...mockLineageNodes[0],
            nodeDepth: 1,
          },
          {
            ...mockLineageNodes[1],
            nodeDepth: 2,
          },
        ]);
      });
    });

    it('should calculate pagination offset correctly for table-level lineage', async () => {
      const setFilterNodes = jest.fn();
      mockUseLineageTableState.mockReturnValue({
        ...defaultMockState,
        impactLevel: EImpactLevel.TableLevel,
        setFilterNodes,
      });
      mockUsePaging.mockReturnValue({
        currentPage: 3,
        pageSize: 10,
        paging: { total: 100 },
        showPagination: true,
        handlePageChange: jest.fn(),
        handlePagingChange: jest.fn(),
      } as unknown as ReturnType<typeof usePaging>);

      render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(mockGetLineageByEntityCount).toHaveBeenCalledWith(
          expect.objectContaining({
            from: 20,
            size: 10,
          })
        );
      });
    });

    it('should pass query_filter to getLineageByEntityCount', async () => {
      const setFilterNodes = jest.fn();
      const mockQueryFilter = {
        query: {
          bool: {
            must: [
              {
                bool: {
                  should: [{ term: { 'service.name': 'test-service' } }],
                },
              },
            ],
          },
        },
      };

      mockUseLineageProvider.mockReturnValue({
        selectedQuickFilters: [
          {
            key: 'service.name',
            value: [
              {
                key: 'test-service',
              },
            ],
          },
        ],
        setSelectedQuickFilters: jest.fn(),
        lineageConfig: {
          downstreamDepth: 2,
          upstreamDepth: 2,
        } as LineageConfig,
        updateEntityData: jest.fn(),
        onExportClick: jest.fn(),
        onLineageConfigUpdate: jest.fn(),
      } as unknown as LineageContextType);

      mockUseLineageTableState.mockReturnValue({
        ...defaultMockState,
        impactLevel: EImpactLevel.TableLevel,
        setFilterNodes,
      });

      render(<LineageTable entity={mockEntity} />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(mockGetLineageByEntityCount).toHaveBeenCalledWith(
          expect.objectContaining({
            query_filter: JSON.stringify(mockQueryFilter),
          })
        );
      });
    });
  });
});
