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
import { useCallback, useMemo, useState } from 'react';
import { Edge, Node, OnEdgesChange, OnNodesChange } from 'reactflow';

interface UseMapBasedNodesEdgesReturn {
  nodes: Node[];
  edges: Edge[];
  setNodes: (update: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (update: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  removeNodeById: (nodeId: string) => void;
  removeEdgeById: (edgeId: string) => void;
  removeEdgesBySourceTarget: (sourceId: string, targetId: string) => void;
  removeEdgesByDocId: (docId: string) => void;
  addNodes: (newNodes: Node[]) => void;
  addEdges: (newEdges: Edge[]) => void;
  updateNode: (nodeId: string, updater: (node: Node) => Node) => void;
  updateEdge: (edgeId: string, updater: (edge: Edge) => Edge) => void;
}

export const useMapBasedNodesEdges = (
  initialNodes: Node[] = [],
  initialEdges: Edge[] = []
): UseMapBasedNodesEdgesReturn => {
  const [nodesMap, setNodesMap] = useState<Map<string, Node>>(
    () => new Map(initialNodes.map((node) => [node.id, node]))
  );

  const [edgesMap, setEdgesMap] = useState<Map<string, Edge>>(
    () => new Map(initialEdges.map((edge) => [edge.id, edge]))
  );

  const nodes = useMemo(() => Array.from(nodesMap.values()), [nodesMap]);
  const edges = useMemo(() => Array.from(edgesMap.values()), [edgesMap]);

  const setNodes = useCallback(
    (update: Node[] | ((prev: Node[]) => Node[])) => {
      setNodesMap((prevMap) => {
        const prevArray = Array.from(prevMap.values());
        const newArray =
          typeof update === 'function' ? update(prevArray) : update;

        return new Map(newArray.map((node) => [node.id, node]));
      });
    },
    []
  );

  const setEdges = useCallback(
    (update: Edge[] | ((prev: Edge[]) => Edge[])) => {
      setEdgesMap((prevMap) => {
        const prevArray = Array.from(prevMap.values());
        const newArray =
          typeof update === 'function' ? update(prevArray) : update;

        return new Map(newArray.map((edge) => [edge.id, edge]));
      });
    },
    []
  );

  const removeNodeById = useCallback((nodeId: string) => {
    setNodesMap((prev) => {
      const next = new Map(prev);
      next.delete(nodeId);

      return next;
    });
  }, []);

  const removeEdgeById = useCallback((edgeId: string) => {
    setEdgesMap((prev) => {
      const next = new Map(prev);
      next.delete(edgeId);

      return next;
    });
  }, []);

  const removeEdgesBySourceTarget = useCallback(
    (sourceId: string, targetId: string) => {
      setEdgesMap((prev) => {
        const next = new Map(prev);
        for (const [id, edge] of prev.entries()) {
          if (edge.source === sourceId && edge.target === targetId) {
            next.delete(id);
          }
        }

        return next;
      });
    },
    []
  );

  const removeEdgesByDocId = useCallback((docId: string) => {
    setEdgesMap((prev) => {
      const next = new Map(prev);
      for (const [id, edge] of prev.entries()) {
        if (edge.data?.edge?.extraInfo?.docId === docId) {
          next.delete(id);
        }
      }

      return next;
    });
  }, []);

  const addNodes = useCallback((newNodes: Node[]) => {
    setNodesMap((prev) => {
      const next = new Map(prev);
      for (const node of newNodes) {
        next.set(node.id, node);
      }

      return next;
    });
  }, []);

  const addEdges = useCallback((newEdges: Edge[]) => {
    setEdgesMap((prev) => {
      const next = new Map(prev);
      for (const edge of newEdges) {
        next.set(edge.id, edge);
      }

      return next;
    });
  }, []);

  const updateNode = useCallback(
    (nodeId: string, updater: (node: Node) => Node) => {
      setNodesMap((prev) => {
        const node = prev.get(nodeId);
        if (!node) {
          return prev;
        }
        const next = new Map(prev);
        next.set(nodeId, updater(node));

        return next;
      });
    },
    []
  );

  const updateEdge = useCallback(
    (edgeId: string, updater: (edge: Edge) => Edge) => {
      setEdgesMap((prev) => {
        const edge = prev.get(edgeId);
        if (!edge) {
          return prev;
        }
        const next = new Map(prev);
        next.set(edgeId, updater(edge));

        return next;
      });
    },
    []
  );

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodesMap((prev) => {
      const next = new Map(prev);
      for (const change of changes) {
        switch (change.type) {
          case 'remove':
            next.delete(change.id);

            break;
          case 'position':
          case 'dimensions':
          case 'select': {
            const node = next.get(change.id);
            if (node) {
              next.set(change.id, {
                ...node,
                ...(change.type === 'position' && change.position
                  ? { position: change.position }
                  : {}),
                ...(change.type === 'dimensions' && change.dimensions
                  ? {
                      width: change.dimensions.width,
                      height: change.dimensions.height,
                    }
                  : {}),
                ...(change.type === 'select'
                  ? { selected: change.selected }
                  : {}),
              });
            }

            break;
          }
        }
      }

      return next;
    });
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdgesMap((prev) => {
      const next = new Map(prev);
      for (const change of changes) {
        switch (change.type) {
          case 'remove':
            next.delete(change.id);

            break;
          case 'select': {
            const edge = next.get(change.id);
            if (edge) {
              next.set(change.id, { ...edge, selected: change.selected });
            }

            break;
          }
        }
      }

      return next;
    });
  }, []);

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    removeNodeById,
    removeEdgeById,
    removeEdgesBySourceTarget,
    removeEdgesByDocId,
    addNodes,
    addEdges,
    updateNode,
    updateEdge,
  };
};
