/*
 *  Copyright 2026 Collate.
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
import { Edge } from 'reactflow';
import { EdgeInteractionOverlay } from './EdgeInteractionOverlay.component';

const mockUseViewport = jest.fn().mockReturnValue({ x: 0, y: 0, zoom: 1 });
const mockUseLineageStore = {
  isEditMode: false,
  selectedEdge: undefined,
};

jest.mock('reactflow', () => ({
  ...jest.requireActual('reactflow'),
  useViewport: () => mockUseViewport(),
  useReactFlow: () => ({ getNode: jest.fn() }),
}));

jest.mock('../../../hooks/useLineageStore', () => ({
  useLineageStore: () => mockUseLineageStore,
}));

const createEdge = (overrides: Partial<Edge> = {}): Edge => ({
  id: 'edge-1',
  source: 'node-1',
  target: 'node-2',
  data: {
    edge: {
      fromEntity: { fullyQualifiedName: 'table1', id: 'id1' },
      toEntity: { fullyQualifiedName: 'table2', id: 'id2' },
    },
    computedPath: {
      edgePath: 'M 0,0 C 100,0 100,100 200,100',
      edgeCenterX: 100,
      edgeCenterY: 50,
    },
    isColumnLineage: false,
  },
  ...overrides,
});

describe('EdgeInteractionOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLineageStore.isEditMode = false;
    mockUseLineageStore.selectedEdge = undefined;
  });

  it('renders nothing when no hovered or selected edge', () => {
    const { container } = render(<EdgeInteractionOverlay />);

    expect(
      container.querySelector('.edge-interaction-overlay')
    ).toBeEmptyDOMElement();
  });

  it('renders edit button when edge is selected in edit mode', () => {
    const edge = createEdge();
    mockUseLineageStore.isEditMode = true;
    mockUseLineageStore.selectedEdge = edge;

    render(<EdgeInteractionOverlay />);

    const editButton = screen.getByTestId('add-pipeline');

    expect(editButton).toBeInTheDocument();
  });

  it('does not render edit button for column lineage', () => {
    const edge = createEdge({
      data: {
        ...createEdge().data,
        isColumnLineage: true,
      },
    });
    mockUseLineageStore.isEditMode = true;
    mockUseLineageStore.selectedEdge = edge;

    render(<EdgeInteractionOverlay />);

    expect(screen.queryByTestId('add-pipeline')).not.toBeInTheDocument();
  });

  it('renders delete button for column lineage in edit mode', () => {
    const edge = createEdge({
      data: {
        ...createEdge().data,
        isColumnLineage: true,
      },
    });
    mockUseLineageStore.isEditMode = true;
    mockUseLineageStore.selectedEdge = edge;

    render(<EdgeInteractionOverlay />);

    const deleteButton = screen.getByTestId('delete-button');

    expect(deleteButton).toBeInTheDocument();
  });

  it('does not render delete button for non-column lineage', () => {
    const edge = createEdge();
    mockUseLineageStore.isEditMode = true;
    mockUseLineageStore.selectedEdge = edge;

    render(<EdgeInteractionOverlay />);

    expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();
  });

  it('calls onEdgeRemove when delete button is clicked', () => {
    const onEdgeRemove = jest.fn();
    const edge = createEdge({
      data: {
        ...createEdge().data,
        isColumnLineage: true,
      },
    });
    mockUseLineageStore.isEditMode = true;
    mockUseLineageStore.selectedEdge = edge;

    render(<EdgeInteractionOverlay onEdgeRemove={onEdgeRemove} />);

    const deleteButton = screen.getByTestId('delete-button');
    fireEvent.click(deleteButton);

    expect(onEdgeRemove).toHaveBeenCalled();
  });

  it('does not render when computedPath is missing', () => {
    createEdge({
      data: {
        edge: {
          fromEntity: { fullyQualifiedName: 'table1', id: 'id1' },
          toEntity: { fullyQualifiedName: 'table2', id: 'id2' },
          pipeline: {
            fullyQualifiedName: 'pipeline1',
            name: 'Pipeline 1',
          },
        },
        isColumnLineage: false,
      },
    });

    render(<EdgeInteractionOverlay />);

    expect(
      screen.queryByTestId('pipeline-label-table1-table2')
    ).not.toBeInTheDocument();
  });
});
