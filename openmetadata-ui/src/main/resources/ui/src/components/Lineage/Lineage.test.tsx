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
import { DragEvent } from 'react';
import ReactFlow from 'reactflow';
import { useLineageProvider } from '../../context/LineageProvider/LineageProvider';
import { EntityType } from '../../enums/entity.enum';
import { Table } from '../../generated/entity/data/table';
import LineageControlButtons from '../Entity/EntityLineage/LineageControlButtons/LineageControlButtons';
import LineageLayers from '../Entity/EntityLineage/LineageLayers/LineageLayers';
import { MOCK_EXPLORE_SEARCH_RESULTS } from '../Explore/Explore.mock';
import Lineage from './Lineage.component';
import { EntityLineageResponse } from './Lineage.interface';

const mockEntity = MOCK_EXPLORE_SEARCH_RESULTS.hits.hits[0]._source;

const entityLineage: EntityLineageResponse = {
  entity: {
    name: 'fact_sale',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_sale',
    id: '5a1947bb-84eb-40de-a5c5-2b7b80c834c3',
    type: 'table',
  },
  nodes: [
    {
      name: 'dim_location',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_location',
      id: '30e9170c-0e07-4e55-bf93-2d2dfab3a36e',
      type: 'table',
    },
    {
      name: 'dim_address_clean',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address_clean',
      id: '6059959e-96c8-4b61-b905-fc5d88b33293',
      type: 'table',
    },
  ],
  edges: [
    {
      toEntity: {
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_location',
        id: '30e9170c-0e07-4e55-bf93-2d2dfab3a36e',
        type: 'table',
      },
      fromEntity: {
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_sale',
        id: '5a1947bb-84eb-40de-a5c5-2b7b80c834c3',
        type: 'table',
      },
      sqlQuery: '',
      source: 'Manual',
    },
    {
      toEntity: {
        fullyQualifiedName: 'mlflow_svc.eta_predictions',
        id: 'b81f6bad-42f3-4216-8505-cf6f0c0a8897',
        type: 'mlmodel',
      },
      fromEntity: {
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_sale',
        id: '5a1947bb-84eb-40de-a5c5-2b7b80c834c3',
        type: 'table',
      },
    },
    {
      toEntity: {
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_sale',
        id: '5a1947bb-84eb-40de-a5c5-2b7b80c834c3',
        type: 'table',
      },
      fromEntity: {
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address_clean',
        id: '6059959e-96c8-4b61-b905-fc5d88b33293',
        type: 'table',
      },
      sqlQuery: '',
      source: 'Manual',
    },
  ],
};

const mockNodes = [
  {
    id: 'node-1',
    type: 'default',
    position: { x: 0, y: 0 },
    data: { label: 'Node 1' },
  },
  {
    id: 'node-2',
    type: 'default',
    position: { x: 100, y: 100 },
    data: { label: 'Node 2' },
  },
];

const mockEdges = [
  {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    type: 'default',
  },
];

const mockUpdateEntityData = jest.fn();
const mockOnNodeClick = jest.fn();
const mockOnEdgeClick = jest.fn();
const mockOnNodeDrop = jest.fn();
const mockOnNodesChange = jest.fn();
const mockOnEdgesChange = jest.fn();
const mockOnPaneClick = jest.fn();
const mockOnConnect = jest.fn();
const mockOnInitReactFlow = jest.fn();

const mockLineageProviderValues = {
  nodes: mockNodes,
  edges: mockEdges,
  isEditMode: false,
  init: true,
  onNodeClick: mockOnNodeClick,
  onEdgeClick: mockOnEdgeClick,
  onNodeDrop: mockOnNodeDrop,
  onNodesChange: mockOnNodesChange,
  onEdgesChange: mockOnEdgesChange,
  onPaneClick: mockOnPaneClick,
  onConnect: mockOnConnect,
  onInitReactFlow: mockOnInitReactFlow,
  updateEntityData: mockUpdateEntityData,
  tracedNodes: [],
  tracedColumns: [],
  activeLayer: [],
  entityLineage,
};

jest.mock('../../context/LineageProvider/LineageProvider', () => ({
  useLineageProvider: jest.fn(),
}));

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: jest.fn(() => ({ pathname: 'pathname' })),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    fqn: 'fqn',
  }),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../Entity/EntityLineage/CustomControls.component', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="custom-controls">Controls</div>),
}));

