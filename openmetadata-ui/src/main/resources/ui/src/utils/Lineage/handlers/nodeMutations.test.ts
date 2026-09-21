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
import { DragEvent } from 'react';
import { Edge, Node } from 'reactflow';
import { EntityLineageResponse } from '../../../components/Lineage/Lineage.interface';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { getLineageDataByFQN } from '../../../rest/lineageAPI';
import {
  loadChildNodesHandler,
  onNodeClick,
  onNodeCollapse,
  onNodeDrop,
  onPaneClick,
  removeNodeHandler,
} from './nodeMutations';

jest.mock('../../../rest/lineageAPI', () => ({
  getLineageDataByFQN: jest.fn(),
}));

describe('nodeMutations', () => {
  beforeEach(() => {
    useLineageStore.getState().reset();
    jest.clearAllMocks();
  });

  it('removeNodeHandler removes the node from updatedEntityLineage', () => {
    useLineageStore.setState({
      updatedEntityLineage: undefined,
      entityLineage: {
        entity: { id: 'root' },
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [],
      } as unknown as EntityLineageResponse,
    });

    removeNodeHandler({ id: 'a' } as unknown as Node);

    expect(
      useLineageStore
        .getState()
        .updatedEntityLineage?.nodes?.some((n: { id: string }) => n.id === 'a')
    ).toBe(false);
  });

  it('onNodeCollapse removes the collapsed subtree from nodes', () => {
    const nodeA = {
      id: 'a',
      data: { node: { fullyQualifiedName: 'a' }, nodeDepth: 0 },
    } as unknown as Node;
    const nodeB = {
      id: 'b',
      data: { node: { fullyQualifiedName: 'b' }, nodeDepth: 1 },
    } as unknown as Node;
    const edge = {
      id: 'e1',
      source: 'a',
      target: 'b',
      data: { edge: { fromEntity: { id: 'a' }, toEntity: { id: 'b' } } },
    } as unknown as Edge;

    useLineageStore.setState({
      nodes: [nodeA, nodeB],
      edges: [edge],
      entityLineage: {
        entity: { id: 'a' },
        nodes: [
          { id: 'a', fullyQualifiedName: 'a' },
          { id: 'b', fullyQualifiedName: 'b' },
        ],
        edges: [{ fromEntity: { id: 'a' }, toEntity: { id: 'b' } }],
      } as unknown as EntityLineageResponse,
    });

    onNodeCollapse(nodeA, LineageDirection.Downstream);

    expect(useLineageStore.getState().nodes.some((n) => n.id === 'b')).toBe(
      false
    );
  });

  it('loadChildNodesHandler fetches lineage data and bumps lineageMutationTick', async () => {
    (getLineageDataByFQN as jest.Mock).mockResolvedValue({
      nodes: {},
      downstreamEdges: {},
      upstreamEdges: {},
    });

    useLineageStore.setState({
      entityLineage: {
        entity: { id: 'root' },
        nodes: [{ id: 'root', fullyQualifiedName: 'root' }],
        edges: [],
      } as unknown as EntityLineageResponse,
    });

    const tickBefore = useLineageStore.getState().lineageMutationTick;

    await loadChildNodesHandler(
      { id: 'root', fullyQualifiedName: 'root', entityType: 'table' } as never,
      LineageDirection.Downstream,
      1
    );

    expect(getLineageDataByFQN).toHaveBeenCalledWith(
      expect.objectContaining({
        fqn: 'root',
        direction: LineageDirection.Downstream,
      })
    );
    expect(useLineageStore.getState().lineageMutationTick).toBe(tickBefore + 1);
  });

  it('onNodeClick sets activeNode/selectedNode and opens the drawer', () => {
    const node = {
      id: 'a',
      type: 'default',
      data: { node: { id: 'a', fullyQualifiedName: 'a' } },
    } as unknown as Node;

    onNodeClick(node);

    const state = useLineageStore.getState();

    expect(state.activeNode).toBe(node);
    expect(state.selectedNode).toEqual(node.data.node);
    expect(state.isDrawerOpen).toBe(true);
  });

  it('onPaneClick clears the selection and closes the drawer', () => {
    useLineageStore.setState({
      activeNode: { id: 'a' } as unknown as Node,
      selectedNode: { id: 'a' } as never,
      selectedEdge: { id: 'e1' } as unknown as Edge,
      selectedColumn: 'col',
      isDrawerOpen: true,
    });

    onPaneClick();

    const state = useLineageStore.getState();

    expect(state.activeNode).toBeUndefined();
    expect(state.selectedNode).toBeUndefined();
    expect(state.selectedEdge).toBeUndefined();
    expect(state.selectedColumn).toBe('');
    expect(state.isDrawerOpen).toBe(false);
  });

  it('onNodeDrop adds a new placeholder node to nodes', () => {
    useLineageStore.setState({
      reactFlowInstance: {
        project: jest.fn(({ x, y }) => ({ x, y })),
      } as never,
    });

    const dataTransfer = {
      getData: jest.fn(() => 'table'),
    };
    const event = {
      preventDefault: jest.fn(),
      dataTransfer,
      clientX: 100,
      clientY: 100,
    } as unknown as DragEvent;
    const bounds = { left: 0, top: 0 } as DOMRect;

    onNodeDrop(event, bounds);

    const state = useLineageStore.getState();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(state.nodes).toHaveLength(1);
    expect(state.newAddedNode).toBeDefined();
  });
});
