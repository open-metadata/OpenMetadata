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

import type { EdgeData, ElementDatum, IElementEvent, NodeData } from '@antv/g6';
import { ExtensionCategory, Graph, register } from '@antv/g6';
import { ReactNode as AntVReactNode } from '@antv/g6-extension-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import CustomNode from '../../components/KnowledgeGraph/GraphElements/CustomNode';
import { ZOOM_RANGE } from '../../components/KnowledgeGraph/KnowledgeGraph.constants';
import {
  EdgeTooltipState,
  GraphData,
  GraphLevelRing,
  GraphNodePresentation,
  KnowledgeGraphEdge,
  KnowledgeGraphLabelMode,
  KnowledgeGraphLayout,
  KnowledgeGraphMode,
} from '../../components/KnowledgeGraph/KnowledgeGraph.interface';
import { RelationCategory } from '../../components/KnowledgeGraph/KnowledgeGraph.relations';
import { useTheme } from '../../context/UntitledUIThemeProvider/theme-provider';
import {
  applyGraphLayout,
  buildEdgeBaseStyle,
  buildEdgeDimStyle,
  buildEdgeHighlightStyle,
  buildNodeUpdateData,
  fitGraphViewport,
  getColorSetForType,
  getGraphLevelRings,
  getLaneLevelBands,
  getNodeRenderKey,
  projectGraphToPositions,
  resolveFocusNodeId,
  transformToG6Format,
} from '../../utils/KnowledgeGraph.utils';

register(ExtensionCategory.NODE, 'react-node', AntVReactNode);

export type GraphSelection =
  | { kind: 'node' | 'edge'; id: string }
  | { kind: 'category'; category: RelationCategory }
  | null;

const nodesForRings = (data: { nodes?: NodeData[] }) => data.nodes ?? [];

const displayedNodeId = (nodes: NodeData[], id: string) =>
  nodes.find((node) => node.id === id)?.id ??
  nodes.find((node) =>
    (
      node.data?.presentation as GraphNodePresentation | undefined
    )?.members?.some((member) => member.id === id)
  )?.id;

const displayedSelection = (nodes: NodeData[], selection: GraphSelection) =>
  selection?.kind === 'node'
    ? { ...selection, id: displayedNodeId(nodes, selection.id) ?? selection.id }
    : selection;

const getContextEdgeStyle = (
  edge: EdgeData,
  nodes: Map<string, NodeData>,
  layout: KnowledgeGraphLayout,
  selected: boolean,
  lineWidth: number
) => {
  const source = nodes.get(edge.source)?.data?.presentation as
    | GraphNodePresentation
    | undefined;
  const target = nodes.get(edge.target)?.data?.presentation as
    | GraphNodePresentation
    | undefined;
  const branch = [
    source?.root,
    target?.root,
    source?.anchorId === edge.target,
    target?.anchorId === edge.source,
    source?.groupId === edge.target,
    target?.groupId === edge.source,
  ].some(Boolean);
  const context = layout === 'lanes' && !selected && !branch;

  return {
    strokeOpacity: context ? 0.3 : 1,
    endArrowFillOpacity: context ? 0.3 : 1,
    lineWidth: context ? 1 : lineWidth,
  };
};

const isFocusInView = (graph: Graph, entityId: string) => {
  const nodes = graph.getNodeData();
  const focus = nodes.find(
    (node) => node.id === resolveFocusNodeId(nodes, entityId)
  );
  if (!focus) {
    return true;
  }
  const [x, y] = graph.getViewportByCanvas([
    Number(focus.style?.x ?? 0),
    Number(focus.style?.y ?? 0),
  ]);
  const [width, height] = graph.getSize();

  return x >= 0 && y >= 0 && x <= width && y <= height;
};

const fitViewport = async (
  graph: Graph,
  focusId: string,
  container: HTMLDivElement | null
) => {
  const width = container?.clientWidth || 800;
  const height = container?.clientHeight || 600;
  // The legend can resize the pane before ResizeObserver reaches G6.
  graph.resize(width, height);
  await fitGraphViewport(graph, focusId, width, height);
};

