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
import type { ComboData, EdgeData, NodeData } from '@antv/g6';
import { useCallback, useMemo } from 'react';
import { Glossary } from '../../../generated/entity/data/glossary';
import { RelationshipType } from '../../../generated/entity/data/relationshipType';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import {
  DATA_MODE_ASSET_CIRCLE_SIZE,
  DATA_MODE_ASSET_EDGE_STROKE_COLOR,
  DATA_MODE_TERM_H_SPACING,
  DATA_MODE_TERM_NODE_SIZE,
  DATA_MODE_TERM_V_SPACING,
  DIMMED_EDGE_LABEL_OPACITY,
  DIMMED_EDGE_OPACITY,
  EDGE_LINE_APPEND_WIDTH,
  EDGE_STROKE_COLOR,
  NODE_BORDER_COLOR,
  RELATION_COLORS,
  RELATION_META,
} from '../OntologyExplorer.constants';
import {
  BuildGraphDataProps,
  ExplorationMode,
  GraphSearchHighlightInput,
  HierarchyComboInfo,
  MergedEdge,
  OntologyEdge,
  OntologyNode,
} from '../OntologyExplorer.interface';
import {
  OBSERVED_LINEAGE_EDGE_KIND,
  SEMANTIC_PROJECTION_EDGE_KIND,
} from '../utils/graphBuilders';
import {
  BADGE_MIN_NODE_WIDTH,
  estimateNodeWidth,
  MODEL_NODE_MAX_WIDTH,
  NODE_HEIGHT,
  truncateNodeLabelByWidth,
} from '../utils/graphConfig';
import {
  buildComboStyle,
  buildDataModeAssetNodeStyle,
  buildDataModeTermNodeStyle,
  buildDefaultRectNodeStyle,
  formatRelationLabel,
  getCanvasColor,
  getEdgeRelationLabelStyle,
} from '../utils/graphStyles';
import {
  computeGlossaryGroupPositions,
  computeOutermostRingRadius,
} from '../utils/layoutCalculations';
import {
  getInverseRelationshipName,
  getRelationshipCardinalityLabels,
  getRelationshipColor,
  isSymmetricRelationship,
} from '../utils/relationshipTypeUtils';

const COLOR_BLUE_600 = 'var(--color-blue-600)';

const STUDIO_DEFAULT_ACCENT = '#84CAFF';
const STUDIO_COMPLIANCE_ACCENT = '#DC6803';
const STUDIO_ISOLATED_ACCENT = '#F79009';

// px between badge centres (badge height ~22px + gap); shared by edge label
// offsetting, curve offsets, and combo padding calculations below.
const BADGE_V_STEP = 44;

export function getStudioNodeAccentColor(node: OntologyNode): string {
  if (node.type === 'glossaryTermIsolated') {
    return STUDIO_ISOLATED_ACCENT;
  }

  const hierarchyRoot = node.fullyQualifiedName?.split('.')[1]?.toLowerCase();

  return hierarchyRoot?.startsWith('compliance')
    ? STUDIO_COMPLIANCE_ACCENT
    : STUDIO_DEFAULT_ACCENT;
}

export function getOntologyEdgeId(edge: MergedEdge): string {
  const identity =
    edge.id ??
    `${edge.from}-${edge.to}-${edge.relationType}-${
      edge.edgeKind ?? 'ontology'
    }`;

  return `edge-${identity}`;
}

function getCardinalityEndLabels(
  relationType: string,
  cardinalityMap: Map<string, RelationshipType>
): { startLabelText: string; endLabelText: string } | null {
  const relationshipType = cardinalityMap.get(relationType);
  const labels = relationshipType
    ? getRelationshipCardinalityLabels(relationshipType)
    : null;

  return labels;
}

interface RelationMaps {
  inverseMap: Record<string, string>;
  symmetricSet: Set<string>;
}

function buildRelationMaps(configuredTypes?: RelationshipType[]): RelationMaps {
  const inverseMap: Record<string, string> = {};
  const symmetricSet = new Set<string>();
  configuredTypes?.forEach((relationshipType) => {
    const inverseName = getInverseRelationshipName(relationshipType);
    if (inverseName) {
      inverseMap[relationshipType.name] = inverseName;
      if (!(inverseName in inverseMap)) {
        inverseMap[inverseName] = relationshipType.name;
      }
    }
    if (isSymmetricRelationship(relationshipType)) {
      symmetricSet.add(relationshipType.name);
    }
  });

  return { inverseMap, symmetricSet };
}

function isInversePair(
  a: string,
  b: string,
  inverseMap: Record<string, string>
): boolean {
  return inverseMap[a] === b || inverseMap[b] === a;
}

function groupEdgesByPair(
  inputEdges: OntologyEdge[]
): Map<string, OntologyEdge[]> {
  const pairGroups = new Map<string, OntologyEdge[]>();
  inputEdges.forEach((edge) => {
    const pairKey = [edge.from, edge.to]
      .sort((a, b) => a.localeCompare(b))
      .join('::');
    const list = pairGroups.get(pairKey) ?? [];
    list.push(edge);
    pairGroups.set(pairKey, list);
  });

  return pairGroups;
}

function findMirrorEdgeIndex(
  list: OntologyEdge[],
  startIndex: number,
  edge: OntologyEdge,
  isSymmetric: boolean,
  consumed: Set<number>,
  inverseMap: Record<string, string>
): number {
  for (let j = startIndex; j < list.length; j++) {
    if (consumed.has(j)) {
      continue;
    }
    const other = list[j];
    if (other.from !== edge.to || other.to !== edge.from) {
      continue;
    }
    if (other.edgeKind !== edge.edgeKind) {
      continue;
    }
    const isSymmetricMatch =
      isSymmetric && other.relationType === edge.relationType;
    if (
      isSymmetricMatch ||
      isInversePair(edge.relationType, other.relationType, inverseMap)
    ) {
      return j;
    }
  }

  return -1;
}

// Extracted so the run of optional-field ternaries lives in its own
// complexity scope instead of buildMergedEdge's.
function buildOptionalEdgeFields(
  edge: OntologyEdge,
  match: OntologyEdge | null
): Partial<MergedEdge> {
  return {
    ...(edge.id ? { id: edge.id } : {}),
    ...(match && edge.relationType !== match.relationType
      ? { inverseRelationType: match.relationType }
      : {}),
    ...(edge.edgeKind ? { edgeKind: edge.edgeKind } : {}),
    ...(edge.provenance ? { provenance: edge.provenance } : {}),
    ...(edge.status ? { status: edge.status } : {}),
    ...(edge.createdBy ? { createdBy: edge.createdBy } : {}),
    ...(edge.createdAt ? { createdAt: edge.createdAt } : {}),
    ...(edge.relationshipType
      ? { relationshipType: edge.relationshipType }
      : {}),
  };
}

function buildMergedEdge(
  edge: OntologyEdge,
  match: OntologyEdge | null,
  isSymmetric: boolean
): MergedEdge {
  return {
    ...buildOptionalEdgeFields(edge, match),
    from: edge.from,
    to: edge.to,
    relationType: edge.relationType,
    isBidirectional: match ? true : isSymmetric,
  };
}

