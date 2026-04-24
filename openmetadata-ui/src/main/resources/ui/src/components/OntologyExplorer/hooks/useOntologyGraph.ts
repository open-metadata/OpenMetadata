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
  CanvasEvent,
  ComboData,
  Graph,
  GraphData,
  GraphEvent,
  IElementEvent,
  NodeData,
  NodeEvent,
} from '@antv/g6';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  BRAND_BLUE_FALLBACK,
  COMBO_COLOR_FALLBACK,
  COMBO_INTERIOR_PADDING_SIDES,
  COMBO_INTERIOR_PADDING_TOP,
  DATA_MODE_ASSET_LOAD_PAGE_SIZE,
  DATA_MODE_LOAD_MORE_BADGE_BG,
  DATA_MODE_TERM_ASSET_COUNT_BADGE_DIAMETER,
  DATA_MODE_TERM_ASSET_COUNT_BADGE_DIAMETER_WIDE,
  DATA_MODE_TERM_ASSET_COUNT_BADGE_PADDING,
  DATA_MODE_TERM_ASSET_COUNT_BADGE_WIDTH_CHAR,
  DATA_MODE_TERM_ASSET_COUNT_BADGE_WIDTH_MIN,
  DEFAULT_ZOOM,
  DIMMED_EDGE_OPACITY,
  DIMMED_NODE_OPACITY,
  EDGE_LINE_APPEND_WIDTH,
  EDGE_LINE_WIDTH_DEFAULT,
  EDGE_LINE_WIDTH_HIGHLIGHTED,
  EDGE_STROKE_COLOR,
  fitViewWithMinZoom,
  HIERARCHY_BADGE_OFFSET_Y,
  HIERARCHY_BADGE_TEXT_INSET,
  LayoutEngine,
  MAX_ZOOM,
  MIN_ZOOM,
  NODE_BADGE_OFFSET_X,
  NODE_BADGE_OFFSET_Y,
  NODE_BORDER_COLOR,
  NODE_BORDER_RADIUS,
  NODE_FILL_DEFAULT,
  NODE_LABEL_FILL,
  NODE_SELECTED_HALO_FILL,
  NODE_SELECTED_HALO_LINE_WIDTH,
  NODE_SELECTED_LINE_WIDTH,
  NODE_SELECTED_STROKE,
  PRACTICAL_MIN_ZOOM,
  type LayoutEngineType,
} from '../OntologyExplorer.constants';
import { GraphSettings, OntologyNode } from '../OntologyExplorer.interface';
import { getEntityIconUrl } from '../utils/entityIconUrls';
import {
  adaptiveSpacing,
  getLayoutConfig,
  NODE_HEIGHT,
  NODE_WIDTH,
} from '../utils/graphConfig';
import {
  buildComboStyle,
  buildDataModeAssetNodeStyle,
  buildDataModeTermNodeStyle,
  buildDefaultRectNodeStyle,
  getCanvasColor,
  truncateHierarchyBadgeToFitWidth,
} from '../utils/graphStyles';
import { computeAssetRingPositions } from '../utils/layoutCalculations';

/**
 * Starts a G6 layout and waits for it to actually finish.
 *
 * graph.layout() returns a Promise, but when enableWorker:true the promise
 * resolves when the worker *starts*, not when positions are ready. Listening
 * to the 'afterlayout' event is the only reliable way to know the worker has
 * written positions back to all nodes.
 */
const LAYOUT_TIMEOUT_MS = 15_000;

function runLayout(graph: Graph): Promise<void> {
  const layoutDone = new Promise<void>((resolve, reject) => {
    graph.once(GraphEvent.AFTER_LAYOUT, () => resolve());
    graph.layout().catch(reject);
  });
  const timeout = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error('layout timeout')), LAYOUT_TIMEOUT_MS)
  );

  return Promise.race([layoutDone, timeout]);
}

const toIdSet = <T extends { id?: string }>(elements: readonly T[]) =>
  new Set(
    elements.map(({ id }) => id).filter((id): id is string => Boolean(id))
  );

const sameStringSet = (a: Set<string>, b: Set<string>) => {
  if (a.size !== b.size) {
    return false;
  }
  for (const id of a) {
    if (!b.has(id)) {
      return false;
    }
  }

  return true;
};

function isGraphTopologySynced(graph: Graph, graphData: GraphData): boolean {
  const { nodes = [], edges = [], combos = [] } = graphData;

  if (!sameStringSet(toIdSet(nodes), toIdSet(graph.getNodeData()))) {
    return false;
  }

  if (!sameStringSet(toIdSet(edges), toIdSet(graph.getEdgeData()))) {
    return false;
  }

  const modelCombos = graph.getComboData();
  if (combos.length === 0) {
    return modelCombos.length === 0;
  }

  return sameStringSet(toIdSet(combos), toIdSet(modelCombos));
}

const findBadgeIndex = (originalTarget: unknown): number | null => {
  let current: unknown = originalTarget;
  for (let depth = 0; depth < 14; depth += 1) {
    if (!current || typeof current !== 'object') {
      return null;
    }
    const shape = current as {
      className?: string;
      name?: string;
      parent?: unknown;
    };
    const key = shape.className ?? shape.name;
    if (typeof key === 'string') {
      const match = /^badge-(\d+)$/.exec(key);
      if (match) {
        return Number(match[1]);
      }
    }
    current = shape.parent;
  }

  return null;
};

function isDataModeAssetBadgeShape(originalTarget: unknown): boolean {
  const idx = findBadgeIndex(originalTarget);

  return idx === 0;
}

function isDataModeLoadMoreBadgeShape(originalTarget: unknown): boolean {
  const idx = findBadgeIndex(originalTarget);

  return idx === 1;
}

function stripNodePositionsForDataMode<T extends { style?: unknown }>(
  nodes: T[]
): T[] {
  return nodes.map((node) => {
    const style = node.style as Record<string, unknown> | undefined;
    if (!style || (!('x' in style) && !('y' in style))) {
      return node;
    }
    const { x: _x, y: _y, ...restStyle } = style;

    return { ...node, style: restStyle };
  });
}

interface GraphNodeMeta {
  color?: string;
  assetColor?: string;
  label?: string;
  hierarchyBadge?: string;
  assetCount?: number;
  loadedAssetCount?: number;
  assetsExpanded?: boolean;
  isLoadingAssets?: boolean;
  ontologyNode?: OntologyNode;
  isDimmed?: boolean;
  isSelected?: boolean;
}

interface GraphEdgeMeta {
  isCrossTeam?: boolean;
  isHighlighted?: boolean;
  isClickedEdge?: boolean;
  isEdgeDimmed?: boolean;
  edgeColor?: string;
}

interface GraphComboMeta {
  color?: string;
  glossaryName?: string;
  isDimmed?: boolean;
}