const matchesSelection = (
  edge: EdgeData,
  selection: NonNullable<GraphSelection>
): boolean => {
  switch (selection.kind) {
    case 'edge':
      return (
        edge.id === selection.id ||
        (edge.data?.members as KnowledgeGraphEdge[] | undefined)?.some(
          (member) => member.id === selection.id
        ) === true
      );
    case 'category':
      return edge.data?.category === selection.category;
    case 'node':
      return edge.source === selection.id || edge.target === selection.id;
  }
};

const isEdgeLabelVisible = (
  mode: KnowledgeGraphLabelMode,
  edge: EdgeData,
  context: { direct: boolean; selected: boolean; groupSelected: boolean }
) => {
  if (mode === 'all') {
    return true;
  }
  if (mode === 'none') {
    return false;
  }
  if (edge.data?.presentationOnly && context.groupSelected) {
    return false;
  }

  return context.direct || context.selected;
};
const selectionSurvives = (
  selection: GraphSelection,
  nodes: NodeData[],
  edges: EdgeData[]
): boolean => {
  if (selection?.kind === 'node') {
    return Boolean(displayedNodeId(nodes, selection.id));
  }
  if (selection?.kind === 'edge') {
    return edges.some((edge) => matchesSelection(edge, selection));
  }

  return true;
};

const retainSelection = async (
  graph: Graph,
  selection: GraphSelection,
  previousNodes: NodeData[],
  nodes: NodeData[],
  edges: EdgeData[],
  focusId: string,
  onSelectionChange: (selection: GraphSelection) => void
) => {
  if (!selectionSurvives(selection, nodes, edges)) {
    onSelectionChange(null);
    if (nodes.some((node) => node.id === focusId)) {
      await graph.focusElement(focusId, false);
    }
  } else if (selection?.kind === 'node') {
    const id = displayedNodeId(nodes, selection.id);
    if (id && id !== displayedNodeId(previousNodes, selection.id)) {
      await graph.focusElement(id, false);
    }
  }
};

const configureParallelEdges = (
  graph: Graph,
  edges: EdgeData[],
  layout: KnowledgeGraphLayout
) => {
  if (layout === 'lanes') {
    graph.setTransforms([]);

    return;
  }
  const counts = new Map<string, number>();
  const key = (edge: EdgeData) =>
    JSON.stringify([edge.source, edge.target].sort());
  edges.forEach((edge) =>
    counts.set(key(edge), (counts.get(key(edge)) ?? 0) + 1)
  );
  const parallel = edges
    .filter((edge) => (counts.get(key(edge)) ?? 0) > 1)
    .map((edge) => String(edge.id));
  graph.setTransforms(
    parallel.length
      ? [
          {
            type: 'process-parallel-edges',
            mode: 'bundle',
            distance: 32,
            edges: parallel,
          },
        ]
      : []
  );
};

const focusPendingNode = async (
  graph: Graph,
  nodes: NodeData[],
  pending: { current: string | null },
  container: HTMLDivElement | null
) => {
  if (!pending.current || !nodes.some((node) => node.id === pending.current)) {
    return;
  }
  const id = pending.current;
  pending.current = null;
  await graph.focusElement(id, false);
  container
    ?.querySelector<HTMLButtonElement>(`[data-node-id="${CSS.escape(id)}"]`)
    ?.focus({ preventScroll: true });
};

interface CanvasOptions {
  data: GraphData | null;
  unfiltered: GraphData | null;
  entityId: string;
  entityType: string;
  layout: KnowledgeGraphLayout;
  mode: KnowledgeGraphMode;
  labelMode: KnowledgeGraphLabelMode;
  selection: GraphSelection;
  /**
   * Identifies the scope being viewed (level, mode, presentation, families,
   * expanded groups). The viewport is re-fitted when the graph is next drawn
   * for a new key, so every level opens framed rather than inheriting the
   * previous level's zoom and pan.
   */
  fitKey: string;
  /** Identifies the pane the graph lives in; a change re-fits once the pane has resized. */
  viewportKey: string;
  onSelectionChange: (selection: GraphSelection) => void;
  onExpandGroup?: (id: string) => void;
}

const getWorldRings = (
  layout: KnowledgeGraphLayout,
  nodes: NodeData[],
  focusId: string
): GraphLevelRing[] => {
  if (layout === 'radial') {
    return getGraphLevelRings(nodes, focusId);
  }
  if (layout !== 'lanes') {
    return [];
  }

  return getLaneLevelBands(nodes);
};
const edgeLabel = (edge: EdgeData) => {
  const members = edge.data?.members as unknown[] | undefined;

  return (
    String(edge.data?.label ?? '') +
    (members && members.length > 1 ? ' ×' + members.length : '')
  );
};

