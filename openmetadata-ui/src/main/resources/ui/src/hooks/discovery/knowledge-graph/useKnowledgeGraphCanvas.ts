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
import { Graph } from '@antv/g6';
import {
  ComponentType,
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ZOOM_RANGE } from '../../../constants/discovery/knowledge-graph.constants';
import { useTheme } from '../../../context/UntitledUIThemeProvider/theme-provider';
import {
  CustomNodeProps,
  EdgeTooltipState,
  GraphData,
  KnowledgeGraphLabelMode,
  KnowledgeGraphLayout,
  KnowledgeGraphMode,
} from '../../../interface/discovery/knowledge-graph.interface';
import {
  applyGraphLayout,
  projectGraphToPositions,
  resolveFocusNodeId,
  transformToG6Format,
} from '../../../utils/discovery/knowledge-graph/knowledge-graph.utils';
import { ensureG6NodeRegistered } from './ensureG6NodeRegistered';
import type { GraphSelection } from './KnowledgeGraphCanvas.utils';
import {
  computeAppearance,
  configureParallelEdges,
  fitViewport,
  focusPendingNode,
  getWorldRings,
  matchesSelection,
  nodesForRings,
  readEdgeData,
  readMembers,
  retainSelection,
} from './KnowledgeGraphCanvas.utils';
import KnowledgeGraphNode from './KnowledgeGraphNode';
import { attachCanvasResize } from './useCanvasResize';
import { useCanvasRings } from './useCanvasRings';
import { useCanvasSelection } from './useCanvasSelection';
import { createCanvasWheelHandler } from './useCanvasWheel';

export type { GraphSelection } from './KnowledgeGraphCanvas.utils';

/**
 * Explicit lifecycle for the G6 graph. `queue.current` still serialises async
 * render/draw calls, but readiness is a state, not a boolean the effect
 * flipped ad-hoc.
 */
export type CanvasStatus =
  | 'idle'
  | 'creating'
  | 'rendering'
  | 'ready'
  | 'destroying'
  | 'error';

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
  /** Renders one graph node. Injected so this hook stays below the component layer. */
  NodeComponent: ComponentType<CustomNodeProps>;
}

interface UseKnowledgeGraphCanvasResult {
  containerRef: React.RefObject<HTMLDivElement>;
  ready: boolean;
  status: CanvasStatus;
  error: unknown;
  rings: ReturnType<typeof useCanvasRings>['rings'];
  tooltip: EdgeTooltipState | null;
  zoom: number;
  viewportOrigin: string;
  selectNode: (id: string) => void;
  fit: () => void;
  zoomBy: (factor: number) => void;
}

