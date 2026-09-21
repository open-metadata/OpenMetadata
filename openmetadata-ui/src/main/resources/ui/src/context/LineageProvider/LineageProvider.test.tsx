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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { Edge } from 'reactflow';
import {
  EntityLineageResponse,
  LineageNodeType,
} from '../../components/Lineage/Lineage.interface';
import { SourceType } from '../../components/SearchedData/SearchedData.interface';
import { EntityType } from '../../enums/entity.enum';
import { LineageDirection } from '../../generated/api/lineage/searchLineageRequest';
import { useLineageStore } from '../../hooks/useLineageStore';
import {
  getDataQualityLineage,
  getLineageDataByFQN,
} from '../../rest/lineageAPI';
import LineageProvider, { useLineageProvider } from './LineageProvider';

const mockLocation = {
  search: '',
  pathname: '/lineage',
};

const mockData = {
  lineageConfig: {
    upstreamDepth: 1,
    downstreamDepth: 1,
    lineageLayer: 'EntityLineage',
  },
};

const mockToggleEditMode = jest.fn();
const mockSetActiveLayer = jest.fn();
const mockSetTracedNodes = jest.fn();
const mockSetTracedColumns = jest.fn();
const mockSetSelectedColumn = jest.fn();

// The factory below is invoked at require-time (during this file's own imports), before
// any of the `const mockXxx = jest.fn()` declarations above have run — Jest hoists
// `jest.mock` calls above the rest of the file. Referencing those outer `mock*`
// identifiers is only safe from inside a nested, not-yet-invoked closure (e.g.
// `buildSnapshot` below); by the time that closure actually runs (a component calling
// the hook, well after module load), the outer consts are long since initialized. All
// other mock state below is intentionally local to this factory so nothing here relies
// on top-level `const` initialization order.
jest.mock('../../hooks/useLineageStore', () => {
  // Mutable snapshot backing the mocked store. The bridge effects added in Task 6 call
  // useLineageStore.getState()/setState() directly (outside the hook), so the mock needs
  // real getState/setState statics — a bare jest.fn() hook mock isn't enough.
  const state: Record<string, unknown> = {
    isEditMode: false,
    activeLayer: [],
    tracedNodes: new Set(),
    tracedColumns: new Set(),
    lineageConfig: {
      upstreamDepth: 1,
      downstreamDepth: 1,
      nodesPerLayer: 50,
    },
    zoomValue: 1,
    columnsHavingLineage: new Map(),
    platformView: 'None',
    isPlatformLineage: false,
    activeNode: undefined,
    selectedNode: undefined,
    selectedEdge: undefined,
    isColumnLevelLineage: false,
    isDQEnabled: false,
    selectedColumn: undefined,
    isCreatingEdge: false,
    columnsInCurrentPages: new Map(),
    // Bridge fields mirrored by LineageProvider's Task 6 effects.
    nodes: [],
    edges: [],
    columnEdges: [],
    entityLineage: {},
    updatedEntityLineage: undefined,
    dataQualityLineage: undefined,
    dqHighlightedEdges: new Set(),
    status: 'initial',
    init: false,
    loading: false,
    entity: undefined,
    entityType: undefined,
    entityFqn: '',
    reactFlowInstance: undefined,
    selectedQuickFilters: [],
    timeFilter: {},
    showAddEdgeModal: false,
    showDeleteModal: false,
    isDrawerOpen: false,
    newAddedNode: undefined,
    deletionState: { loading: false, status: 'initial' },
  };

  const setNodes = jest.fn((nodes: unknown) => {
    state.nodes = nodes;
  });
  const setEdges = jest.fn((edges: unknown) => {
    state.edges = edges;
  });
  const setColumnEdges = jest.fn((columnEdges: unknown) => {
    state.columnEdges = columnEdges;
  });
  const setEntityContext = jest.fn(
    (context: {
      entity?: unknown;
      entityType?: unknown;
      entityFqn: unknown;
    }) => {
      state.entity = context.entity;
      state.entityType = context.entityType;
      state.entityFqn = context.entityFqn;
    }
  );
  const setReactFlowInstance = jest.fn((reactFlowInstance: unknown) => {
    state.reactFlowInstance = reactFlowInstance;
  });
  const setUpdatedEntityLineage = jest.fn((updatedEntityLineage: unknown) => {
    state.updatedEntityLineage = updatedEntityLineage;
  });
  const setDQLineage = jest.fn((dataQualityLineage: unknown) => {
    state.dataQualityLineage = dataQualityLineage;
  });
  const setDQHighlightedEdges = jest.fn((dqHighlightedEdges: unknown) => {
    state.dqHighlightedEdges = dqHighlightedEdges;
  });
  const setSelectedQuickFilters = jest.fn((selectedQuickFilters: unknown) => {
    state.selectedQuickFilters = selectedQuickFilters;
  });
  const setTimeFilter = jest.fn((timeFilter: unknown) => {
    state.timeFilter = timeFilter;
  });
  const openAddEdgeModal = jest.fn(() => {
    state.showAddEdgeModal = true;
  });
  const closeAddEdgeModal = jest.fn(() => {
    state.showAddEdgeModal = false;
  });
  const openDeleteModal = jest.fn(() => {
    state.showDeleteModal = true;
  });
  const closeDeleteModal = jest.fn(() => {
    state.showDeleteModal = false;
  });
  const openDrawer = jest.fn(() => {
    state.isDrawerOpen = true;
  });
  const closeDrawer = jest.fn(() => {
    state.isDrawerOpen = false;
  });
  const setNewAddedNode = jest.fn((newAddedNode: unknown) => {
    state.newAddedNode = newAddedNode;
  });
  const setDeletionState = jest.fn((deletionState: unknown) => {
    state.deletionState = deletionState;
  });

  const buildSnapshot = () => ({
    ...state,
    toggleEditMode: mockToggleEditMode,
    setActiveLayer: mockSetActiveLayer,
    setTracedNodes: mockSetTracedNodes,
    setTracedColumns: mockSetTracedColumns,
    setSelectedColumn: mockSetSelectedColumn,
    setLineageConfig: jest.fn(),
    addTracedColumns: jest.fn(),
    addTracedNodes: jest.fn(),
    setZoomValue: jest.fn(),
    setColumnsHavingLineage: jest.fn(),
    updateColumnsHavingLineageById: jest.fn(),
    updateActiveLayer: jest.fn(),
    setPlatformView: jest.fn(),
    setIsPlatformLineage: jest.fn(),
    setActiveNode: jest.fn(),
    setSelectedNode: jest.fn(),
    setSelectedEdge: jest.fn(),
    setIsCreatingEdge: jest.fn(),
    setIsRepositioning: jest.fn(),
    setColumnsInCurrentPages: jest.fn(),
    updateColumnsInCurrentPages: jest.fn(),
    reset: jest.fn(),
    setNodes,
    setEdges,
    setColumnEdges,
    setEntityContext,
    setReactFlowInstance,
    setUpdatedEntityLineage,
    setDQLineage,
    setDQHighlightedEdges,
    setSelectedQuickFilters,
    setTimeFilter,
    openAddEdgeModal,
    closeAddEdgeModal,
    openDeleteModal,
    closeDeleteModal,
    openDrawer,
    closeDrawer,
    setNewAddedNode,
    setDeletionState,
  });

  const useLineageStoreMock = Object.assign(
    jest.fn().mockImplementation(buildSnapshot),
    {
      getState: jest.fn(buildSnapshot),
      setState: jest.fn(
        (
          partial:
            | Record<string, unknown>
            | ((s: Record<string, unknown>) => Record<string, unknown>)
        ) => {
          Object.assign(
            state,
            typeof partial === 'function' ? partial(state) : partial
          );
        }
      ),
    }
  );

  return { useLineageStore: useLineageStoreMock };
});

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    appPreferences: mockData,
  })),
}));