export const useKnowledgeGraphCanvas = (options: CanvasOptions) => {
  const { theme, brandColors } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const hoverRef = useRef<GraphSelection>(null);
  const [hover, setHover] = useState<GraphSelection>(null);
  const [tooltip, setTooltip] = useState<EdgeTooltipState | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [rings, setRings] = useState<GraphLevelRing[]>([]);
  const [zoom, setZoom] = useState(1);
  const worldRings = useRef<GraphLevelRing[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const drawn = useRef(false);
  const fittedKey = useRef<string | null>(null);
  const refitOnResize = useRef(false);
  const positionedSnapshot = useRef<{
    data: GraphData;
    layout: KnowledgeGraphLayout;
    positioned: Awaited<ReturnType<typeof applyGraphLayout>>;
  } | null>(null);
  const entityKey = JSON.stringify([options.entityType, options.entityId]);

  const updateRings = useCallback(() => {
    const graph = graphRef.current;
    if (!graph || graph.destroyed || !drawn.current) {
      return;
    }
    const zoom = graph.getZoom();
    setZoom(zoom);
    setRings(
      worldRings.current.map((ring) => {
        const [x, y] = graph.getViewportByCanvas([ring.x, ring.y]);

        return {
          ...ring,
          x,
          y,
          radiusX: ring.radiusX * zoom,
          radiusY: ring.radiusY * zoom,
        };
      })
    );
  }, []);

  const fit = useCallback(() => {
    const graph = graphRef.current;
    if (graph && drawn.current && !graph.destroyed) {
      const focusId = resolveFocusNodeId(
        graph.getNodeData(),
        latest.current.entityId
      );
      queue.current = queue.current
        .catch(() => undefined)
        .then(() => fitViewport(graph, focusId, containerRef.current))
        .catch(setError);
    }
  }, []);

  const selectNode = useCallback((id: string) => {
    const graph = graphRef.current;
    latest.current.onSelectionChange({ kind: 'node', id });
    if (!graph?.getNodeData().some((node) => node.id === id)) {
      pendingFocus.current = id;

      return;
    }
    if (graph && drawn.current && !graph.destroyed) {
      void graph
        .focusElement(id, false)
        .then(() => {
          containerRef.current
            ?.querySelector<HTMLButtonElement>(
              `[data-node-id="${CSS.escape(id)}"]`
            )
            ?.focus({ preventScroll: true });
        })
        .catch(setError);
    }
  }, []);

  const renderNode = useCallback(
    (data: NodeData) => (
      <CustomNode
        nodeData={data}
        nodeRenderKey={getNodeRenderKey(data)}
        onBlur={() => {
          hoverRef.current = null;
          setHover(null);
        }}
        onExpand={() => latest.current.onExpandGroup?.(data.id)}
        onFocus={() => {
          const target: GraphSelection = { kind: 'node', id: data.id };
          hoverRef.current = target;
          setHover(target);
          const graph = graphRef.current;
          if (graph && drawn.current && !graph.destroyed) {
            void graph.focusElement(data.id, false).catch(setError);
          }
        }}
        onSelect={(keyboard) => {
          latest.current.onSelectionChange({ kind: 'node', id: data.id });
          if (keyboard) {
            requestAnimationFrame(() =>
              containerRef.current
                ?.closest('.knowledge-graph-container')
                ?.querySelector<HTMLElement>(
                  '[data-testid="graph-inspector"] h3'
                )
                ?.focus()
            );
          }
        }}
      />
    ),
    []
  );

  const applyAppearance = useCallback((graph: Graph) => {
    const current = latest.current;
    const nodes = graph.getNodeData();
    const focus = displayedSelection(
      nodes,
      hoverRef.current ?? current.selection
    );
    const edges = graph.getEdgeData();
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    const rootId = resolveFocusNodeId(nodes, current.entityId);
    const groupSelected =
      focus?.kind === 'node' &&
      Boolean(
        (
          nodes.find((node) => node.id === focus.id)?.data?.presentation as
            | GraphNodePresentation
            | undefined
        )?.members
      );
    if (focus) {
      edges.forEach((edge) => {
        const matches = matchesSelection(edge, focus);
        if (matches) {
          nodeIds.add(edge.source);
          nodeIds.add(edge.target);
          edgeIds.add(String(edge.id));
        }
      });
      if (focus.kind === 'node') {
        nodeIds.add(focus.id);
        const adjacency = new Map<string, { node: string; edge: string }[]>();
        nodes.forEach((node) => adjacency.set(node.id, []));
        edges.forEach((edge) => {
          adjacency
            .get(edge.source)
            ?.push({ node: edge.target, edge: String(edge.id) });
          adjacency
            .get(edge.target)
            ?.push({ node: edge.source, edge: String(edge.id) });
        });
        const parents = new Map<string, { node: string; edge: string }>();
        const visited = new Set([rootId]);
        const pending = [rootId];
        for (
          let index = 0;
          index < pending.length && !visited.has(focus.id);
          index++
        ) {
          const from = pending[index];
          adjacency.get(from)?.forEach(({ node, edge }) => {
            if (!visited.has(node)) {
              visited.add(node);
              parents.set(node, { node: from, edge });
              pending.push(node);
            }
          });
        }
        let cursor = focus.id;
        let parent = parents.get(cursor);
        while (parent) {
          nodeIds.add(cursor);
          nodeIds.add(parent.node);
          edgeIds.add(parent.edge);
          cursor = parent.node;
          parent = parents.get(cursor);
        }
      }
    }
    const nodeMap = new Map<string, NodeData>(
      nodes.map((node) => {
        const color = getColorSetForType(String(node.data?.type));

        return [
          node.id,
          {
            ...node,
            data: {
              ...node.data,
              colorMain: color.main,
              colorLight: color.light,
            },
          },
        ];
      })
    );
    graph.updateNodeData(
      nodes.map((node) =>
        buildNodeUpdateData(
          node.id,
          nodeMap,
          nodeIds.has(node.id) || node.id === rootId,
          Boolean(focus) &&
            !groupSelected &&
            !nodeIds.has(node.id) &&
            node.id !== rootId
        )
      )
    );
    graph.updateEdgeData(
      edges.map((edge) => {
        const category = (edge.data?.category ?? 'other') as RelationCategory;
        const label = edgeLabel(edge);
        const direct =
          Number(nodeMap.get(edge.source)?.data?.level) < 3 &&
          Number(nodeMap.get(edge.target)?.data?.level) < 3;
        const show = isEdgeLabelVisible(current.labelMode, edge, {
          direct,
          selected: edgeIds.has(String(edge.id)),
          groupSelected,
        });
        let style = buildEdgeBaseStyle(category, label, show);
        if (edgeIds.has(String(edge.id))) {
          style = buildEdgeHighlightStyle(category, label, show);
        } else if (focus && !groupSelected) {
          style = {
            ...style,
            ...buildEdgeDimStyle(category),
            labelText: current.labelMode === 'all' ? label : '',
          };
        }

        return {
          id: String(edge.id),
          style: {
            ...style,
            ...getContextEdgeStyle(
              edge,
              nodeMap,
              current.layout,
              Boolean(focus),
              style.lineWidth
            ),
            endArrow: !edge.data?.derivation,
            labelAutoRotate: false,
          },
        };
      })
    );
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    setReady(false);
    setError(null);
    setTooltip(null);
    setHover(null);
    hoverRef.current = null;
    drawn.current = false;
    positionedSnapshot.current = null;
    worldRings.current = [];
    setRings([]);
    // G6 otherwise adds inline relative positioning, making the canvas size its parent.
    container.style.position = 'absolute';
    const graph = new Graph({
      container,
      width: container.parentElement?.clientWidth || 800,
      height: container.parentElement?.clientHeight || 600,
      animation: false,
      padding: 40,
      zoomRange: ZOOM_RANGE,
      data: { nodes: [], edges: [] },
      behaviors: [
        'drag-canvas',
        'zoom-canvas',
        {
          type: 'auto-adapt-label',
          key: 'labels',
          padding: 8,
          enable: () => latest.current.labelMode === 'auto',
          // The edge-only sorter reads operands in model order instead of comparator order.
          sort: (left: ElementDatum, right: ElementDatum) => {
            const selected = hoverRef.current ?? latest.current.selection;
            const priority = (edge: ElementDatum) => {
              if (
                !selected ||
                !('source' in edge) ||
                !matchesSelection(edge as EdgeData, selected)
              ) {
                return 2;
              }

              return selected.kind === 'edge' ? 0 : 1;
            };

            const memberCount = (edge: ElementDatum) =>
              (edge.data?.members as KnowledgeGraphEdge[] | undefined)
                ?.length ?? 0;

            return Math.sign(
              priority(left) - priority(right) ||
                memberCount(right) - memberCount(left)
            ) as -1 | 0 | 1;
          },
        },
      ],
      node: { type: 'react-node', style: { component: renderNode } },
      edge: {
        style: {
          endArrow: (edge: EdgeData) => !edge.data?.derivation,
          labelFontFamily: getComputedStyle(container).fontFamily,
          labelBackgroundPadding: [3, 6],
          labelAutoRotate: false,
        },
      },
    });
    graphRef.current = graph;
    const nodeHover = (event: IElementEvent) => {
      hoverRef.current = { kind: 'node', id: event.target.id };
      setHover(hoverRef.current);
    };
    const leave = () => {
      hoverRef.current = null;
      setHover(null);
      setTooltip(null);
    };
    container.addEventListener('pointerleave', leave);
    graph.on('node:pointerover', nodeHover);
    graph.on('node:pointerleave', leave);
    graph.on('node:click', (event: IElementEvent) =>
      latest.current.onSelectionChange({ kind: 'node', id: event.target.id })
    );
    graph.on('edge:click', (event: IElementEvent) => {
      const edge = graph.getEdgeData(event.target.id);
      const original = edge?.data?.presentationOnly
        ? (edge.data.members as KnowledgeGraphEdge[] | undefined)?.[0]
        : undefined;
      latest.current.onSelectionChange({
        kind: 'edge',
        id: original?.id ?? event.target.id,
      });
    });
    graph.on('edge:pointerover', (event: IElementEvent) => {
      const edge = graph.getEdgeData(event.target.id);
      if (!edge) {
        return;
      }
      hoverRef.current = { kind: 'edge', id: String(edge.id) };
      setHover(hoverRef.current);
      const labels = new Map(
        latest.current.data?.nodes.map((node) => [node.id, node.label])
      );
      setTooltip({
        edgeId: String(edge.id),
        x: event.client.x,
        y: event.client.y,
        sourceLabel: labels.get(edge.source) ?? edge.source,
        targetLabel: labels.get(edge.target) ?? edge.target,
        labels: [String(edge.data?.label ?? '')],
        derived: Boolean(edge.data?.derivation),
      });
    });
    graph.on('edge:pointerleave', leave);
    graph.on('canvas:click', () => {
      leave();
      latest.current.onSelectionChange(null);
    });
    graph.on('aftertransform', updateRings);
    let previousBounds = container.getBoundingClientRect();
    let previousWindow = [window.innerWidth, window.innerHeight];
    const resize = new ResizeObserver(() => {
      if (!graph.destroyed && drawn.current) {
        const parent = container.parentElement;
        if (refitOnResize.current) {
          refitOnResize.current = false;

          fit();

          return;
        }
        if (parent) {
          const anchor = graph.getViewportByCanvas([0, 0]);
          const bounds = container.getBoundingClientRect();
          const windowChanged =
            previousWindow[0] !== window.innerWidth ||
            previousWindow[1] !== window.innerHeight;
          const [width, height] = graph.getSize();
          const keepCenter = windowChanged || width !== parent.clientWidth;
          const offset = keepCenter
            ? [
                (parent.clientWidth - width) / 2,
                (parent.clientHeight - height) / 2,
              ]
            : [
                previousBounds.left - bounds.left,
                previousBounds.top - bounds.top,
              ];
          graph.resize(parent.clientWidth, parent.clientHeight);
          const resizedAnchor = graph.getViewportByCanvas([0, 0]);
          // Width changes keep the viewed center; toolbar changes keep the graph under the pointer.
          void graph
            .translateBy(
              [
                anchor[0] - resizedAnchor[0] + offset[0],
                anchor[1] - resizedAnchor[1] + offset[1],
              ],
              false
            )
            .then(() => {
              // A pane that shrank past the subject would otherwise show an
              // empty canvas; re-frame rather than leave the graph out of view.
              if (!isFocusInView(graph, latest.current.entityId)) {
                fit();
              }
            })
            .catch(setError);
          previousBounds = bounds;
          previousWindow = [window.innerWidth, window.innerHeight];
        }
        updateRings();
      }
    });
    resize.observe(container.parentElement ?? container);
    const onWheel = (event: WheelEvent) => {
      const nativeCanvas = container.querySelector('canvas');
      if (
        event.target instanceof HTMLCanvasElement ||
        !nativeCanvas ||
        !drawn.current
      ) {
        return;
      }
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      graph.emit('wheel', {
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        viewport: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      });
    };
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      resize.disconnect();
      container.removeEventListener('pointerleave', leave);
      container.removeEventListener('wheel', onWheel);
      graph.destroy();
      if (graphRef.current === graph) {
        graphRef.current = null;
      }
    };
  }, [entityKey, renderNode, updateRings, fit]);

  useEffect(() => {
    // The pane changes size after this effect runs; the ResizeObserver
    // performs the fit once the new size is known.
    refitOnResize.current = drawn.current;
  }, [options.viewportKey]);

  const getPositions = useCallback(
    async (
      unfiltered: GraphData,
      layout: KnowledgeGraphLayout,
      entityId: string
    ) => {
      const cached = positionedSnapshot.current;
      if (cached?.data === unfiltered && cached.layout === layout) {
        return cached.positioned;
      }
      const all = transformToG6Format(unfiltered);

      return applyGraphLayout(all, {
        layout,
        focusNodeId: resolveFocusNodeId(all.nodes ?? [], entityId),
        width: 0,
        height: 0,
        hasEntity: true,
      });
    },
    []
  );
  const { data, unfiltered, layout, entityId } = options;

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !data || !unfiltered) {
      return;
    }
    let cancelled = false;
    const isCancelled = () => cancelled || graph.destroyed;
    const update = async () => {
      if (isCancelled()) {
        return;
      }
      const positioned = await getPositions(unfiltered, layout, entityId);
      const focusId = resolveFocusNodeId(positioned.nodes ?? [], entityId);
      if (isCancelled()) {
        return;
      }
      positionedSnapshot.current = { data: unfiltered, layout, positioned };
      const filtered = projectGraphToPositions(data, positioned);
      const { nodes, edges } = filtered;
      const previousNodes = graph.getNodeData();
      configureParallelEdges(graph, edges, layout);
      graph.setData(filtered);
      applyAppearance(graph);
      const firstDraw = !drawn.current;
      if (firstDraw) {
        await graph.render();
        containerRef.current?.querySelectorAll('canvas').forEach((canvas) => {
          canvas.tabIndex = -1;
          canvas.setAttribute('aria-hidden', 'true');
        });
      } else {
        await graph.draw();
      }
      if (isCancelled()) {
        return;
      }
      drawn.current = true;
      worldRings.current = getWorldRings(
        layout,
        nodesForRings(positioned),
        focusId
      );
      const fitKey = latest.current.fitKey;
      if ((firstDraw || fittedKey.current !== fitKey) && nodes.length > 0) {
        await fitViewport(graph, focusId, containerRef.current);
        fittedKey.current = fitKey;
      }
      await retainSelection(
        graph,
        latest.current.selection,
        previousNodes,
        nodes,
        edges,
        focusId,
        latest.current.onSelectionChange
      );
      await focusPendingNode(graph, nodes, pendingFocus, containerRef.current);
      setReady(true);
      setError(null);
      updateRings();
    };
    queue.current = queue.current
      .catch(() => undefined)
      .then(update)
      .catch((failure: unknown) => {
        if (!cancelled && !graph.destroyed) {
          setError(failure);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    data,
    unfiltered,
    layout,
    entityId,
    getPositions,
    entityKey,
    applyAppearance,
    updateRings,
  ]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !drawn.current) {
      return;
    }
    queue.current = queue.current
      .catch(() => undefined)
      .then(async () => {
        if (graph.destroyed) {
          return;
        }
        applyAppearance(graph);
        await graph.draw();
      })
      .catch(setError);
  }, [
    options.labelMode,
    options.selection,
    hover,
    theme,
    brandColors,
    applyAppearance,
  ]);

  return {
    containerRef,
    graphRef,
    ready,
    error,
    rings,
    tooltip,
    selectNode,
    fit,
    zoom,
  };
};
