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
import { SourceType } from '../../components/SearchedData/SearchedData.interface';
import { EntityType } from '../../enums/entity.enum';
import { LineageDirection } from '../../generated/api/lineage/searchLineageRequest';
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

jest.mock('../../hooks/useLineageStore', () => ({
  useLineageStore: jest.fn().mockImplementation(() => ({
    isEditMode: false,
    activeLayer: [],
    tracedNodes: new Set(),
    tracedColumns: new Set(),
    toggleEditMode: mockToggleEditMode,
    setActiveLayer: mockSetActiveLayer,
    setTracedNodes: mockSetTracedNodes,
    setTracedColumns: mockSetTracedColumns,
    setSelectedColumn: mockSetSelectedColumn,
    lineageConfig: {
      upstreamDepth: 1,
      downstreamDepth: 1,
      nodesPerLayer: 50,
    },
    setLineageConfig: jest.fn(),
    addTracedColumns: jest.fn(),
    addTracedNodes: jest.fn(),
    zoomValue: 1,
    setZoomValue: jest.fn(),
    columnsHavingLineage: new Map(),
    setColumnsHavingLineage: jest.fn(),
    updateColumnsHavingLineageById: jest.fn(),
    updateActiveLayer: jest.fn(),
    platformView: 'None',
    setPlatformView: jest.fn(),
    isPlatformLineage: false,
    setIsPlatformLineage: jest.fn(),
    activeNode: undefined,
    setActiveNode: jest.fn(),
    selectedNode: undefined,
    setSelectedNode: jest.fn(),
    selectedEdge: undefined,
    setSelectedEdge: jest.fn(),
    isColumnLevelLineage: false,
    isDQEnabled: false,
    selectedColumn: undefined,
    isCreatingEdge: false,
    setIsCreatingEdge: jest.fn(),
    columnsInCurrentPages: new Map(),
    setColumnsInCurrentPages: jest.fn(),
    updateColumnsInCurrentPages: jest.fn(),
    reset: jest.fn(),
  })),
}));

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
jest.mock('../../utils/EntityLineageUtils', () => ({
  ...jest.requireActual('../../utils/EntityLineageUtils'),
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
      expect(getLineageDataByFQN).toHaveBeenCalledWith({
        entityType: 'table',
        fqn: 'table1',
        config: {
          downstreamDepth: 1,
          nodesPerLayer: 50,
          upstreamDepth: 1,
        },
        queryFilter: '',
      });
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
              nodeData as SourceType,
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
              nodeData as SourceType,
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
});