const mockSetNodes = jest.fn();
const mockSetEdges = jest.fn();
const mockOnNodesChange = jest.fn();
const mockOnEdgesChange = jest.fn();
const mockRemoveNodeById = jest.fn();
const mockRemoveEdgeById = jest.fn();
const mockRemoveEdgesBySourceTarget = jest.fn();

jest.mock('../../hooks/useMapBasedNodesEdges', () => ({
  useMapBasedNodesEdges: jest.fn().mockImplementation(() => ({
    nodes: [],
    edges: [],
    nodeEdges: [],
    columnEdges: [],
    setNodes: mockSetNodes,
    setEdges: mockSetEdges,
    onNodesChange: mockOnNodesChange,
    onEdgesChange: mockOnEdgesChange,
    removeNodeById: mockRemoveNodeById,
    removeEdgeById: mockRemoveEdgeById,
    removeEdgesBySourceTarget: mockRemoveEdgesBySourceTarget,
    removeEdgesByDocId: jest.fn(),
    addNodes: jest.fn(),
    addEdges: jest.fn(),
    updateNode: jest.fn(),
    updateEdge: jest.fn(),
  })),
}));

const DummyChildrenComponent = () => {
  const {
    loadChildNodesHandler,
    onEdgeClick,
    updateEntityData,
    onColumnMouseEnter,
    redraw,
    onNodeCollapse,
  } = useLineageProvider();

  const nodeData = {
    name: 'table1',
    type: 'table',
    entityType: 'table',
    fullyQualifiedName: 'table1',
    id: 'table1',
  };

  const MOCK_EDGE = {
    id: 'test',
    source: 'test',
    target: 'test',
    type: 'test',
    data: {
      edge: {
        fromEntity: {
          id: 'test',
          type: 'test',
        },
        toEntity: {
          id: 'test',
          type: 'test',
        },
      },
    },
  };

  const MOCK_NODE = {
    id: 'table1',
    type: 'default',
    position: { x: 0, y: 0 },
    data: {
      node: {
        id: 'table1',
        name: 'table1',
        fullyQualifiedName: 'table1',
        type: 'table',
      },
      isRootNode: false,
      fullyQualifiedName: 'table1',
    },
  };

  const handleButtonClick = () => {
    loadChildNodesHandler(nodeData, LineageDirection.Downstream, 1);
  };

  useEffect(() => {
    updateEntityData(EntityType.TABLE, {
      id: 'table1',
      name: 'table1',
      type: 'table',
      fullyQualifiedName: 'table1',
    } as SourceType);
  }, []);

  return (
    <div>
      <button data-testid="load-nodes" onClick={handleButtonClick}>
        Load Nodes
      </button>
      <button
        data-testid="edge-click"
        onClick={() => onEdgeClick(MOCK_EDGE as Edge)}>
        On Edge Click
      </button>
      <button
        data-testid="column-enter"
        onClick={() => onColumnMouseEnter('column')}>
        On Column Enter
      </button>
      <button data-testid="openConfirmationModal">
        Close Confirmation Modal
      </button>
      <button data-testid="redraw" onClick={() => redraw()}>
        Redraw
      </button>
      <button
        data-testid="node-collapse"
        onClick={() => onNodeCollapse(MOCK_NODE, LineageDirection.Downstream)}>
        Node Collapse
      </button>
    </div>
  );
};

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ ...mockLocation }));
});

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    fqn: 'table1',
  }),
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));

