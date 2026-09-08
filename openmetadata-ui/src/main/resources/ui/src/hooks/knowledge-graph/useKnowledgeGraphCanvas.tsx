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

import {
  EdgeData,
  ExtensionCategory,
  Graph,
  IElementEvent,
  NodeData,
  register,
} from '@antv/g6';
import { ReactNode as AntVReactNode } from '@antv/g6-extension-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import CustomNode from '../../components/KnowledgeGraph/GraphElements/CustomNode';
import {
  EdgeTooltipState,
  GraphData,
  GraphLevelRing,
  KnowledgeGraphLabelMode,
  KnowledgeGraphLayout,
} from '../../components/KnowledgeGraph/KnowledgeGraph.interface';
import { RelationCategory } from '../../components/KnowledgeGraph/KnowledgeGraph.relations';
import { useTheme } from '../../context/UntitledUIThemeProvider/theme-provider';
import {
  applyGraphLayout,
  buildEdgeBaseStyle,
  buildEdgeDimStyle,
  buildEdgeHighlightStyle,
  buildNodeUpdateData,
  getColorSetForType,
  getGraphLevelRings,
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

const matchesSelection = (
  edge: EdgeData,
  selection: NonNullable<GraphSelection>
): boolean => {
  switch (selection.kind) {
    case 'edge':
      return edge.id === selection.id;
    case 'category':
      return edge.data?.category === selection.category;
    case 'node':
      return edge.source === selection.id || edge.target === selection.id;
  }
};
const selectionSurvives = (
  selection: GraphSelection,
  nodes: NodeData[],
  edges: EdgeData[]
): boolean => {
  if (selection?.kind === 'node') {
    return nodes.some((node) => node.id === selection.id);
  }
  if (selection?.kind === 'edge') {
    return edges.some((edge) => edge.id === selection.id);
  }

  return true;
};

interface CanvasOptions {
  data: GraphData | null;
  unfiltered: GraphData | null;
  entityId: string;
  entityType: string;
  layout: KnowledgeGraphLayout;
  labelMode: KnowledgeGraphLabelMode;
  selection: GraphSelection;
  onSelectionChange: (selection: GraphSelection) => void;
}

export const useKnowledgeGraphCanvas = (options: CanvasOptions) => {
  const { theme, brandColors } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const hoverRef = useRef<GraphSelection>(null);
  const [hover, setHover] = useState<GraphSelection>(null);
  const [tooltip, setTooltip] = useState<EdgeTooltipState | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [rings, setRings] = useState<GraphLevelRing[]>([]);
  const worldRings = useRef<GraphLevelRing[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const drawn = useRef(false);
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

  const selectNode = useCallback((id: string) => {
    const graph = graphRef.current;
    latest.current.onSelectionChange({ kind: 'node', id });
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
              containerRef.current?.parentElement
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
    const focus = hoverRef.current ?? current.selection;
    const nodes = graph.getNodeData();
    const edges = graph.getEdgeData();
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    const rootId = resolveFocusNodeId(nodes, current.entityId);
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
    const nodeMap = new Map(
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
          Boolean(focus) && !nodeIds.has(node.id) && node.id !== rootId
        )
      )
    );
    graph.updateEdgeData(
      edges.map((edge) => {
        const category = (edge.data?.category ?? 'other') as RelationCategory;
        const label = String(edge.data?.label ?? '');
        const show = current.labelMode !== 'none';
        let style = buildEdgeBaseStyle(category, label, show);
        if (edgeIds.has(String(edge.id))) {
          style = buildEdgeHighlightStyle(category, label, show);
        } else if (focus) {
          style = {
            ...style,
            ...buildEdgeDimStyle(category),
            labelText: current.labelMode === 'all' ? label : '',
          };
        }

        return {
          id: String(edge.id),
          style: { ...style, labelAutoRotate: false },
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
    const graph = new Graph({
      container,
      width: container.parentElement?.clientWidth || 800,
      height: container.parentElement?.clientHeight || 600,
      animation: false,
      data: { nodes: [], edges: [] },
      behaviors: [
        'drag-canvas',
        'zoom-canvas',
        {
          type: 'auto-adapt-label',
          key: 'labels',
          padding: 8,
          enable: () => latest.current.labelMode === 'auto',
          sortEdge: (left: EdgeData, right: EdgeData) => {
            const selected = hoverRef.current ?? latest.current.selection;
            const priority = (edge: EdgeData) => {
              if (!selected || !matchesSelection(edge, selected)) {
                return 2;
              }

              return selected.kind === 'edge' ? 0 : 1;
            };

            return Math.sign(priority(left) - priority(right)) as -1 | 0 | 1;
          },
        },
      ],
      transforms: [
        { type: 'process-parallel-edges', mode: 'bundle', distance: 24 },
      ],
      node: { type: 'react-node', style: { component: renderNode } },
      edge: {
        style: {
          endArrow: true,
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
    graph.on('node:pointerover', nodeHover);
    graph.on('node:pointerleave', leave);
    graph.on('node:click', (event: IElementEvent) =>
      latest.current.onSelectionChange({ kind: 'node', id: event.target.id })
    );
    graph.on('edge:click', (event: IElementEvent) =>
      latest.current.onSelectionChange({ kind: 'edge', id: event.target.id })
    );
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
      });
    });
    graph.on('edge:pointerleave', leave);
    graph.on('canvas:click', () => {
      leave();
      latest.current.onSelectionChange(null);
    });
    graph.on('aftertransform', updateRings);
    const resize = new ResizeObserver(() => {
      if (!graph.destroyed) {
        const parent = container.parentElement;
        if (parent) {
          const [width, height] = graph.getSize();
          graph.resize(parent.clientWidth, parent.clientHeight);
          if (drawn.current) {
            void graph
              .translateBy(
                [
                  (parent.clientWidth - width) / 2,
                  (parent.clientHeight - height) / 2,
                ],
                false
              )
              .catch(setError);
          }
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
      container.removeEventListener('wheel', onWheel);
      graph.destroy();
      if (graphRef.current === graph) {
        graphRef.current = null;
      }
    };
  }, [entityKey, renderNode, updateRings]);

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
      worldRings.current =
        layout === 'radial'
          ? getGraphLevelRings(nodesForRings(positioned), focusId)
          : [];
      if (firstDraw && nodes.length > 0) {
        await graph.fitView();
        await graph.zoomTo(Math.min(1, Math.max(0.85, graph.getZoom())), false);
        await graph.focusElement(focusId, false);
      }
      if (!selectionSurvives(latest.current.selection, nodes, edges)) {
        latest.current.onSelectionChange(null);
      }
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

  return { containerRef, graphRef, ready, error, rings, tooltip, selectNode };
};