interface UseOntologyGraphProps {
  containerRef: React.RefObject<HTMLDivElement>;
  graphData: GraphData;
  inputNodes: OntologyNode[];
  mergedEdgesList: Array<{ from: string; to: string; relationType: string }>;
  explorationMode: 'model' | 'data' | 'hierarchy';
  settings: GraphSettings;
  layoutType: LayoutEngineType;
  focusNodeId?: string | null;
  selectedNodeId?: string | null;
  expandedTermIds?: Set<string>;
  dataSignature?: string;
  onNodeClick: (
    node: OntologyNode,
    position: { x: number; y: number },
    meta?: {
      dataModeAssetBadgeClick?: boolean;
      dataModeLoadMoreBadgeClick?: boolean;
    }
  ) => void;
  onNodeDoubleClick: (node: OntologyNode) => void;
  onPaneClick: () => void;
  onScrollNearEdge?: () => void;
  setClickedEdgeId: (id: string | null) => void;
  neighborSet: Set<string>;
  glossaryColorMap: Record<string, string>;
  computeNodeColor: (node: OntologyNode) => string;
  assetToTermMap: Record<string, string[]>;
  onPositionsReady?: (
    positions: Record<string, { x: number; y: number }>
  ) => void;
}

export function useOntologyGraph({
  containerRef,
  graphData,
  inputNodes,
  mergedEdgesList,
  explorationMode,
  settings,
  layoutType,
  focusNodeId,
  selectedNodeId,
  expandedTermIds,
  dataSignature,
  onNodeClick,
  onNodeDoubleClick,
  onPaneClick,
  onScrollNearEdge,
  setClickedEdgeId,
  neighborSet,
  glossaryColorMap,
  computeNodeColor,
  assetToTermMap,
  onPositionsReady,
}: UseOntologyGraphProps) {
  const graphRef = useRef<Graph | null>(null);
  const settingsRef = useRef(settings);

  settingsRef.current = settings;

  const prevDataSignatureRef = useRef<string>('');
  const termFingerprintRef = useRef<string>('');
  const assetFingerprintRef = useRef<string>('');
  const justInitializedRef = useRef<boolean>(false);
  const prevLayoutTypeRef = useRef<typeof layoutType | null>(null);
  const cancelPendingUpdateRef = useRef<(() => void) | null>(null);
  const assetToTermMapRef = useRef(assetToTermMap);
  assetToTermMapRef.current = assetToTermMap;

  const setClickedEdgeIdRef = useRef(setClickedEdgeId);
  setClickedEdgeIdRef.current = setClickedEdgeId;

  const inputNodesRef = useRef(inputNodes);
  inputNodesRef.current = inputNodes;

  const expandedTermIdsRef = useRef(expandedTermIds);
  expandedTermIdsRef.current = expandedTermIds;

  const onScrollNearEdgeRef = useRef(onScrollNearEdge);
  onScrollNearEdgeRef.current = onScrollNearEdge;

  const onPositionsReadyRef = useRef(onPositionsReady);
  onPositionsReadyRef.current = onPositionsReady;

  // Cached graph bounds — recomputed only when node data changes, not on every
  // pan/zoom transform. Updated by recomputeGraphBounds() after data updates.
  const graphBoundsRef = useRef<{ maxX: number; maxY: number } | null>(null);

  const recomputeGraphBounds = useCallback(() => {
    const g = graphRef.current;
    if (!g) {
      return;
    }
    let maxX = -Infinity;
    let maxY = -Infinity;
    g.getNodeData().forEach((node) => {
      try {
        const pos = g.getElementPosition(String(node.id));
        if (pos) {
          if (pos[0] > maxX) {
            maxX = pos[0];
          }
          if (pos[1] > maxY) {
            maxY = pos[1];
          }
        }
      } catch {
        // Node not yet positioned
      }
    });
    graphBoundsRef.current = maxX === -Infinity ? null : { maxX, maxY };
  }, []);

  // Suppresses the edge-proximity API call during programmatic transforms
  // (zoom buttons, fit-to-screen). Only user-initiated pan/scroll should
  // trigger data fetching.
  const isProgrammaticTransformRef = useRef(false);
  const suppressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suppressEdgeCheck = useCallback((durationMs = 600) => {
    if (suppressTimeoutRef.current !== null) {
      clearTimeout(suppressTimeoutRef.current);
    }
    isProgrammaticTransformRef.current = true;
    suppressTimeoutRef.current = setTimeout(() => {
      isProgrammaticTransformRef.current = false;
      suppressTimeoutRef.current = null;
    }, durationMs);
  }, []);

  const extractNodePositions = useCallback((): Record<
    string,
    { x: number; y: number }
  > => {
    const graph = graphRef.current;
    if (!graph) {
      return {};
    }
    const positions: Record<string, { x: number; y: number }> = {};
    const getHalfSize = (rawSize: unknown, fallback: number) => {
      const sizeArr = Array.isArray(rawSize) ? rawSize : null;
      const size = sizeArr ? Number(sizeArr[0]) : Number(rawSize);

      return (Number.isFinite(size) ? size : fallback) / 2;
    };
    graph.getNodeData().forEach((node) => {
      const pos = graph.getElementPosition(node.id);
      if (pos && Array.isArray(pos)) {
        const rawSize = node.style?.size;
        const w = getHalfSize(rawSize, 200);
        const h = Array.isArray(rawSize)
          ? (Number(rawSize[1]) || 40) / 2
          : getHalfSize(rawSize, 40);
        positions[node.id] = { x: pos[0] - w, y: pos[1] - h };
      }
    });

    return positions;
  }, []);

  const emitPagePositions = useCallback((graph: Graph) => {
    const cb = onPositionsReadyRef.current;
    if (!cb) {
      return;
    }
    const pagePositions: Record<string, { x: number; y: number }> = {};
    graph.getNodeData().forEach((node) => {
      try {
        const canvasPos = graph.getElementPosition(node.id);
        const clientPos = graph.getClientByCanvas(canvasPos);
        pagePositions[node.id] = { x: clientPos[0], y: clientPos[1] };
      } catch {
        // Node may not be rendered yet; skip it.
      }
    });
    cb(pagePositions);
  }, []);

  const positionAssetNodes = useCallback((graph: Graph) => {
    const map = assetToTermMapRef.current;
    const updates: NodeData[] = [];
    const assignRingPositions = (
      anchorX: number,
      anchorY: number,
      assetIds: string[]
    ) => {
      const ringPositions = computeAssetRingPositions(
        anchorX,
        anchorY,
        assetIds
      );
      Object.entries(ringPositions).forEach(([assetId, pos]) => {
        const nodeData = graph.getNodeData(assetId);
        if (nodeData) {
          updates.push({
            id: assetId,
            style: { ...(nodeData.style ?? {}), x: pos.x, y: pos.y },
          });
        }
      });
    };

    const singleTermAssets = new Map<string, string[]>();
    const multiTermAssets = new Map<
      string,
      { termIds: string[]; assetIds: string[] }
    >();

    Object.entries(map).forEach(([assetId, connectedTermIds]) => {
      const uniqueTermIds = [...new Set(connectedTermIds)];
      if (uniqueTermIds.length <= 1) {
        const termId = uniqueTermIds[0];
        if (!termId) {
          return;
        }
        const assetIds = singleTermAssets.get(termId) ?? [];
        assetIds.push(assetId);
        singleTermAssets.set(termId, assetIds);

        return;
      }

      const sortedTermIds = [...uniqueTermIds].sort();
      const key = sortedTermIds.join('|');
      const group = multiTermAssets.get(key) ?? {
        termIds: sortedTermIds,
        assetIds: [],
      };
      group.assetIds.push(assetId);
      multiTermAssets.set(key, group);
    });

    singleTermAssets.forEach((assetIds, termId) => {
      try {
        const termPos = graph.getElementPosition(termId);
        if (!termPos) {
          return;
        }
        assignRingPositions(termPos[0], termPos[1], assetIds);
      } catch {
        // Term not yet in graph.
      }
    });

    multiTermAssets.forEach(({ termIds, assetIds }) => {
      try {
        const termPositions = termIds
          .map((termId) => graph.getElementPosition(termId))
          .filter((position): position is [number, number] =>
            Array.isArray(position)
          );
        if (termPositions.length === 0) {
          return;
        }

        const centerX =
          termPositions.reduce((sum, [x]) => sum + x, 0) / termPositions.length;
        const centerY =
          termPositions.reduce((sum, [, y]) => sum + y, 0) /
          termPositions.length;
        assignRingPositions(centerX, centerY, assetIds);
      } catch {
        // one or more terms are not yet in the graph
      }
    });

    if (updates.length > 0) {
      graph.updateNodeData(updates);
    }
  }, []);

  /**
   * Positions every node in model-view into a deterministic grid that
   * guarantees no overlapping — regardless of how many combos exist.
   *
   * Each combo's nodes are arranged in a small square grid inside their
   * glossary box. The combo boxes are then arranged in a larger square grid
   * across the canvas. No layout algorithm is needed, so there is no risk of
   * antv-dagre placing combos on top of each other.
   */
  const positionModelModeNodes = useCallback((graph: Graph) => {
    const combos = graph.getComboData();
    if (combos.length === 0) {
      return;
    }

    const NODE_H_SEP = 200;
    const NODE_V_SEP = 80;
    const COMBO_H_GAP = 160;
    const COMBO_V_GAP = 180;
    const GRID_COLS = Math.ceil(Math.sqrt(combos.length));

    const nodesByCombo = new Map<string, NodeData[]>();
    graph.getNodeData().forEach((node) => {
      const comboId =
        typeof node.combo === 'string' ? node.combo : String(node.combo ?? '');
      if (!comboId) {
        return;
      }
      if (!nodesByCombo.has(comboId)) {
        nodesByCombo.set(comboId, []);
      }
      nodesByCombo.get(comboId)!.push(node);
    });

    const updates: NodeData[] = [];
    let curX = 0;
    let curY = 0;
    let rowMaxH = 0;

    combos.forEach((combo, idx) => {
      const col = idx % GRID_COLS;
      if (col === 0 && idx > 0) {
        curX = 0;
        curY += rowMaxH + COMBO_V_GAP;
        rowMaxH = 0;
      }

      const nodes = nodesByCombo.get(String(combo.id)) ?? [];
      const k = Math.max(1, nodes.length);
      const innerCols = Math.ceil(Math.sqrt(k));

      // Use the widest node's actual rendered width so long-label nodes
      // (up to MODEL_NODE_MAX_WIDTH) don't overlap neighbours and hide edges.
      const maxNodeW = nodes.reduce((m, n) => {
        const s = n.data?.size;
        const w = Array.isArray(s) ? Number(s[0]) || NODE_WIDTH : NODE_WIDTH;

        return Math.max(m, w);
      }, NODE_WIDTH);

      nodes.forEach((node, i) => {
        const nc = i % innerCols;
        const nr = Math.floor(i / innerCols);
        updates.push({
          id: node.id,
          style: {
            ...(node.style ?? {}),
            x:
              curX +
              COMBO_INTERIOR_PADDING_SIDES +
              nc * (maxNodeW + NODE_H_SEP) +
              maxNodeW / 2,
            y:
              curY +
              COMBO_INTERIOR_PADDING_TOP +
              nr * (NODE_HEIGHT + NODE_V_SEP) +
              NODE_HEIGHT / 2,
          },
        });
      });

      const innerRows = Math.ceil(k / innerCols);
      const comboW =
        innerCols * maxNodeW +
        (innerCols - 1) * NODE_H_SEP +
        COMBO_INTERIOR_PADDING_SIDES * 2;
      const comboH =
        innerRows * NODE_HEIGHT +
        (innerRows - 1) * NODE_V_SEP +
        COMBO_INTERIOR_PADDING_TOP +
        COMBO_INTERIOR_PADDING_SIDES;

      curX += comboW + COMBO_H_GAP;
      rowMaxH = Math.max(rowMaxH, comboH);
    });

    // Position orphan nodes (e.g. metric nodes) that have no combo.
    // Without this they stack at the origin, causing overlap.
    const orphanNodes = graph.getNodeData().filter((n) => !n.combo);
    if (orphanNodes.length > 0) {
      const bottomY = curY + rowMaxH;
      const orphanCols = Math.ceil(Math.sqrt(orphanNodes.length));
      orphanNodes.forEach((node, i) => {
        const col = i % orphanCols;
        const row = Math.floor(i / orphanCols);
        updates.push({
          id: node.id,
          style: {
            ...(node.style ?? {}),
            x:
              COMBO_INTERIOR_PADDING_SIDES +
              col * (NODE_WIDTH + NODE_H_SEP) +
              NODE_WIDTH / 2,
            y:
              bottomY +
              COMBO_V_GAP +
              row * (NODE_HEIGHT + NODE_V_SEP) +
              NODE_HEIGHT / 2,
          },
        });
      });
    }

    if (updates.length > 0) {
      graph.updateNodeData(updates);
    }
  }, []);

  const applyBakedPositions = useCallback((graph: Graph, nodes: NodeData[]) => {
    const bakedUpdates = nodes
      .filter(
        (n) =>
          typeof (n.style as Record<string, unknown> | undefined)?.x ===
          'number'
      )
      .map((n) => {
        const s = n.style as Record<string, unknown>;

        return { id: n.id, style: { x: s.x as number, y: s.y as number } };
      });
    if (bakedUpdates.length > 0) {
      graph.updateNodeData(bakedUpdates);
    }
  }, []);

  /**
   * Shared helper: builds per-combo node positions using circular inner layout
   * and arranges combo blocks in an outer grid.
   * Returns a flat array of node updates ready for graph.updateNodeData().
   */
  const buildIntraComboLayout = useCallback((graph: Graph): NodeData[] => {
    const totalNodes = graph.getNodeData().length;
    const adaptedNodeSep = adaptiveSpacing(60, totalNodes);
    const adaptedGap = Math.max(48, adaptiveSpacing(280, totalNodes));

    const NODE_H_SEP = adaptedNodeSep;
    const COMBO_H_GAP = adaptedGap;
    const COMBO_V_GAP = adaptedGap;
    const MAX_RING_RADIUS_MODEL = Math.max(
      120,
      adaptiveSpacing(360, totalNodes)
    );
    const MIN_RING_RADIUS = 80;
    const GRID_COLS = Math.max(
      1,
      Math.ceil(Math.sqrt(graph.getComboData().length * 2))
    );

    const nodesByCombo = new Map<string, NodeData[]>();
    graph.getNodeData().forEach((node) => {
      const comboId =
        typeof node.combo === 'string' ? node.combo : String(node.combo ?? '');
      if (!comboId) {
        return;
      }
      if (!nodesByCombo.has(comboId)) {
        nodesByCombo.set(comboId, []);
      }
      nodesByCombo.get(comboId)!.push(node);
    });

    const updates: NodeData[] = [];
    let curX = 0;
    let curY = 0;
    let rowMaxH = 0;

    graph.getComboData().forEach((combo, idx) => {
      const col = idx % GRID_COLS;
      if (col === 0 && idx > 0) {
        curX = 0;
        curY += rowMaxH + COMBO_V_GAP;
        rowMaxH = 0;
      }

      const nodes = nodesByCombo.get(String(combo.id)) ?? [];
      const k = nodes.length;
      if (k === 0) {
        return;
      }

      const maxNodeW = nodes.reduce((m, n) => {
        const s = n.data?.size;
        const w = Array.isArray(s) ? Number(s[0]) || NODE_WIDTH : NODE_WIDTH;

        return Math.max(m, w);
      }, NODE_WIDTH);

      // Ring radius large enough so node borders don't overlap, capped so
      // large groups (50-200 nodes) don't create unbounded layouts.
      const ringRadius =
        k <= 1
          ? 0
          : Math.min(
              MAX_RING_RADIUS_MODEL,
              Math.max(
                MIN_RING_RADIUS,
                (k * (maxNodeW + NODE_H_SEP)) / (2 * Math.PI)
              )
            );

      // Visual span = ring diameter + one node half-width on each side
      const visualW = ringRadius === 0 ? maxNodeW : 2 * ringRadius + maxNodeW;
      const visualH =
        ringRadius === 0 ? NODE_HEIGHT : 2 * ringRadius + NODE_HEIGHT;
      const comboW = visualW + COMBO_INTERIOR_PADDING_SIDES * 2;
      const comboH =
        visualH + COMBO_INTERIOR_PADDING_TOP + COMBO_INTERIOR_PADDING_SIDES;

      const centerX = curX + comboW / 2;
      const centerY =
        curY + COMBO_INTERIOR_PADDING_TOP + ringRadius + NODE_HEIGHT / 2;

      // Circular: all nodes evenly on the ring
      nodes.forEach((node, i) => {
        const angle = k === 1 ? 0 : (2 * Math.PI * i) / k - Math.PI / 2;
        updates.push({
          id: node.id,
          style: {
            ...(node.style ?? {}),
            x: centerX + (k === 1 ? 0 : ringRadius * Math.cos(angle)),
            y: centerY + (k === 1 ? 0 : ringRadius * Math.sin(angle)),
          },
        });
      });

      curX += comboW + COMBO_H_GAP;
      rowMaxH = Math.max(rowMaxH, comboH);
    });

    // Orphan nodes (no combo) placed in a row below all combo blocks
    const orphanNodes = graph.getNodeData().filter((n) => !n.combo);
    if (orphanNodes.length > 0) {
      const bottomY = curY + rowMaxH + COMBO_V_GAP;
      const orphanCols = Math.ceil(Math.sqrt(orphanNodes.length));
      orphanNodes.forEach((node, i) => {
        updates.push({
          id: node.id,
          style: {
            ...(node.style ?? {}),
            x:
              COMBO_INTERIOR_PADDING_SIDES +
              (i % orphanCols) * (NODE_WIDTH + NODE_H_SEP) +
              NODE_WIDTH / 2,
            y:
              bottomY +
              Math.floor(i / orphanCols) * (NODE_HEIGHT + 40) +
              NODE_HEIGHT / 2,
          },
        });
      });
    }

    return updates;
  }, []);

  /** Circular layout within each combo box, combo boxes arranged in a grid. */
  const positionCircularNodes = useCallback(
    (graph: Graph) => {
      const updates = buildIntraComboLayout(graph);
      if (updates.length > 0) {
        graph.updateNodeData(updates);
      }
    },
    [buildIntraComboLayout]
  );

  const DATA_MODE_ASSET_TYPES = new Set(['dataAsset', 'metric']);
  const termNodeCount = useMemo(
    () =>
      explorationMode === 'data'
        ? inputNodes.filter((n) => !DATA_MODE_ASSET_TYPES.has(n.type)).length
        : inputNodes.length,
    [explorationMode, inputNodes]
  );

  const hasBakedPositions = useMemo(() => {
    if (explorationMode === 'data') {
      return true;
    }
    if (
      explorationMode === 'hierarchy' &&
      layoutType === LayoutEngine.Circular
    ) {
      return true;
    }

    return false;
  }, [explorationMode, layoutType]);

  useEffect(() => {
    if (!containerRef.current || termNodeCount === 0) {
      return;
    }

    const container = containerRef.current;
    const width = container.offsetWidth || 800;
    const height = container.offsetHeight || 600;

    const isDataMode = explorationMode === 'data';
    const isHierarchyMode = explorationMode === 'hierarchy';
    const hasCombos = Boolean(graphData.combos && graphData.combos.length > 0);
    const isModelView = explorationMode === 'model';
    const graph = new Graph({
      container,
      width,
      height,
      data: graphData,
      padding: 0,
      zoomRange: [MIN_ZOOM, MAX_ZOOM],
      zoom: DEFAULT_ZOOM,
      theme: false,
      node: {
        type: (datum: NodeData) =>
          typeof datum.type === 'string' && datum.type.length > 0
            ? datum.type
            : 'rect',
        style: (datum: NodeData) => {
          const d = (datum.data ?? {}) as GraphNodeMeta;
          const nodeColor = d?.color;
          const assetColor = d?.assetColor;
          const ontNode = d?.ontologyNode;
          const isAsset =
            ontNode?.type === 'dataAsset' || ontNode?.type === 'metric';
          const isTerm = isDataMode && !isAsset;

          if (isDataMode && isAsset) {
            const ac = assetColor ?? NODE_BORDER_COLOR;
            const label = d?.label ?? datum.id;
            const entityTypeLabel =
              ontNode?.entityRef?.type !== undefined
                ? entityUtilClassBase.getFormattedEntityType(
                    ontNode.entityRef.type
                  )
                : undefined;
            const entityIconUrl = getEntityIconUrl(ontNode?.entityRef?.type);

            return {
              ...buildDataModeAssetNodeStyle(
                getCanvasColor,
                label,
                ac,
                undefined,
                entityTypeLabel,
                entityIconUrl
              ),
              testId: 'ontology-asset-node',
              nodeId: ontNode?.id ?? datum.id,
              zIndex: 2,
              opacity: d?.isDimmed ? DIMMED_NODE_OPACITY : 1,
            };
          }

          if (isTerm) {
            const tc = nodeColor ?? NODE_BORDER_COLOR;
            const assetCount = d?.assetCount ?? 0;
            const isLoadingAssets = d?.isLoadingAssets ?? false;
            const hasAssetBadge = assetCount > 0 || isLoadingAssets;
            const assetsExpanded = d?.assetsExpanded ?? false;
            const loadedAssetCount = d?.loadedAssetCount ?? 0;
            const remaining = Math.max(0, assetCount - loadedAssetCount);
            const showLoadMore =
              assetsExpanded &&
              loadedAssetCount > 0 &&
              assetCount > DATA_MODE_ASSET_LOAD_PAGE_SIZE &&
              remaining > 0;
            const badgeText = isLoadingAssets
              ? '...'
              : assetsExpanded
              ? '\u2212'
              : `+${assetCount}`;
            const label = d?.label ?? datum.id;
            const badgeDiameterBase = isLoadingAssets
              ? DATA_MODE_TERM_ASSET_COUNT_BADGE_DIAMETER_WIDE
              : undefined;
            let assetCountBadgeDiameter: number;
            if (badgeDiameterBase !== undefined) {
              assetCountBadgeDiameter = badgeDiameterBase;
            } else if (assetsExpanded) {
              assetCountBadgeDiameter =
                badgeText.length > 2
                  ? DATA_MODE_TERM_ASSET_COUNT_BADGE_DIAMETER_WIDE
                  : DATA_MODE_TERM_ASSET_COUNT_BADGE_DIAMETER;
            } else {
              assetCountBadgeDiameter = Math.max(
                DATA_MODE_TERM_ASSET_COUNT_BADGE_DIAMETER_WIDE,
                DATA_MODE_TERM_ASSET_COUNT_BADGE_WIDTH_MIN +
                  badgeText.length * DATA_MODE_TERM_ASSET_COUNT_BADGE_WIDTH_CHAR
              );
            }
            const assetCountBadgeR = assetCountBadgeDiameter / 2;

            const loadMoreText = `Load ${remaining} more`;
            const loadMoreHPad = 4;
            const loadMoreCharW = 7;
            const loadMoreH = DATA_MODE_TERM_ASSET_COUNT_BADGE_DIAMETER;
            const loadMoreW = Math.max(
              60,
              loadMoreHPad * 2 + loadMoreText.length * loadMoreCharW
            );
            const loadMoreOffsetX = -(loadMoreW / 2);

            const badges = hasAssetBadge
              ? [
                  {
                    className: 'badge-data-mode-asset-count',
                    text: badgeText,
                    placement: 'top-right' as const,
                    offsetX: NODE_BADGE_OFFSET_X,
                    offsetY: NODE_BADGE_OFFSET_Y,
                    textAlign: 'center' as const,
                    fontSize: 12,
                    fontWeight: 700,
                    fill: NODE_FILL_DEFAULT,
                    background: true,
                    backgroundFill: NODE_LABEL_FILL,
                    backgroundWidth: assetCountBadgeDiameter,
                    backgroundHeight: assetCountBadgeDiameter,
                    backgroundRadius: assetCountBadgeR,
                    backgroundStroke: 'none',
                    backgroundLineWidth: 0,
                    padding: DATA_MODE_TERM_ASSET_COUNT_BADGE_PADDING,
                    backgroundOpacity: 1,
                  },
                  ...(showLoadMore
                    ? [
                        {
                          className: 'badge-data-mode-load-more',
                          text: loadMoreText,
                          placement: 'top-left' as const,
                          offsetX: loadMoreOffsetX,
                          offsetY: 0,
                          textAlign: 'center' as const,
                          fontSize: 11,
                          fontWeight: 600,
                          fill: NODE_FILL_DEFAULT,
                          background: true,
                          backgroundFill: DATA_MODE_LOAD_MORE_BADGE_BG,
                          backgroundWidth: loadMoreW,
                          backgroundHeight: loadMoreH,
                          backgroundRadius: 6,
                          backgroundStroke: 'none',
                          backgroundLineWidth: 0,
                          padding: [4, loadMoreHPad, 4, loadMoreHPad] as [
                            number,
                            number,
                            number,
                            number
                          ],
                          backgroundOpacity: 1,
                        },
                      ]
                    : []),
                ]
              : [];

            return {
              ...buildDataModeTermNodeStyle(getCanvasColor, label, tc),
              zIndex: 2,
              opacity: d?.isDimmed ? DIMMED_NODE_OPACITY : 1,
              badge: hasAssetBadge,
              badges,
              labelFill: NODE_FILL_DEFAULT,
              ...(d?.isSelected && {
                stroke: NODE_SELECTED_STROKE,
                lineWidth: NODE_SELECTED_LINE_WIDTH,
                haloStroke: NODE_SELECTED_STROKE,
                haloLineWidth: NODE_SELECTED_HALO_LINE_WIDTH,
                haloStrokeOpacity: 0.7,
                haloFill: NODE_SELECTED_HALO_FILL,
                haloFillOpacity: 1,
              }),
            };
          }

          const hasHierarchyBadge = Boolean(d?.hierarchyBadge);
          const badgeGlossaryId =
            ontNode?.originalGlossary ?? ontNode?.glossaryId;
          const badgeGlossaryColor = badgeGlossaryId
            ? glossaryColorMap[badgeGlossaryId] ?? NODE_BORDER_COLOR
            : NODE_BORDER_COLOR;
          const badgeColor = getCanvasColor(
            badgeGlossaryColor,
            BRAND_BLUE_FALLBACK
          );
          const nodeBorderColor = hasHierarchyBadge
            ? badgeColor
            : NODE_BORDER_COLOR;
          const size = (datum.style?.size as [number, number] | undefined) ?? [
            200, 40,
          ];
          const label = d?.label ?? datum.id;
          const nodeW = size[0];
          const hierarchyBadgeFontSize = 10;
          const hierarchyBadgePaddingH = 4;
          const badgeBackgroundW = Math.max(
            24,
            nodeW - hierarchyBadgePaddingH * 2
          );
          const badgeTextMaxW = Math.max(
            24,
            badgeBackgroundW - HIERARCHY_BADGE_TEXT_INSET
          );
          const hierarchyBadgeText = truncateHierarchyBadgeToFitWidth(
            String(d.hierarchyBadge ?? ''),
            badgeTextMaxW,
            hierarchyBadgeFontSize
          );

          const hierarchyBadgeOffsetX = -nodeW / 2 + hierarchyBadgePaddingH;

          return {
            ...buildDefaultRectNodeStyle(getCanvasColor, label, size),
            zIndex: 2,
            opacity: d?.isDimmed ? DIMMED_NODE_OPACITY : 1,
            stroke: d?.isSelected ? NODE_SELECTED_STROKE : nodeBorderColor,
            lineWidth: d?.isSelected ? NODE_SELECTED_LINE_WIDTH : 1,
            ...(hasHierarchyBadge && {
              radius: [
                0,
                NODE_BORDER_RADIUS,
                NODE_BORDER_RADIUS,
                NODE_BORDER_RADIUS,
              ],
            }),
            badge: hasHierarchyBadge,
            badges: hasHierarchyBadge
              ? [
                  {
                    text: hierarchyBadgeText,
                    placement: 'top',
                    offsetX: hierarchyBadgeOffsetX,
                    offsetY: HIERARCHY_BADGE_OFFSET_Y,
                    textAlign: 'left',
                    fontSize: hierarchyBadgeFontSize,
                    fontWeight: 600,
                    fill: NODE_FILL_DEFAULT,
                    wordWrap: false,
                    maxLines: 1,
                    background: true,
                    backgroundFill: badgeColor,
                    backgroundWidth: badgeBackgroundW,
                    backgroundRadius: [8, 8, 0, 0],
                    backgroundStroke: badgeColor,
                    backgroundLineWidth: 1,
                    padding: [
                      4,
                      hierarchyBadgePaddingH,
                      4,
                      hierarchyBadgePaddingH,
                    ],
                    backgroundOpacity: 1,
                  },
                ]
              : [],
          };
        },
      },
      edge: {
        type: 'cubic-vertical',
        animation: {
          enter: false,
        },
        style: (datum) => {
          const d = (datum.data ?? {}) as GraphEdgeMeta;
          const isHighlighted = d?.isHighlighted ?? false;
          const isClickedEdge = d?.isClickedEdge ?? false;
          const isEdgeDimmed = d?.isEdgeDimmed ?? false;
          const edgeColor = d?.edgeColor ?? EDGE_STROKE_COLOR;

          const edgeLineWidth =
            isHighlighted || isClickedEdge
              ? EDGE_LINE_WIDTH_HIGHLIGHTED
              : EDGE_LINE_WIDTH_DEFAULT;

          const base = {
            zIndex: 1,
            stroke: edgeColor,
            lineWidth: edgeLineWidth,
            lineAppendWidth: EDGE_LINE_APPEND_WIDTH,
            opacity: isEdgeDimmed ? DIMMED_EDGE_OPACITY : 1,
            endArrow: !isDataMode,
          };

          const merged = (
            datum.style ? { ...base, ...datum.style } : { ...base }
          ) as Record<string, unknown>;
          if (settingsRef.current.showEdgeLabels) {
            if (merged.labelText) {
              merged.label = true;
            }
          } else {
            merged.label = false;
            merged.labelText = '';
          }

          return merged;
        },
      },
      combo: {
        type: 'glossary-combo',
        style: (datum: ComboData) => {
          const d = (datum.data ?? {}) as GraphComboMeta;
          const color = d?.color ?? COMBO_COLOR_FALLBACK;
          const glossaryName = d?.glossaryName ?? '';

          return {
            ...buildComboStyle(glossaryName, color),
            zIndex: 0,
            opacity: d?.isDimmed ? DIMMED_NODE_OPACITY : 1,
          };
        },
      },
      layout: getLayoutConfig(layoutType, inputNodes.length, {
        hasCombos,
        isDataMode,
        isHierarchyMode,
        isModelView,
      }),
      behaviors: [
        { type: 'drag-canvas' },
        { type: 'zoom-canvas' },
        { type: 'drag-element' },
      ],
      plugins: [],
    });

    graphRef.current = graph;
    justInitializedRef.current = true;
    termFingerprintRef.current = '';
    assetFingerprintRef.current = '';

    const resolveNodeForCallback = (node: OntologyNode): OntologyNode =>
      node.originalNode ?? node;
    const findNodeById = (id: string) =>
      inputNodesRef.current.find((n) => n.id === id);
    const getClientPosition = (
      id: string,
      fallback: { x: number; y: number }
    ) => {
      try {
        const canvasPos = graph.getElementPosition(id);
        const clientPos = graph.getClientByCanvas(canvasPos);

        return { x: clientPos[0], y: clientPos[1] };
      } catch {
        return fallback;
      }
    };

    const handleNodeClick = (e: IElementEvent) => {
      const id = e.target.id;
      if (id) {
        const node = findNodeById(id);
        if (node) {
          const position = getClientPosition(id, {
            x: e.clientX ?? 0,
            y: e.clientY ?? 0,
          });
          const dataModeAssetBadgeClick =
            isDataMode && isDataModeAssetBadgeShape(e.originalTarget);
          const dataModeLoadMoreBadgeClick =
            isDataMode && isDataModeLoadMoreBadgeShape(e.originalTarget);
          onNodeClick(resolveNodeForCallback(node), position, {
            dataModeAssetBadgeClick,
            dataModeLoadMoreBadgeClick,
          });
        }
      }
    };

    const handleNodeDblClick = (e: IElementEvent) => {
      const id = e.target.id;
      if (id) {
        const node = findNodeById(id);
        if (node) {
          onNodeDoubleClick(resolveNodeForCallback(node));
        }
      }
    };

    graph.on(NodeEvent.CLICK, handleNodeClick);
    graph.on(NodeEvent.DBLCLICK, handleNodeDblClick);
    graph.on(CanvasEvent.CLICK, () => {
      setClickedEdgeIdRef.current(null);
      onPaneClick();
    });

    const handleEdgeClick = (e: IElementEvent) => {
      setClickedEdgeIdRef.current(e.target.id ?? null);
    };
    graph.on('edge:click', handleEdgeClick);

    const EDGE_TRIGGER_PX = 400;

    const checkEdgeProximity = () => {
      const g = graphRef.current;
      const c = containerRef.current;
      if (
        !g ||
        !c ||
        !onScrollNearEdgeRef.current ||
        isProgrammaticTransformRef.current ||
        !graphBoundsRef.current
      ) {
        return;
      }

      const W = c.offsetWidth;
      const H = c.offsetHeight;
      const canvasBottom = g.getCanvasByViewport([W / 2, H]);
      const cvpBottom = Array.isArray(canvasBottom)
        ? canvasBottom[1]
        : (canvasBottom as unknown as ArrayLike<number>)[1];

      const { maxY } = graphBoundsRef.current;
      const nearBottom = cvpBottom >= maxY - EDGE_TRIGGER_PX;

      if (nearBottom) {
        onScrollNearEdgeRef.current();
      }
    };

    // Use a wheel-event flag to distinguish zoom (wheel/pinch) from pan (drag).
    // AFTER_TRANSFORM fires for both — the wheel flag tells us which triggered it.
    let isZooming = false;
    let zoomClearTimer: ReturnType<typeof setTimeout> | null = null;
    const handleWheelEvent = () => {
      isZooming = true;
      if (zoomClearTimer !== null) {
        clearTimeout(zoomClearTimer);
      }
      zoomClearTimer = setTimeout(() => {
        isZooming = false;
        zoomClearTimer = null;
      }, 150);
    };
    container.addEventListener('wheel', handleWheelEvent, { passive: true });

    // RAF-throttled: edge-proximity check on pan only (skip zoom)
    let transformRafId: number | null = null;
    const scheduleTransformWork = () => {
      if (transformRafId !== null) {
        return;
      }
      transformRafId = requestAnimationFrame(() => {
        transformRafId = null;
        if (!isZooming && !isProgrammaticTransformRef.current) {
          checkEdgeProximity();
        }
      });
    };
    graph.on(GraphEvent.AFTER_TRANSFORM, scheduleTransformWork);

    const fitAndClampZoom = async () => {
      await fitViewWithMinZoom(graph);
      const zoom = graph.getZoom();
      if (zoom < PRACTICAL_MIN_ZOOM) {
        graph.zoomTo(
          PRACTICAL_MIN_ZOOM,
          { duration: 0 },
          graph.getCanvasCenter()
        );
      }
    };

    let renderCancelled = false;
    const runRender = async () => {
      suppressEdgeCheck(1500);
      try {
        if (hasBakedPositions) {
          applyBakedPositions(graph, graphData.nodes ?? []);
          if (isDataMode) {
            positionAssetNodes(graph);
          }
          await graph.draw();
        } else if (
          (isModelView || isHierarchyMode) &&
          layoutType === LayoutEngine.Dagre
        ) {
          positionModelModeNodes(graph);
          await graph.draw();
        } else if (isModelView && layoutType === LayoutEngine.Circular) {
          positionCircularNodes(graph);
          await graph.draw();
        } else {
          await runLayout(graph);
          if (renderCancelled) {
            return;
          }
          await graph.draw();
        }
        if (renderCancelled) {
          return;
        }
        await fitAndClampZoom();
        recomputeGraphBounds();
        emitPagePositions(graph);
      } catch {
        if (renderCancelled) {
          return;
        }
        // Layout or draw failed — attempt a bare draw so at least something
        // renders, then still try to fit the view.
        try {
          await graph.draw();
          if (!renderCancelled) {
            await fitAndClampZoom();
            recomputeGraphBounds();
            emitPagePositions(graph);
          }
        } catch {
          // Graph may have been destroyed; ignore.
        }
      }
    };

    runRender();

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && graphRef.current) {
        graphRef.current.resize(
          containerRef.current.offsetWidth,
          containerRef.current.offsetHeight
        );
        scheduleTransformWork();
      }
    });
    resizeObserver.observe(container);

    return () => {
      renderCancelled = true;
      if (transformRafId !== null) {
        cancelAnimationFrame(transformRafId);
      }
      if (zoomClearTimer !== null) {
        clearTimeout(zoomClearTimer);
      }
      container.removeEventListener('wheel', handleWheelEvent);
      if (cancelPendingUpdateRef.current) {
        cancelPendingUpdateRef.current();
        cancelPendingUpdateRef.current = null;
      }
      resizeObserver.disconnect();
      graph.off(NodeEvent.CLICK, handleNodeClick);
      graph.off(NodeEvent.DBLCLICK, handleNodeDblClick);
      graph.off(CanvasEvent.CLICK);
      graph.off('edge:click', handleEdgeClick);
      graph.off(GraphEvent.AFTER_TRANSFORM, scheduleTransformWork);
      graph.destroy();
      graphRef.current = null;
    };
  }, [
    applyBakedPositions,
    termNodeCount,
    explorationMode,
    hasBakedPositions,
    layoutType,
    recomputeGraphBounds,
    emitPagePositions,
  ]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || inputNodes.length === 0) {
      return;
    }

    const dataSignatureChanged = prevDataSignatureRef.current !== dataSignature;

    const isDataMode = explorationMode === 'data';
    const assetTypeSet = new Set(['dataAsset', 'metric']);
    const nodeTypeById = new Map(inputNodes.map((n) => [n.id, n.type]));

    const termNodes = isDataMode
      ? inputNodes.filter((n) => !assetTypeSet.has(n.type))
      : inputNodes;
    const termEdges = isDataMode
      ? mergedEdgesList.filter(
          (e) =>
            !assetTypeSet.has(nodeTypeById.get(e.from) ?? '') &&
            !assetTypeSet.has(nodeTypeById.get(e.to) ?? '')
        )
      : mergedEdgesList;

    const newTermFingerprint = [
      termNodes.map((n) => n.id).join(','),
      termEdges.length.toString(),
      termEdges.map((e) => `${e.from}>${e.to}:${e.relationType}`).join(','),
      layoutType,
      explorationMode,
    ].join('||');

    const newAssetFingerprint = isDataMode
      ? [...(expandedTermIds ?? new Set<string>())].sort().join('|')
      : '';

    const termFingerprintChanged =
      dataSignatureChanged || newTermFingerprint !== termFingerprintRef.current;
    const assetFingerprintChanged =
      newAssetFingerprint !== assetFingerprintRef.current;
    const layoutTypeChanged =
      prevLayoutTypeRef.current !== null &&
      prevLayoutTypeRef.current !== layoutType;
    prevLayoutTypeRef.current = layoutType;
    if (justInitializedRef.current) {
      justInitializedRef.current = false;
      prevDataSignatureRef.current = dataSignature ?? '';
      termFingerprintRef.current = newTermFingerprint;
      assetFingerprintRef.current = newAssetFingerprint;

      return;
    }

    if (dataSignatureChanged) {
      prevDataSignatureRef.current = dataSignature ?? '';
    }
    const structuralChanged = termFingerprintChanged || assetFingerprintChanged;
    const topologySynced = isGraphTopologySynced(graph, graphData);
    const canPatchInPlace = !structuralChanged && topologySynced;

    if (canPatchInPlace) {
      try {
        let nodesToUpdate = graphData.nodes ?? [];
        if (isDataMode) {
          nodesToUpdate = stripNodePositionsForDataMode(nodesToUpdate);
        }
        graph.updateNodeData(nodesToUpdate);
        graph.updateEdgeData(graphData.edges ?? []);
        graph.draw();

        return;
      } catch {
        // Fall through to setData(graphData).
      }
    }

    // Additive-only change: all existing nodes still present + new ones added.
    // Skip layout entirely — bake current positions for existing nodes and place
    // new nodes in a grid below the existing graph.  This prevents Dagre from
    // re-running on thousands of nodes on every scroll-append, which would time
    // out and leave the graph blank.
    const currentNodeIds = new Set(
      graph.getNodeData().map((n) => String(n.id))
    );
    const newNodeIdSet = new Set(
      (graphData.nodes ?? []).map((n) => String(n.id))
    );
    const noneRemoved = [...currentNodeIds].every((id) => newNodeIdSet.has(id));
    const isAdditiveOnly =
      noneRemoved && (graphData.nodes?.length ?? 0) > currentNodeIds.size;

    if (isAdditiveOnly) {
      let maxY = 0;
      let sumX = 0;
      let positionedCount = 0;
      const currentPositions: Record<string, [number, number]> = {};

      graph.getNodeData().forEach((n) => {
        try {
          const pos = graph.getElementPosition(String(n.id));
          if (pos) {
            currentPositions[String(n.id)] = [pos[0], pos[1]];
            maxY = Math.max(maxY, pos[1]);
            sumX += pos[0];
            positionedCount++;
          }
        } catch {
          // not yet positioned
        }
      });

      const centerX = positionedCount > 0 ? sumX / positionedCount : 0;
      const addedNodes = (graphData.nodes ?? []).filter(
        (n) => !currentNodeIds.has(String(n.id))
      );
      const COLS = Math.max(1, Math.ceil(Math.sqrt(addedNodes.length)));
      let newIdx = 0;

      // Pre-compute asset ring positions for newly added assets only.
      // Existing assets keep their currentPositions — recomputing all 3500+
      // entries on every expand is O(n) work that is mostly wasted because only
      // the term(s) that received new assets need their ring recomputed.
      const precomputedAssetPositions: Record<string, [number, number]> = {};

      if (isDataMode) {
        const map = assetToTermMapRef.current;

        // Find which terms actually received new asset nodes this render.
        const addedNodeIds = new Set(addedNodes.map((n) => String(n.id)));
        const termsWithNewAssets = new Set<string>();
        addedNodeIds.forEach((assetId) => {
          const termIds = map[assetId];
          termIds?.forEach((termId) => termsWithNewAssets.add(termId));
        });

        // Group ALL assets by term, but only for the affected terms.
        // Ring positions are computed for the full ring because adding one asset
        // shifts the angular spacing of every sibling in the same ring.
        const affectedAssetsByTerm = new Map<string, string[]>();
        Object.entries(map).forEach(([assetId, termIds]) => {
          termIds.forEach((termId) => {
            if (!termsWithNewAssets.has(termId)) {
              return;
            }
            const list = affectedAssetsByTerm.get(termId) ?? [];
            list.push(assetId);
            affectedAssetsByTerm.set(termId, list);
          });
        });

        affectedAssetsByTerm.forEach((assetIds, termId) => {
          const termPos = currentPositions[termId];
          if (!termPos) {
            return;
          }
          const [termX, termY] = termPos;
          const ringPositions = computeAssetRingPositions(
            termX,
            termY,
            assetIds
          );
          Object.entries(ringPositions).forEach(([assetId, pos]) => {
            precomputedAssetPositions[assetId] = [pos.x, pos.y];
          });
        });
      }

      const bakedData = {
        ...graphData,
        nodes: (graphData.nodes ?? []).map((node) => {
          const id = String(node.id);

          const ringPos = precomputedAssetPositions[id];
          if (ringPos) {
            return {
              ...node,
              style: { ...node.style, x: ringPos[0], y: ringPos[1] },
            };
          }

          const existingPos = currentPositions[id];
          if (existingPos) {
            return {
              ...node,
              style: { ...node.style, x: existingPos[0], y: existingPos[1] },
            };
          }

          const col = newIdx % COLS;
          const row = Math.floor(newIdx / COLS);
          newIdx++;

          return {
            ...node,
            style: {
              ...node.style,
              x: centerX + (col - COLS / 2) * 220,
              y: maxY + 200 + row * 120,
            },
          };
        }),
      };

      if (termFingerprintChanged) {
        termFingerprintRef.current = newTermFingerprint;
      }

      const addedNodeIds = new Set(addedNodes.map((n) => String(n.id)));
      const currentEdgeIds = new Set(
        graph.getEdgeData().map((e) => String(e.id))
      );
      const newEdges = (bakedData.edges ?? []).filter(
        (e) => !currentEdgeIds.has(String(e.id))
      );

      const existingNodesToUpdate = (bakedData.nodes ?? []).filter(
        (n) => !addedNodeIds.has(String(n.id))
      );
      const newNodesToAdd = (bakedData.nodes ?? []).filter((n) =>
        addedNodeIds.has(String(n.id))
      );

      // Use incremental updates instead of setData so the viewport is never
      // reset — adding/updating individual elements does not shift the camera.
      if (existingNodesToUpdate.length > 0) {
        graph.updateNodeData(existingNodesToUpdate);
      }
      graph.addNodeData(newNodesToAdd);
      if (newEdges.length > 0) {
        graph.addEdgeData(newEdges);
      }
      graph.draw();

      return;
    }

    // expandedTermIds toggled but asset fetch not yet complete — topology is
    // already in sync (same nodes/edges), so update in-place to avoid the
    // graph.setData() path which resets the camera.
    if (assetFingerprintChanged && !termFingerprintChanged && topologySynced) {
      assetFingerprintRef.current = newAssetFingerprint;
      try {
        let nodesToUpdate = graphData.nodes ?? [];
        if (isDataMode) {
          nodesToUpdate = stripNodePositionsForDataMode(nodesToUpdate);
        }
        graph.updateNodeData(nodesToUpdate);
        graph.updateEdgeData(graphData.edges ?? []);
        graph.draw();
      } catch {
        // ignore
      }

      return;
    }

    if (termFingerprintChanged) {
      termFingerprintRef.current = newTermFingerprint;
    }
    if (assetFingerprintChanged) {
      assetFingerprintRef.current = newAssetFingerprint;
    }

    const hasCombos = Boolean(graphData.combos && graphData.combos.length > 0);
    const isHierarchyMode = explorationMode === 'hierarchy';
    const isModelViewLocal = explorationMode === 'model';
    const layoutOptions = getLayoutConfig(layoutType, inputNodes.length, {
      hasCombos,
      isDataMode,
      isHierarchyMode,
      isModelView: isModelViewLocal,
    });

    if (cancelPendingUpdateRef.current) {
      cancelPendingUpdateRef.current();
    }
    let cancelled = false;
    cancelPendingUpdateRef.current = () => {
      cancelled = true;
    };

    const runUpdate = async () => {
      suppressEdgeCheck(1500);
      try {
        graph.stopLayout();
        if (cancelled) {
          return;
        }

        setClickedEdgeIdRef.current(null);

        const preUpdatePositions: Record<string, [number, number]> = {};
        if (isDataMode && !termFingerprintChanged) {
          inputNodesRef.current.forEach((n) => {
            try {
              const pos = graph.getElementPosition(n.id);
              if (pos) {
                preUpdatePositions[n.id] = [pos[0], pos[1]];
              }
            } catch {
              // not yet positioned
            }
          });
        }

        graph.setData(graphData);

        if (
          (isModelViewLocal || isHierarchyMode) &&
          layoutType === LayoutEngine.Dagre
        ) {
          positionModelModeNodes(graph);
        } else if (isModelViewLocal && layoutType === LayoutEngine.Circular) {
          positionCircularNodes(graph);
        } else if (hasBakedPositions) {
          if (
            isDataMode &&
            !termFingerprintChanged &&
            Object.keys(preUpdatePositions).length > 0
          ) {
            const updates = (graphData.nodes ?? [])
              .map((node) => {
                const snapshotPos = preUpdatePositions[String(node.id)];
                if (!snapshotPos) {
                  return null;
                }

                return {
                  id: node.id,
                  style: {
                    ...((node.style as Record<string, unknown>) ?? {}),
                    x: snapshotPos[0],
                    y: snapshotPos[1],
                  },
                };
              })
              .filter((u): u is NonNullable<typeof u> => u !== null);
            if (updates.length > 0) {
              graph.updateNodeData(updates);
            }
          } else {
            applyBakedPositions(graph, graphData.nodes ?? []);
          }
        } else {
          graph.setLayout(layoutOptions);
          try {
            await runLayout(graph);
          } catch {
            // Layout timed out or failed — draw with default positions rather
            // than leave the graph blank.
          }
        }

        // In data mode, positions are baked into node data (style.x/y), so
        // positionAssetNodes can read from node data before draw() — eliminating
        // the second draw that caused visible node movement when opening a spiral.
        if (isDataMode) {
          positionAssetNodes(graph);
        }

        if (cancelled) {
          return;
        }
        await graph.draw();

        if (cancelled) {
          return;
        }

        if (termFingerprintChanged || layoutTypeChanged) {
          await fitViewWithMinZoom(graph);
        }
        recomputeGraphBounds();
        emitPagePositions(graph);
      } finally {
        if (!cancelled) {
          cancelPendingUpdateRef.current = null;
        }
      }
    };

    runUpdate();
  }, [
    graphData,
    layoutType,
    inputNodes,
    mergedEdgesList,
    selectedNodeId,
    neighborSet,
    settings.showEdgeLabels,
    computeNodeColor,
    dataSignature,
    explorationMode,
    focusNodeId,
    expandedTermIds,
    applyBakedPositions,
    hasBakedPositions,
    positionAssetNodes,
    positionModelModeNodes,
    positionCircularNodes,
    recomputeGraphBounds,
    emitPagePositions,
  ]);

  return {
    graphRef,
    extractNodePositions,
    suppressEdgeCheck,
    emitPagePositions,
  };
}
