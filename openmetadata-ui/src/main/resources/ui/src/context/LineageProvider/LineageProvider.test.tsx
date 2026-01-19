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
import { fireEvent, render, screen } from '@testing-library/react';
import QueryString from 'qs';
import { useEffect } from 'react';
import { Edge, Node as ReactFlowNode } from 'reactflow';
import { SourceType } from '../../components/SearchedData/SearchedData.interface';
import { EntityType } from '../../enums/entity.enum';
import { LineageDirection } from '../../generated/api/lineage/searchLineageRequest';
import { LineageLayer } from '../../generated/settings/settings';
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

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    appPreferences: mockData,
  })),
}));

const DummyChildrenComponent = () => {
  const {
    loadChildNodesHandler,
    onEdgeClick,
    onColumnClick,
    updateEntityData,
    onLineageEditClick,
  } = useLineageProvider();

  const nodeData = {
    name: 'table1',
    type: 'table',
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

  const handleButtonClick = () => {
    // Trigger the loadChildNodesHandler method when the button is clicked
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
        data-testid="column-click"
        onClick={() => onColumnClick('column')}>
        On Column Click
      </button>
      <button data-testid="openConfirmationModal">
        Close Confirmation Modal
      </button>
      <button data-testid="editLineage" onClick={onLineageEditClick}>
        Edit Lineage
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

describe('LineageProvider', () => {
  beforeEach(() => {
    mockLocation.search = '';
    mockIsAlertSupported = false;
    jest.clearAllMocks();
  });

  it('renders Lineage component and fetches data', async () => {
    render(
      <LineageProvider>
        <DummyChildrenComponent />
      </LineageProvider>
    );

    expect(getLineageDataByFQN).toHaveBeenCalled();
    expect(getDataQualityLineage).not.toHaveBeenCalled();
  });

  it('getDataQualityLineage should be called if alert is supported', async () => {
    mockLocation.search = QueryString.stringify({
      layers: ['DataObservability'],
    });
    mockIsAlertSupported = true;
    (getLineageDataByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        nodes: [],
        edges: [],
      })
    );

    render(
      <LineageProvider>
        <DummyChildrenComponent />
      </LineageProvider>
    );

    expect(getLineageDataByFQN).toHaveBeenCalledWith({
      entityType: 'table',
      fqn: 'table1',
      config: {
        downstreamDepth: 1,
        nodesPerLayer: 50,
        pipelineViewMode: undefined,
        upstreamDepth: 1,
      },
      queryFilter: '',
      columnFilter: '',
    });
    expect(getDataQualityLineage).toHaveBeenCalledWith(
      'table1',
      {
        downstreamDepth: 1,
        nodesPerLayer: 50,
        pipelineViewMode: undefined,
        upstreamDepth: 1,
      },
      '',
      ''
    );
  });

  it('should call loadChildNodesHandler', async () => {
    render(
      <LineageProvider>
        <DummyChildrenComponent />
      </LineageProvider>
    );

    const loadButton = screen.getByTestId('load-nodes');
    fireEvent.click(loadButton);

    expect(getLineageDataByFQN).toHaveBeenCalled();
  });

  it('should show sidebar when edit is clicked', async () => {
    render(
      <LineageProvider>
        <DummyChildrenComponent />
      </LineageProvider>
    );

    const loadButton = screen.getByTestId('editLineage');
    fireEvent.click(loadButton);

    const edgeDrawer = screen.getByText('Entity Lineage Sidebar');

    expect(edgeDrawer).toBeInTheDocument();
  });

  it('should enable column layer when entering edit mode', () => {
    const TestComponent = () => {
      const { onLineageEditClick, activeLayer } = useLineageProvider();

      return (
        <div>
          <button data-testid="edit-lineage" onClick={onLineageEditClick}>
            Edit Lineage
          </button>
          <div data-testid="active-layers">{activeLayer.join(',')}</div>
        </div>
      );
    };

    render(
      <LineageProvider>
        <TestComponent />
      </LineageProvider>
    );

    const editButton = screen.getByTestId('edit-lineage');
    const activeLayers = screen.getByTestId('active-layers');

    expect(activeLayers.textContent).not.toContain('ColumnLevelLineage');

    fireEvent.click(editButton);

    expect(activeLayers.textContent).toContain('ColumnLevelLineage');
  });

  it('should keep other layers unaffected while entering edit mode', () => {
    const TestComponent = () => {
      const { onLineageEditClick, onUpdateLayerView, activeLayer } =
        useLineageProvider();

      return (
        <div>
          <button
            data-testid="add-column-lineage"
            onClick={() =>
              onUpdateLayerView([
                ...activeLayer,
                LineageLayer.ColumnLevelLineage,
              ])
            }>
            Add Column Lineage
          </button>
          <button
            data-testid="add-data-observability"
            onClick={() =>
              onUpdateLayerView([
                ...activeLayer,
                LineageLayer.DataObservability,
              ])
            }>
            Add DataObservability
          </button>
          <button data-testid="edit-lineage" onClick={onLineageEditClick}>
            Edit Lineage
          </button>
          <div data-testid="active-layers">{activeLayer.join(',')}</div>
        </div>
      );
    };

    render(
      <LineageProvider>
        <TestComponent />
      </LineageProvider>
    );

    const addColumnLineageButton = screen.getByTestId('add-column-lineage');
    const addDataObservabilityButton = screen.getByTestId(
      'add-data-observability'
    );
    const editButton = screen.getByTestId('edit-lineage');
    const activeLayers = screen.getByTestId('active-layers');

    expect(activeLayers.textContent).not.toContain('ColumnLevelLineage');
    expect(activeLayers.textContent).not.toContain('DataObservability');

    fireEvent.click(addColumnLineageButton);

    expect(activeLayers.textContent).toContain('ColumnLevelLineage');
    expect(activeLayers.textContent).not.toContain('DataObservability');

    fireEvent.click(addDataObservabilityButton);

    expect(activeLayers.textContent).toContain('ColumnLevelLineage');
    expect(activeLayers.textContent).toContain('DataObservability');

    fireEvent.click(editButton);

    expect(activeLayers.textContent).toContain('ColumnLevelLineage');
    expect(activeLayers.textContent).toContain('DataObservability');
  });

  it('should remove traced nodes and columns while exiting edit mode', () => {
    const mockNode: ReactFlowNode = {
      id: 'test-node',
      type: 'default',
      position: { x: 0, y: 0 },
      data: { node: { name: 'test', fullyQualifiedName: 'test-node-fqn' } },
    };

    const TestComponent = () => {
      const {
        onLineageEditClick,
        tracedNodes,
        tracedColumns,
        isEditMode,
        onColumnClick,
        onNodeClick,
      } = useLineageProvider();

      return (
        <div>
          <button
            data-testid="simulate-node-click"
            onClick={() => onNodeClick(mockNode)}>
            Simulate Node Click
          </button>
          <button
            data-testid="simulate-column-click"
            onClick={() => onColumnClick('test-column')}>
            Simulate Column Click
          </button>
          <button data-testid="edit-lineage" onClick={onLineageEditClick}>
            Edit Lineage
          </button>
          <div data-testid="is-edit-mode">{isEditMode.toString()}</div>
          <div data-testid="traced-nodes">{tracedNodes.join(',')}</div>
          <div data-testid="traced-columns">{tracedColumns.join(',')}</div>
        </div>
      );
    };

    render(
      <LineageProvider>
        <TestComponent />
      </LineageProvider>
    );

    const editButton = screen.getByTestId('edit-lineage');
    const simulateNodeClick = screen.getByTestId('simulate-node-click');
    const simulateColumnClick = screen.getByTestId('simulate-column-click');
    const isEditModeDisplay = screen.getByTestId('is-edit-mode');
    const tracedNodesDisplay = screen.getByTestId('traced-nodes');
    const tracedColumnsDisplay = screen.getByTestId('traced-columns');

    expect(isEditModeDisplay.textContent).toBe('false');
    expect(tracedNodesDisplay.textContent).toBe('');
    expect(tracedColumnsDisplay.textContent).toBe('');

    fireEvent.click(editButton);

    expect(isEditModeDisplay.textContent).toBe('true');

    fireEvent.click(simulateNodeClick);

    expect(tracedNodesDisplay.textContent).toBe('test-node');

    fireEvent.click(simulateColumnClick);

    expect(tracedColumnsDisplay.textContent).toBe('test-column');

    fireEvent.click(editButton);

    expect(isEditModeDisplay.textContent).toBe('false');
    expect(tracedNodesDisplay.textContent).toBe('');
    expect(tracedColumnsDisplay.textContent).toBe('');
  });

  it('should remove traced columns when column layer is removed', () => {
    const TestComponent = () => {
      const { onUpdateLayerView, onColumnClick, activeLayer, tracedColumns } =
        useLineageProvider();

      const toggleColumnLayer = () => {
        if (activeLayer.includes(LineageLayer.ColumnLevelLineage)) {
          onUpdateLayerView(
            activeLayer.filter(
              (layer) => layer !== LineageLayer.ColumnLevelLineage
            )
          );
        } else {
          onUpdateLayerView([...activeLayer, LineageLayer.ColumnLevelLineage]);
        }
      };

      return (
        <div>
          <button data-testid="toggle-column-layer" onClick={toggleColumnLayer}>
            Toggle Column Layer
          </button>
          <button
            data-testid="simulate-column-click"
            onClick={() => onColumnClick('test-column')}>
            Simulate Column Click
          </button>
          <div data-testid="active-layers">{activeLayer.join(',')}</div>
          <div data-testid="traced-columns">{tracedColumns.join(',')}</div>
        </div>
      );
    };

    render(
      <LineageProvider>
        <TestComponent />
      </LineageProvider>
    );

    const toggleColumnLayerButton = screen.getByTestId('toggle-column-layer');
    const simulateColumnClick = screen.getByTestId('simulate-column-click');
    const activeLayersDisplay = screen.getByTestId('active-layers');
    const tracedColumnsDisplay = screen.getByTestId('traced-columns');

    expect(tracedColumnsDisplay.textContent).toBe('');
    expect(activeLayersDisplay.textContent).not.toContain('ColumnLevelLineage');

    fireEvent.click(toggleColumnLayerButton);

    expect(activeLayersDisplay.textContent).toContain('ColumnLevelLineage');

    fireEvent.click(simulateColumnClick);

    expect(tracedColumnsDisplay.textContent).toBe('test-column');

    fireEvent.click(toggleColumnLayerButton);

    expect(activeLayersDisplay.textContent).not.toContain('ColumnLevelLineage');
    expect(tracedColumnsDisplay.textContent).toBe('');
  });

  it('should show delete modal', async () => {
    render(
      <LineageProvider>
        <DummyChildrenComponent />
      </LineageProvider>
    );

    const edgeClick = screen.getByTestId('edge-click');
    fireEvent.click(edgeClick);

    const edgeDrawer = screen.getByText('Edge Info Drawer');

    expect(edgeDrawer).toBeInTheDocument();
  });

  it('should close the drawer if open, on column click', async () => {
    render(
      <LineageProvider>
        <DummyChildrenComponent />
      </LineageProvider>
    );

    const edgeClick = screen.getByTestId('edge-click');
    fireEvent.click(edgeClick);

    const edgeDrawer = screen.getByText('Edge Info Drawer');

    expect(edgeDrawer).toBeInTheDocument();

    const columnClick = screen.getByTestId('column-click');
    fireEvent.click(columnClick);

    expect(edgeDrawer).not.toBeInTheDocument();
  });
});
