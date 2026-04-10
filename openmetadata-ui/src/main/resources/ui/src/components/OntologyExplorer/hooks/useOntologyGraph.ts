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
  ONTOLOGY_FIT_VIEW_PADDING,
  PRACTICAL_MIN_ZOOM,
  type LayoutEngineType,
} from '../OntologyExplorer.constants';
import { GraphSettings, OntologyNode } from '../OntologyExplorer.interface';
import { getEntityIconUrl } from '../utils/entityIconUrls';
import { getLayoutConfig, NODE_HEIGHT, NODE_WIDTH } from '../utils/graphConfig';
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

interface GraphNodeMeta {
  color?: string;
  assetColor?: string;
  label?: string;
  hierarchyBadge?: string;
  assetCount?: number;
  loadedAssetCount?: number;
  assetsExpanded?: boolean;
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
  onNodeContextMenu: (
    node: OntologyNode,
    position: { x: number; y: number }
  ) => void;
  onPaneClick: () => void;
  setClickedEdgeId: (id: string | null) => void;
  neighborSet: Set<string>;
  glossaryColorMap: Record<string, string>;
  computeNodeColor: (node: OntologyNode) => string;
  assetToTermMap: Record<string, string>;
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
  onNodeContextMenu,
  onPaneClick,
  setClickedEdgeId,
  neighborSet,
  glossaryColorMap,
  computeNodeColor,
  assetToTermMap,
}: UseOntologyGraphProps) {
  const graphRef = useRef<Graph | null>(null);
  const settingsRef = useRef(settings);

  settingsRef.current = settings;

  const prevDataSignatureRef = useRef<string>('');
  const termFingerprintRef = useRef<string>('');
  const assetFingerprintRef = useRef<string>('');
  const justInitializedRef = useRef<boolean>(false);
  const cancelPendingUpdateRef = useRef<(() => void) | null>(null);
  const assetToTermMapRef = useRef(assetToTermMap);
  assetToTermMapRef.current = assetToTermMap;

  const setClickedEdgeIdRef = useRef(setClickedEdgeId);
  setClickedEdgeIdRef.current = setClickedEdgeId;

  const inputNodesRef = useRef(inputNodes);
  inputNodesRef.current = inputNodes;

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

  const positionAssetNodes = useCallback((graph: Graph) => {
    const map = assetToTermMapRef.current;
    const assetsByTerm = new Map<string, string[]>();
    Object.entries(map).forEach(([assetId, termId]) => {
      const list = assetsByTerm.get(termId) ?? [];
      list.push(assetId);
      assetsByTerm.set(termId, list);
    });

    const updates: NodeData[] = [];
    assetsByTerm.forEach((assetIds, termId) => {
      try {
        const termPos = graph.getElementPosition(termId);
        if (!termPos) {
          return;
        }
        const [termX, termY] = termPos;
        const ringPositions = computeAssetRingPositions(termX, termY, assetIds);
        Object.entries(ringPositions).forEach(([assetId, pos]) => {
          const nodeData = graph.getNodeData(assetId);
          if (nodeData) {
            updates.push({
              id: assetId,
              style: { ...(nodeData.style ?? {}), x: pos.x, y: pos.y },
            });
          }
        });
      } catch {
        // Term not yet in graph.
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

    const NODE_H_SEP = 80;
    const NODE_V_SEP = 60;
    const COMBO_GAP = 500;
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
        curY += rowMaxH + COMBO_GAP;
        rowMaxH = 0;
      }

      const nodes = nodesByCombo.get(String(combo.id)) ?? [];
      const k = Math.max(1, nodes.length);
      const innerCols = Math.ceil(Math.sqrt(k));

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
              nc * (NODE_WIDTH + NODE_H_SEP) +
              NODE_WIDTH / 2,
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
        innerCols * NODE_WIDTH +
        (innerCols - 1) * NODE_H_SEP +
        COMBO_INTERIOR_PADDING_SIDES * 2;
      const comboH =
        innerRows * NODE_HEIGHT +
        (innerRows - 1) * NODE_V_SEP +
        COMBO_INTERIOR_PADDING_TOP +
        COMBO_INTERIOR_PADDING_SIDES;

      curX += comboW + COMBO_GAP;
      rowMaxH = Math.max(rowMaxH, comboH);
    });

    if (updates.length > 0) {
      graph.updateNodeData(updates);
    }
  }, []);

  const DATA_MODE_ASSET_TYPES = new Set(['dataAsset', 'metric']);
  const termNodeCount = useMemo(
    () =>
      explorationMode === 'data'
        ? inputNodes.filter((n) => !DATA_MODE_ASSET_TYPES.has(n.type)).length
        : inputNodes.length,
    [explorationMode, inputNodes]
  );

  const isModelView = explorationMode === 'model';

  const hasBakedPositions = useMemo(() => {
    if (explorationMode === 'data') {
      return true;
    }
    if (
      explorationMode === 'hierarchy' &&
      (layoutType === LayoutEngine.Circular ||
        layoutType === LayoutEngine.Radial)
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
    const graph = new Graph({
      container,
      width,
      height,
      data: graphData,
      padding: ONTOLOGY_FIT_VIEW_PADDING,
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
            const hasAssetBadge = assetCount > 0;
            const assetsExpanded = d?.assetsExpanded ?? false;
            const loadedAssetCount = d?.loadedAssetCount ?? 0;
            const remaining = Math.max(0, assetCount - loadedAssetCount);
            const showLoadMore = assetsExpanded && remaining > 0;
            const badgeText = assetsExpanded ? '\u2212' : `+${assetCount}`;
            const label = d?.label ?? datum.id;
            let assetCountBadgeDiameter: number;
            if (assetsExpanded) {
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
        focusNode:
          layoutType === LayoutEngine.Radial
            ? focusNodeId ?? selectedNodeId ?? undefined
            : undefined,
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

    const handleNodeContextMenu = (e: IElementEvent) => {
      e.preventDefault();
      const id = e.target.id;
      if (id) {
        const node = findNodeById(id);
        if (node) {
          onNodeContextMenu(resolveNodeForCallback(node), {
            x: e.clientX ?? 0,
            y: e.clientY ?? 0,
          });
        }
      }
    };

    graph.on(NodeEvent.CLICK, handleNodeClick);
    graph.on(NodeEvent.DBLCLICK, handleNodeDblClick);
    graph.on(NodeEvent.CONTEXT_MENU, handleNodeContextMenu);
    graph.on(CanvasEvent.CLICK, () => {
      setClickedEdgeIdRef.current(null);
      onPaneClick();
    });

    const handleEdgeClick = (e: IElementEvent) => {
      setClickedEdgeIdRef.current(e.target.id ?? null);
    };
    graph.on('edge:click', handleEdgeClick);

    const fitAndClampZoom = async () => {
      await fitViewWithMinZoom(graph, termNodeCount, isDataMode);
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
      try {
        if (hasBakedPositions) {
          await graph.draw();
          if (isDataMode) {
            positionAssetNodes(graph);
            graph.draw();
          }
        } else if (isModelView && hasCombos) {
          positionModelModeNodes(graph);
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
      } catch {
        // Layout or draw failed — attempt a bare draw so at least something
        // renders, then still try to fit the view.
        try {
          await graph.draw();
          await fitAndClampZoom();
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
      }
    });
    resizeObserver.observe(container);

    return () => {
      renderCancelled = true;
      if (cancelPendingUpdateRef.current) {
        cancelPendingUpdateRef.current();
        cancelPendingUpdateRef.current = null;
      }
      resizeObserver.disconnect();
      graph.off(NodeEvent.CLICK, handleNodeClick);
      graph.off(NodeEvent.DBLCLICK, handleNodeDblClick);
      graph.off(NodeEvent.CONTEXT_MENU, handleNodeContextMenu);
      graph.off(CanvasEvent.CLICK);
      graph.off('edge:click', handleEdgeClick);
      graph.destroy();
      graphRef.current = null;
    };
  }, [termNodeCount, explorationMode, hasBakedPositions, layoutType]);

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
      layoutType === LayoutEngine.Radial
        ? focusNodeId ?? selectedNodeId ?? ''
        : '',
      explorationMode,
    ].join('||');

    const newAssetFingerprint = isDataMode
      ? [...(expandedTermIds ?? new Set<string>())].sort().join('|')
      : '';

    const termFingerprintChanged =
      dataSignatureChanged || newTermFingerprint !== termFingerprintRef.current;
    const assetFingerprintChanged =
      newAssetFingerprint !== assetFingerprintRef.current;
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
        graph.updateNodeData(graphData.nodes ?? []);
        graph.updateEdgeData(graphData.edges ?? []);
        graph.draw();

        return;
      } catch {
        // Fall through to setData(graphData).
      }
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
      focusNode:
        layoutType === LayoutEngine.Radial
          ? focusNodeId ?? selectedNodeId ?? undefined
          : undefined,
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
      try {
        graph.stopLayout();
        if (cancelled) {
          return;
        }

        setClickedEdgeIdRef.current(null);
        graph.setData(graphData);

        if (isModelViewLocal && hasCombos) {
          positionModelModeNodes(graph);
        } else if (!hasBakedPositions) {
          graph.setLayout(layoutOptions);
          await runLayout(graph);
        }
        if (cancelled) {
          return;
        }
        graph.draw();
        if (isDataMode) {
          positionAssetNodes(graph);
          graph.draw();
        }

        if (cancelled) {
          return;
        }

        if (termFingerprintChanged) {
          await fitViewWithMinZoom(graph, termNodeCount, isDataMode);
        }
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
    hasBakedPositions,
    positionAssetNodes,
    positionModelModeNodes,
  ]);

  return { graphRef, extractNodePositions };
}
