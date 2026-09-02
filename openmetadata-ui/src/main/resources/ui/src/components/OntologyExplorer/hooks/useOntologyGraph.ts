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
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import {
  BRAND_BLUE_FALLBACK,
  COMBO_COLOR_FALLBACK,
  COMBO_INTERIOR_PADDING_SIDES,
  COMBO_INTERIOR_PADDING_TOP,
  DATA_MODE_ASSET_COUNT_BADGE_BG,
  DATA_MODE_ASSET_LOAD_PAGE_SIZE,
  DATA_MODE_LOAD_MORE_BADGE_BG,
  DATA_MODE_TERM_ASSET_COUNT_BADGE_DIAMETER,
  DATA_MODE_TERM_ASSET_COUNT_BADGE_DIAMETER_WIDE,
  DATA_MODE_TERM_ASSET_COUNT_BADGE_PADDING,
  DATA_MODE_TERM_ASSET_COUNT_BADGE_WIDTH_CHAR,
  DATA_MODE_TERM_ASSET_COUNT_BADGE_WIDTH_MIN,
  DEFAULT_ZOOM,
  DIMMED_EDGE_LABEL_OPACITY,
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
  NODE_LABEL_FILL_INVERSE,
  NODE_LINE_WIDTH,
  NODE_SELECTED_HALO_FILL,
  NODE_SELECTED_HALO_LINE_WIDTH,
  NODE_SELECTED_LINE_WIDTH,
  NODE_SELECTED_STROKE,
  PRACTICAL_MIN_ZOOM,
  type LayoutEngineType,
} from '../OntologyExplorer.constants';
import { GraphSettings, OntologyNode } from '../OntologyExplorer.interface';
import {
  OntologyEditNodeClickDetail,
  ONTOLOGY_EDIT_CANCEL_EVENT,
  ONTOLOGY_EDIT_NODE_CLICK_EVENT,
} from '../PortOverlay.interface';
import {
  adaptiveSpacing,
  getLayoutConfig,
  NODE_HEIGHT,
  NODE_WIDTH,
  shouldUseComboGridLayout,
} from '../utils/graphConfig';
import {
  buildComboStyle,
  buildDataModeAssetNodeStyle,
  buildDataModeTermNodeStyle,
  buildDefaultRectNodeStyle,
  CARDINALITY_AWARE_LINE_EDGE_TYPE,
  CARDINALITY_AWARE_QUADRATIC_EDGE_TYPE,
  getCanvasColor,
  STUDIO_EDIT_PORT_CLASS_NAME,
  truncateHierarchyBadgeToFitWidth,
} from '../utils/graphStyles';
import { computeAssetRingPositions } from '../utils/layoutCalculations';
import { calculateStudioNodePositions } from '../utils/studioGraphLayout';

/**
 * Starts a G6 layout and waits for it to actually finish.
 *
 * graph.layout() returns a Promise, but when enableWorker:true the promise
 * resolves when the worker *starts*, not when positions are ready. Listening
 * to the 'afterlayout' event is the only reliable way to know the worker has
 * written positions back to all nodes.
 */
const LAYOUT_TIMEOUT_MS = 15_000;
const DATA_MODE_ASSET_TYPES = new Set(['dataAsset', 'metric']);

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