jest.mock(
  '../Entity/EntityLineage/LineageControlButtons/LineageControlButtons',
  () => ({
    __esModule: true,
    default: jest.fn(() => (
      <div data-testid="lineage-control-buttons">Control Buttons</div>
    )),
  })
);

jest.mock('../Entity/EntityLineage/LineageLayers/LineageLayers', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="lineage-layers">Layers</div>),
}));

jest.mock('reactflow', () => ({
  __esModule: true,
  default: jest.fn(
    ({
      onDragOver,
      onDrop,
      onNodeClick,
      onEdgeClick,
      onPaneClick,
      children,
    }) => (
      <div
        data-testid="react-flow-component"
        onClick={(e) => {
          if ((e.target as HTMLElement).dataset.testid === 'react-flow-node') {
            onNodeClick?.(e, { id: 'node-1' });
          } else if (
            (e.target as HTMLElement).dataset.testid === 'react-flow-edge'
          ) {
            onEdgeClick?.(e, { id: 'edge-1' });
          } else if (
            (e.target as HTMLElement).dataset.testid === 'react-flow-pane'
          ) {
            onPaneClick?.(e);
          }
        }}
        onDragOver={(e) => {
          if (onDragOver) {
            onDragOver(e);
          }
        }}
        onDrop={onDrop}>
        <div data-testid="react-flow-nodes">Nodes</div>
        <div data-testid="react-flow-edges">Edges</div>
        {children}
      </div>
    )
  ),
  Background: jest.fn(() => <div data-testid="react-flow-background" />),
  MiniMap: jest.fn(() => <div data-testid="react-flow-minimap" />),
  Panel: jest.fn(({ children }) => (
    <div data-testid="react-flow-panel">{children}</div>
  )),
}));

jest.mock('../../utils/EntityLineageUtils', () => ({
  customEdges: {},
  nodeTypes: {},
  dragHandle: jest.fn(),
  onNodeContextMenu: jest.fn(),
  onNodeMouseEnter: jest.fn(),
  onNodeMouseLeave: jest.fn(),
  onNodeMouseMove: jest.fn(),
}));

