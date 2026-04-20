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
import { act, renderHook } from '@testing-library/react';
import { Edge, Node } from 'reactflow';
import { useMapBasedNodesEdges } from './useMapBasedNodesEdges';

jest.mock('../utils/EntityLineageUtils', () => ({
  getClassifiedEdge: jest.fn((edges: Edge[]) => ({
    normalEdge: edges.filter((e) => !e.data?.isColumnLineage),
    columnEdge: edges.filter((e) => e.data?.isColumnLineage),
  })),
}));

const createNode = (id: string): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
});

const createEdge = (
  id: string,
  source: string,
  target: string,
  isColumnLineage = false
): Edge => ({
  id,
  source,
  target,
  data: { isColumnLineage },
});

describe('useMapBasedNodesEdges', () => {
  it('initializes with empty nodes and edges', () => {
    const { result } = renderHook(() => useMapBasedNodesEdges());

    expect(result.current.nodes).toEqual([]);
    expect(result.current.edges).toEqual([]);
    expect(result.current.nodeEdges).toEqual([]);
    expect(result.current.columnEdges).toEqual([]);
  });

  it('initializes with provided nodes and edges', () => {
    const initialNodes = [createNode('node1'), createNode('node2')];
    const initialEdges = [createEdge('edge1', 'node1', 'node2')];

    const { result } = renderHook(() =>
      useMapBasedNodesEdges(initialNodes, initialEdges)
    );

    expect(result.current.nodes).toEqual(initialNodes);
    expect(result.current.edges).toEqual(initialEdges);
  });

  it('sets nodes with array', () => {
    const { result } = renderHook(() => useMapBasedNodesEdges());

    const newNodes = [createNode('node1'), createNode('node2')];

    act(() => {
      result.current.setNodes(newNodes);
    });

    expect(result.current.nodes).toEqual(newNodes);
  });

  it('sets nodes with updater function', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges([createNode('node1')])
    );

    act(() => {
      result.current.setNodes((prev) => [...prev, createNode('node2')]);
    });

    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.nodes[1].id).toBe('node2');
  });

  it('sets edges with array', () => {
    const { result } = renderHook(() => useMapBasedNodesEdges());

    const newEdges = [createEdge('edge1', 'node1', 'node2')];

    act(() => {
      result.current.setEdges(newEdges);
    });

    expect(result.current.edges).toEqual(newEdges);
  });

  it('sets edges with updater function', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges([], [createEdge('edge1', 'node1', 'node2')])
    );

    act(() => {
      result.current.setEdges((prev) => [
        ...prev,
        createEdge('edge2', 'node2', 'node3'),
      ]);
    });

    expect(result.current.edges).toHaveLength(2);
    expect(result.current.edges[1].id).toBe('edge2');
  });

  it('removes node by id', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges([createNode('node1'), createNode('node2')])
    );

    act(() => {
      result.current.removeNodeById('node1');
    });

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0].id).toBe('node2');
  });

  it('removes edge by id', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges(
        [],
        [
          createEdge('edge1', 'node1', 'node2'),
          createEdge('edge2', 'node2', 'node3'),
        ]
      )
    );

    act(() => {
      result.current.removeEdgeById('edge1');
    });

    expect(result.current.edges).toHaveLength(1);
    expect(result.current.edges[0].id).toBe('edge2');
  });

  it('removes edges by source and target', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges(
        [],
        [
          createEdge('edge1', 'node1', 'node2'),
          createEdge('edge2', 'node1', 'node2'),
          createEdge('edge3', 'node2', 'node3'),
        ]
      )
    );

    act(() => {
      result.current.removeEdgesBySourceTarget('node1', 'node2');
    });

    expect(result.current.edges).toHaveLength(1);
    expect(result.current.edges[0].id).toBe('edge3');
  });

  it('removes edges by docId', () => {
    const edge1 = createEdge('edge1', 'node1', 'node2');
    edge1.data = { edge: { extraInfo: { docId: 'doc1' } } };

    const edge2 = createEdge('edge2', 'node2', 'node3');
    edge2.data = { edge: { extraInfo: { docId: 'doc1' } } };

    const edge3 = createEdge('edge3', 'node3', 'node4');
    edge3.data = { edge: { extraInfo: { docId: 'doc2' } } };

    const { result } = renderHook(() =>
      useMapBasedNodesEdges([], [edge1, edge2, edge3])
    );

    act(() => {
      result.current.removeEdgesByDocId('doc1');
    });

    expect(result.current.edges).toHaveLength(1);
    expect(result.current.edges[0].id).toBe('edge3');
  });

  it('adds nodes', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges([createNode('node1')])
    );

    act(() => {
      result.current.addNodes([createNode('node2'), createNode('node3')]);
    });

    expect(result.current.nodes).toHaveLength(3);
    expect(result.current.nodes.map((n) => n.id)).toEqual([
      'node1',
      'node2',
      'node3',
    ]);
  });

  it('adds edges', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges([], [createEdge('edge1', 'node1', 'node2')])
    );

    act(() => {
      result.current.addEdges([createEdge('edge2', 'node2', 'node3')]);
    });

    expect(result.current.edges).toHaveLength(2);
  });

  it('updates node', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges([createNode('node1')])
    );

    act(() => {
      result.current.updateNode('node1', (node) => ({
        ...node,
        position: { x: 100, y: 100 },
      }));
    });

    expect(result.current.nodes[0].position).toEqual({ x: 100, y: 100 });
  });

  it('does not update non-existent node', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges([createNode('node1')])
    );

    act(() => {
      result.current.updateNode('node2', (node) => ({
        ...node,
        position: { x: 100, y: 100 },
      }));
    });

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0].id).toBe('node1');
  });

  it('updates edge', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges([], [createEdge('edge1', 'node1', 'node2')])
    );

    act(() => {
      result.current.updateEdge('edge1', (edge) => ({
        ...edge,
        animated: true,
      }));
    });

    expect(result.current.edges[0].animated).toBe(true);
  });

  it('does not update non-existent edge', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges([], [createEdge('edge1', 'node1', 'node2')])
    );

    act(() => {
      result.current.updateEdge('edge2', (edge) => ({
        ...edge,
        animated: true,
      }));
    });

    expect(result.current.edges).toHaveLength(1);
    expect(result.current.edges[0].id).toBe('edge1');
  });

  it('handles onNodesChange with add', () => {
    const { result } = renderHook(() => useMapBasedNodesEdges());

    act(() => {
      result.current.onNodesChange([
        {
          type: 'add',
          item: createNode('node1'),
        },
      ]);
    });

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0].id).toBe('node1');
  });

  it('handles onNodesChange with remove', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges([createNode('node1')])
    );

    act(() => {
      result.current.onNodesChange([
        {
          type: 'remove',
          id: 'node1',
        },
      ]);
    });

    expect(result.current.nodes).toHaveLength(0);
  });

  it('handles onNodesChange with position', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges([createNode('node1')])
    );

    act(() => {
      result.current.onNodesChange([
        {
          type: 'position',
          id: 'node1',
          position: { x: 100, y: 100 },
          dragging: false,
        },
      ]);
    });

    expect(result.current.nodes[0].position).toEqual({ x: 100, y: 100 });
  });

  it('handles onNodesChange with select', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges([createNode('node1')])
    );

    act(() => {
      result.current.onNodesChange([
        {
          type: 'select',
          id: 'node1',
          selected: true,
        },
      ]);
    });

    expect(result.current.nodes[0].selected).toBe(true);
  });

  it('handles onEdgesChange with add', () => {
    const { result } = renderHook(() => useMapBasedNodesEdges());

    act(() => {
      result.current.onEdgesChange([
        {
          type: 'add',
          item: createEdge('edge1', 'node1', 'node2'),
        },
      ]);
    });

    expect(result.current.edges).toHaveLength(1);
    expect(result.current.edges[0].id).toBe('edge1');
  });

  it('handles onEdgesChange with remove', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges([], [createEdge('edge1', 'node1', 'node2')])
    );

    act(() => {
      result.current.onEdgesChange([
        {
          type: 'remove',
          id: 'edge1',
        },
      ]);
    });

    expect(result.current.edges).toHaveLength(0);
  });

  it('handles onEdgesChange with select', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges([], [createEdge('edge1', 'node1', 'node2')])
    );

    act(() => {
      result.current.onEdgesChange([
        {
          type: 'select',
          id: 'edge1',
          selected: true,
        },
      ]);
    });

    expect(result.current.edges[0].selected).toBe(true);
  });

  it('classifies edges into node and column edges', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges(
        [],
        [
          createEdge('edge1', 'node1', 'node2', false),
          createEdge('edge2', 'node2', 'node3', true),
          createEdge('edge3', 'node3', 'node4', false),
        ]
      )
    );

    expect(result.current.nodeEdges).toHaveLength(2);
    expect(result.current.columnEdges).toHaveLength(1);
  });

  it('replaces node when adding with same id', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges([createNode('node1')])
    );

    const updatedNode = createNode('node1');
    updatedNode.position = { x: 100, y: 100 };

    act(() => {
      result.current.addNodes([updatedNode]);
    });

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0].position).toEqual({ x: 100, y: 100 });
  });

  it('replaces edge when adding with same id', () => {
    const { result } = renderHook(() =>
      useMapBasedNodesEdges([], [createEdge('edge1', 'node1', 'node2')])
    );

    const updatedEdge = createEdge('edge1', 'node1', 'node3');

    act(() => {
      result.current.addEdges([updatedEdge]);
    });

    expect(result.current.edges).toHaveLength(1);
    expect(result.current.edges[0].target).toBe('node3');
  });

  it('handles batch node operations', () => {
    const { result } = renderHook(() => useMapBasedNodesEdges());

    act(() => {
      result.current.addNodes([createNode('node1'), createNode('node2')]);
      result.current.removeNodeById('node1');
      result.current.addNodes([createNode('node3')]);
    });

    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.nodes.map((n) => n.id)).toEqual(['node2', 'node3']);
  });

  it('handles batch edge operations', () => {
    const { result } = renderHook(() => useMapBasedNodesEdges());

    act(() => {
      result.current.addEdges([
        createEdge('edge1', 'node1', 'node2'),
        createEdge('edge2', 'node2', 'node3'),
      ]);
      result.current.removeEdgeById('edge1');
      result.current.addEdges([createEdge('edge3', 'node3', 'node4')]);
    });

    expect(result.current.edges).toHaveLength(2);
    expect(result.current.edges.map((e) => e.id)).toEqual(['edge2', 'edge3']);
  });
});