export const useKnowledgeGraphCanvas = (
  options: CanvasOptions
): UseKnowledgeGraphCanvasResult => {
  const { theme, brandColors } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const { hover, hoverRef, setHover, clearHover } = useCanvasSelection();
  const [tooltip, setTooltip] = useState<EdgeTooltipState | null>(null);
  const [status, setStatus] = useState<CanvasStatus>('idle');
  const [error, setError] = useState<unknown>(null);
  const drawn = useRef(false);
  const isDrawn = useCallback(() => drawn.current, []);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const fittedKey = useRef<string | null>(null);
  const refitOnResize = useRef(false);
  const positionedSnapshot = useRef<{
    data: GraphData;
    layout: KnowledgeGraphLayout;
    positioned: Awaited<ReturnType<typeof applyGraphLayout>>;
  } | null>(null);
  const entityKey = JSON.stringify([options.entityType, options.entityId]);

  const setErrorState = useCallback((failure: unknown) => {
    setError(failure);
    setStatus('error');
  }, []);

  const { rings, zoom, viewportOrigin, worldRings, updateRings } =
    useCanvasRings({ graphRef, isDrawn });

  const clearTooltip = useCallback(() => setTooltip(null), []);
  const clearAll = useCallback(() => {
    clearHover();
    clearTooltip();
  }, [clearHover, clearTooltip]);

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
        .catch(setErrorState);
    }
  }, [setErrorState]);

  const zoomBy = useCallback(
    (factor: number) => {
      const graph = graphRef.current;
      if (graph && drawn.current && !graph.destroyed) {
        void graph.zoomTo(graph.getZoom() * factor, false).catch(setErrorState);
      }
    },
    [setErrorState]
  );

  const selectNode = useCallback(
    (id: string) => {
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
          .catch(setErrorState);
      }
    },
    [setErrorState]
  );

  const renderNode = useCallback(
    (data: NodeData) =>
      createElement(KnowledgeGraphNode, {
        Component: latest.current.NodeComponent,
        nodeData: data,
        onExpand: (id: string) => latest.current.onExpandGroup?.(id),
        onHoverEnd: () => clearHover(),
        onHoverStart: (id: string) => {
          setHover({ kind: 'node', id });
          const graph = graphRef.current;
          if (graph && drawn.current && !graph.destroyed) {
            void graph.focusElement(id, false).catch(setErrorState);
          }
        },
        onSelect: (id: string, keyboard: boolean) => {
          latest.current.onSelectionChange({ kind: 'node', id });
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
        },
      }),
    [clearHover, setHover, setErrorState]
  );

  const applyAppearance = useCallback(
    (graph: Graph) => {
      const current = latest.current;
      const { nodeUpdates, edgeUpdates } = computeAppearance(
        graph.getNodeData(),
        graph.getEdgeData(),
        {
          labelMode: current.labelMode,
          layout: current.layout,
          entityId: current.entityId,
          focus: hoverRef.current ?? current.selection,
        }
      );
      graph.updateNodeData(nodeUpdates);
      graph.updateEdgeData(edgeUpdates);
    },
    [hoverRef]
  );

  useEffect(() => {
    ensureG6NodeRegistered();
    const container = containerRef.current;
    if (!container) {
      return;
    }
    setStatus('creating');
    setError(null);
    clearAll();
    drawn.current = false;
    positionedSnapshot.current = null;
    worldRings.current = [];
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
            const isEdge = (datum: ElementDatum): datum is EdgeData =>
              'source' in datum && 'target' in datum;
            const asEdge = (datum: ElementDatum): EdgeData | null =>
              isEdge(datum) ? datum : null;
            const priority = (datum: ElementDatum) => {
              const edge = asEdge(datum);
              if (!selected || !edge || !matchesSelection(edge, selected)) {
                return 2;
              }

              return selected.kind === 'edge' ? 0 : 1;
            };
            const memberCount = (datum: ElementDatum) => {
              const edge = asEdge(datum);

              return edge ? readMembers(edge)?.length ?? 0 : 0;
            };
            const sign = Math.sign(
              priority(left) - priority(right) ||
                memberCount(right) - memberCount(left)
            );
            if (sign < 0) {
              return -1;
            }

            return sign > 0 ? 1 : 0;
          },
        },
      ],
      node: { type: 'react-node', style: { component: renderNode } },
      edge: {
        style: {
          endArrow: (edge: EdgeData) => !readEdgeData(edge)?.derivation,
          labelFontFamily: getComputedStyle(container).fontFamily,
          labelBackgroundPadding: [3, 6],
          labelAutoRotate: false,
        },
      },
    });
    graphRef.current = graph;
    const nodeHover = (event: IElementEvent) =>
      setHover({ kind: 'node', id: event.target.id });
    const leave = () => {
      clearHover();
      clearTooltip();
    };
    container.addEventListener('pointerleave', leave);
    graph.on('node:pointerover', nodeHover);
    graph.on('node:pointerleave', leave);
    graph.on('node:click', (event: IElementEvent) =>
      latest.current.onSelectionChange({ kind: 'node', id: event.target.id })
    );
    graph.on('edge:click', (event: IElementEvent) => {
      const edge = graph.getEdgeData(event.target.id);
      const original = readEdgeData(edge)?.presentationOnly
        ? readMembers(edge)?.[0]
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
      setHover({ kind: 'edge', id: String(edge.id) });
      const labels = new Map(
        latest.current.data?.nodes.map((node) => [node.id, node.label])
      );
      setTooltip({
        edgeId: String(edge.id),
        x: event.client.x,
        y: event.client.y,
        sourceLabel: labels.get(edge.source) ?? edge.source,
        targetLabel: labels.get(edge.target) ?? edge.target,
        labels: [String(readEdgeData(edge)?.label ?? '')],
        derived: Boolean(readEdgeData(edge)?.derivation),
      });
    });
    graph.on('edge:pointerleave', leave);
    graph.on('canvas:click', () => {
      leave();
      latest.current.onSelectionChange(null);
    });
    graph.on('aftertransform', updateRings);
    const disposeResize = attachCanvasResize({
      container,
      graph,
      isDrawn,
      refitOnResize,
      onFit: fit,
      onUpdateRings: updateRings,
      onError: setErrorState,
      getEntityId: () => latest.current.entityId,
    });
    const onWheel = createCanvasWheelHandler(container, graph, isDrawn);
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      setStatus('destroying');
      disposeResize();
      container.removeEventListener('pointerleave', leave);
      container.removeEventListener('wheel', onWheel);
      graph.destroy();
      if (graphRef.current === graph) {
        graphRef.current = null;
      }
      setStatus('idle');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityKey, renderNode, updateRings, fit, setErrorState]);

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
      setStatus('rendering');
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
      setError(null);
      setStatus('ready');
      updateRings();
    };
    queue.current = queue.current
      .catch(() => undefined)
      .then(update)
      .catch((failure: unknown) => {
        if (!cancelled && !graph.destroyed) {
          setErrorState(failure);
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
    worldRings,
    setErrorState,
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
      .catch(setErrorState);
  }, [
    options.labelMode,
    options.selection,
    hover,
    theme,
    brandColors,
    applyAppearance,
    setErrorState,
  ]);

  return {
    containerRef,
    ready: status === 'ready',
    status,
    error,
    rings,
    tooltip,
    zoom,
    viewportOrigin,
    selectNode,
    fit,
    zoomBy,
  };
};
