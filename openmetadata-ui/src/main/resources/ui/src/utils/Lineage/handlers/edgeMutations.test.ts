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
import { Edge, Node } from 'reactflow';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { SourceType } from '../../../interface/source.interface';
import {
  onAddPipelineClick,
  onColumnEdgeRemove,
  onEdgeClick,
} from './edgeMutations';

describe('onEdgeClick', () => {
  beforeEach(() => useLineageStore.getState().reset());

  it('selects the edge, opens the drawer and clears node selection', () => {
    useLineageStore.setState({
      activeNode: { id: 'node1' } as unknown as Node,
      selectedNode: { id: 'node1' } as unknown as SourceType,
      tracedNodes: new Set(['node1']),
      isDrawerOpen: false,
    });

    const edge = {
      id: 'edge1',
      source: 'node1',
      target: 'node2',
    } as unknown as Edge;

    onEdgeClick(edge);

    const state = useLineageStore.getState();

    expect(state.selectedEdge).toBe(edge);
    expect(state.isDrawerOpen).toBe(true);
    expect(state.activeNode).toBeUndefined();
    expect(state.selectedNode).toBeUndefined();
    expect(state.tracedNodes.size).toBe(0);
  });

  it('traces the source/target column handles for a column-level edge', () => {
    const edge = {
      id: 'edge1',
      source: 'node1',
      target: 'node2',
      sourceHandle: 'node1.col1',
      targetHandle: 'node2.col2',
    } as unknown as Edge;

    onEdgeClick(edge);

    const state = useLineageStore.getState();

    expect(state.tracedColumns).toEqual(new Set(['node1.col1', 'node2.col2']));
  });

  it('does not set traced columns when handles are absent', () => {
    useLineageStore.setState({ tracedColumns: new Set(['prior.col']) });

    const edge = {
      id: 'edge1',
      source: 'node1',
      target: 'node2',
    } as unknown as Edge;

    onEdgeClick(edge);

    expect(useLineageStore.getState().tracedColumns).toEqual(
      new Set(['prior.col'])
    );
  });
});

describe('onAddPipelineClick', () => {
  beforeEach(() => useLineageStore.getState().reset());

  it('opens the add-edge modal', () => {
    expect(useLineageStore.getState().showAddEdgeModal).toBe(false);

    onAddPipelineClick();

    expect(useLineageStore.getState().showAddEdgeModal).toBe(true);
  });
});

describe('onColumnEdgeRemove', () => {
  beforeEach(() => useLineageStore.getState().reset());

  it('opens the delete-edge confirmation modal', () => {
    expect(useLineageStore.getState().showDeleteModal).toBe(false);

    onColumnEdgeRemove();

    expect(useLineageStore.getState().showDeleteModal).toBe(true);
  });
});