export function isGraphTopologySynced(
  graph: Graph,
  graphData: GraphData
): boolean {
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

export const findBadgeIndex = (originalTarget: unknown): number | null => {
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

const hasShapeClass = (originalTarget: unknown, className: string): boolean => {
  let current: unknown = originalTarget;
  for (let depth = 0; depth < 14; depth += 1) {
    if (!current || typeof current !== 'object') {
      return false;
    }
    const shape = current as {
      className?: string;
      name?: string;
      parent?: unknown;
    };
    if ((shape.className ?? shape.name) === className) {
      return true;
    }
    current = shape.parent;
  }

  return false;
};

export function isDataModeAssetBadgeShape(originalTarget: unknown): boolean {
  const idx = findBadgeIndex(originalTarget);

  return idx === 0;
}

export function isDataModeLoadMoreBadgeShape(originalTarget: unknown): boolean {
  const idx = findBadgeIndex(originalTarget);

  return idx === 1;
}

function dispatchStudioEditNodeClick(
  container: HTMLDivElement,
  event: IElementEvent,
  nodeId: string,
  position: { x: number; y: number },
  isEditPort: boolean
): boolean {
  const detail: OntologyEditNodeClickDetail = {
    clientX: event.clientX ?? position.x,
    clientY: event.clientY ?? position.y,
    isPort: isEditPort,
    nodeId,
  };
  const editEvent = new CustomEvent(ONTOLOGY_EDIT_NODE_CLICK_EVENT, {
    cancelable: true,
    detail,
  });
  const isHandled = !container.dispatchEvent(editEvent);

  return isEditPort || isHandled;
}

export function stripNodePositionsForDataMode<T extends { style?: unknown }>(
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
  studioMode?: boolean;
  studioAccentColor?: string;
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
  extraVerticalPadding?: number;
}

function getSelectedNodeStyle(isSelected: boolean): Record<string, unknown> {
  if (!isSelected) {
    return {};
  }

  return {
    stroke: getCanvasColor(NODE_SELECTED_STROKE, '#1570ef'),
    lineWidth: NODE_SELECTED_LINE_WIDTH,
    haloStroke: getCanvasColor(NODE_SELECTED_STROKE, '#1570ef'),
    haloLineWidth: NODE_SELECTED_HALO_LINE_WIDTH,
    haloStrokeOpacity: 0.7,
    haloFill: getCanvasColor(
      NODE_SELECTED_HALO_FILL,
      'rgba(21, 112, 239, 0.06)'
    ),
    haloFillOpacity: 1,
  };
}

function buildRuntimeDataAssetStyle(
  datum: NodeData,
  meta: GraphNodeMeta
): Record<string, unknown> {
  const ontologyNode = meta.ontologyNode;
  const assetColor = meta.assetColor ?? NODE_BORDER_COLOR;
  const label = meta.label ?? datum.id;
  const entityTypeLabel =
    ontologyNode?.entityRef?.type !== undefined
      ? entityUtilClassBase.getFormattedEntityType(ontologyNode.entityRef.type)
      : undefined;
  const entityIconUrl = serviceUtilClassBase.getServiceTypeLogo({
    entityType: ontologyNode?.entityRef?.type,
    serviceType: ontologyNode?.serviceLabel,
  });

  return {
    ...buildDataModeAssetNodeStyle(
      getCanvasColor,
      label,
      assetColor,
      undefined,
      entityTypeLabel,
      entityIconUrl
    ),
    testId: 'ontology-asset-node',
    nodeId: ontologyNode?.id ?? datum.id,
    zIndex: 2,
    opacity: meta.isDimmed ? DIMMED_NODE_OPACITY : 1,
  };
}

function getDataModeTermBadgeText(
  isLoadingAssets: boolean,
  assetsExpanded: boolean,
  assetCount: number
): string {
  if (isLoadingAssets) {
    return '...';
  }

  return assetsExpanded ? '\u2212' : `+${assetCount}`;
}

function getAssetCountBadgeDiameter(
  isLoadingAssets: boolean,
  assetsExpanded: boolean,
  badgeText: string
): number {
  if (isLoadingAssets) {
    return DATA_MODE_TERM_ASSET_COUNT_BADGE_DIAMETER_WIDE;
  }
  if (assetsExpanded) {
    return badgeText.length > 2
      ? DATA_MODE_TERM_ASSET_COUNT_BADGE_DIAMETER_WIDE
      : DATA_MODE_TERM_ASSET_COUNT_BADGE_DIAMETER;
  }

  return Math.max(
    DATA_MODE_TERM_ASSET_COUNT_BADGE_DIAMETER_WIDE,
    DATA_MODE_TERM_ASSET_COUNT_BADGE_WIDTH_MIN +
      badgeText.length * DATA_MODE_TERM_ASSET_COUNT_BADGE_WIDTH_CHAR
  );
}

function buildDataModeTermBadges(
  hasAssetBadge: boolean,
  showLoadMore: boolean,
  badgeText: string,
  remaining: number,
  assetCountBadgeDiameter: number
): Array<Record<string, unknown>> {
  if (!hasAssetBadge) {
    return [];
  }
  const assetCountBadge = {
    className: 'badge-data-mode-asset-count',
    text: badgeText,
    placement: 'top-right' as const,
    offsetX: NODE_BADGE_OFFSET_X,
    offsetY: NODE_BADGE_OFFSET_Y,
    textAlign: 'center' as const,
    fontSize: 12,
    fontWeight: 700,
    fill: getCanvasColor(NODE_LABEL_FILL_INVERSE, '#ffffff'),
    background: true,
    backgroundFill: getCanvasColor(DATA_MODE_ASSET_COUNT_BADGE_BG, '#181D27'),
    backgroundWidth: assetCountBadgeDiameter,
    backgroundHeight: assetCountBadgeDiameter,
    backgroundRadius: assetCountBadgeDiameter / 2,
    backgroundStroke: 'none',
    backgroundLineWidth: 0,
    padding: DATA_MODE_TERM_ASSET_COUNT_BADGE_PADDING,
    backgroundOpacity: 1,
  };
  if (!showLoadMore) {
    return [assetCountBadge];
  }
  const loadMoreText = `Load ${remaining} more`;
  const loadMoreHorizontalPadding = 4;
  const loadMoreWidth = Math.max(
    60,
    loadMoreHorizontalPadding * 2 + loadMoreText.length * 7
  );
  const loadMoreBadge = {
    className: 'badge-data-mode-load-more',
    text: loadMoreText,
    placement: 'top-left' as const,
    offsetX: -(loadMoreWidth / 2),
    offsetY: 0,
    textAlign: 'center' as const,
    fontSize: 11,
    fontWeight: 600,
    fill: getCanvasColor(NODE_LABEL_FILL_INVERSE, '#ffffff'),
    background: true,
    backgroundFill: getCanvasColor(DATA_MODE_LOAD_MORE_BADGE_BG, '#155EEF'),
    backgroundWidth: loadMoreWidth,
    backgroundHeight: DATA_MODE_TERM_ASSET_COUNT_BADGE_DIAMETER,
    backgroundRadius: 6,
    backgroundStroke: 'none',
    backgroundLineWidth: 0,
    padding: [4, loadMoreHorizontalPadding, 4, loadMoreHorizontalPadding] as [
      number,
      number,
      number,
      number
    ],
    backgroundOpacity: 1,
  };

  return [assetCountBadge, loadMoreBadge];
}

function buildRuntimeDataTermStyle(
  datum: NodeData,
  meta: GraphNodeMeta
): Record<string, unknown> {
  const {
    color: termColor = NODE_BORDER_COLOR,
    assetCount = 0,
    isLoadingAssets = false,
    assetsExpanded = false,
    loadedAssetCount = 0,
  } = meta;
  const hasAssetBadge = assetCount > 0 || isLoadingAssets;
  const remaining = Math.max(0, assetCount - loadedAssetCount);
  const showLoadMore =
    assetsExpanded &&
    loadedAssetCount > 0 &&
    assetCount > DATA_MODE_ASSET_LOAD_PAGE_SIZE &&
    remaining > 0;
  const badgeText = getDataModeTermBadgeText(
    isLoadingAssets,
    assetsExpanded,
    assetCount
  );
  const badgeDiameter = getAssetCountBadgeDiameter(
    isLoadingAssets,
    assetsExpanded,
    badgeText
  );
  const badges = buildDataModeTermBadges(
    hasAssetBadge,
    showLoadMore,
    badgeText,
    remaining,
    badgeDiameter
  );

  return {
    ...buildDataModeTermNodeStyle(
      getCanvasColor,
      meta.label ?? datum.id,
      termColor
    ),
    zIndex: 2,
    opacity: meta.isDimmed ? DIMMED_NODE_OPACITY : 1,
    badge: hasAssetBadge,
    badges,
    labelFill: getCanvasColor(NODE_LABEL_FILL_INVERSE, '#ffffff'),
    ...getSelectedNodeStyle(Boolean(meta.isSelected)),
  };
}

function buildRuntimeStudioNodeStyle(
  datum: NodeData,
  meta: GraphNodeMeta
): Record<string, unknown> {
  const isIsolated = meta.ontologyNode?.type === 'glossaryTermIsolated';
  const accentColor = isIsolated
    ? '#F79009'
    : meta.studioAccentColor ?? '#84CAFF';
  const borderColor = isIsolated
    ? '#FEDF89'
    : getCanvasColor(NODE_BORDER_COLOR, '#E9EAEB');
  const size = (datum.style?.size as [number, number] | undefined) ?? [150, 36];
  const label = meta.label ?? datum.id;
  const selectedStyle = getSelectedNodeStyle(Boolean(meta.isSelected));

  return {
    ...buildDefaultRectNodeStyle(getCanvasColor, label, size),
    label: false,
    studioLabelText: label,
    studioAccentColor: accentColor,
    zIndex: 2,
    opacity: meta.isDimmed ? DIMMED_NODE_OPACITY : 1,
    stroke: meta.isSelected
      ? getCanvasColor(NODE_SELECTED_STROKE, '#1570ef')
      : borderColor,
    lineWidth: meta.isSelected ? NODE_SELECTED_LINE_WIDTH : NODE_LINE_WIDTH,
    ...selectedStyle,
  };
}

function buildHierarchyBadge(
  meta: GraphNodeMeta,
  badgeColor: string,
  nodeWidth: number
): Array<Record<string, unknown>> {
  if (!meta.hierarchyBadge) {
    return [];
  }
  const fontSize = 10;
  const horizontalPadding = 4;
  const backgroundWidth = Math.max(24, nodeWidth - horizontalPadding * 2);
  const textMaxWidth = Math.max(
    24,
    backgroundWidth - HIERARCHY_BADGE_TEXT_INSET
  );

  return [
    {
      text: truncateHierarchyBadgeToFitWidth(
        meta.hierarchyBadge,
        textMaxWidth,
        fontSize
      ),
      placement: 'top',
      offsetX: -nodeWidth / 2 + horizontalPadding,
      offsetY: HIERARCHY_BADGE_OFFSET_Y,
      textAlign: 'left',
      fontSize,
      fontWeight: 600,
      fill: getCanvasColor(NODE_LABEL_FILL_INVERSE, '#ffffff'),
      wordWrap: false,
      maxLines: 1,
      background: true,
      backgroundFill: badgeColor,
      backgroundWidth,
      backgroundRadius: [8, 8, 0, 0],
      backgroundStroke: badgeColor,
      backgroundLineWidth: 1,
      padding: [4, horizontalPadding, 4, horizontalPadding],
      backgroundOpacity: 1,
    },
  ];
}

function getDefaultNodeSelectionStyle(
  isSelected: boolean,
  nodeBorderColor: string
): { lineWidth: number; stroke: string } {
  return isSelected
    ? {
        lineWidth: NODE_SELECTED_LINE_WIDTH,
        stroke: getCanvasColor(NODE_SELECTED_STROKE, '#1570ef'),
      }
    : { lineWidth: 1, stroke: nodeBorderColor };
}

function buildRuntimeDefaultNodeStyle(
  datum: NodeData,
  meta: GraphNodeMeta,
  glossaryColorMap: Record<string, string>
): Record<string, unknown> {
  const hasHierarchyBadge = Boolean(meta.hierarchyBadge);
  const badgeGlossaryId =
    meta.ontologyNode?.originalGlossary ?? meta.ontologyNode?.glossaryId;
  let badgeGlossaryColor = NODE_BORDER_COLOR;
  if (badgeGlossaryId) {
    badgeGlossaryColor = glossaryColorMap[badgeGlossaryId] ?? NODE_BORDER_COLOR;
  }
  const badgeColor = getCanvasColor(badgeGlossaryColor, BRAND_BLUE_FALLBACK);
  const nodeBorderColor = hasHierarchyBadge
    ? badgeColor
    : getCanvasColor(NODE_BORDER_COLOR, '#E9EAEB');
  const size = (datum.style?.size as [number, number] | undefined) ?? [200, 40];
  const label = meta.label ?? datum.id;
  const badges = buildHierarchyBadge(meta, badgeColor, size[0]);
  const selectionStyle = getDefaultNodeSelectionStyle(
    Boolean(meta.isSelected),
    nodeBorderColor
  );

  return {
    ...buildDefaultRectNodeStyle(getCanvasColor, label, size),
    zIndex: 2,
    opacity: meta.isDimmed ? DIMMED_NODE_OPACITY : 1,
    ...selectionStyle,
    ...(hasHierarchyBadge
      ? {
          radius: [
            0,
            NODE_BORDER_RADIUS,
            NODE_BORDER_RADIUS,
            NODE_BORDER_RADIUS,
          ],
        }
      : {}),
    badge: hasHierarchyBadge,
    badges,
  };
}

function buildRuntimeNodeStyle(
  datum: NodeData,
  isDataMode: boolean,
  glossaryColorMap: Record<string, string>
): Record<string, unknown> {
  const meta = (datum.data ?? {}) as GraphNodeMeta;
  const isAsset = DATA_MODE_ASSET_TYPES.has(meta.ontologyNode?.type ?? '');
  if (isDataMode && isAsset) {
    return buildRuntimeDataAssetStyle(datum, meta);
  }
  if (isDataMode) {
    return buildRuntimeDataTermStyle(datum, meta);
  }
  if (meta.studioMode) {
    return buildRuntimeStudioNodeStyle(datum, meta);
  }

  return buildRuntimeDefaultNodeStyle(datum, meta, glossaryColorMap);
}

function buildRuntimeEdgeStyle(
  datum: { data?: unknown; style?: unknown },
  isDataMode: boolean,
  showEdgeLabels: boolean
): Record<string, unknown> {
  const meta = (datum.data ?? {}) as GraphEdgeMeta;
  const {
    isHighlighted = false,
    isClickedEdge = false,
    isEdgeDimmed = false,
    edgeColor = EDGE_STROKE_COLOR,
  } = meta;
  const labelOpacity = isEdgeDimmed ? DIMMED_EDGE_LABEL_OPACITY : 1;
  const base = {
    zIndex: 1,
    stroke: getCanvasColor(edgeColor, '#9196B1'),
    lineWidth:
      isHighlighted || isClickedEdge
        ? EDGE_LINE_WIDTH_HIGHLIGHTED
        : EDGE_LINE_WIDTH_DEFAULT,
    lineAppendWidth: EDGE_LINE_APPEND_WIDTH,
    opacity: isEdgeDimmed ? DIMMED_EDGE_OPACITY : 1,
    endArrow: !isDataMode,
    // G6 merges updates, so non-dimmed edges must restore a prior faded label.
    labelOpacity,
    labelBackgroundOpacity: labelOpacity,
  };
  const merged = (datum.style ? { ...base, ...datum.style } : base) as Record<
    string,
    unknown
  >;
  if (!showEdgeLabels) {
    merged.label = false;
    merged.labelText = '';
  } else if (merged.labelText) {
    merged.label = true;
  }

  return merged;
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
  hierarchicalRelationTypes?: ReadonlySet<string>;
  isEditMode?: boolean;
  studioMode?: boolean;
}

function getGraphFingerprints(
  inputNodes: OntologyNode[],
  mergedEdgesList: UseOntologyGraphProps['mergedEdgesList'],
  explorationMode: UseOntologyGraphProps['explorationMode'],
  layoutType: LayoutEngineType,
  expandedTermIds?: Set<string>
): { asset: string; term: string } {
  const isDataMode = explorationMode === 'data';
  const nodeTypeById = new Map(inputNodes.map((node) => [node.id, node.type]));
  const termNodes = isDataMode
    ? inputNodes.filter((node) => !DATA_MODE_ASSET_TYPES.has(node.type))
    : inputNodes;
  const termEdges = isDataMode
    ? mergedEdgesList.filter(
        (edge) =>
          !DATA_MODE_ASSET_TYPES.has(nodeTypeById.get(edge.from) ?? '') &&
          !DATA_MODE_ASSET_TYPES.has(nodeTypeById.get(edge.to) ?? '')
      )
    : mergedEdgesList;

  return {
    asset: isDataMode
      ? [...(expandedTermIds ?? new Set<string>())].sort().join('|')
      : '',
    term: [
      termNodes.map((node) => node.id).join(','),
      termEdges.length.toString(),
      termEdges
        .map((edge) => `${edge.from}>${edge.to}:${edge.relationType}`)
        .join(','),
      layoutType,
      explorationMode,
    ].join('||'),
  };
}

function patchGraphDataInPlace(
  graph: Graph,
  graphData: GraphData,
  isDataMode: boolean
): boolean {
  try {
    const nodes = isDataMode
      ? stripNodePositionsForDataMode(graphData.nodes ?? [])
      : graphData.nodes ?? [];
    graph.updateNodeData(nodes);
    graph.updateEdgeData(graphData.edges ?? []);
    graph.draw().catch(() => {
      // The graph can be destroyed while a fire-and-forget repaint is pending.
    });

    return true;
  } catch {
    return false;
  }
}

interface CurrentGraphPositions {
  centerX: number;
  maxY: number;
  positions: Record<string, [number, number]>;
}

function getCurrentGraphPositions(graph: Graph): CurrentGraphPositions {
  let maxY = 0;
  let sumX = 0;
  let positionedCount = 0;
  const positions: Record<string, [number, number]> = {};
  graph.getNodeData().forEach((node) => {
    try {
      const position = graph.getElementPosition(String(node.id));
      if (position) {
        positions[String(node.id)] = [position[0], position[1]];
        maxY = Math.max(maxY, position[1]);
        sumX += position[0];
        positionedCount += 1;
      }
    } catch {
      // Nodes can exist before their first layout has assigned a position.
    }
  });

  return {
    centerX: positionedCount > 0 ? sumX / positionedCount : 0,
    maxY,
    positions,
  };
}

function getAffectedAssetRingPositions(
  addedNodes: NodeData[],
  assetToTermMap: Record<string, string[]>,
  currentPositions: Record<string, [number, number]>
): Record<string, [number, number]> {
  const addedNodeIds = new Set(addedNodes.map((node) => String(node.id)));
  const termsWithNewAssets = new Set<string>();
  addedNodeIds.forEach((assetId) => {
    assetToTermMap[assetId]?.forEach((termId) =>
      termsWithNewAssets.add(termId)
    );
  });
  const affectedAssetsByTerm = new Map<string, string[]>();
  Object.entries(assetToTermMap).forEach(([assetId, termIds]) => {
    termIds.forEach((termId) => {
      if (!termsWithNewAssets.has(termId)) {
        return;
      }
      const assets = affectedAssetsByTerm.get(termId) ?? [];
      assets.push(assetId);
      affectedAssetsByTerm.set(termId, assets);
    });
  });
  const ringPositions: Record<string, [number, number]> = {};
  affectedAssetsByTerm.forEach((assetIds, termId) => {
    const termPosition = currentPositions[termId];
    if (!termPosition) {
      return;
    }
    const positions = computeAssetRingPositions(
      termPosition[0],
      termPosition[1],
      assetIds
    );
    Object.entries(positions).forEach(([assetId, position]) => {
      ringPositions[assetId] = [position.x, position.y];
    });
  });

  return ringPositions;
}

function bakeAdditiveNodePositions(
  nodes: NodeData[],
  currentPositions: CurrentGraphPositions,
  ringPositions: Record<string, [number, number]>,
  addedNodeCount: number
): NodeData[] {
  const columns = Math.max(1, Math.ceil(Math.sqrt(addedNodeCount)));
  let newIndex = 0;

  return nodes.map((node) => {
    const id = String(node.id);
    const retainedPosition =
      ringPositions[id] ?? currentPositions.positions[id];
    if (retainedPosition) {
      return {
        ...node,
        style: {
          ...node.style,
          x: retainedPosition[0],
          y: retainedPosition[1],
        },
      };
    }
    const column = newIndex % columns;
    const row = Math.floor(newIndex / columns);
    newIndex += 1;

    return {
      ...node,
      style: {
        ...node.style,
        x: currentPositions.centerX + (column - columns / 2) * 220,
        y: currentPositions.maxY + 200 + row * 120,
      },
    };
  });
}

function applyAdditiveGraphUpdate(
  graph: Graph,
  graphData: GraphData,
  isDataMode: boolean,
  assetToTermMap: Record<string, string[]>
): boolean {
  const currentNodeIds = new Set(
    graph.getNodeData().map((node) => String(node.id))
  );
  const nextNodes = graphData.nodes ?? [];
  const nextNodeIds = new Set(nextNodes.map((node) => String(node.id)));
  const noneRemoved = [...currentNodeIds].every((id) => nextNodeIds.has(id));
  const isAdditiveOnly = noneRemoved && nextNodes.length > currentNodeIds.size;
  if (!isAdditiveOnly) {
    return false;
  }
  const addedNodes = nextNodes.filter(
    (node) => !currentNodeIds.has(String(node.id))
  );
  const currentPositions = getCurrentGraphPositions(graph);
  // Adding one asset changes every sibling angle, so only affected rings are
  // recomputed while all unrelated positions remain untouched.
  const ringPositions = isDataMode
    ? getAffectedAssetRingPositions(
        addedNodes,
        assetToTermMap,
        currentPositions.positions
      )
    : {};
  const bakedNodes = bakeAdditiveNodePositions(
    nextNodes,
    currentPositions,
    ringPositions,
    addedNodes.length
  );
  const addedNodeIds = new Set(addedNodes.map((node) => String(node.id)));
  const currentEdgeIds = new Set(
    graph.getEdgeData().map((edge) => String(edge.id))
  );
  const newEdges = (graphData.edges ?? []).filter(
    (edge) => !currentEdgeIds.has(String(edge.id))
  );
  const existingNodes = bakedNodes.filter(
    (node) => !addedNodeIds.has(String(node.id))
  );
  const newNodes = bakedNodes.filter((node) =>
    addedNodeIds.has(String(node.id))
  );

  if (existingNodes.length > 0) {
    graph.updateNodeData(existingNodes);
  }
  graph.addNodeData(newNodes);
  if (newEdges.length > 0) {
    graph.addEdgeData(newEdges);
  }
  graph.draw().catch(() => {
    // The graph can be destroyed while a fire-and-forget repaint is pending.
  });

  return true;
}

function getActiveGraph(
  graph: Graph | null,
  inputNodeCount: number
): Graph | null {
  return graph && inputNodeCount > 0 ? graph : null;
}

function didTermFingerprintChange(
  dataSignatureChanged: boolean,
  nextFingerprint: string,
  currentFingerprint: string
): boolean {
  return dataSignatureChanged || nextFingerprint !== currentFingerprint;
}

function didLayoutTypeChange(
  previousLayoutType: LayoutEngineType | null,
  layoutType: LayoutEngineType
): boolean {
  return previousLayoutType !== null && previousLayoutType !== layoutType;
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
  hierarchicalRelationTypes,
  isEditMode = false,
  studioMode = false,
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

  const graphDataRef = useRef(graphData);
  graphDataRef.current = graphData;

  const glossaryColorMapRef = useRef(glossaryColorMap);
  glossaryColorMapRef.current = glossaryColorMap;

  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;

  const onNodeDoubleClickRef = useRef(onNodeDoubleClick);
  onNodeDoubleClickRef.current = onNodeDoubleClick;

  const onPaneClickRef = useRef(onPaneClick);
  onPaneClickRef.current = onPaneClick;

  const expandedTermIdsRef = useRef(expandedTermIds);
  expandedTermIdsRef.current = expandedTermIds;

  const onScrollNearEdgeRef = useRef(onScrollNearEdge);
  onScrollNearEdgeRef.current = onScrollNearEdge;

  const isEditModeRef = useRef(isEditMode);
  isEditModeRef.current = isEditMode;

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
      let comboNodes = nodesByCombo.get(comboId);
      if (!comboNodes) {
        comboNodes = [];
        nodesByCombo.set(comboId, comboNodes);
      }
      comboNodes.push(node);
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

  const positionStudioNodes = useCallback(
    async (graph: Graph) => {
      const positions = await calculateStudioNodePositions(
        graph.getNodeData(),
        graph.getEdgeData(),
        {
          hierarchicalRelationTypes,
          viewportWidth: containerRef.current?.offsetWidth,
        }
      );
      const updates = graph
        .getNodeData()
        .map((node) => {
          const position = positions[String(node.id)];
          if (!position) {
            return null;
          }

          return {
            id: node.id,
            style: {
              ...(node.style ?? {}),
              x: position.x,
              y: position.y,
            },
          };
        })
        .filter((node): node is NonNullable<typeof node> => node !== null);

      if (updates.length > 0) {
        graph.updateNodeData(updates);
      }
    },
    [containerRef, hierarchicalRelationTypes]
  );

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
      let comboNodes = nodesByCombo.get(comboId);
      if (!comboNodes) {
        comboNodes = [];
        nodesByCombo.set(comboId, comboNodes);
      }
      comboNodes.push(node);
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
    const hasCombos = Boolean(
      graphDataRef.current.combos && graphDataRef.current.combos.length > 0
    );
    const isModelView = explorationMode === 'model';
    const useComboGridLayout = shouldUseComboGridLayout(layoutType, {
      hasCombos,
      isHierarchyMode,
      isModelView,
    });
    const graph = new Graph({
      container,
      width,
      height,
      data: graphDataRef.current,
      padding: 0,
      zoomRange: [MIN_ZOOM, MAX_ZOOM],
      zoom: DEFAULT_ZOOM,
      theme: false,
      node: {
        type: (datum: NodeData) =>
          typeof datum.type === 'string' && datum.type.length > 0
            ? datum.type
            : 'rect',
        style: (datum: NodeData) =>
          buildRuntimeNodeStyle(datum, isDataMode, glossaryColorMapRef.current),
      },
      edge: {
        type: () =>
          studioMode && !isDataMode
            ? CARDINALITY_AWARE_QUADRATIC_EDGE_TYPE
            : CARDINALITY_AWARE_LINE_EDGE_TYPE,
        animation: {
          enter: false,
        },
        style: (datum) =>
          buildRuntimeEdgeStyle(
            datum,
            isDataMode,
            settingsRef.current.showEdgeLabels
          ),
      },
      combo: {
        type: 'glossary-combo',
        style: (datum: ComboData) => {
          const d = (datum.data ?? {}) as GraphComboMeta;
          const color = d?.color ?? COMBO_COLOR_FALLBACK;
          const glossaryName = d?.glossaryName ?? '';
          const extraVerticalPadding =
            typeof d?.extraVerticalPadding === 'number'
              ? d.extraVerticalPadding
              : 0;

          return {
            ...buildComboStyle(glossaryName, color, extraVerticalPadding),
            zIndex: 0,
            opacity: d?.isDimmed ? DIMMED_NODE_OPACITY : 1,
          };
        },
      },
      layout: studioMode
        ? { type: 'preset', animation: false }
        : getLayoutConfig(layoutType, inputNodesRef.current.length, {
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
      if (!id) {
        return;
      }
      const node = findNodeById(id);
      if (!node) {
        return;
      }
      const position = getClientPosition(id, {
        x: e.clientX ?? 0,
        y: e.clientY ?? 0,
      });
      const isEditPort = hasShapeClass(
        e.originalTarget,
        STUDIO_EDIT_PORT_CLASS_NAME
      );
      if (
        studioMode &&
        isEditModeRef.current &&
        dispatchStudioEditNodeClick(container, e, id, position, isEditPort)
      ) {
        return;
      }
      onNodeClickRef.current(resolveNodeForCallback(node), position, {
        dataModeAssetBadgeClick:
          isDataMode && isDataModeAssetBadgeShape(e.originalTarget),
        dataModeLoadMoreBadgeClick:
          isDataMode && isDataModeLoadMoreBadgeShape(e.originalTarget),
      });
    };

    const handleNodeDblClick = (e: IElementEvent) => {
      const id = e.target.id;
      if (id) {
        const node = findNodeById(id);
        if (node) {
          onNodeDoubleClickRef.current(resolveNodeForCallback(node));
        }
      }
    };

    const cancelEditGesture = () => {
      container.dispatchEvent(new Event(ONTOLOGY_EDIT_CANCEL_EVENT));
    };
    const writeGraphSnapshot = () => {
      const positions = Object.fromEntries(
        graph.getNodeData().flatMap((node) => {
          try {
            const canvasPosition = graph.getElementPosition(node.id);
            const clientPosition = graph.getClientByCanvas(canvasPosition);

            return [
              [String(node.id), { x: clientPosition[0], y: clientPosition[1] }],
            ];
          } catch {
            return [];
          }
        })
      );
      container.dataset.graphZoom = String(graph.getZoom());
      container.dataset.nodePositions = JSON.stringify(positions);
    };

    graph.on(NodeEvent.CLICK, handleNodeClick);
    graph.on(NodeEvent.DBLCLICK, handleNodeDblClick);
    graph.on(NodeEvent.DRAG_START, cancelEditGesture);
    graph.on(GraphEvent.AFTER_DRAW, writeGraphSnapshot);
    graph.on(GraphEvent.AFTER_TRANSFORM, cancelEditGesture);
    graph.on(GraphEvent.AFTER_TRANSFORM, writeGraphSnapshot);
    graph.on(CanvasEvent.CLICK, () => {
      setClickedEdgeIdRef.current(null);
      onPaneClickRef.current();
    });

    const handleEdgeClick = (e: IElementEvent) => {
      setClickedEdgeIdRef.current(e.target.id ?? null);
    };
    graph.on('edge:click', handleEdgeClick);

    const TOOLBAR_AREA_PX = 80;

    const checkEdgeProximity = () => {
      const g = graphRef.current;
      const c = containerRef.current;
      if (!g || !c || !graphBoundsRef.current) {
        return;
      }
      if (!onScrollNearEdgeRef.current || isProgrammaticTransformRef.current) {
        return;
      }

      const W = c.offsetWidth;
      const H = c.offsetHeight;
      // Canvas Y that corresponds to the toolbar zone in viewport space.
      const canvasAtToolbar = g.getCanvasByViewport([
        W / 2,
        H - TOOLBAR_AREA_PX,
      ]);
      const cvpAtToolbar = Array.isArray(canvasAtToolbar)
        ? canvasAtToolbar[1]
        : (canvasAtToolbar as unknown as ArrayLike<number>)[1];

      const { maxY } = graphBoundsRef.current;
      // Fire when the bottom-most nodes have scrolled up to the toolbar level.
      if (cvpAtToolbar >= maxY) {
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
    const drawInitialGraph = async () => {
      if (studioMode) {
        await positionStudioNodes(graph);
        if (!renderCancelled) {
          await graph.draw();
        }

        return;
      }
      if (hasBakedPositions) {
        applyBakedPositions(graph, graphDataRef.current.nodes ?? []);
        if (isDataMode) {
          positionAssetNodes(graph);
        }
        await graph.draw();

        return;
      }
      if (useComboGridLayout) {
        positionModelModeNodes(graph);
        await graph.draw();

        return;
      }
      if (isModelView && layoutType === LayoutEngine.Circular) {
        positionCircularNodes(graph);
        await graph.draw();

        return;
      }

      await runLayout(graph);
      if (!renderCancelled) {
        await graph.draw();
      }
    };
    const resetInitialViewport = async () => {
      if (studioMode) {
        await graph.zoomTo(DEFAULT_ZOOM, { duration: 0 });
        await graph.translateTo([0, 0], { duration: 0 });

        return;
      }

      await fitAndClampZoom();
    };
    const recoverInitialRender = async () => {
      try {
        await graph.draw();
        if (renderCancelled) {
          return;
        }
        await resetInitialViewport();
        recomputeGraphBounds();
      } catch {
        // Graph may have been destroyed while the recovery draw was pending.
      }
    };
    const runRender = async () => {
      suppressEdgeCheck(1500);
      try {
        await drawInitialGraph();
        if (renderCancelled) {
          return;
        }
        await resetInitialViewport();
        recomputeGraphBounds();
      } catch {
        if (renderCancelled) {
          return;
        }
        // Layout or draw failed — attempt a bare draw so at least something
        // renders, then restore a usable viewport.
        await recoverInitialRender();
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
      graph.off(NodeEvent.DRAG_START, cancelEditGesture);
      graph.off(GraphEvent.AFTER_DRAW, writeGraphSnapshot);
      graph.off(CanvasEvent.CLICK);
      graph.off('edge:click', handleEdgeClick);
      graph.off(GraphEvent.AFTER_TRANSFORM, scheduleTransformWork);
      graph.off(GraphEvent.AFTER_TRANSFORM, cancelEditGesture);
      graph.off(GraphEvent.AFTER_TRANSFORM, writeGraphSnapshot);
      graph.destroy();
      graphRef.current = null;
    };
  }, [
    applyBakedPositions,
    containerRef,
    termNodeCount,
    explorationMode,
    hasBakedPositions,
    layoutType,
    studioMode,
    positionAssetNodes,
    positionCircularNodes,
    positionModelModeNodes,
    positionStudioNodes,
    recomputeGraphBounds,
    suppressEdgeCheck,
  ]);

  useEffect(() => {
    const graph = getActiveGraph(graphRef.current, inputNodes.length);
    if (!graph) {
      return;
    }

    const dataSignatureChanged = prevDataSignatureRef.current !== dataSignature;

    const isDataMode = explorationMode === 'data';
    const { asset: newAssetFingerprint, term: newTermFingerprint } =
      getGraphFingerprints(
        inputNodes,
        mergedEdgesList,
        explorationMode,
        layoutType,
        expandedTermIds
      );

    const termFingerprintChanged = didTermFingerprintChange(
      dataSignatureChanged,
      newTermFingerprint,
      termFingerprintRef.current
    );
    const assetFingerprintChanged =
      newAssetFingerprint !== assetFingerprintRef.current;
    const layoutTypeChanged = didLayoutTypeChange(
      prevLayoutTypeRef.current,
      layoutType
    );
    prevLayoutTypeRef.current = layoutType;
    const finishInitialSync = () => {
      if (!justInitializedRef.current) {
        return false;
      }
      justInitializedRef.current = false;
      prevDataSignatureRef.current = dataSignature ?? '';
      termFingerprintRef.current = newTermFingerprint;
      assetFingerprintRef.current = newAssetFingerprint;

      return true;
    };
    if (finishInitialSync()) {
      return;
    }

    if (dataSignatureChanged) {
      prevDataSignatureRef.current = dataSignature ?? '';
    }
    const structuralChanged = termFingerprintChanged || assetFingerprintChanged;
    const topologySynced = isGraphTopologySynced(graph, graphData);
    const canPatchInPlace = !structuralChanged && topologySynced;
    const applySynchronousUpdate = () => {
      if (
        canPatchInPlace &&
        patchGraphDataInPlace(graph, graphData, isDataMode)
      ) {
        return true;
      }
      if (
        applyAdditiveGraphUpdate(
          graph,
          graphData,
          isDataMode,
          assetToTermMapRef.current
        )
      ) {
        if (termFingerprintChanged) {
          termFingerprintRef.current = newTermFingerprint;
        }

        return true;
      }
      // An expansion can change badges before its asset request changes
      // topology; patching keeps the camera stable during that interim render.
      const canPatchAssetToggle =
        assetFingerprintChanged && !termFingerprintChanged && topologySynced;
      if (canPatchAssetToggle) {
        assetFingerprintRef.current = newAssetFingerprint;
        patchGraphDataInPlace(graph, graphData, isDataMode);

        return true;
      }

      return false;
    };
    if (applySynchronousUpdate()) {
      return;
    }
    const recordChangedFingerprints = () => {
      if (termFingerprintChanged) {
        termFingerprintRef.current = newTermFingerprint;
      }
      if (assetFingerprintChanged) {
        assetFingerprintRef.current = newAssetFingerprint;
      }
    };
    recordChangedFingerprints();

    const hasCombos = Boolean(graphData.combos && graphData.combos.length > 0);
    const isHierarchyMode = explorationMode === 'hierarchy';
    const isModelViewLocal = explorationMode === 'model';
    const layoutOptions = getLayoutConfig(layoutType, inputNodes.length, {
      hasCombos,
      isDataMode,
      isHierarchyMode,
      isModelView: isModelViewLocal,
    });
    const useComboGridLayout = shouldUseComboGridLayout(layoutType, {
      hasCombos,
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

    const capturePreUpdatePositions = () => {
      const positions: Record<string, [number, number]> = {};
      if (!isDataMode || termFingerprintChanged) {
        return positions;
      }
      inputNodesRef.current.forEach((node) => {
        try {
          const position = graph.getElementPosition(node.id);
          if (position) {
            positions[node.id] = [position[0], position[1]];
          }
        } catch {
          // A newly added node may not have a position until the next draw.
        }
      });

      return positions;
    };
    const restorePreUpdatePositions = (
      positions: Record<string, [number, number]>
    ) => {
      const updates = (graphData.nodes ?? []).flatMap((node) => {
        const position = positions[String(node.id)];
        if (!position) {
          return [];
        }

        return [
          {
            id: node.id,
            style: {
              ...((node.style as Record<string, unknown>) ?? {}),
              x: position[0],
              y: position[1],
            },
          },
        ];
      });
      if (updates.length > 0) {
        graph.updateNodeData(updates);
      }
    };
    const applyUpdateLayout = async (
      preUpdatePositions: Record<string, [number, number]>
    ) => {
      if (studioMode) {
        await positionStudioNodes(graph);

        return;
      }
      if (useComboGridLayout) {
        positionModelModeNodes(graph);

        return;
      }
      if (isModelViewLocal && layoutType === LayoutEngine.Circular) {
        positionCircularNodes(graph);

        return;
      }
      if (hasBakedPositions) {
        const canRestorePositions =
          isDataMode &&
          !termFingerprintChanged &&
          Object.keys(preUpdatePositions).length > 0;
        if (canRestorePositions) {
          restorePreUpdatePositions(preUpdatePositions);
        } else {
          applyBakedPositions(graph, graphData.nodes ?? []);
        }

        return;
      }
      graph.setLayout(layoutOptions);
      try {
        await runLayout(graph);
      } catch {
        // Drawing with default positions is preferable to leaving a blank graph.
      }
    };
    const updateViewportAfterDraw = async () => {
      if (studioMode && termFingerprintChanged) {
        await graph.zoomTo(DEFAULT_ZOOM, { duration: 0 });
        await graph.translateTo([0, 0], { duration: 0 });

        return;
      }
      if (!studioMode && (termFingerprintChanged || layoutTypeChanged)) {
        await fitViewWithMinZoom(graph);
      }
    };
    const runUpdate = async () => {
      suppressEdgeCheck(1500);
      try {
        graph.stopLayout();
        if (cancelled) {
          return;
        }
        setClickedEdgeIdRef.current(null);
        const preUpdatePositions = capturePreUpdatePositions();
        graph.setData(graphData);
        await applyUpdateLayout(preUpdatePositions);

        // Asset positions are derived from baked term coordinates before draw,
        // avoiding the visible second paint previously needed for spiral layout.
        if (isDataMode) {
          positionAssetNodes(graph);
        }
        if (cancelled || graph.destroyed) {
          return;
        }
        await graph.draw();
        if (cancelled) {
          return;
        }
        await updateViewportAfterDraw();
        recomputeGraphBounds();
      } catch {
        // Draw rejections are expected when navigation destroys an in-flight graph.
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
    positionStudioNodes,
    studioMode,
    recomputeGraphBounds,
    suppressEdgeCheck,
  ]);

  return {
    graphRef,
    extractNodePositions,
    suppressEdgeCheck,
  };
}
