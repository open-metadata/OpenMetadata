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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { EntityType } from '../../enums/entity.enum';
import { usePaging } from '../../hooks/paging/usePaging';
import { useFqn } from '../../hooks/useFqn';
import { useLineageStore } from '../../hooks/useLineageStore';
import { LineageConfig } from '../../interface/lineage.interface';
import {
  getLineageByEntityCount,
  getLineageDataByFQN,
  getLineagePagingData,
} from '../../rest/lineageAPI';
import {
  prepareDownstreamColumnLevelNodesFromDownstreamEdges,
  prepareUpstreamColumnLevelNodesFromUpstreamEdges,
} from '../../utils/Lineage/LineagePureUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { useLineageHandlers } from '../Lineage/Lineage/LineageHandlersContext';
import LineageTable from './LineageTable';
import { EImpactLevel } from './LineageTable.interface';
import { useLineageTableState } from './useLineageTableState';

// Mock dependencies (mirrors LineageTable.test.tsx), EXCEPT react-router-dom
// is left real so a real MemoryRouter drives useNavigate/useLocation and URL
// mutations actually update location.search — which is what these tests
// observe.
jest.mock('../Lineage/Lineage/LineageHandlersContext');
jest.mock('../../hooks/paging/usePaging');
jest.mock('../../hooks/useFqn');
jest.mock('../../utils/useRequiredParams');
jest.mock('./useLineageTableState');
jest.mock('../../rest/lineageAPI');
jest.mock('../../utils/StringUtils', () => ({
  ...jest.requireActual('../../utils/StringUtils'),
}));

jest.mock('../../utils/RichTextStringUtils', () => ({
  stringToHTML: jest.fn((str: string) => str),
}));
jest.mock('../../hooks/useLineageStore', () => {
  const mockStore = jest.fn();

  // getState mirrors whatever state the current mock implementation returns.
  return {
    useLineageStore: Object.assign(mockStore, {
      getState: () => mockStore(),
    }),
  };
});
jest.mock('../../utils/Lineage/LineageUtils');
jest.mock('../../utils/Lineage/LineagePureUtils');
jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../utils/FqnUtils', () => ({
  getPartialNameFromTableFQN: jest,
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

const mockUseLineageHandlers = useLineageHandlers as jest.MockedFunction<
  typeof useLineageHandlers
>;
const mockUseLineageStore = useLineageStore as jest.MockedFunction<
  typeof useLineageStore
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

// Probe rendered inside the same router so the test can read the settled
// `location.search` and drive URL mutations through the real `useNavigate`.
let currentSearch = '';
let navigateRef: ReturnType<typeof useNavigate> = jest.fn();
const RouterProbe = () => {
  const location = useLocation();

  currentSearch = location.search;
  navigateRef = useNavigate();

  return null;
};

const buildTree = (initialEntry: string) => (
  <MemoryRouter initialEntries={[initialEntry]}>
    <RouterProbe />
    <LineageTable entity={mockEntity} />
  </MemoryRouter>
);

const mockLineageConfig = {
  downstreamDepth: 3,
  upstreamDepth: 3,
} as LineageConfig;

const setupStore = (config: LineageConfig = mockLineageConfig) => {
  mockUseLineageStore.mockReturnValue({
    selectedQuickFilters: [],
    setSelectedQuickFilters: jest.fn(),
    lineageConfig: config,
    setLineageConfig: jest.fn(),
  });
};

describe('LineageTable depth sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseLineageHandlers.mockReturnValue({
      updateEntityData: jest.fn(),
    } as unknown as ReturnType<typeof useLineageHandlers>);

    setupStore(mockLineageConfig);

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
      entityFqn: '',
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
      paginationInfo: mockLineagePagingInfo,
    });

    mockGetLineagePagingData.mockResolvedValue(mockLineagePagingInfo);
    mockGetLineageDataByFQN.mockResolvedValue({
      nodes: {},
      upstreamEdges: {},
      downstreamEdges: {},
    });
    mockPrepareUpstreamColumnLevelNodesFromUpstreamEdges.mockReturnValue([]);
    mockPrepareDownstreamColumnLevelNodesFromDownstreamEdges.mockReturnValue(
      []
    );

    currentSearch = '';
  });

  it('keeps a URL-supplied depth on mount (shared link)', async () => {
    render(buildTree('/?dir=Downstream&depth=5'));

    await waitFor(() => expect(currentSearch).toContain('depth=5'));

    expect(currentSearch).not.toMatch(/depth=3/);
  });

  it('does NOT revert a depth written to the URL by the dropdown', async () => {
    render(buildTree('/?dir=Downstream'));

    await act(async () => {
      navigateRef({ search: '?dir=Downstream&depth=5' }, { replace: true });
    });

    await waitFor(() => expect(currentSearch).toContain('depth=5'));

    expect(currentSearch).not.toMatch(/depth=3/);
  });

  it('does NOT reset depth when an unrelated control (fullscreen toggle) writes to the URL', async () => {
    render(buildTree('/?dir=Downstream&depth=5'));

    await act(async () => {
      navigateRef(
        { search: '?dir=Downstream&depth=5&fullscreen=true' },
        { replace: true }
      );
    });

    await waitFor(() => expect(currentSearch).toContain('fullscreen=true'));

    expect(currentSearch).toContain('depth=5');
  });

  it("resets depth to the new direction's configured depth when direction is switched", async () => {
    setupStore({ downstreamDepth: 3, upstreamDepth: 2 } as LineageConfig);

    render(buildTree('/?dir=Downstream&depth=5'));

    fireEvent.click(screen.getByRole('radio', { name: /label.upstream/ }));

    await waitFor(() => expect(currentSearch).toContain('dir=Upstream'));

    expect(currentSearch).toContain('depth=2');
  });
});