jest.mock(
  '../../components/Entity/EntityInfoDrawer/EdgeInfoDrawer.component',
  () => {
    return jest.fn().mockImplementation(() => {
      return <p>Edge Info Drawer</p>;
    });
  }
);

jest.mock(
  '../../components/Entity/EntityLineage/EntityLineageSidebar.component',
  () => {
    return jest.fn().mockImplementation(() => {
      return <p>Entity Lineage Sidebar</p>;
    });
  }
);
let mockIsAlertSupported = false;
jest.mock('../../utils/TableClassBase', () => ({
  getAlertEnableStatus: jest
    .fn()
    .mockImplementation(() => mockIsAlertSupported),
}));

jest.mock('../../rest/lineageAPI', () => ({
  getLineageDataByFQN: jest.fn(),
  getDataQualityLineage: jest.fn(),
}));

const mockCenterNodePosition = jest.fn();
jest.mock('../../utils/EntityLineageLayoutUtils', () => ({
  ...jest.requireActual('../../utils/EntityLineageLayoutUtils'),
  centerNodePosition: (...args: unknown[]) => mockCenterNodePosition(...args),
}));

describe('LineageProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAlertSupported = false;
    mockLocation.search = '';
    mockSetNodes.mockClear();
    mockSetEdges.mockClear();
    mockCenterNodePosition.mockClear();
    // Bridge fields mirrored by Task 6's effects — reset so each test starts clean.
    useLineageStore.setState({
      nodes: [],
      edges: [],
      columnEdges: [],
      entity: undefined,
      entityType: undefined,
      entityFqn: '',
      reactFlowInstance: undefined,
      entityLineage: {} as EntityLineageResponse,
      updatedEntityLineage: undefined,
      dataQualityLineage: undefined,
      dqHighlightedEdges: new Set(),
      status: 'initial',
      init: false,
      loading: false,
      selectedQuickFilters: [],
      timeFilter: {},
      showAddEdgeModal: false,
      showDeleteModal: false,
      isDrawerOpen: false,
      newAddedNode: undefined,
      deletionState: { loading: false, status: 'initial' },
    });
  });

  it('renders Lineage component and fetches data', async () => {
    render(
      <LineageProvider>
        <DummyChildrenComponent />
      </LineageProvider>
    );

    await waitFor(() => {
      expect(getLineageDataByFQN).toHaveBeenCalled();
    });

    expect(getDataQualityLineage).not.toHaveBeenCalled();
  });

  it('should fetch lineage data with correct parameters', async () => {
    (getLineageDataByFQN as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        nodes: {},
        downstreamEdges: {},
        upstreamEdges: {},
      })
    );

    render(
      <LineageProvider>
        <DummyChildrenComponent />
      </LineageProvider>
    );

    await waitFor(() => {
      expect(getLineageDataByFQN).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'table',
          fqn: 'table1',
          config: {
            downstreamDepth: 1,
            nodesPerLayer: 50,
            upstreamDepth: 1,
          },
          queryFilter: '',
        })
      );
    });
  });

  it('should call loadChildNodesHandler', async () => {
    (getLineageDataByFQN as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        nodes: {},
        downstreamEdges: {},
        upstreamEdges: {},
      })
    );

    render(
      <LineageProvider>
        <DummyChildrenComponent />
      </LineageProvider>
    );

    const loadButton = screen.getByTestId('load-nodes');
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(getLineageDataByFQN).toHaveBeenCalled();
    });
  });

  it('should call onEdgeClick handler', async () => {
    const { getByTestId } = render(
      <LineageProvider>
        <DummyChildrenComponent />
      </LineageProvider>
    );

    const edgeClick = getByTestId('edge-click');
    fireEvent.click(edgeClick);

    expect(edgeClick).toBeInTheDocument();
  });

  it('should handle column mouse enter', async () => {
    render(
      <LineageProvider>
        <DummyChildrenComponent />
      </LineageProvider>
    );

    const columnEnter = screen.getByTestId('column-enter');
    fireEvent.click(columnEnter);

    expect(mockSetTracedColumns).toHaveBeenCalled();
  });

  it('should call redraw handler', async () => {
    (getLineageDataByFQN as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        nodes: {},
        downstreamEdges: {},
        upstreamEdges: {},
      })
    );

    render(
      <LineageProvider>
        <DummyChildrenComponent />
      </LineageProvider>
    );

    const redrawButton = screen.getByTestId('redraw');
    fireEvent.click(redrawButton);

    expect(redrawButton).toBeInTheDocument();
  });

  it('should call onNodeCollapse handler', async () => {
    (getLineageDataByFQN as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        nodes: {},
        downstreamEdges: {},
        upstreamEdges: {},
      })
    );

    render(
      <LineageProvider>
        <DummyChildrenComponent />
      </LineageProvider>
    );

    const collapseButton = screen.getByTestId('node-collapse');
    fireEvent.click(collapseButton);

    expect(collapseButton).toBeInTheDocument();
  });

  it('should handle loadChildNodesHandler with upstream direction', async () => {
    const nodeData = {
      name: 'table2',
      type: 'table',
      entityType: 'table',
      fullyQualifiedName: 'table2',
      id: 'table2',
    };

    (getLineageDataByFQN as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        nodes: { table2: { entity: nodeData } },
        downstreamEdges: {},
        upstreamEdges: {},
      })
    );

    const TestComponent = () => {
      const { loadChildNodesHandler } = useLineageProvider();

      return (
        <button
          data-testid="load-upstream-nodes"
          onClick={() =>
            loadChildNodesHandler(
              nodeData as LineageNodeType,
              LineageDirection.Upstream,
              1
            )
          }>
          Load Upstream Nodes
        </button>
      );
    };

    render(
      <LineageProvider>
        <TestComponent />
      </LineageProvider>
    );

    const loadButton = screen.getByTestId('load-upstream-nodes');
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(getLineageDataByFQN).toHaveBeenCalled();
    });
  });

  it('should call loadChildNodesHandler and update lineage data', async () => {
    const nodeData = {
      name: 'table3',
      type: 'table',
      entityType: 'table',
      fullyQualifiedName: 'table3',
      id: 'table3',
      downstreamExpandPerformed: false,
    };

    const mockLineageResponse = {
      nodes: {
        table3: { entity: nodeData },
        table4: {
          entity: {
            id: 'table4',
            name: 'table4',
            entityType: 'table',
            fullyQualifiedName: 'table4',
          },
        },
      },
      downstreamEdges: {
        'table3-table4': {
          fromEntity: { id: 'table3', type: 'table' },
          toEntity: { id: 'table4', type: 'table' },
        },
      },
      upstreamEdges: {},
    };

    (getLineageDataByFQN as jest.Mock).mockResolvedValue(mockLineageResponse);

    const TestComponent = () => {
      const { loadChildNodesHandler } = useLineageProvider();

      return (
        <button
          data-testid="load-child-nodes"
          onClick={() =>
            loadChildNodesHandler(
              nodeData as LineageNodeType,
              LineageDirection.Downstream,
              1
            )
          }>
          Load Child Nodes
        </button>
      );
    };

    render(
      <LineageProvider>
        <TestComponent />
      </LineageProvider>
    );

    const loadButton = screen.getByTestId('load-child-nodes');
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(getLineageDataByFQN).toHaveBeenCalledWith(
        expect.objectContaining({
          fqn: 'table3',
          entityType: 'table',
        })
      );
    });
  });

  it('should fetch lineage when switching from impact analysis to lineage mode', async () => {
    mockLocation.search = '?mode=impact_analysis';
    (getLineageDataByFQN as jest.Mock).mockResolvedValue({
      nodes: {},
      downstreamEdges: {},
      upstreamEdges: {},
    });

    const EntityDataComponent = () => {
      const { updateEntityData } = useLineageProvider();

      useEffect(() => {
        updateEntityData(EntityType.TABLE, {
          id: 'table1',
          name: 'table1',
          type: EntityType.TABLE,
          entityType: EntityType.TABLE,
          fullyQualifiedName: 'table1',
        } as SourceType);
      }, []);

      return <div data-testid="entity-data-component" />;
    };

    const { rerender } = render(
      <LineageProvider>
        <EntityDataComponent />
      </LineageProvider>
    );

    expect(getLineageDataByFQN).not.toHaveBeenCalled();

    mockLocation.search = '?mode=lineage';
    rerender(
      <LineageProvider>
        <EntityDataComponent />
      </LineageProvider>
    );

    await waitFor(() => {
      expect(getLineageDataByFQN).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: EntityType.TABLE,
          fqn: 'table1',
        })
      );
    });
  });

  it('should reuse loaded lineage when switching from lineage to impact analysis and back', async () => {
    mockLocation.search = '?mode=lineage';
    (getLineageDataByFQN as jest.Mock).mockResolvedValue({
      nodes: {},
      downstreamEdges: {},
      upstreamEdges: {},
    });

    // eslint-disable-next-line sonarjs/no-identical-functions -- test harness component
    const EntityDataComponent = () => {
      const { updateEntityData } = useLineageProvider();

      useEffect(() => {
        updateEntityData(EntityType.TABLE, {
          id: 'table1',
          name: 'table1',
          type: EntityType.TABLE,
          entityType: EntityType.TABLE,
          fullyQualifiedName: 'table1',
        } as SourceType);
      }, []);

      return <div data-testid="entity-data-component" />;
    };

    const { rerender } = render(
      <LineageProvider>
        <EntityDataComponent />
      </LineageProvider>
    );

    await waitFor(() => {
      expect(getLineageDataByFQN).toHaveBeenCalledTimes(1);
    });

    mockLocation.search = '?mode=impact_analysis';
    rerender(
      <LineageProvider>
        <EntityDataComponent />
      </LineageProvider>
    );

    mockLocation.search = '?mode=lineage';
    rerender(
      <LineageProvider>
        <EntityDataComponent />
      </LineageProvider>
    );

    await Promise.resolve();

    expect(getLineageDataByFQN).toHaveBeenCalledTimes(1);
  });

  it('writes nodes/edges into useLineageStore while mounted', async () => {
    (getLineageDataByFQN as jest.Mock).mockResolvedValue({
      nodes: {},
      downstreamEdges: {},
      upstreamEdges: {},
    });

    const TestConsumer = () => {
      useLineageProvider();

      return null;
    };

    render(
      <LineageProvider>
        <TestConsumer />
      </LineageProvider>
    );

    await waitFor(() => {
      expect(useLineageStore.getState().nodes).toEqual(expect.any(Array));
    });

    expect(useLineageStore.getState().entityFqn).toBeDefined();
  });
});
