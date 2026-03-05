/*
 *  Copyright 2024 Collate.
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

import ELK, { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk.bundled.js';
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactFlow, {
  Background,
  Edge,
  EdgeTypes,
  MiniMap,
  Node,
  NodeProps,
  NodeTypes,
  ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import OntologyEdge, {
  OntologyEdgeData,
  RELATION_COLORS,
} from './OntologyEdge';
import {
  GraphSettings,
  OntologyEdge as OntologyEdgeType,
  OntologyNode as OntologyNodeType,
} from './OntologyExplorer.interface';
import OntologyNode, { OntologyNodeData } from './OntologyNode';

const NODE_WIDTH = 200;
const GROUP_PADDING = 24;
const NODE_HEIGHT = 60;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;
const DEFAULT_ZOOM = 0.8;

const elk = new ELK();

const INVERSE_RELATION_PAIRS: Record<string, string> = {
  broader: 'narrower',
  narrower: 'broader',
  parentOf: 'childOf',
  childOf: 'parentOf',
  hasPart: 'partOf',
  partOf: 'hasPart',
  hasA: 'componentOf',
  componentOf: 'hasA',
  composedOf: 'partOf',
  owns: 'ownedBy',
  ownedBy: 'owns',
  manages: 'managedBy',
  managedBy: 'manages',
  contains: 'containedIn',
  containedIn: 'contains',
  hasTypes: 'typeOf',
  typeOf: 'hasTypes',
  usedToCalculate: 'calculatedFrom',
  calculatedFrom: 'usedToCalculate',
  usedBy: 'dependsOn',
  dependsOn: 'usedBy',
};

const SYMMETRIC_RELATIONS = new Set([
  'related',
  'relatedTo',
  'synonym',
  'antonym',
  'seeAlso',
]);

interface MergedEdge {
  from: string;
  to: string;
  relationType: string;
  inverseRelationType?: string;
  isBidirectional: boolean;
}

const layoutOptions: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '80',
  'elk.layered.spacing.nodeNodeBetweenLayers': '120',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.crossingMinimization.greedySwitch.type': 'TWO_SIDED',
  'elk.separateConnectedComponents': 'false',
};

const forceLayoutOptions: Record<string, string> = {
  'elk.algorithm': 'stress',
  'elk.stress.desiredEdgeLength': '200',
  'elk.spacing.nodeNode': '120',
};

const radialLayoutOptions: Record<string, string> = {
  'elk.algorithm': 'radial',
  'elk.spacing.nodeNode': '100',
  'elk.radial.centerOnRoot': 'true',
  'elk.radial.compactor': 'WEDGE_COMPACTION',
};

export interface OntologyGraphProps {
  nodes: OntologyNodeType[];
  edges: OntologyEdgeType[];
  settings: GraphSettings;
  nodePositions?: Record<string, { x: number; y: number }>;
  selectedNodeId?: string | null;
  glossaryColorMap: Record<string, string>;
  onNodeClick: (node: OntologyNodeType) => void;
  onNodeDoubleClick: (node: OntologyNodeType) => void;
  onNodeContextMenu: (
    node: OntologyNodeType,
    position: { x: number; y: number }
  ) => void;
  onPaneClick: () => void;
  showMinimap?: boolean;
}

export interface OntologyGraphHandle {
  fitView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  runLayout: () => void;
  focusNode: (nodeId: string) => void;
  getNodePositions: () => Record<string, { x: number; y: number }>;
}

export interface GlossaryGroupNodeData {
  glossaryId: string;
  glossaryName: string;
  color: string;
}

const GlossaryGroupNode = memo(function GlossaryGroupNode({
  data,
}: NodeProps<GlossaryGroupNodeData>) {
  const borderColor = data?.color ?? '#94a3b8';
  const backgroundColor = data?.color
    ? `${data.color}18`
    : 'rgba(148, 163, 184, 0.08)';

  return (
    <div
      className="tw:box-border tw:h-full tw:w-full tw:overflow-visible tw:rounded-xl tw:border-2 tw:border-dashed"
      style={{ backgroundColor, borderColor }}>
      <span className="tw:absolute tw:left-0 tw:-top-5.5 tw:max-w-45 tw:overflow-hidden tw:text-ellipsis tw:whitespace-nowrap tw:tw:text-xs tw:font-medium tw:text-slate-500">
        {data?.glossaryName ?? ''}
      </span>
    </div>
  );
});

const nodeTypes: NodeTypes = {
  ontologyNode: OntologyNode,
  glossaryGroup: GlossaryGroupNode,
};

const edgeTypes: EdgeTypes = {
  ontologyEdge: OntologyEdge,
};

const OntologyGraph = forwardRef<OntologyGraphHandle, OntologyGraphProps>(
  (
    {
      nodes: inputNodes,
      edges: inputEdges,
      settings,
      nodePositions,
      selectedNodeId,
      glossaryColorMap,
      onNodeClick,
      onNodeDoubleClick,
      onNodeContextMenu,
      onPaneClick,
      showMinimap = false,
    },
    ref
  ) => {
    const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isLayouting, setIsLayouting] = useState(false);
    const [runLayoutTrigger, setRunLayoutTrigger] = useState(0);

    const getLayoutOptions = useCallback(() => {
      switch (settings.layout) {
        case 'hierarchical':
          return layoutOptions;
        case 'radial':
        case 'circular':
          return radialLayoutOptions;
        case 'force':
        default:
          return forceLayoutOptions;
      }
    }, [settings.layout]);

    const getNeighborIds = useCallback(
      (nodeId: string): Set<string> => {
        const neighbors = new Set<string>();
        inputEdges.forEach((edge) => {
          if (edge.from === nodeId) {
            neighbors.add(edge.to);
          }
          if (edge.to === nodeId) {
            neighbors.add(edge.from);
          }
        });

        return neighbors;
      },
      [inputEdges]
    );

    const connectionCounts = useMemo(() => {
      const counts = new Map<string, number>();
      inputEdges.forEach((edge) => {
        counts.set(edge.from, (counts.get(edge.from) ?? 0) + 1);
        counts.set(edge.to, (counts.get(edge.to) ?? 0) + 1);
      });

      return counts;
    }, [inputEdges]);

    const outDegrees = useMemo(() => {
      const counts = new Map<string, number>();
      inputEdges.forEach((edge) => {
        counts.set(edge.from, (counts.get(edge.from) ?? 0) + 1);
      });

      return counts;
    }, [inputEdges]);

    const hierarchyDepths = useMemo(() => {
      const depths = new Map<string, number>();
      const hasIncoming = new Set(inputEdges.map((e) => e.to));
      const roots = inputNodes.filter((n) => !hasIncoming.has(n.id));
      const queue: Array<{ id: string; depth: number }> = roots.map((r) => ({
        id: r.id,
        depth: 0,
      }));
      queue.forEach(({ id, depth }) => depths.set(id, depth));
      let i = 0;
      while (i < queue.length) {
        const { id, depth } = queue[i];
        inputEdges.forEach((edge) => {
          if (edge.from === id && !depths.has(edge.to)) {
            depths.set(edge.to, depth + 1);
            queue.push({ id: edge.to, depth: depth + 1 });
          }
        });
        i++;
      }
      inputNodes.forEach((n) => {
        if (!depths.has(n.id)) {
          depths.set(n.id, 0);
        }
      });

      return depths;
    }, [inputNodes, inputEdges]);

    const computeNodeColor = useCallback(
      (node: OntologyNodeType): string => {
        switch (settings.nodeColorMode) {
          case 'glossary':
            return node.glossaryId && glossaryColorMap[node.glossaryId]
              ? glossaryColorMap[node.glossaryId]
              : '#3062d4';
          case 'connectionCount': {
            const count = connectionCounts.get(node.id) ?? 0;
            if (count === 0) {
              return '#9ca3af';
            }
            if (count <= 2) {
              return '#3b82f6';
            }
            if (count <= 5) {
              return '#7c3aed';
            }

            return '#ec4899';
          }
          case 'hierarchyLevel': {
            const palette = [
              '#1d4ed8',
              '#2563eb',
              '#3b82f6',
              '#60a5fa',
              '#93c5fd',
            ];
            const depth = hierarchyDepths.get(node.id) ?? 0;

            return palette[Math.min(depth, palette.length - 1)];
          }
          case 'relationType': {
            const typeCounts = new Map<string, number>();
            inputEdges.forEach((edge) => {
              if (edge.from === node.id || edge.to === node.id) {
                typeCounts.set(
                  edge.relationType,
                  (typeCounts.get(edge.relationType) ?? 0) + 1
                );
              }
            });
            let primaryType = '';
            let maxCount = 0;
            typeCounts.forEach((count, type) => {
              if (count > maxCount) {
                maxCount = count;
                primaryType = type;
              }
            });

            return RELATION_COLORS[primaryType] ?? '#3062d4';
          }
          default:
            return node.glossaryId && glossaryColorMap[node.glossaryId]
              ? glossaryColorMap[node.glossaryId]
              : '#3062d4';
        }
      },
      [
        settings.nodeColorMode,
        glossaryColorMap,
        connectionCounts,
        hierarchyDepths,
        inputEdges,
      ]
    );

    const computeNodeHeight = useCallback(
      (nodeId: string): number => {
        switch (settings.nodeSizeMode) {
          case 'connectionCount':
            return (
              NODE_HEIGHT +
              Math.min((connectionCounts.get(nodeId) ?? 0) * 4, 30)
            );
          case 'childCount':
            return (
              NODE_HEIGHT + Math.min((outDegrees.get(nodeId) ?? 0) * 4, 30)
            );
          case 'uniform':
          default:
            return NODE_HEIGHT;
        }
      },
      [settings.nodeSizeMode, connectionCounts, outDegrees]
    );

    const mergedEdges = useMemo((): MergedEdge[] => {
      const edgeMap = new Map<string, OntologyEdgeType>();
      const processedPairs = new Set<string>();
      const result: MergedEdge[] = [];

      inputEdges.forEach((edge) => {
        const key = `${edge.from}->${edge.to}`;
        edgeMap.set(key, edge);
      });

      inputEdges.forEach((edge) => {
        const forwardKey = `${edge.from}->${edge.to}`;
        const reverseKey = `${edge.to}->${edge.from}`;
        const pairKey = [edge.from, edge.to]
          .sort((a, b) => a.localeCompare(b))
          .join('::');

        if (processedPairs.has(pairKey)) {
          return;
        }

        const reverseEdge = edgeMap.get(reverseKey);
        const inverseRelation = INVERSE_RELATION_PAIRS[edge.relationType];
        const isSymmetric = SYMMETRIC_RELATIONS.has(edge.relationType);

        if (inverseRelation && reverseEdge?.relationType === inverseRelation) {
          processedPairs.add(pairKey);
          result.push({
            from: edge.from,
            to: edge.to,
            relationType: edge.relationType,
            inverseRelationType: reverseEdge.relationType,
            isBidirectional: true,
          });
        } else if (
          reverseEdge &&
          isSymmetric &&
          edge.relationType === reverseEdge.relationType
        ) {
          processedPairs.add(pairKey);
          result.push({
            from: edge.from,
            to: edge.to,
            relationType: edge.relationType,
            isBidirectional: true,
          });
        } else {
          edgeMap.delete(forwardKey);
          result.push({
            from: edge.from,
            to: edge.to,
            relationType: edge.relationType,
            isBidirectional: false,
          });
        }
      });

      return result;
    }, [inputEdges]);

    const wrapInGlossaryGroups = useCallback(
      (termNodes: Node[], colorMap: Record<string, string>): Node[] => {
        const byGlossary = new Map<string, Node[]>();
        const ungrouped: Node[] = [];

        termNodes.forEach((node) => {
          if (node.type !== 'ontologyNode' || !node.data) {
            ungrouped.push(node);

            return;
          }
          const ontologyData = node.data as OntologyNodeData;
          const glossaryId = ontologyData.node.glossaryId;
          if (!glossaryId) {
            ungrouped.push(node);

            return;
          }
          const list = byGlossary.get(glossaryId) ?? [];
          list.push(node);
          byGlossary.set(glossaryId, list);
        });

        const groupNodes: Node[] = [];
        const groupedTerms: Node[] = [];

        byGlossary.forEach((nodesInGroup, glossaryId) => {
          if (nodesInGroup.length === 0) {
            return;
          }
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          nodesInGroup.forEach((n) => {
            const x = n.position?.x ?? 0;
            const y = n.position?.y ?? 0;
            const w = n.width ?? NODE_WIDTH;
            const h = n.height ?? NODE_HEIGHT;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);
          });
          const groupX = minX - GROUP_PADDING;
          const groupY = minY - GROUP_PADDING;
          const groupW = maxX - minX + 2 * GROUP_PADDING;
          const groupH = maxY - minY + 2 * GROUP_PADDING;

          const firstData = nodesInGroup[0].data as OntologyNodeData;
          const glossaryName = firstData.node.group ?? glossaryId;
          const groupColor = colorMap[glossaryId] ?? '#94a3b8';

          const groupId = `glossary-group-${glossaryId}`;
          const groupData: GlossaryGroupNodeData = {
            glossaryId,
            glossaryName,
            color: groupColor,
          };
          groupNodes.push({
            id: groupId,
            type: 'glossaryGroup',
            position: { x: groupX, y: groupY },
            data: groupData,
            width: groupW,
            height: groupH,
            style: { width: groupW, height: groupH },
            selectable: false,
            draggable: true,
            zIndex: 0,
          });

          nodesInGroup.forEach((n) => {
            const relX = (n.position?.x ?? 0) - groupX;
            const relY = (n.position?.y ?? 0) - groupY;
            groupedTerms.push({
              ...n,
              parentNode: groupId,
              extent: 'parent' as const,
              position: { x: relX, y: relY },
              zIndex: 2,
            });
          });
        });

        return [...groupNodes, ...ungrouped, ...groupedTerms];
      },
      []
    );

    const handleNodeClick = useCallback(
      (_event: React.MouseEvent, node: Node) => {
        const ontologyNode = inputNodes.find((n) => n.id === node.id);
        if (ontologyNode) {
          onNodeClick(ontologyNode);
        }
      },
      [inputNodes, onNodeClick]
    );

    const handleNodeDoubleClick = useCallback(
      (_event: React.MouseEvent, node: Node) => {
        const ontologyNode = inputNodes.find((n) => n.id === node.id);
        if (ontologyNode) {
          onNodeDoubleClick(ontologyNode);
        }
      },
      [inputNodes, onNodeDoubleClick]
    );

    const handleNodeContextMenu = useCallback(
      (event: React.MouseEvent, node: Node) => {
        event.preventDefault();
        const ontologyNode = inputNodes.find((n) => n.id === node.id);
        if (ontologyNode) {
          onNodeContextMenu(ontologyNode, {
            x: event.clientX,
            y: event.clientY,
          });
        }
      },
      [inputNodes, onNodeContextMenu]
    );

    const handlePaneClick = useCallback(() => {
      onPaneClick();
    }, [onPaneClick]);

    const layoutNodes = useCallback(
      async (
        nodesData: OntologyNodeType[],
        edgesData: OntologyEdgeType[]
      ): Promise<Node[]> => {
        // Separate nodes that have at least one edge from isolated nodes.
        // Isolated nodes are placed in a grid below the connected graph so they
        // never overlap with arrow paths between connected nodes.
        const connectedNodeIds = new Set<string>();
        edgesData.forEach((e) => {
          connectedNodeIds.add(e.from);
          connectedNodeIds.add(e.to);
        });
        const connectedNodes = nodesData.filter((n) =>
          connectedNodeIds.has(n.id)
        );
        const isolatedNodes = nodesData.filter(
          (n) => !connectedNodeIds.has(n.id)
        );

        const elkNodes: ElkNode[] = connectedNodes.map((node) => ({
          id: node.id,
          width: NODE_WIDTH,
          height: computeNodeHeight(node.id),
        }));

        const elkEdges: ElkExtendedEdge[] = edgesData.map((edge, index) => ({
          id: `elk-edge-${index}`,
          sources: [edge.from],
          targets: [edge.to],
        }));

        const graph = {
          id: 'root',
          layoutOptions: getLayoutOptions(),
          children: elkNodes,
          edges: elkEdges,
        };

        const nodeById = new Map(nodesData.map((n) => [n.id, n]));
        const handleClick = (id: string) => {
          const n = nodeById.get(id);
          if (n) {
            onNodeClick(n);
          }
        };
        const handleDoubleClick = (id: string) => {
          const n = nodeById.get(id);
          if (n) {
            onNodeDoubleClick(n);
          }
        };

        const positionsById = new Map<string, { x: number; y: number }>();

        const placeIsolatedGrid = (startY: number) => {
          const ISOLATED_COL_GAP = NODE_WIDTH + 40;
          const ISOLATED_ROW_GAP = NODE_HEIGHT + 40;
          const cols = Math.ceil(Math.sqrt(Math.max(1, isolatedNodes.length)));
          isolatedNodes.forEach((node, index) => {
            positionsById.set(node.id, {
              x: (index % cols) * ISOLATED_COL_GAP,
              y: startY + Math.floor(index / cols) * ISOLATED_ROW_GAP,
            });
          });
        };

        try {
          const layoutedGraph = await elk.layout(graph);
          let connectedMaxY = 0;
          (layoutedGraph.children ?? []).forEach((elkNode) => {
            positionsById.set(elkNode.id, {
              x: elkNode.x ?? 0,
              y: elkNode.y ?? 0,
            });
            connectedMaxY = Math.max(
              connectedMaxY,
              (elkNode.y ?? 0) +
                (elkNode.height ?? computeNodeHeight(elkNode.id))
            );
          });

          if (isolatedNodes.length > 0) {
            placeIsolatedGrid(
              connectedNodes.length > 0 ? connectedMaxY + 80 : 0
            );
          }
        } catch {
          nodesData.forEach((node, index) => {
            positionsById.set(node.id, {
              x: (index % 10) * (NODE_WIDTH + 50),
              y: Math.floor(index / 10) * (NODE_HEIGHT + 50),
            });
          });
        }

        return nodesData.map((node) => {
          const pos = positionsById.get(node.id) ?? { x: 0, y: 0 };
          const neighborIds = getNeighborIds(node.id);
          const isSelected = selectedNodeId === node.id;
          const isHighlighted =
            selectedNodeId !== null && neighborIds.has(selectedNodeId ?? '');
          const isConnected = (connectionCounts.get(node.id) ?? 0) > 0;
          const glossaryColor = computeNodeColor(node);
          const nodeHeight = computeNodeHeight(node.id);

          const nodeData: OntologyNodeData = {
            node,
            isSelected,
            isHighlighted,
            isConnected,
            glossaryColor,
            nodeHeight,
            onClick: handleClick,
            onDoubleClick: handleDoubleClick,
          };

          return {
            id: node.id,
            type: 'ontologyNode',
            position: pos,
            data: nodeData,
            width: NODE_WIDTH,
            height: nodeHeight,
          };
        });
      },
      [
        getLayoutOptions,
        getNeighborIds,
        selectedNodeId,
        connectionCounts,
        onNodeClick,
        onNodeDoubleClick,
        computeNodeColor,
        computeNodeHeight,
      ]
    );

    const layoutNodesWithHulls = useCallback(
      async (
        nodesData: OntologyNodeType[],
        edgesData: OntologyEdgeType[]
      ): Promise<Node[]> => {
        // Group nodes by glossary
        const byGlossary = new Map<string, OntologyNodeType[]>();
        const ungroupedData: OntologyNodeType[] = [];
        nodesData.forEach((node) => {
          if (node.glossaryId) {
            const list = byGlossary.get(node.glossaryId) ?? [];
            list.push(node);
            byGlossary.set(node.glossaryId, list);
          } else {
            ungroupedData.push(node);
          }
        });

        // Split edges into intra-group (same glossary) and cross-group
        const nodeToGlossary = new Map(
          nodesData.map((n) => [n.id, n.glossaryId])
        );
        const intraByGlossary = new Map<string, OntologyEdgeType[]>();
        const crossEdgesList: OntologyEdgeType[] = [];
        edgesData.forEach((edge) => {
          const fromG = nodeToGlossary.get(edge.from);
          const toG = nodeToGlossary.get(edge.to);
          if (fromG && fromG === toG) {
            const list = intraByGlossary.get(fromG) ?? [];
            list.push(edge);
            intraByGlossary.set(fromG, list);
          } else {
            crossEdgesList.push(edge);
          }
        });

        // Build ELK compound graph: each glossary is a compound node
        const topPadding = GROUP_PADDING + 22; // extra room for glossary label
        const elkChildren: ElkNode[] = [];
        byGlossary.forEach((terms, glossaryId) => {
          const intraEdges = intraByGlossary.get(glossaryId) ?? [];
          elkChildren.push({
            id: `glossary-group-${glossaryId}`,
            layoutOptions: {
              'elk.algorithm': 'layered',
              'elk.direction': 'RIGHT',
              'elk.spacing.nodeNode': '60',
              'elk.layered.spacing.nodeNodeBetweenLayers': '80',
              'elk.padding': `[top=${topPadding},left=${GROUP_PADDING},bottom=${GROUP_PADDING},right=${GROUP_PADDING}]`,
            },
            children: terms.map((t) => ({
              id: t.id,
              width: NODE_WIDTH,
              height: computeNodeHeight(t.id),
            })),
            edges: intraEdges.map((e, i) => ({
              id: `intra-${glossaryId}-${i}`,
              sources: [e.from],
              targets: [e.to],
            })),
          });
        });
        // Among ungrouped nodes, separate those with cross-edges from
        // truly isolated ones (no edges at all). Isolated nodes are placed
        // below the main layout to prevent them overlapping with edge arrows.
        const crossEdgeNodeIds = new Set<string>();
        crossEdgesList.forEach((e) => {
          crossEdgeNodeIds.add(e.from);
          crossEdgeNodeIds.add(e.to);
        });
        const ungroupedConnected = ungroupedData.filter((n) =>
          crossEdgeNodeIds.has(n.id)
        );
        const ungroupedIsolated = ungroupedData.filter(
          (n) => !crossEdgeNodeIds.has(n.id)
        );

        ungroupedConnected.forEach((node) => {
          elkChildren.push({
            id: node.id,
            width: NODE_WIDTH,
            height: computeNodeHeight(node.id),
          });
        });

        const elkEdges: ElkExtendedEdge[] = crossEdgesList.map((edge, i) => ({
          id: `cross-${i}`,
          sources: [edge.from],
          targets: [edge.to],
        }));

        const rootDirection =
          settings.layout === 'hierarchical' ? 'RIGHT' : 'DOWN';

        const graph: ElkNode = {
          id: 'root',
          layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': rootDirection,
            'elk.spacing.nodeNode': '120',
            'elk.layered.spacing.nodeNodeBetweenLayers': '160',
            'elk.separateConnectedComponents': 'false',
          },
          children: elkChildren,
          edges: elkEdges,
        };

        const nodeById = new Map(nodesData.map((n) => [n.id, n]));
        const handleClick = (id: string) => {
          const n = nodeById.get(id);
          if (n) {
            onNodeClick(n);
          }
        };
        const handleDoubleClick = (id: string) => {
          const n = nodeById.get(id);
          if (n) {
            onNodeDoubleClick(n);
          }
        };

        try {
          const layoutedGraph = await elk.layout(graph);
          const groupNodes: Node[] = [];
          const termNodes: Node[] = [];
          let topLevelMaxY = 0;

          layoutedGraph.children?.forEach((elkNode) => {
            topLevelMaxY = Math.max(
              topLevelMaxY,
              (elkNode.y ?? 0) + (elkNode.height ?? NODE_HEIGHT)
            );

            if (elkNode.id.startsWith('glossary-group-')) {
              const glossaryId = elkNode.id.replace('glossary-group-', '');
              const groupW = elkNode.width ?? 200;
              const groupH = elkNode.height ?? 100;
              const firstTerm = byGlossary.get(glossaryId)?.[0];
              const glossaryName = firstTerm?.group ?? glossaryId;
              const groupColor = glossaryColorMap[glossaryId] ?? '#94a3b8';

              groupNodes.push({
                id: elkNode.id,
                type: 'glossaryGroup',
                position: { x: elkNode.x ?? 0, y: elkNode.y ?? 0 },
                data: {
                  glossaryId,
                  glossaryName,
                  color: groupColor,
                } as GlossaryGroupNodeData,
                width: groupW,
                height: groupH,
                style: { width: groupW, height: groupH },
                selectable: false,
                draggable: true,
                zIndex: 0,
              });

              elkNode.children?.forEach((child) => {
                const ontNode = nodeById.get(child.id);
                if (!ontNode) {
                  return;
                }
                const neighborIds = getNeighborIds(ontNode.id);
                const isSelected = selectedNodeId === ontNode.id;
                const isHighlighted =
                  selectedNodeId !== null &&
                  neighborIds.has(selectedNodeId ?? '');
                const isConnected = (connectionCounts.get(ontNode.id) ?? 0) > 0;
                const nodeGlossaryColor = computeNodeColor(ontNode);
                const nodeHeight = computeNodeHeight(child.id);

                termNodes.push({
                  id: child.id,
                  type: 'ontologyNode',
                  position: { x: child.x ?? 0, y: child.y ?? 0 },
                  parentNode: elkNode.id,
                  extent: 'parent' as const,
                  data: {
                    node: ontNode,
                    isSelected,
                    isHighlighted,
                    isConnected,
                    glossaryColor: nodeGlossaryColor,
                    nodeHeight,
                    onClick: handleClick,
                    onDoubleClick: handleDoubleClick,
                  } as OntologyNodeData,
                  width: NODE_WIDTH,
                  height: nodeHeight,
                  selected: isSelected,
                  zIndex: 2,
                });
              });
            } else {
              const ontNode = nodeById.get(elkNode.id);
              if (!ontNode) {
                return;
              }
              const neighborIds = getNeighborIds(ontNode.id);
              const isSelected = selectedNodeId === ontNode.id;
              const isHighlighted =
                selectedNodeId !== null &&
                neighborIds.has(selectedNodeId ?? '');
              const isConnected = (connectionCounts.get(ontNode.id) ?? 0) > 0;
              const nodeGlossaryColor = computeNodeColor(ontNode);
              const nodeHeight = computeNodeHeight(elkNode.id);

              termNodes.push({
                id: elkNode.id,
                type: 'ontologyNode',
                position: { x: elkNode.x ?? 0, y: elkNode.y ?? 0 },
                data: {
                  node: ontNode,
                  isSelected,
                  isHighlighted,
                  isConnected,
                  glossaryColor: nodeGlossaryColor,
                  nodeHeight,
                  onClick: handleClick,
                  onDoubleClick: handleDoubleClick,
                } as OntologyNodeData,
                width: NODE_WIDTH,
                height: nodeHeight,
                selected: isSelected,
              });
            }
          });

          // Place ungrouped isolated nodes in a grid below the ELK layout
          if (ungroupedIsolated.length > 0) {
            const ISOLATED_GAP = 80;
            const ISOLATED_COL_GAP = NODE_WIDTH + 40;
            const ISOLATED_ROW_GAP = NODE_HEIGHT + 40;
            const cols = Math.ceil(Math.sqrt(ungroupedIsolated.length));
            ungroupedIsolated.forEach((node, index) => {
              const col = index % cols;
              const row = Math.floor(index / cols);
              const neighborIds = getNeighborIds(node.id);
              const isSelected = selectedNodeId === node.id;
              const isHighlighted =
                selectedNodeId !== null &&
                neighborIds.has(selectedNodeId ?? '');
              const isConnected = (connectionCounts.get(node.id) ?? 0) > 0;
              const nodeGlossaryColor = computeNodeColor(node);
              const nodeHeight = computeNodeHeight(node.id);
              termNodes.push({
                id: node.id,
                type: 'ontologyNode',
                position: {
                  x: col * ISOLATED_COL_GAP,
                  y: topLevelMaxY + ISOLATED_GAP + row * ISOLATED_ROW_GAP,
                },
                data: {
                  node,
                  isSelected,
                  isHighlighted,
                  isConnected,
                  glossaryColor: nodeGlossaryColor,
                  nodeHeight,
                  onClick: handleClick,
                  onDoubleClick: handleDoubleClick,
                } as OntologyNodeData,
                width: NODE_WIDTH,
                height: nodeHeight,
                selected: isSelected,
              });
            });
          }

          // Group nodes must precede their children in the React Flow array
          return [...groupNodes, ...termNodes];
        } catch {
          return layoutNodes(nodesData, edgesData);
        }
      },
      [
        getNeighborIds,
        selectedNodeId,
        connectionCounts,
        onNodeClick,
        onNodeDoubleClick,
        layoutNodes,
        computeNodeColor,
        computeNodeHeight,
        settings.layout,
      ]
    );

    const createEdges = useCallback(
      (edgesData: MergedEdge[]): Edge[] => {
        return edgesData.map((edge, index) => {
          const isHighlighted =
            selectedNodeId === edge.from || selectedNodeId === edge.to;

          const edgeData: OntologyEdgeData = {
            relationType: edge.relationType,
            inverseRelationType: edge.inverseRelationType,
            isBidirectional: edge.isBidirectional,
            isHighlighted,
            showLabels: settings.showEdgeLabels,
            color: '',
          };

          return {
            id: `edge-${index}-${edge.from}-${edge.to}`,
            source: edge.from,
            target: edge.to,
            sourceHandle: 'center',
            targetHandle: 'center',
            type: 'ontologyEdge',
            data: edgeData,
            zIndex: isHighlighted ? 1001 : 10,
          };
        });
      },
      [selectedNodeId, settings.showEdgeLabels]
    );

    const buildNodesWithPositions = useCallback(
      (
        nodesData: OntologyNodeType[],
        positions: Record<string, { x: number; y: number }>
      ): Node[] => {
        const nodeById = new Map(nodesData.map((n) => [n.id, n]));
        const handleClick = (id: string) => {
          const n = nodeById.get(id);
          if (n) {
            onNodeClick(n);
          }
        };
        const handleDoubleClick = (id: string) => {
          const n = nodeById.get(id);
          if (n) {
            onNodeDoubleClick(n);
          }
        };

        return nodesData.map((node) => {
          const pos = positions[node.id] ?? { x: 0, y: 0 };
          const neighborIds = getNeighborIds(node.id);
          const isSelected = selectedNodeId === node.id;
          const isHighlighted =
            selectedNodeId !== null && neighborIds.has(selectedNodeId ?? '');
          const isConnected = (connectionCounts.get(node.id) ?? 0) > 0;
          const glossaryColor = computeNodeColor(node);
          const nodeHeight = computeNodeHeight(node.id);

          const nodeData: OntologyNodeData = {
            node,
            isSelected,
            isHighlighted,
            isConnected,
            glossaryColor,
            nodeHeight,
            onClick: handleClick,
            onDoubleClick: handleDoubleClick,
          };

          return {
            id: node.id,
            type: 'ontologyNode',
            position: pos,
            data: nodeData,
            width: NODE_WIDTH,
            height: nodeHeight,
            selected: isSelected,
          };
        });
      },
      [
        getNeighborIds,
        selectedNodeId,
        connectionCounts,
        onNodeClick,
        onNodeDoubleClick,
        computeNodeColor,
        computeNodeHeight,
      ]
    );

    useEffect(() => {
      const updateLayout = async () => {
        if (inputNodes.length === 0) {
          setNodes([]);
          setEdges([]);

          return;
        }

        setIsLayouting(true);

        try {
          const hasSavedPositions =
            runLayoutTrigger === 0 &&
            nodePositions &&
            Object.keys(nodePositions).length > 0;
          const flowEdges = createEdges(mergedEdges);

          if (hasSavedPositions) {
            const positionedNodes = buildNodesWithPositions(
              inputNodes,
              nodePositions ?? {}
            );
            setNodes(
              settings.showGlossaryHulls
                ? wrapInGlossaryGroups(positionedNodes, glossaryColorMap)
                : positionedNodes
            );
            setEdges(flowEdges);
          } else {
            const layoutedNodes = settings.showGlossaryHulls
              ? await layoutNodesWithHulls(inputNodes, inputEdges)
              : await layoutNodes(inputNodes, inputEdges);
            setNodes(layoutedNodes);
            setEdges(flowEdges);
          }

          setTimeout(() => {
            reactFlowInstance.current?.fitView({
              padding: 0.05,
              maxZoom: DEFAULT_ZOOM,
              duration: settings.animateTransitions ? 500 : 0,
            });
          }, 100);
        } finally {
          setIsLayouting(false);
        }
      };

      updateLayout();
    }, [
      inputNodes,
      inputEdges,
      mergedEdges,
      settings.layout,
      settings.animateTransitions,
      settings.showGlossaryHulls,
      layoutNodes,
      layoutNodesWithHulls,
      createEdges,
      buildNodesWithPositions,
      wrapInGlossaryGroups,
      glossaryColorMap,
      setNodes,
      setEdges,
      nodePositions,
      runLayoutTrigger,
    ]);

    useEffect(() => {
      setNodes((nds) =>
        nds.map((node) => {
          const inputNode = inputNodes.find((n) => n.id === node.id);
          if (!inputNode) {
            return node;
          }

          const neighborIds = getNeighborIds(node.id);
          const isSelected = selectedNodeId === node.id;
          const isHighlighted =
            selectedNodeId !== null && neighborIds.has(selectedNodeId ?? '');

          return {
            ...node,
            data: {
              ...node.data,
              isSelected,
              isHighlighted,
            },
          };
        })
      );

      setEdges((eds) =>
        eds.map((edge) => {
          const isHighlighted =
            selectedNodeId === edge.source || selectedNodeId === edge.target;

          return {
            ...edge,
            data: {
              ...edge.data,
              isHighlighted,
            } as OntologyEdgeData,
            zIndex: isHighlighted ? 1001 : 10,
          };
        })
      );
    }, [selectedNodeId, inputNodes, getNeighborIds, setNodes, setEdges]);

    useImperativeHandle(
      ref,
      () => ({
        fitView: () => {
          reactFlowInstance.current?.fitView({
            padding: 0.05,
            maxZoom: DEFAULT_ZOOM,
            duration: settings.animateTransitions ? 400 : 0,
          });
        },
        zoomIn: () => {
          reactFlowInstance.current?.zoomIn();
        },
        zoomOut: () => {
          reactFlowInstance.current?.zoomOut();
        },
        runLayout: () => {
          setRunLayoutTrigger((t) => t + 1);
        },
        focusNode: (nodeId: string) => {
          const instance = reactFlowInstance.current;
          if (!instance) {
            return;
          }
          const flowNodes = instance.getNodes();
          const byId = new Map(flowNodes.map((n) => [n.id, n]));
          const node = byId.get(nodeId);
          if (!node?.position) {
            return;
          }
          let x = node.position.x;
          let y = node.position.y;
          if (node.parentNode) {
            const parent = byId.get(node.parentNode);
            if (parent?.position) {
              x += parent.position.x;
              y += parent.position.y;
            }
          }
          const nodeW = node.width ?? NODE_WIDTH;
          const nodeH = node.height ?? NODE_HEIGHT;
          instance.setCenter(x + nodeW / 2, y + nodeH / 2, {
            zoom: 1.2,
            duration: settings.animateTransitions ? 400 : 0,
          });
        },
        getNodePositions: () => {
          const flowNodes = reactFlowInstance.current?.getNodes() ?? [];
          const byId = new Map(flowNodes.map((n) => [n.id, n]));
          const positions: Record<string, { x: number; y: number }> = {};
          flowNodes.forEach((n) => {
            if (n.type === 'glossaryGroup') {
              return;
            }
            let x = n.position?.x ?? 0;
            let y = n.position?.y ?? 0;
            if (n.parentNode) {
              const parent = byId.get(n.parentNode);
              if (parent?.position) {
                x += parent.position.x;
                y += parent.position.y;
              }
            }
            positions[n.id] = { x, y };
          });

          return positions;
        },
      }),
      [settings.animateTransitions]
    );

    const onInit = useCallback((instance: ReactFlowInstance) => {
      reactFlowInstance.current = instance;
    }, []);

    return (
      <div className="ontology-flow-container">
        <ReactFlow
          elevateEdgesOnSelect
          fitView
          edgeTypes={edgeTypes}
          edges={edges}
          elevateNodesOnSelect={false}
          maxZoom={MAX_ZOOM}
          minZoom={MIN_ZOOM}
          nodeTypes={nodeTypes}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={!isLayouting}
          proOptions={{ hideAttribution: true }}
          selectNodesOnDrag={false}
          onEdgesChange={onEdgesChange}
          onInit={onInit}
          onNodeClick={handleNodeClick}
          onNodeContextMenu={handleNodeContextMenu}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodesChange={onNodesChange}
          onPaneClick={handlePaneClick}>
          <Background color="#e5e7eb" gap={20} size={1} />

          {showMinimap && (
            <MiniMap
              pannable
              zoomable
              maskColor="rgba(0, 0, 0, 0.1)"
              nodeColor={(node) => {
                const data = node.data as OntologyNodeData;

                return data.glossaryColor || '#3062d4';
              }}
              position="bottom-right"
            />
          )}
        </ReactFlow>
      </div>
    );
  }
);

OntologyGraph.displayName = 'OntologyGraph';

export default OntologyGraph;