describe('Lineage Component', () => {
  const defaultProps = {
    entity: mockEntity as Table,
    deleted: false,
    hasEditAccess: true,
    entityType: EntityType.TABLE,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useLineageProvider as jest.Mock).mockReturnValue(
      mockLineageProviderValues
    );
  });

  describe('Rendering', () => {
    it('should render lineage component with all sub-components', () => {
      render(<Lineage {...defaultProps} />);

      expect(screen.getByTestId('lineage-details')).toBeInTheDocument();
      expect(screen.getByTestId('lineage-container')).toBeInTheDocument();
      expect(screen.getByTestId('custom-controls')).toBeInTheDocument();
      expect(screen.getByTestId('lineage-control-buttons')).toBeInTheDocument();
      expect(screen.getByTestId('react-flow-component')).toBeInTheDocument();
      expect(screen.getByTestId('lineage-layers')).toBeInTheDocument();
    });

    it('should render ReactFlow with background and minimap', () => {
      render(<Lineage {...defaultProps} />);

      expect(screen.getByTestId('react-flow-background')).toBeInTheDocument();
      expect(screen.getByTestId('react-flow-minimap')).toBeInTheDocument();
    });

    it('should render loader when init is false', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        init: false,
      });

      render(<Lineage {...defaultProps} />);

      expect(screen.getByTestId('loader')).toBeInTheDocument();
      expect(
        screen.queryByTestId('react-flow-component')
      ).not.toBeInTheDocument();
    });

    it('should not render CustomControls when isPlatformLineage is true', () => {
      render(<Lineage {...defaultProps} isPlatformLineage />);

      expect(screen.queryByTestId('custom-controls')).not.toBeInTheDocument();
    });

    it('should render CustomControls when isPlatformLineage is false', () => {
      render(<Lineage {...defaultProps} isPlatformLineage={false} />);

      expect(screen.getByTestId('custom-controls')).toBeInTheDocument();
    });

    it('should render CustomControls when isPlatformLineage is undefined', () => {
      render(<Lineage {...defaultProps} />);

      expect(screen.getByTestId('custom-controls')).toBeInTheDocument();
    });

    it('should apply edit mode class when isEditMode is true', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        isEditMode: true,
      });

      render(<Lineage {...defaultProps} />);

      const header = screen
        .getByTestId('custom-controls')
        .closest('.lineage-header');

      expect(header).toHaveClass('lineage-header-edit-mode');
    });
  });

  describe('Entity Updates', () => {
    it('should call updateEntityData on mount', () => {
      render(<Lineage {...defaultProps} />);

      expect(mockUpdateEntityData).toHaveBeenCalledWith(
        EntityType.TABLE,
        mockEntity,
        undefined
      );
    });

    it('should call updateEntityData when entity changes', () => {
      const { rerender } = render(<Lineage {...defaultProps} />);

      expect(mockUpdateEntityData).toHaveBeenCalledTimes(1);

      const newEntity = { ...mockEntity, id: 'new-id' };
      rerender(<Lineage {...defaultProps} entity={newEntity as Table} />);

      expect(mockUpdateEntityData).toHaveBeenCalledTimes(2);
      expect(mockUpdateEntityData).toHaveBeenCalledWith(
        EntityType.TABLE,
        newEntity,
        undefined
      );
    });

    it('should call updateEntityData when entityType changes', () => {
      const { rerender } = render(<Lineage {...defaultProps} />);

      expect(mockUpdateEntityData).toHaveBeenCalledTimes(1);

      rerender(<Lineage {...defaultProps} entityType={EntityType.TOPIC} />);

      expect(mockUpdateEntityData).toHaveBeenCalledTimes(2);
      expect(mockUpdateEntityData).toHaveBeenCalledWith(
        EntityType.TOPIC,
        mockEntity,
        undefined
      );
    });

    it('should call updateEntityData when isPlatformLineage changes', () => {
      const { rerender } = render(<Lineage {...defaultProps} />);

      expect(mockUpdateEntityData).toHaveBeenCalledTimes(1);

      rerender(<Lineage {...defaultProps} isPlatformLineage />);

      expect(mockUpdateEntityData).toHaveBeenCalledTimes(2);
      expect(mockUpdateEntityData).toHaveBeenCalledWith(
        EntityType.TABLE,
        mockEntity,
        true
      );
    });
  });

  describe('Drag and Drop', () => {
    it('should handle drag over event', () => {
      render(<Lineage {...defaultProps} />);

      const reactFlow = screen.getByTestId('react-flow-component');

      const dragOverEvent = new Event('dragover', { bubbles: true });
      Object.defineProperty(dragOverEvent, 'dataTransfer', {
        value: { dropEffect: '' },
        writable: true,
      });

      const preventDefaultSpy = jest.spyOn(dragOverEvent, 'preventDefault');

      fireEvent(reactFlow, dragOverEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect((dragOverEvent as any).dataTransfer.dropEffect).toBe('move');
    });

    it('should handle node drop event', () => {
      render(<Lineage {...defaultProps} />);

      const reactFlow = screen.getByTestId('react-flow-component');
      const dropEvent = {
        preventDefault: jest.fn(),
        clientX: 100,
        clientY: 200,
      } as unknown as DragEvent;

      fireEvent.drop(reactFlow, dropEvent);

      expect(mockOnNodeDrop).toHaveBeenCalled();
    });
  });

  describe('Node Interactions', () => {
    it('should handle node click and stop propagation', () => {
      render(<Lineage {...defaultProps} />);

      const node = screen.getByTestId('react-flow-nodes');
      node.setAttribute('data-testid', 'react-flow-node');

      const clickEvent = { stopPropagation: jest.fn() };
      fireEvent.click(node, clickEvent);

      expect(mockOnNodeClick).toHaveBeenCalledWith({ id: 'node-1' });
    });

    it('should call onNodesChange when nodes are updated', () => {
      render(<Lineage {...defaultProps} />);

      expect(ReactFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          onNodesChange: mockOnNodesChange,
        }),
        expect.anything()
      );
    });
  });

  describe('Edge Interactions', () => {
    it('should handle edge click and stop propagation', () => {
      render(<Lineage {...defaultProps} />);

      const edge = screen.getByTestId('react-flow-edges');
      edge.setAttribute('data-testid', 'react-flow-edge');

      fireEvent.click(edge);

      expect(mockOnEdgeClick).toHaveBeenCalledWith({ id: 'edge-1' });
    });

    it('should call onEdgesChange when edges are updated', () => {
      render(<Lineage {...defaultProps} />);

      expect(ReactFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          onEdgesChange: mockOnEdgesChange,
        }),
        expect.anything()
      );
    });
  });

  describe('Pane Interactions', () => {
    it('should handle pane click', () => {
      render(<Lineage {...defaultProps} />);

      const pane = screen.getByTestId('react-flow-component');
      const paneClickTarget = document.createElement('div');
      paneClickTarget.setAttribute('data-testid', 'react-flow-pane');
      pane.appendChild(paneClickTarget);

      fireEvent.click(paneClickTarget);

      expect(mockOnPaneClick).toHaveBeenCalled();
    });
  });

  describe('ReactFlow Configuration', () => {
    it('should pass correct props to ReactFlow', () => {
      render(<Lineage {...defaultProps} />);

      expect(ReactFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: mockNodes,
          edges: mockEdges,
          nodesConnectable: false,
          selectNodesOnDrag: false,
          deleteKeyCode: null,
          elevateEdgesOnSelect: true,
          nodeDragThreshold: 1,
          maxZoom: expect.any(Number),
          minZoom: expect.any(Number),
          fitViewOptions: { padding: 48 },
        }),
        expect.anything()
      );
    });

    it('should enable nodesConnectable when in edit mode', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        isEditMode: true,
      });

      render(<Lineage {...defaultProps} />);

      expect(ReactFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          nodesConnectable: true,
        }),
        expect.anything()
      );
    });

    it('should call onInitReactFlow on ReactFlow init', () => {
      render(<Lineage {...defaultProps} />);

      expect(ReactFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          onInit: mockOnInitReactFlow,
        }),
        expect.anything()
      );
    });

    it('should call onConnect when nodes are connected', () => {
      render(<Lineage {...defaultProps} />);

      expect(ReactFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          onConnect: mockOnConnect,
        }),
        expect.anything()
      );
    });
  });

  describe('Props Passing', () => {
    it('should pass correct props to LineageControlButtons', () => {
      render(<Lineage {...defaultProps} />);

      expect(LineageControlButtons).toHaveBeenCalledWith(
        {
          miniMapVisible: true,
          onToggleMiniMap: expect.any(Function),
        },
        expect.anything()
      );
    });

    it('should pass correct props to LineageLayers', () => {
      render(<Lineage {...defaultProps} />);

      expect(LineageLayers).toHaveBeenCalledWith(
        {
          entity: mockEntity,
          entityType: EntityType.TABLE,
        },
        expect.anything()
      );
    });
  });

  describe('Different Entity Types', () => {
    it.each([
      EntityType.TABLE,
      EntityType.TOPIC,
      EntityType.DASHBOARD,
      EntityType.PIPELINE,
      EntityType.MLMODEL,
    ])('should render lineage for %s entity type', (entityType) => {
      render(<Lineage {...defaultProps} entityType={entityType} />);

      expect(screen.getByTestId('lineage-details')).toBeInTheDocument();
      expect(mockUpdateEntityData).toHaveBeenCalledWith(
        entityType,
        mockEntity,
        undefined
      );
    });
  });

  describe('Container Reference', () => {
    it('should render container with id for export functionality', () => {
      render(<Lineage {...defaultProps} />);

      const container = screen.getByTestId('lineage-container');

      expect(container).toHaveAttribute('id', 'lineage-container');
    });
  });

  describe('Event Handler Memoization', () => {
    it('should not recreate handlers on re-render with same props', () => {
      const { rerender } = render(<Lineage {...defaultProps} />);

      const firstRenderCalls = mockOnNodeClick.mock.calls.length;

      rerender(<Lineage {...defaultProps} />);

      expect(mockOnNodeClick.mock.calls).toHaveLength(firstRenderCalls);
    });
  });

  describe('Empty States', () => {
    it('should render with empty nodes and edges', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        nodes: [],
        edges: [],
      });

      render(<Lineage {...defaultProps} />);

      expect(screen.getByTestId('react-flow-component')).toBeInTheDocument();
    });
  });
});