export function mergeEdges(
  inputEdges: OntologyEdge[],
  configuredTypes?: RelationshipType[]
): MergedEdge[] {
  const { inverseMap, symmetricSet } = buildRelationMaps(configuredTypes);
  const pairGroups = groupEdgesByPair(inputEdges);

  const result: MergedEdge[] = [];
  for (const list of pairGroups.values()) {
    const consumed = new Set<number>();
    for (let i = 0; i < list.length; i++) {
      if (consumed.has(i)) {
        continue;
      }
      const edge = list[i];
      const isSymmetric = symmetricSet.has(edge.relationType);
      const matchIndex = findMirrorEdgeIndex(
        list,
        i + 1,
        edge,
        isSymmetric,
        consumed,
        inverseMap
      );

      consumed.add(i);
      if (matchIndex < 0) {
        result.push(buildMergedEdge(edge, null, isSymmetric));

        continue;
      }
      consumed.add(matchIndex);
      result.push(buildMergedEdge(edge, list[matchIndex], isSymmetric));
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Search-highlight sets
// ---------------------------------------------------------------------------

interface SearchHighlightSets {
  active: boolean;
  nodeSet: Set<string> | null;
  edgeSet: Set<string> | null;
  glossarySet: Set<string> | null;
}

function computeSearchHighlightSets(
  graphSearchHighlight?: GraphSearchHighlightInput | null
): SearchHighlightSets {
  const active = Boolean(graphSearchHighlight?.active);
  if (!active) {
    return { active, nodeSet: null, edgeSet: null, glossarySet: null };
  }

  const nodeSet = new Set(graphSearchHighlight?.highlightedNodeIds ?? []);
  const edgeSet = new Set(graphSearchHighlight?.highlightedEdgeKeys ?? []);
  const glossarySet =
    (graphSearchHighlight?.highlightedGlossaryIds.length ?? 0) > 0
      ? new Set(graphSearchHighlight?.highlightedGlossaryIds ?? [])
      : null;

  return { active, nodeSet, edgeSet, glossarySet };
}

// ---------------------------------------------------------------------------
// Per-exploration-mode node/edge subset selection
// ---------------------------------------------------------------------------

interface DataModeSubset {
  nodesForGraph: OntologyNode[];
  edgesForGraph: MergedEdge[];
  termAssetCountMap: Map<string, number>;
  termHSpacing: number;
  termVSpacing: number;
}

function computeAssetAndTermIdSets(inputNodes: OntologyNode[]): {
  allAssetIds: Set<string>;
  allTermIds: Set<string>;
} {
  const allAssetIds = new Set(
    inputNodes
      .filter((n) => n.type === 'dataAsset' || n.type === 'metric')
      .map((n) => n.id)
  );
  const allTermIds = new Set(
    inputNodes.filter((n) => !allAssetIds.has(n.id)).map((n) => n.id)
  );

  return { allAssetIds, allTermIds };
}

function computeVisibleAssetIds(
  idsToExpand: Set<string>,
  allTermIds: Set<string>,
  allAssetIds: Set<string>,
  mergedEdgesList: MergedEdge[]
): Set<string> {
  const visibleAssetIds = new Set<string>();
  idsToExpand.forEach((termId) => {
    if (!allTermIds.has(termId)) {
      return;
    }
    mergedEdgesList.forEach((edge) => {
      if (edge.from === termId && allAssetIds.has(edge.to)) {
        visibleAssetIds.add(edge.to);
      }
      if (edge.to === termId && allAssetIds.has(edge.from)) {
        visibleAssetIds.add(edge.from);
      }
    });
  });

  return visibleAssetIds;
}

function computeExpandedTermSpacing(
  idsToExpand: Set<string>,
  allTermIds: Set<string>,
  allAssetIds: Set<string>,
  mergedEdgesList: MergedEdge[]
): { termHSpacing: number; termVSpacing: number } {
  let termHSpacing = DATA_MODE_TERM_H_SPACING;
  let termVSpacing = DATA_MODE_TERM_V_SPACING;
  if (idsToExpand.size === 0) {
    return { termHSpacing, termVSpacing };
  }

  let maxFootprint = 0;
  idsToExpand.forEach((termId) => {
    if (!allTermIds.has(termId)) {
      return;
    }
    let visibleCount = 0;
    mergedEdgesList.forEach((edge) => {
      if (edge.from === termId && allAssetIds.has(edge.to)) {
        visibleCount++;
      }
      if (edge.to === termId && allAssetIds.has(edge.from)) {
        visibleCount++;
      }
    });
    const footprint = computeOutermostRingRadius(visibleCount);
    if (footprint > maxFootprint) {
      maxFootprint = footprint;
    }
  });
  if (maxFootprint > 0) {
    const minSpacing = maxFootprint * 2 + 40;
    termHSpacing = Math.max(DATA_MODE_TERM_H_SPACING, minSpacing);
    termVSpacing = Math.max(DATA_MODE_TERM_V_SPACING, minSpacing);
  }

  return { termHSpacing, termVSpacing };
}

function computeTermLabelHSpacing(
  inputNodes: OntologyNode[],
  allAssetIds: Set<string>,
  baseHSpacing: number
): number {
  const LABEL_SPACING_GAP = 56;
  const maxTermLabelWidth = inputNodes.reduce((max, n) => {
    if (allAssetIds.has(n.id)) {
      return max;
    }
    const rawLabel = n.originalLabel ?? n.label;
    const w = Math.min(MODEL_NODE_MAX_WIDTH, estimateNodeWidth(rawLabel));

    return Math.max(max, w);
  }, 0);

  return maxTermLabelWidth > 0
    ? Math.max(baseHSpacing, maxTermLabelWidth + LABEL_SPACING_GAP)
    : baseHSpacing;
}

function computeTermAssetCountMap(
  inputNodes: OntologyNode[],
  allTermIds: Set<string>,
  allAssetIds: Set<string>,
  mergedEdgesList: MergedEdge[]
): Map<string, number> {
  const termAssetCountMap = new Map<string, number>();
  inputNodes.forEach((node) => {
    if (allTermIds.has(node.id) && typeof node.assetCount === 'number') {
      termAssetCountMap.set(node.id, node.assetCount);
    }
  });
  mergedEdgesList.forEach((edge) => {
    if (
      allTermIds.has(edge.from) &&
      allAssetIds.has(edge.to) &&
      !termAssetCountMap.has(edge.from)
    ) {
      termAssetCountMap.set(
        edge.from,
        (termAssetCountMap.get(edge.from) ?? 0) + 1
      );
    }
    if (
      allAssetIds.has(edge.from) &&
      allTermIds.has(edge.to) &&
      !termAssetCountMap.has(edge.to)
    ) {
      termAssetCountMap.set(edge.to, (termAssetCountMap.get(edge.to) ?? 0) + 1);
    }
  });

  return termAssetCountMap;
}

function filterDataModeEdges(
  mergedEdgesList: MergedEdge[],
  visibleIds: Set<string>,
  allAssetIds: Set<string>,
  idsToExpand: Set<string>
): MergedEdge[] {
  return mergedEdgesList.filter((e) => {
    if (!visibleIds.has(e.from) || !visibleIds.has(e.to)) {
      return false;
    }
    const fromIsAsset = allAssetIds.has(e.from);
    const toIsAsset = allAssetIds.has(e.to);
    if (fromIsAsset && toIsAsset) {
      return true;
    }
    if (fromIsAsset || toIsAsset) {
      const termId = fromIsAsset ? e.to : e.from;

      return idsToExpand.has(termId);
    }

    return true;
  });
}

function computeDataModeSubset(
  inputNodes: OntologyNode[],
  mergedEdgesList: MergedEdge[],
  expandedTermIds?: Set<string>
): DataModeSubset {
  const { allAssetIds, allTermIds } = computeAssetAndTermIdSets(inputNodes);
  const visibleTermIds = new Set(allTermIds);
  const idsToExpand =
    expandedTermIds && expandedTermIds.size > 0
      ? expandedTermIds
      : new Set<string>();
  const visibleAssetIds = computeVisibleAssetIds(
    idsToExpand,
    allTermIds,
    allAssetIds,
    mergedEdgesList
  );

  const spacing = computeExpandedTermSpacing(
    idsToExpand,
    allTermIds,
    allAssetIds,
    mergedEdgesList
  );
  const termHSpacing = computeTermLabelHSpacing(
    inputNodes,
    allAssetIds,
    spacing.termHSpacing
  );
  const termVSpacing = spacing.termVSpacing;

  const termAssetCountMap = computeTermAssetCountMap(
    inputNodes,
    allTermIds,
    allAssetIds,
    mergedEdgesList
  );

  const visibleIds = new Set([...visibleTermIds, ...visibleAssetIds]);
  const nodesForGraph = inputNodes.filter((n) => visibleIds.has(n.id));
  const edgesForGraph = filterDataModeEdges(
    mergedEdgesList,
    visibleIds,
    allAssetIds,
    idsToExpand
  );

  return {
    nodesForGraph,
    edgesForGraph,
    termAssetCountMap,
    termHSpacing,
    termVSpacing,
  };
}

function computeHierarchyModeSubset(
  inputNodes: OntologyNode[],
  inputEdges: OntologyEdge[]
): { nodesForGraph: OntologyNode[]; edgesForGraph: MergedEdge[] } {
  const nodesForGraph = inputNodes;
  const edgesForGraph: MergedEdge[] = inputEdges.map((e) => ({
    from: e.from,
    to: e.to,
    relationType: e.relationType,
    ...(e.inverseRelationType
      ? { inverseRelationType: e.inverseRelationType }
      : {}),
    isBidirectional: Boolean(e.inverseRelationType),
  }));

  return { nodesForGraph, edgesForGraph };
}

function selectModeGraphSubset(
  explorationMode: ExplorationMode,
  inputNodes: OntologyNode[],
  inputEdges: OntologyEdge[],
  mergedEdgesList: MergedEdge[],
  expandedTermIds?: Set<string>
): DataModeSubset {
  if (explorationMode === 'data') {
    return computeDataModeSubset(inputNodes, mergedEdgesList, expandedTermIds);
  }
  if (explorationMode === 'hierarchy') {
    const { nodesForGraph, edgesForGraph } = computeHierarchyModeSubset(
      inputNodes,
      inputEdges
    );

    return {
      nodesForGraph,
      edgesForGraph,
      termAssetCountMap: new Map<string, number>(),
      termHSpacing: DATA_MODE_TERM_H_SPACING,
      termVSpacing: DATA_MODE_TERM_V_SPACING,
    };
  }

  return {
    nodesForGraph: inputNodes,
    edgesForGraph: mergedEdgesList,
    termAssetCountMap: new Map<string, number>(),
    termHSpacing: DATA_MODE_TERM_H_SPACING,
    termVSpacing: DATA_MODE_TERM_V_SPACING,
  };
}

function buildNodeLookupMaps(nodesForGraph: OntologyNode[]): {
  nodeIdToGlossaryId: Map<string, string>;
  nodeIdToType: Map<string, string>;
} {
  const nodeIdToGlossaryId = new Map<string, string>();
  const nodeIdToType = new Map<string, string>();
  nodesForGraph.forEach((n) => {
    if (n.glossaryId) {
      nodeIdToGlossaryId.set(n.id, n.glossaryId);
    }
    nodeIdToType.set(n.id, n.type);
  });

  return { nodeIdToGlossaryId, nodeIdToType };
}

function computeLocalAssetToTermColor(
  nodesForGraph: OntologyNode[],
  edgesForGraph: MergedEdge[],
  glossaryColorMap: Record<string, string>
): Map<string, string> {
  const localAssetToTermColor = new Map<string, string>();
  const termIdSet = new Set(
    nodesForGraph
      .filter((n) => n.type !== 'dataAsset' && n.type !== 'metric')
      .map((n) => n.id)
  );
  const getTermColor = (termId: string): string => {
    const termNode = nodesForGraph.find((n) => n.id === termId);

    return termNode?.glossaryId
      ? glossaryColorMap[termNode.glossaryId] ?? COLOR_BLUE_600
      : COLOR_BLUE_600;
  };
  edgesForGraph.forEach((edge) => {
    const fromIsTerm = termIdSet.has(edge.from);
    const toIsTerm = termIdSet.has(edge.to);
    if (fromIsTerm && !toIsTerm) {
      localAssetToTermColor.set(edge.to, getTermColor(edge.from));
    } else if (toIsTerm && !fromIsTerm) {
      localAssetToTermColor.set(edge.from, getTermColor(edge.to));
    }
  });

  return localAssetToTermColor;
}

// ---------------------------------------------------------------------------
// Node building
// ---------------------------------------------------------------------------

interface NodeBuildContext {
  explorationMode: ExplorationMode;
  studioMode: boolean;
  isEditMode: boolean;
  selectedNodeId: string | null;
  neighborSet: Set<string>;
  searchHighlightActive: boolean;
  searchNodeSet: Set<string> | null;
  nodePositions?: Record<string, { x: number; y: number }>;
  dataModeTermPositions: Record<string, { x: number; y: number }>;
  localAssetToTermColor: Map<string, string>;
  termAssetCountMap: Map<string, number>;
  expandedTermIds?: Set<string>;
  computeNodeColor: (node: OntologyNode) => string;
}

interface NodeVisualState {
  color: string;
  height: number;
  rawLabel: string;
  isDataAsset: boolean;
  nodeWidth: number;
  label: string;
  studioAccentColor: string | undefined;
  pos: { x: number; y: number } | undefined;
  isSelected: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
}

function computeNodePosition(
  node: OntologyNode,
  isDataAsset: boolean,
  ctx: NodeBuildContext
): { x: number; y: number } | undefined {
  if (ctx.explorationMode === 'hierarchy') {
    return ctx.nodePositions?.[node.id];
  }
  if (ctx.explorationMode === 'data') {
    return isDataAsset ? undefined : ctx.dataModeTermPositions[node.id];
  }

  return undefined;
}

function computeNodeSelectionState(
  node: OntologyNode,
  ctx: NodeBuildContext
): { isSelected: boolean; isHighlighted: boolean; isDimmed: boolean } {
  const isSelected =
    ctx.explorationMode === 'hierarchy'
      ? node.termId === ctx.selectedNodeId || ctx.selectedNodeId === node.id
      : ctx.selectedNodeId === node.id;
  const isHighlighted =
    ctx.selectedNodeId !== null && !isSelected && ctx.neighborSet.has(node.id);
  const isDimmedBySelection =
    ctx.selectedNodeId !== null && !isSelected && !ctx.neighborSet.has(node.id);
  const isDimmedBySearch =
    ctx.searchNodeSet != null && !ctx.searchNodeSet.has(node.id);
  const isDimmed = ctx.searchHighlightActive
    ? isDimmedBySearch
    : isDimmedBySelection;

  return { isSelected, isHighlighted, isDimmed };
}

function computeNodeVisualState(
  node: OntologyNode,
  ctx: NodeBuildContext
): NodeVisualState {
  const color = ctx.computeNodeColor(node);
  const height = NODE_HEIGHT;
  const rawLabel = node.originalLabel ?? node.label;
  const isInModelMode = ctx.explorationMode === 'model';
  const isDataAsset = node.type === 'dataAsset' || node.type === 'metric';
  const shouldTruncateLabel =
    isInModelMode || (ctx.explorationMode === 'data' && !isDataAsset);
  const estimatedWidth = estimateNodeWidth(rawLabel);
  const nodeWidth = ctx.studioMode
    ? MODEL_NODE_MAX_WIDTH
    : shouldTruncateLabel
    ? Math.min(MODEL_NODE_MAX_WIDTH, estimatedWidth)
    : estimatedWidth;
  const label = shouldTruncateLabel
    ? truncateNodeLabelByWidth(rawLabel, nodeWidth)
    : rawLabel;
  const studioAccentColor = ctx.studioMode
    ? getStudioNodeAccentColor(node)
    : undefined;
  const pos = computeNodePosition(node, isDataAsset, ctx);
  const { isSelected, isHighlighted, isDimmed } = computeNodeSelectionState(
    node,
    ctx
  );

  return {
    color,
    height,
    rawLabel,
    isDataAsset,
    nodeWidth,
    label,
    studioAccentColor,
    pos,
    isSelected,
    isHighlighted,
    isDimmed,
  };
}

function buildHierarchyNodeData(
  node: OntologyNode,
  state: NodeVisualState
): NodeData {
  const comboId = `hierarchy-combo-${node.glossaryId}`;
  const ontologyNode = node.originalNode ?? node;
  const effectiveWidth = node.originalGlossary
    ? Math.max(state.nodeWidth, BADGE_MIN_NODE_WIDTH)
    : state.nodeWidth;

  return {
    id: node.id,
    data: {
      ontologyNode,
      label: state.label,
      color: state.color,
      isSelected: state.isSelected,
      isHighlighted: state.isHighlighted,
      isDimmed: state.isDimmed,
      size: [effectiveWidth, state.height],
      nodeWidth: effectiveWidth,
      glossaryId: node.glossaryId ?? '',
      hierarchyBadge: node.originalGlossary
        ? node.glossaryName ?? node.originalGlossary
        : undefined,
    },
    style: buildDefaultRectNodeStyle(
      getCanvasColor,
      state.label,
      [effectiveWidth, state.height],
      state.pos
    ),
    combo: comboId,
  };
}

function buildDataModeAssetNodeData(
  node: OntologyNode,
  state: NodeVisualState,
  ctx: NodeBuildContext
): NodeData {
  const sz = DATA_MODE_ASSET_CIRCLE_SIZE;
  const assetColor =
    ctx.localAssetToTermColor.get(node.id) ?? NODE_BORDER_COLOR;
  const entityTypeLabel =
    node.entityRef?.type !== undefined
      ? entityUtilClassBase.getFormattedEntityType(node.entityRef.type)
      : undefined;
  const entityIconUrl = serviceUtilClassBase.getServiceTypeLogo({
    entityType: node.entityRef?.type,
    serviceType: node.serviceLabel,
  });

  return {
    id: node.id,
    type: 'data-mode-asset',
    data: {
      ontologyNode: node,
      label: state.label,
      color: state.color,
      assetColor,
      isSelected: state.isSelected,
      isHighlighted: state.isHighlighted,
      isDimmed: state.isDimmed,
      size: [sz, sz],
      nodeWidth: state.nodeWidth,
      glossaryId: node.glossaryId ?? '',
    },
    style: buildDataModeAssetNodeStyle(
      getCanvasColor,
      state.label,
      assetColor,
      state.pos,
      entityTypeLabel,
      entityIconUrl
    ),
  };
}

function buildDataModeTermNodeData(
  node: OntologyNode,
  state: NodeVisualState,
  ctx: NodeBuildContext
): NodeData {
  const sz = DATA_MODE_TERM_NODE_SIZE;
  const assetCount = ctx.termAssetCountMap.get(node.id) ?? 0;
  const assetsExpanded = Boolean(ctx.expandedTermIds?.has(node.id));

  return {
    id: node.id,
    type: 'circle',
    data: {
      ontologyNode: node,
      label: state.label,
      color: state.color,
      isSelected: state.isSelected,
      isHighlighted: state.isHighlighted,
      isDimmed: state.isDimmed,
      size: [sz, sz],
      nodeWidth: state.nodeWidth,
      glossaryId: node.glossaryId ?? '',
      assetCount,
      loadedAssetCount: node.loadedAssetCount ?? 0,
      assetsExpanded,
      isLoadingAssets: node.isLoadingAssets ?? false,
    },
    style: buildDataModeTermNodeStyle(
      getCanvasColor,
      state.label,
      state.color,
      state.pos
    ),
  };
}

function buildDefaultNodeData(
  node: OntologyNode,
  state: NodeVisualState,
  ctx: NodeBuildContext
): NodeData {
  return {
    id: node.id,
    ...(ctx.studioMode ? { type: 'studio-term' } : {}),
    data: {
      ontologyNode: node,
      label: state.label,
      color: state.color,
      isSelected: state.isSelected,
      isHighlighted: state.isHighlighted,
      isDimmed: state.isDimmed,
      size: [state.nodeWidth, state.height],
      nodeWidth: state.nodeWidth,
      glossaryId: node.glossaryId ?? '',
      studioMode: ctx.studioMode,
      studioAccentColor: state.studioAccentColor,
    },
    style: {
      ...buildDefaultRectNodeStyle(
        getCanvasColor,
        state.label,
        [state.nodeWidth, state.height],
        state.pos
      ),
      ...(ctx.studioMode && {
        label: false,
        stroke: node.type === 'glossaryTermIsolated' ? '#FEDF89' : '#E9EAEB',
        studioLabelText: state.label,
        studioAccentColor: state.studioAccentColor ?? STUDIO_DEFAULT_ACCENT,
        studioEditMode: ctx.isEditMode,
      }),
    },
    ...(!ctx.studioMode &&
      node.glossaryId && {
        combo: `glossary-group-${node.glossaryId}`,
      }),
  };
}

function buildG6Node(node: OntologyNode, ctx: NodeBuildContext): NodeData {
  const state = computeNodeVisualState(node, ctx);
  const isInHierarchyMode = ctx.explorationMode === 'hierarchy';
  const isInDataMode = ctx.explorationMode === 'data';

  if (isInHierarchyMode) {
    return buildHierarchyNodeData(node, state);
  }
  if (isInDataMode && state.isDataAsset) {
    return buildDataModeAssetNodeData(node, state, ctx);
  }
  if (isInDataMode) {
    return buildDataModeTermNodeData(node, state, ctx);
  }

  return buildDefaultNodeData(node, state, ctx);
}

// ---------------------------------------------------------------------------
// Edge building
// ---------------------------------------------------------------------------

interface EdgeBuildContext {
  explorationMode: ExplorationMode;
  studioMode: boolean;
  selectedNodeId: string | null;
  neighborSet: Set<string>;
  selectedScopedIds: Set<string> | null;
  searchHighlightActive: boolean;
  searchEdgeSet: Set<string> | null;
  clickedEdgeId: string | null;
  customRelationColorMap: Record<string, string>;
  cardinalityMap: Map<string, RelationshipType>;
  showEdgeLabels: boolean;
  nodePositions?: Record<string, { x: number; y: number }>;
  nodeIdToType: Map<string, string>;
  nodeIdToGlossaryId: Map<string, string>;
}

interface EdgeGroupInfo {
  rep: MergedEdge;
  n: number;
  isCrossTeam: boolean;
  isHighlighted: boolean;
  isDimmedBySelection: boolean;
  isTermTermInDataMode: boolean;
}

function computeSelectedScopedIds(
  explorationMode: ExplorationMode,
  selectedNodeId: string | null,
  nodesForGraph: OntologyNode[]
): Set<string> | null {
  return explorationMode === 'hierarchy' && selectedNodeId
    ? new Set(
        nodesForGraph
          .filter((n) => n.termId === selectedNodeId)
          .map((n) => n.id)
      )
    : null;
}

function groupEdgesByDirectedPair(
  edgesForGraph: MergedEdge[]
): Map<string, MergedEdge[]> {
  const directedGroupMap = new Map<string, MergedEdge[]>();
  edgesForGraph.forEach((edge) => {
    const key = [edge.from, edge.to].sort().join('::');
    const group = directedGroupMap.get(key) ?? [];
    group.push(edge);
    directedGroupMap.set(key, group);
  });

  return directedGroupMap;
}

function computeGlossaryMaxParallelEdges(
  directedGroupMap: Map<string, MergedEdge[]>,
  nodeIdToGlossaryId: Map<string, string>
): Map<string, number> {
  const glossaryMaxParallelEdges = new Map<string, number>();
  directedGroupMap.forEach((group) => {
    if (group.length <= 1) {
      return;
    }
    const fromGlossary = nodeIdToGlossaryId.get(group[0].from);
    const toGlossary = nodeIdToGlossaryId.get(group[0].to);
    if (fromGlossary && fromGlossary === toGlossary) {
      const prev = glossaryMaxParallelEdges.get(fromGlossary) ?? 1;
      glossaryMaxParallelEdges.set(fromGlossary, Math.max(prev, group.length));
    }
  });

  return glossaryMaxParallelEdges;
}

function computeCrossTeam(rep: MergedEdge, ctx: EdgeBuildContext): boolean {
  const fromGlossary = ctx.nodeIdToGlossaryId.get(rep.from);
  const toGlossary = ctx.nodeIdToGlossaryId.get(rep.to);

  return Boolean(fromGlossary && toGlossary && fromGlossary !== toGlossary);
}

function computeGroupHighlighted(
  rep: MergedEdge,
  ctx: EdgeBuildContext
): boolean {
  const isScopedHighlighted =
    ctx.selectedScopedIds != null &&
    (ctx.selectedScopedIds.has(rep.from) || ctx.selectedScopedIds.has(rep.to));

  return (
    ctx.selectedNodeId === rep.from ||
    ctx.selectedNodeId === rep.to ||
    isScopedHighlighted
  );
}

function computeGroupDimmedBySelection(
  rep: MergedEdge,
  ctx: EdgeBuildContext
): boolean {
  const isOtherNodeSelected =
    ctx.selectedNodeId !== null &&
    ctx.selectedNodeId !== rep.from &&
    ctx.selectedNodeId !== rep.to;
  const isOutsideScopedSelection = !(
    ctx.selectedScopedIds?.has(rep.from) || ctx.selectedScopedIds?.has(rep.to)
  );

  return (
    isOtherNodeSelected &&
    isOutsideScopedSelection &&
    !ctx.neighborSet.has(rep.from) &&
    !ctx.neighborSet.has(rep.to)
  );
}

function computeTermTermInDataMode(
  rep: MergedEdge,
  ctx: EdgeBuildContext
): boolean {
  const fromType = ctx.nodeIdToType.get(rep.from);
  const toType = ctx.nodeIdToType.get(rep.to);
  const isFromTypeTerm = fromType !== 'dataAsset' && fromType !== 'metric';
  const isToTypeTerm = toType !== 'dataAsset' && toType !== 'metric';

  return ctx.explorationMode === 'data' && isFromTypeTerm && isToTypeTerm;
}

function computeEdgeGroupInfo(
  group: MergedEdge[],
  ctx: EdgeBuildContext
): EdgeGroupInfo {
  const rep = group[0];
  const n = group.length;

  return {
    rep,
    n,
    isCrossTeam: computeCrossTeam(rep, ctx),
    isHighlighted: computeGroupHighlighted(rep, ctx),
    isDimmedBySelection: computeGroupDimmedBySelection(rep, ctx),
    isTermTermInDataMode: computeTermTermInDataMode(rep, ctx),
  };
}

function computeEdgeKindFlags(singleEdge: MergedEdge): {
  isSemanticProjection: boolean;
  isObservedLineage: boolean;
} {
  return {
    isSemanticProjection: singleEdge.edgeKind === SEMANTIC_PROJECTION_EDGE_KIND,
    isObservedLineage: singleEdge.edgeKind === OBSERVED_LINEAGE_EDGE_KIND,
  };
}

function computeIsDataModeAssetEdge(
  explorationMode: ExplorationMode,
  isTermTermInDataMode: boolean,
  isSemanticProjection: boolean
): boolean {
  return (
    explorationMode === 'data' && !isTermTermInDataMode && !isSemanticProjection
  );
}

function computeEdgeColor(
  singleEdge: MergedEdge,
  isDataModeAssetEdge: boolean,
  customRelationColorMap: Record<string, string>
): string {
  const rawEdgeColor = isDataModeAssetEdge
    ? DATA_MODE_ASSET_EDGE_STROKE_COLOR
    : customRelationColorMap[singleEdge.relationType] ??
      RELATION_COLORS[singleEdge.relationType] ??
      EDGE_STROKE_COLOR;

  return getCanvasColor(
    rawEdgeColor,
    isDataModeAssetEdge ? DATA_MODE_ASSET_EDGE_STROKE_COLOR : EDGE_STROKE_COLOR
  );
}

function computeEdgeIsDimmed(
  edgeKeyStr: string,
  isDimmedBySelection: boolean,
  ctx: EdgeBuildContext
): boolean {
  const isDimmedBySearch =
    ctx.searchEdgeSet != null && !ctx.searchEdgeSet.has(edgeKeyStr);

  return ctx.searchHighlightActive ? isDimmedBySearch : isDimmedBySelection;
}

function computeEdgeLabelVisibility(
  isClickedEdge: boolean,
  isTermTermInDataMode: boolean,
  isSemanticProjection: boolean,
  isObservedLineage: boolean,
  explorationMode: ExplorationMode,
  showEdgeLabelsSetting: boolean
): boolean {
  const isLabelableByMode =
    explorationMode === 'model' ||
    explorationMode === 'hierarchy' ||
    isClickedEdge;
  const isLabelableEdge =
    isLabelableByMode ||
    isTermTermInDataMode ||
    isSemanticProjection ||
    isObservedLineage;

  return showEdgeLabelsSetting && isLabelableEdge;
}

function computeEdgeLabelText(
  singleEdge: MergedEdge,
  showLabel: boolean,
  studioMode: boolean
): { labelText: string | undefined; displayLabel: string | undefined } {
  const labelText = showLabel
    ? singleEdge.inverseRelationType
      ? `${formatRelationLabel(
          singleEdge.relationType
        )} / ${formatRelationLabel(singleEdge.inverseRelationType)}`
      : formatRelationLabel(singleEdge.relationType)
    : undefined;
  const displayLabel =
    studioMode && labelText ? labelText.toLocaleLowerCase() : labelText;

  return { labelText, displayLabel };
}

function computeLabelOffsets(
  singleEdge: MergedEdge,
  i: number,
  n: number,
  nodePositions: Record<string, { x: number; y: number }> | undefined
): { step: number; labelOffsetX: number; labelOffsetY: number } {
  const step = i - (n - 1) / 2;
  let labelOffsetX = 0;
  let labelOffsetY = Math.round(step * BADGE_V_STEP);
  // Use the canonical (sorted) node ordering so that edges travelling in
  // opposite directions between the same pair of nodes always get the same
  // perpendicular vector — preventing both badges from being offset to the
  // same side when one edge is reversed.
  const [canonicalFrom, canonicalTo] = [singleEdge.from, singleEdge.to].sort();
  const fromPos = nodePositions?.[canonicalFrom];
  const toPos = nodePositions?.[canonicalTo];
  if (fromPos && toPos) {
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const offset = step * BADGE_V_STEP;
      labelOffsetX = Math.round((-dy / len) * offset);
      labelOffsetY = Math.round((dx / len) * offset);
    }
  }

  return { step, labelOffsetX, labelOffsetY };
}

function computeCardinalityLabels(
  singleEdge: MergedEdge,
  showLabel: boolean,
  isPrimary: boolean,
  isSemanticProjection: boolean,
  cardinalityMap: Map<string, RelationshipType>
): { startLabelText: string; endLabelText: string } | null {
  return showLabel && isPrimary && !isSemanticProjection
    ? getCardinalityEndLabels(singleEdge.relationType, cardinalityMap)
    : null;
}

function buildEdgeLabelStyle(
  displayLabel: string | undefined,
  singleEdge: MergedEdge,
  customRelationColorMap: Record<string, string>,
  studioMode: boolean,
  labelOffsetX: number,
  labelOffsetY: number,
  cardinalityLabels: { startLabelText: string; endLabelText: string } | null
): Record<string, unknown> {
  return displayLabel
    ? {
        ...getEdgeRelationLabelStyle(
          displayLabel,
          singleEdge.relationType,
          customRelationColorMap[singleEdge.relationType],
          studioMode
        ),
        labelPosition: 'center',
        labelAutoRotate: false,
        labelOffsetX,
        labelOffsetY,
        ...cardinalityLabels,
      }
    : {};
}

function buildEdgeCommonStyle(
  studioMode: boolean,
  n: number,
  step: number,
  isEdgeDimmed: boolean,
  labelStyle: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...(studioMode ? { curveOffset: n === 1 ? 24 : step * BADGE_V_STEP } : {}),
    lineAppendWidth: EDGE_LINE_APPEND_WIDTH,
    opacity: isEdgeDimmed ? DIMMED_EDGE_OPACITY : 1,
    ...labelStyle,
    // Always restore label opacity when not dimmed: G6 merges style updates,
    // so an edge that un-dims (e.g. its node gets selected) would otherwise
    // keep the stale dimmed label opacity and render a bold line with an
    // invisible relation label.
    ...(isEdgeDimmed
      ? {
          labelOpacity: DIMMED_EDGE_LABEL_OPACITY,
          labelBackgroundOpacity: DIMMED_EDGE_LABEL_OPACITY,
        }
      : { labelOpacity: 1, labelBackgroundOpacity: 1 }),
  };
}

function buildEdgeVisibleStyle(
  singleEdge: MergedEdge,
  edgeColor: string,
  isHighlighted: boolean,
  isClickedEdge: boolean,
  isSemanticProjection: boolean,
  studioMode: boolean,
  explorationMode: ExplorationMode,
  commonStyle: Record<string, unknown>
): Record<string, unknown> {
  const hasArrow = explorationMode !== 'data' || isSemanticProjection;
  const highlightedLineWidth = studioMode ? 2.4 : 2.5;
  const defaultLineWidth = studioMode ? 1.8 : 1.5;

  return {
    stroke: edgeColor,
    lineWidth:
      isHighlighted || isClickedEdge ? highlightedLineWidth : defaultLineWidth,
    endArrow: hasArrow,
    startArrow: hasArrow && singleEdge.isBidirectional,
    ...(isSemanticProjection ? { lineDash: [6, 4] } : {}),
    ...commonStyle,
  };
}

function buildG6EdgeForSingle(
  singleEdge: MergedEdge,
  i: number,
  info: EdgeGroupInfo,
  ctx: EdgeBuildContext
): EdgeData {
  const { n, isHighlighted, isDimmedBySelection, isTermTermInDataMode } = info;
  const edgeId = getOntologyEdgeId(singleEdge);
  const isPrimary = i === 0;
  const edgeKeyStr = `${singleEdge.from}::${singleEdge.to}::${singleEdge.relationType}`;
  const isEdgeDimmed = computeEdgeIsDimmed(
    edgeKeyStr,
    isDimmedBySelection,
    ctx
  );
  const isClickedEdge = edgeId === ctx.clickedEdgeId;
  const { isSemanticProjection, isObservedLineage } =
    computeEdgeKindFlags(singleEdge);

  const isDataModeAssetEdge = computeIsDataModeAssetEdge(
    ctx.explorationMode,
    isTermTermInDataMode,
    isSemanticProjection
  );
  const edgeColor = computeEdgeColor(
    singleEdge,
    isDataModeAssetEdge,
    ctx.customRelationColorMap
  );

  const showLabel = computeEdgeLabelVisibility(
    isClickedEdge,
    isTermTermInDataMode,
    isSemanticProjection,
    isObservedLineage,
    ctx.explorationMode,
    ctx.showEdgeLabels
  );
  const { displayLabel } = computeEdgeLabelText(
    singleEdge,
    showLabel,
    ctx.studioMode
  );

  const { step, labelOffsetX, labelOffsetY } = computeLabelOffsets(
    singleEdge,
    i,
    n,
    ctx.nodePositions
  );

  const cardinalityLabels = computeCardinalityLabels(
    singleEdge,
    showLabel,
    isPrimary,
    isSemanticProjection,
    ctx.cardinalityMap
  );

  const labelStyle = buildEdgeLabelStyle(
    displayLabel,
    singleEdge,
    ctx.customRelationColorMap,
    ctx.studioMode,
    labelOffsetX,
    labelOffsetY,
    cardinalityLabels
  );

  const commonStyle = buildEdgeCommonStyle(
    ctx.studioMode,
    n,
    step,
    isEdgeDimmed,
    labelStyle
  );

  const visibleStyle = buildEdgeVisibleStyle(
    singleEdge,
    edgeColor,
    isHighlighted,
    isClickedEdge,
    isSemanticProjection,
    ctx.studioMode,
    ctx.explorationMode,
    commonStyle
  );

  return {
    id: edgeId,
    source: singleEdge.from,
    target: singleEdge.to,
    data: {
      relationshipId: singleEdge.id,
      createdAt: singleEdge.createdAt,
      createdBy: singleEdge.createdBy,
      relationType: singleEdge.relationType,
      relationshipType: singleEdge.relationshipType,
      edgeKind: singleEdge.edgeKind,
      provenance: singleEdge.provenance,
      status: singleEdge.status,
      edgeColor,
      isHighlighted,
      isClickedEdge,
      isCrossTeam: info.isCrossTeam,
      isEdgeDimmed,
    },
    style:
      isPrimary || ctx.studioMode
        ? visibleStyle
        : {
            // Line invisible; label group retains opacity:1 so badge shows.
            stroke: 'transparent',
            lineWidth: 0,
            endArrow: false,
            ...commonStyle,
          },
  };
}

function buildEdgeGroup(
  group: MergedEdge[],
  ctx: EdgeBuildContext
): EdgeData[] {
  const info = computeEdgeGroupInfo(group, ctx);

  return group.map((singleEdge, i) =>
    buildG6EdgeForSingle(singleEdge, i, info, ctx)
  );
}

// ---------------------------------------------------------------------------
// Combo building
// ---------------------------------------------------------------------------

interface BuildCombosParams {
  explorationMode: ExplorationMode;
  studioMode: boolean;
  hierarchyCombos: HierarchyComboInfo[];
  glossaryColorMap: Record<string, string>;
  searchGlossarySet: Set<string> | null;
  nodesForGraph: OntologyNode[];
  glossaries: Glossary[];
  glossaryMaxParallelEdges: Map<string, number>;
}

function extraComboPadding(
  glossaryId: string,
  glossaryMaxParallelEdges: Map<string, number>
): number {
  const maxParallel = glossaryMaxParallelEdges.get(glossaryId) ?? 1;

  return Math.max(0, (maxParallel - 1) * BADGE_V_STEP);
}

function buildHierarchyCombos(params: BuildCombosParams): ComboData[] {
  return params.hierarchyCombos.map((combo) => {
    const color =
      params.glossaryColorMap[combo.glossaryId] ?? 'var(--color-gray-400)';
    const isComboDimmed = Boolean(
      params.searchGlossarySet &&
        !params.searchGlossarySet.has(combo.glossaryId)
    );
    const padding = extraComboPadding(
      combo.glossaryId,
      params.glossaryMaxParallelEdges
    );

    return {
      id: combo.id,
      data: {
        glossaryName: combo.label,
        color,
        isDimmed: isComboDimmed,
        extraVerticalPadding: padding,
      },
      style: buildComboStyle(combo.label, color, padding),
    };
  });
}

function buildGlossaryGroupCombos(params: BuildCombosParams): ComboData[] {
  const byGlossary = new Map<string, OntologyNode[]>();
  params.nodesForGraph.forEach((node) => {
    if (node.glossaryId) {
      const list = byGlossary.get(node.glossaryId) ?? [];
      list.push(node);
      byGlossary.set(node.glossaryId, list);
    }
  });

  const combos: ComboData[] = [];
  byGlossary.forEach((terms, glossaryId) => {
    if (terms.length === 0) {
      return;
    }
    const glossary = params.glossaries.find((g) => g.id === glossaryId);
    const name =
      terms[0].group ?? (glossary ? glossary.displayName || glossary.name : '');
    const color =
      params.glossaryColorMap[glossaryId] ?? 'var(--color-gray-400)';
    const isComboDimmed = Boolean(
      params.searchGlossarySet && !params.searchGlossarySet.has(glossaryId)
    );
    const padding = extraComboPadding(
      glossaryId,
      params.glossaryMaxParallelEdges
    );
    combos.push({
      id: `glossary-group-${glossaryId}`,
      data: {
        glossaryName: name,
        color,
        isDimmed: isComboDimmed,
        extraVerticalPadding: padding,
      },
      style: buildComboStyle(name, color, padding),
    });
  });

  return combos;
}

function buildCombos(params: BuildCombosParams): ComboData[] {
  if (
    params.explorationMode === 'hierarchy' &&
    params.hierarchyCombos.length > 0
  ) {
    return buildHierarchyCombos(params);
  }
  if (params.explorationMode !== 'data' && !params.studioMode) {
    return buildGlossaryGroupCombos(params);
  }

  return [];
}

// ---------------------------------------------------------------------------
// Final safety net
// ---------------------------------------------------------------------------

function enforceGraphSafety(
  g6Nodes: NodeData[],
  g6Edges: EdgeData[]
): { safeNodes: NodeData[]; safeEdges: EdgeData[] } {
  // G6 throws synchronously (and takes down the whole canvas via the
  // ErrorBoundary) on a duplicate node id ("Node already exists") or an edge
  // whose endpoint is missing ("Node not found"). Many independent
  // builders/derivations feed this memo, so enforce both invariants once,
  // here, rather than trusting every upstream path.
  const seenNodeIds = new Set<string>();
  const safeNodes = g6Nodes.filter((node) => {
    const id = String(node.id);
    if (seenNodeIds.has(id)) {
      return false;
    }
    seenNodeIds.add(id);

    return true;
  });
  const safeEdges = g6Edges.filter(
    (edge) =>
      seenNodeIds.has(String(edge.source)) &&
      seenNodeIds.has(String(edge.target))
  );

  return { safeNodes, safeEdges };
}

export function useGraphDataBuilder({
  inputNodes,
  inputEdges,
  explorationMode,
  settings,
  selectedNodeId,
  expandedTermIds,
  clickedEdgeId,
  nodePositions,
  glossaries,
  glossaryColorMap,
  layoutType,
  hierarchyCombos = [],
  graphSearchHighlight = null,
  isEditMode = false,
  relationTypes,
  studioMode = false,
}: BuildGraphDataProps) {
  const computeNodeColor = useCallback(
    (node: OntologyNode): string =>
      node.glossaryId && glossaryColorMap[node.glossaryId]
        ? glossaryColorMap[node.glossaryId]
        : COLOR_BLUE_600,
    [glossaryColorMap]
  );

  const mergedEdgesList = useMemo(
    () => mergeEdges(inputEdges, relationTypes),
    [inputEdges, relationTypes]
  );

  const customRelationColorMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    relationTypes?.forEach((relationshipType) => {
      map[relationshipType.name] =
        RELATION_META[relationshipType.name]?.color ??
        getRelationshipColor(relationshipType);
    });

    return map;
  }, [relationTypes]);

  const cardinalityMap = useMemo<Map<string, RelationshipType>>(() => {
    const map = new Map<string, RelationshipType>();
    relationTypes?.forEach((relationshipType) => {
      map.set(relationshipType.name, relationshipType);
    });

    return map;
  }, [relationTypes]);

  const neighborSet = useMemo(() => {
    const set = new Set<string>();
    if (!selectedNodeId || !inputEdges.length) {
      return set;
    }
    if (explorationMode === 'hierarchy') {
      const selectedIds = new Set<string>();
      inputNodes.forEach((n) => {
        if (n.termId === selectedNodeId || n.id === selectedNodeId) {
          selectedIds.add(n.id);
        }
      });
      selectedIds.forEach((id) => {
        inputEdges.forEach((e) => {
          if (e.from === id) {
            set.add(e.to);
          }
          if (e.to === id) {
            set.add(e.from);
          }
        });
      });
      selectedIds.forEach((id) => set.delete(id));
    } else {
      inputEdges.forEach((e) => {
        if (e.from === selectedNodeId) {
          set.add(e.to);
        }
        if (e.to === selectedNodeId) {
          set.add(e.from);
        }
      });
    }

    return set;
  }, [selectedNodeId, inputEdges, inputNodes, explorationMode]);

  const graphData = useMemo(() => {
    const {
      active: searchHighlightActive,
      nodeSet: searchNodeSet,
      edgeSet: searchEdgeSet,
      glossarySet: searchGlossarySet,
    } = computeSearchHighlightSets(graphSearchHighlight);

    const {
      nodesForGraph,
      edgesForGraph,
      termAssetCountMap,
      termHSpacing,
      termVSpacing,
    } = selectModeGraphSubset(
      explorationMode,
      inputNodes,
      inputEdges,
      mergedEdgesList,
      expandedTermIds
    );

    const { nodeIdToGlossaryId, nodeIdToType } =
      buildNodeLookupMaps(nodesForGraph);

    const dataModeTermPositions: Record<string, { x: number; y: number }> =
      explorationMode === 'data'
        ? computeGlossaryGroupPositions(
            nodesForGraph.filter(
              (n) => n.type !== 'dataAsset' && n.type !== 'metric'
            ),
            layoutType,
            termHSpacing,
            termVSpacing
          )
        : {};

    const localAssetToTermColor =
      explorationMode === 'data'
        ? computeLocalAssetToTermColor(
            nodesForGraph,
            edgesForGraph,
            glossaryColorMap
          )
        : new Map<string, string>();

    const nodeBuildContext: NodeBuildContext = {
      explorationMode,
      studioMode,
      isEditMode,
      selectedNodeId,
      neighborSet,
      searchHighlightActive,
      searchNodeSet,
      nodePositions,
      dataModeTermPositions,
      localAssetToTermColor,
      termAssetCountMap,
      expandedTermIds,
      computeNodeColor,
    };
    const g6Nodes: NodeData[] = nodesForGraph.map((node) =>
      buildG6Node(node, nodeBuildContext)
    );

    const selectedScopedIds = computeSelectedScopedIds(
      explorationMode,
      selectedNodeId,
      nodesForGraph
    );

    const directedGroupMap = groupEdgesByDirectedPair(edgesForGraph);
    const glossaryMaxParallelEdges = computeGlossaryMaxParallelEdges(
      directedGroupMap,
      nodeIdToGlossaryId
    );

    const edgeBuildContext: EdgeBuildContext = {
      explorationMode,
      studioMode,
      selectedNodeId,
      neighborSet,
      selectedScopedIds,
      searchHighlightActive,
      searchEdgeSet,
      clickedEdgeId,
      customRelationColorMap,
      cardinalityMap,
      showEdgeLabels: settings.showEdgeLabels,
      nodePositions,
      nodeIdToType,
      nodeIdToGlossaryId,
    };
    const g6Edges: EdgeData[] = Array.from(directedGroupMap.values()).flatMap(
      (group) => buildEdgeGroup(group, edgeBuildContext)
    );

    const combos = buildCombos({
      explorationMode,
      studioMode,
      hierarchyCombos,
      glossaryColorMap,
      searchGlossarySet,
      nodesForGraph,
      glossaries,
      glossaryMaxParallelEdges,
    });

    const { safeNodes, safeEdges } = enforceGraphSafety(g6Nodes, g6Edges);

    return {
      nodes: safeNodes,
      edges: safeEdges,
      combos: combos.length > 0 ? combos : undefined,
    };
  }, [
    inputNodes,
    inputEdges,
    mergedEdgesList,
    settings.showEdgeLabels,
    selectedNodeId,
    expandedTermIds,
    glossaryColorMap,
    neighborSet,
    computeNodeColor,
    clickedEdgeId,
    nodePositions,
    layoutType,
    explorationMode,
    hierarchyCombos,
    graphSearchHighlight,
    glossaries,
    cardinalityMap,
    customRelationColorMap,
    studioMode,
  ]);

  const assetToTermMap = useMemo(() => {
    if (explorationMode !== 'data') {
      return {} as Record<string, string[]>;
    }
    const map: Record<string, string[]> = {};
    const allAssetIds = new Set(
      inputNodes
        .filter((n) => n.type === 'dataAsset' || n.type === 'metric')
        .map((n) => n.id)
    );
    const allTermIds = new Set(
      inputNodes.filter((n) => !allAssetIds.has(n.id)).map((n) => n.id)
    );
    mergedEdgesList.forEach((edge) => {
      if (allTermIds.has(edge.from) && allAssetIds.has(edge.to)) {
        const existing = map[edge.to] ?? [];
        if (!existing.includes(edge.from)) {
          existing.push(edge.from);
          map[edge.to] = existing;
        }
      } else if (allAssetIds.has(edge.from) && allTermIds.has(edge.to)) {
        const existing = map[edge.from] ?? [];
        if (!existing.includes(edge.to)) {
          existing.push(edge.to);
          map[edge.from] = existing;
        }
      }
    });

    return map;
  }, [explorationMode, inputNodes, mergedEdgesList]);

  const cardinalityLabelMap = useMemo(() => {
    const result: Record<
      string,
      { startLabelText: string; endLabelText: string }
    > = {};
    cardinalityMap.forEach((_, relationType) => {
      const labels = getCardinalityEndLabels(relationType, cardinalityMap);
      if (labels) {
        result[relationType] = labels;
      }
    });

    return result;
  }, [cardinalityMap]);

  return {
    graphData,
    mergedEdgesList,
    neighborSet,
    computeNodeColor,
    assetToTermMap,
    cardinalityLabelMap,
  };
}

export function findOntologyEdgeByGraphId(
  edges: MergedEdge[],
  graphEdgeId: string | null
): MergedEdge | null {
  const edge = graphEdgeId
    ? edges.find((candidate) => getOntologyEdgeId(candidate) === graphEdgeId)
    : undefined;

  return edge ?? null;
}
