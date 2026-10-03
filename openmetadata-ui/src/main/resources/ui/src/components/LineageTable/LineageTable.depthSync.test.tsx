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
import { act, render, waitFor } from '@testing-library/react';
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

  it('writes the configured depth to the URL on mount', async () => {
    render(buildTree('/?dir=Downstream'));

    // The depth-sync effect runs on mount and pushes the configured
    // directional depth (downstreamDepth = 3) into the URL.
    await waitFor(() => expect(currentSearch).toContain('depth=3'));
  });

  it('does NOT revert a depth written to the URL by the dropdown (dropdown persist)', async () => {
    render(buildTree('/?dir=Downstream'));

    // Let the mount sync settle to the configured depth=3.
    await waitFor(() => expect(currentSearch).toContain('depth=3'));

    // Simulate the Node Depth dropdown writing depth=5 to the URL — exactly
    // what CustomControls' `handleNodeDepthUpdate` produces (Test A in
    // CustomControls.test.tsx proves that write happens).
    await act(async () => {
      navigateRef({ search: '?dir=Downstream&depth=5' }, { replace: true });
    });

    // With the fix, the depth-sync effect must NOT re-fire for this URL write
    // (only config/direction changes re-fire it), so depth=5 persists instead
    // of being clobbered back to the configured depth=3.
    await waitFor(() => expect(currentSearch).toContain('depth=5'));

    expect(currentSearch).not.toMatch(/depth=3/);
  });

  it('does NOT reset depth when an unrelated control (fullscreen toggle) writes to the URL', async () => {
    render(buildTree('/?dir=Downstream'));

    await waitFor(() => expect(currentSearch).toContain('depth=3'));

    // Simulate the fullscreen toggle merging `fullscreen=true` into the URL
    // while a non-config depth=5 is already present — mirroring
    // CustomControls' `updateURLParams({ [FULLSCREEN_QUERY_PARAM_KEY]: true })`.
    await act(async () => {
      navigateRef(
        { search: '?dir=Downstream&depth=5&fullscreen=true' },
        { replace: true }
      );
    });

    await waitFor(() => expect(currentSearch).toContain('depth=5'));

    expect(currentSearch).toContain('fullscreen=true');
    expect(currentSearch).not.toMatch(/depth=3/);
  });

  it('re-syncs the URL depth when lineageConfig depth changes', async () => {
    // Re-render with a *fresh* element (same MemoryRouter type/position) so
    // React re-renders the subtree; reusing the same element reference would
    // let React bail out and never observe the new mock config. The router's
    // internal location state is preserved across this reconcile.
    const { rerender } = render(buildTree('/?dir=Downstream'));

    await waitFor(() => expect(currentSearch).toContain('depth=3'));

    // Change the configured downstream depth (e.g. via the LineageConfig
    // settings modal). The depth-sync effect's legitimate
    // `lineageConfig.downstreamDepth` dependency must still re-fire it.
    setupStore({ downstreamDepth: 7, upstreamDepth: 2 } as LineageConfig);
    rerender(buildTree('/?dir=Downstream'));

    await waitFor(() => expect(currentSearch).toContain('depth=7'));

    expect(currentSearch).toContain('dir=Downstream');
  });

  it("re-syncs the URL depth to the new direction's configured depth when direction changes", async () => {
    // Give upstream and downstream distinct configured depths so a direction
    // change is observable in the URL.
    setupStore({ downstreamDepth: 3, upstreamDepth: 2 } as LineageConfig);

    render(buildTree('/?dir=Downstream'));

    // Mount sync writes the downstream configured depth (3).
    await waitFor(() => expect(currentSearch).toContain('depth=3'));

    // Toggle direction by writing `dir=Upstream` to the URL — the direction
    // toggle's legitimate `lineageDirection` dependency re-fires the effect,
    // which writes the upstream configured depth (2).
    await act(async () => {
      navigateRef({ search: '?dir=Upstream' }, { replace: true });
    });

    await waitFor(() => expect(currentSearch).toContain('depth=2'));

    expect(currentSearch).toContain('dir=Upstream');
  });

  it('overwrites a URL-supplied depth with the configured depth on mount (shared-link clobber)', async () => {
    // A URL carrying an explicit depth (e.g. a shared link) is clobbered on
    // mount because the depth-sync effect always runs once on mount. This is
    // the intended residual of the primary fix (the bug was the spurious
    // RE-fire on every URL write, not the legitimate mount run) and is
    // documented here as a regression guard for the mount behavior.
    render(buildTree('/?dir=Downstream&depth=5'));

    await waitFor(() => expect(currentSearch).toContain('depth=3'));

    expect(currentSearch).not.toMatch(/depth=5/);
  });
});
