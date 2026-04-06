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
  IElementEvent,
  NodeData,
  NodeEvent,
} from '@antv/g6';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  BRAND_BLUE_FALLBACK,
  COMBO_COLOR_FALLBACK,
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
  FIT_VIEW_ZOOM_OUT,
  FIT_VIEW_ZOOM_OUT_DATA_MODE,
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
  type LayoutEngineType,
} from '../OntologyExplorer.constants';
import { GraphSettings, OntologyNode } from '../OntologyExplorer.interface';
import { getEntityIconUrl } from '../utils/entityIconUrls';
import { getLayoutConfig } from '../utils/graphConfig';
import {
  buildComboStyle,
  buildDataModeAssetNodeStyle,
  buildDataModeTermNodeStyle,
  buildDefaultRectNodeStyle,
  getCanvasColor,
  truncateHierarchyBadgeToFitWidth,
} from '../utils/graphStyles';
import { computeAssetRingPositions } from '../utils/layoutCalculations';

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

  /** Places asset nodes in concentric rings around their parent term's current drawn position. */
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
        // term not yet in graph
      }
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

  const hasBakedPositions = useMemo(() => {
    const hierarchyWithBakedLayout =
      explorationMode === 'hierarchy' &&
      (layoutType === LayoutEngine.Circular ||
        layoutType === LayoutEngine.Radial);
    if (hierarchyWithBakedLayout) {
      return true;
    }
    if (explorationMode === 'hierarchy') {
      return false;
    }
    const distinctGlossaryIds = new Set(
      inputNodes.map((n) => n.glossaryId).filter(Boolean)
    );
    const hasGroupLayout =
      explorationMode !== 'data' && distinctGlossaryIds.size > 1;

    return hasGroupLayout || explorationMode === 'data';
  }, [inputNodes, explorationMode, layoutType]);

  useEffect(() => {
    if (!containerRef.current || termNodeCount === 0) {
      return;
    }

    const container = containerRef.current;
    const width = container.offsetWidth || 800;
    const height = container.offsetHeight || 600;

    const isDataMode = explorationMode === 'data';
    const graph = new Graph({
      container,
      width,
      height,
      data: graphData,
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
      layout: getLayoutConfig(
        layoutType,
        inputNodes.length,
        true,
        layoutType === LayoutEngine.Radial
          ? focusNodeId ?? selectedNodeId ?? undefined
          : undefined,
        isDataMode,
        explorationMode === 'hierarchy'
      ),
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

    const runRender = async () => {
      if (hasBakedPositions) {
        await graph.draw();
        if (isDataMode) {
          positionAssetNodes(graph);
          graph.draw();
        }
      } else {
        await graph.render();
      }
      const duration = 0;
      const zoomAfterFit = isDataMode
        ? FIT_VIEW_ZOOM_OUT_DATA_MODE
        : FIT_VIEW_ZOOM_OUT;
      await graph.fitView(undefined, { duration });
      await graph.zoomBy(zoomAfterFit, { duration });
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
  }, [termNodeCount, explorationMode]);

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

    const layoutOptions = getLayoutConfig(
      layoutType,
      inputNodes.length,
      true,
      focusNodeId ?? undefined,
      explorationMode === 'data',
      explorationMode === 'hierarchy'
    );

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

        const savedTermPositions: Record<string, { x: number; y: number }> = {};
        if (isDataMode && !termFingerprintChanged) {
          graph.getNodeData().forEach((node) => {
            const pos = graph.getElementPosition(node.id as string);
            if (pos) {
              savedTermPositions[node.id as string] = {
                x: pos[0],
                y: pos[1],
              };
            }
          });
        }

        setClickedEdgeIdRef.current(null);
        graph.setData(graphData);

        if (isDataMode) {
          graph.draw();
          // Restore term node positions that the user may have dragged before
          // setData reset them to their baked layout coordinates.
          if (Object.keys(savedTermPositions).length > 0) {
            const posUpdates = graph
              .getNodeData()
              .filter((node) => savedTermPositions[node.id as string])
              .map((node) => ({
                id: node.id,
                style: {
                  ...(node.style ?? {}),
                  x: savedTermPositions[node.id as string].x,
                  y: savedTermPositions[node.id as string].y,
                },
              }));
            if (posUpdates.length > 0) {
              graph.updateNodeData(posUpdates);
            }
          }
          positionAssetNodes(graph);
          graph.draw();
          if (termFingerprintChanged) {
            await graph.fitView(undefined, { duration: 0 });
            await graph.zoomBy(FIT_VIEW_ZOOM_OUT_DATA_MODE, { duration: 0 });
          }
        } else {
          if (!hasBakedPositions) {
            graph.setLayout(layoutOptions);
            await graph.layout();
            if (cancelled) {
              return;
            }
          }
          graph.draw();

          if (cancelled) {
            return;
          }

          if (inputNodes.length === 1) {
            await graph.fitCenter({ duration: 0 });
            await graph.zoomBy(FIT_VIEW_ZOOM_OUT, { duration: 0 });
          } else {
            await graph.fitView(undefined, { duration: 0 });
            await graph.zoomBy(FIT_VIEW_ZOOM_OUT, { duration: 0 });
          }
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
  ]);

  return { graphRef, extractNodePositions };
}
