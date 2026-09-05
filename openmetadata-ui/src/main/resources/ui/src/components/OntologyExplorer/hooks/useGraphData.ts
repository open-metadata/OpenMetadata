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
import { useTheme } from '../../../context/UntitledUIThemeProvider/theme-provider';
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

const STUDIO_DEFAULT_ACCENT = '#84CAFF';
const STUDIO_COMPLIANCE_ACCENT = '#DC6803';
const STUDIO_ISOLATED_ACCENT = '#F79009';
const DEFAULT_NODE_COLOR = 'var(--color-blue-600)';
const PARALLEL_EDGE_BADGE_STEP = 44;

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

function groupEdgesByNodePair(
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

function findReverseEdgeIndex(
  list: OntologyEdge[],
  edgeIndex: number,
  consumed: Set<number>,
  isSymmetric: boolean,
  inverseMap: Record<string, string>
): number {
  const edge = list[edgeIndex];

  for (let index = edgeIndex + 1; index < list.length; index++) {
    if (consumed.has(index)) {
      continue;
    }
    const candidate = list[index];
    const hasReverseDirection =
      candidate.from === edge.to && candidate.to === edge.from;
    const hasMatchingKind = candidate.edgeKind === edge.edgeKind;
    const isSymmetricMatch =
      isSymmetric && candidate.relationType === edge.relationType;
    const hasMatchingRelation =
      isSymmetricMatch ||
      isInversePair(edge.relationType, candidate.relationType, inverseMap);

    if (hasReverseDirection && hasMatchingKind && hasMatchingRelation) {
      return index;
    }
  }

  return -1;
}

function getMergedEdgeMetadata(edge: OntologyEdge): Partial<MergedEdge> {
  return {
    ...(edge.id ? { id: edge.id } : {}),
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
  isBidirectional: boolean,
  inverseRelationType?: string
): MergedEdge {
  return {
    ...getMergedEdgeMetadata(edge),
    from: edge.from,
    to: edge.to,
    relationType: edge.relationType,
    ...(inverseRelationType && inverseRelationType !== edge.relationType
      ? { inverseRelationType }
      : {}),
    isBidirectional,
  };
}

export function mergeEdges(
  inputEdges: OntologyEdge[],
  configuredTypes?: RelationshipType[]
): MergedEdge[] {
  const { inverseMap, symmetricSet } = buildRelationMaps(configuredTypes);
  const pairGroups = groupEdgesByNodePair(inputEdges);

  const result: MergedEdge[] = [];
  for (const list of pairGroups.values()) {
    const consumed = new Set<number>();
    for (let i = 0; i < list.length; i++) {
      if (consumed.has(i)) {
        continue;
      }
      const edge = list[i];
      const isSymmetric = symmetricSet.has(edge.relationType);
      const matchIndex = findReverseEdgeIndex(
        list,
        i,
        consumed,
        isSymmetric,
        inverseMap
      );

      consumed.add(i);
      if (matchIndex < 0) {
        result.push(buildMergedEdge(edge, isSymmetric));

        continue;
      }
      const match = list[matchIndex];
      consumed.add(matchIndex);
      result.push(buildMergedEdge(edge, true, match.relationType));
    }
  }

  return result;
}

function getHierarchyNeighborSet(
  selectedNodeId: string,
  inputNodes: OntologyNode[],
  inputEdges: OntologyEdge[]
): Set<string> {
  const selectedIds = new Set(
    inputNodes
      .filter(
        (node) => node.termId === selectedNodeId || node.id === selectedNodeId
      )
      .map((node) => node.id)
  );
  const neighbors = new Set<string>();

  selectedIds.forEach((id) => {
    inputEdges.forEach((edge) => {
      if (edge.from === id) {
        neighbors.add(edge.to);
      }
      if (edge.to === id) {
        neighbors.add(edge.from);
      }
    });
  });
  selectedIds.forEach((id) => neighbors.delete(id));

  return neighbors;
}

function getDirectNeighborSet(
  selectedNodeId: string,
  inputEdges: OntologyEdge[]
): Set<string> {
  const neighbors = new Set<string>();
  inputEdges.forEach((edge) => {
    if (edge.from === selectedNodeId) {
      neighbors.add(edge.to);
    }
    if (edge.to === selectedNodeId) {
      neighbors.add(edge.from);
    }
  });

  return neighbors;
}

function buildNeighborSet(
  selectedNodeId: string | null,
  explorationMode: BuildGraphDataProps['explorationMode'],
  inputNodes: OntologyNode[],
  inputEdges: OntologyEdge[]
): Set<string> {
  if (!selectedNodeId || inputEdges.length === 0) {
    return new Set<string>();
  }

  return explorationMode === 'hierarchy'
    ? getHierarchyNeighborSet(selectedNodeId, inputNodes, inputEdges)
    : getDirectNeighborSet(selectedNodeId, inputEdges);
}

interface SearchHighlightSets {
  active: boolean;
  edgeIds: Set<string> | null;
  glossaryIds: Set<string> | null;
  nodeIds: Set<string> | null;
}

function buildSearchHighlightSets(
  highlight: BuildGraphDataProps['graphSearchHighlight']
): SearchHighlightSets {
  if (!highlight?.active) {
    return { active: false, edgeIds: null, glossaryIds: null, nodeIds: null };
  }

  return {
    active: true,
    edgeIds: new Set(highlight.highlightedEdgeKeys),
    glossaryIds:
      highlight.highlightedGlossaryIds.length > 0
        ? new Set(highlight.highlightedGlossaryIds)
        : null,
    nodeIds: new Set(highlight.highlightedNodeIds),
  };
}

interface GraphProjection {
  edges: MergedEdge[];
  nodes: OntologyNode[];
  termAssetCountMap: Map<string, number>;
  termHSpacing: number;
  termVSpacing: number;
}

function getDataModeNodeIds(inputNodes: OntologyNode[]): {
  assetIds: Set<string>;
  termIds: Set<string>;
} {
  const assetIds = new Set(
    inputNodes
      .filter((node) => node.type === 'dataAsset' || node.type === 'metric')
      .map((node) => node.id)
  );
  const termIds = new Set(
    inputNodes.filter((node) => !assetIds.has(node.id)).map((node) => node.id)
  );

  return { assetIds, termIds };
}

function getExpandedAssetIds(
  expandedTermIds: Set<string>,
  termIds: Set<string>,
  assetIds: Set<string>,
  edges: MergedEdge[]
): Set<string> {
  const visibleAssetIds = new Set<string>();
  expandedTermIds.forEach((termId) => {
    if (!termIds.has(termId)) {
      return;
    }
    edges.forEach((edge) => {
      if (edge.from === termId && assetIds.has(edge.to)) {
        visibleAssetIds.add(edge.to);
      }
      if (edge.to === termId && assetIds.has(edge.from)) {
        visibleAssetIds.add(edge.from);
      }
    });
  });

  return visibleAssetIds;
}

function getExpandedAssetSpacing(
  expandedTermIds: Set<string>,
  termIds: Set<string>,
  assetIds: Set<string>,
  edges: MergedEdge[]
): number {
  let maxFootprint = 0;
  expandedTermIds.forEach((termId) => {
    if (!termIds.has(termId)) {
      return;
    }
    const visibleCount = edges.filter(
      (edge) =>
        (edge.from === termId && assetIds.has(edge.to)) ||
        (edge.to === termId && assetIds.has(edge.from))
    ).length;
    maxFootprint = Math.max(
      maxFootprint,
      computeOutermostRingRadius(visibleCount)
    );
  });

  return maxFootprint > 0 ? maxFootprint * 2 + 40 : 0;
}

function getTermLabelSpacing(
  inputNodes: OntologyNode[],
  assetIds: Set<string>
): number {
  const maxTermLabelWidth = inputNodes.reduce((maxWidth, node) => {
    if (assetIds.has(node.id)) {
      return maxWidth;
    }
    const rawLabel = node.originalLabel ?? node.label;
    const width = Math.min(MODEL_NODE_MAX_WIDTH, estimateNodeWidth(rawLabel));

    return Math.max(maxWidth, width);
  }, 0);

  return maxTermLabelWidth > 0 ? maxTermLabelWidth + 56 : 0;
}

function buildTermAssetCountMap(
  inputNodes: OntologyNode[],
  edges: MergedEdge[],
  termIds: Set<string>,
  assetIds: Set<string>
): Map<string, number> {
  const countMap = new Map<string, number>();
  inputNodes.forEach((node) => {
    if (termIds.has(node.id) && typeof node.assetCount === 'number') {
      countMap.set(node.id, node.assetCount);
    }
  });
  edges.forEach((edge) => {
    const termId = termIds.has(edge.from) ? edge.from : edge.to;
    const assetId = assetIds.has(edge.from) ? edge.from : edge.to;
    const connectsTermToAsset = termIds.has(termId) && assetIds.has(assetId);

    if (connectsTermToAsset && !countMap.has(termId)) {
      countMap.set(termId, (countMap.get(termId) ?? 0) + 1);
    }
  });

  return countMap;
}

function isVisibleDataModeEdge(
  edge: MergedEdge,
  visibleIds: Set<string>,
  assetIds: Set<string>,
  expandedTermIds: Set<string>
): boolean {
  if (!visibleIds.has(edge.from) || !visibleIds.has(edge.to)) {
    return false;
  }
  const fromIsAsset = assetIds.has(edge.from);
  const toIsAsset = assetIds.has(edge.to);
  if (fromIsAsset && toIsAsset) {
    return true;
  }
  if (fromIsAsset || toIsAsset) {
    return expandedTermIds.has(fromIsAsset ? edge.to : edge.from);
  }

  return true;
}

function buildDataModeProjection(
  inputNodes: OntologyNode[],
  edges: MergedEdge[],
  expandedTermIds?: Set<string>
): GraphProjection {
  const { assetIds, termIds } = getDataModeNodeIds(inputNodes);
  const expandedIds =
    expandedTermIds && expandedTermIds.size > 0
      ? expandedTermIds
      : new Set<string>();
  const visibleAssetIds = getExpandedAssetIds(
    expandedIds,
    termIds,
    assetIds,
    edges
  );
  const visibleIds = new Set([...termIds, ...visibleAssetIds]);
  const expandedAssetSpacing = getExpandedAssetSpacing(
    expandedIds,
    termIds,
    assetIds,
    edges
  );
  const termLabelSpacing = getTermLabelSpacing(inputNodes, assetIds);

  return {
    edges: edges.filter((edge) =>
      isVisibleDataModeEdge(edge, visibleIds, assetIds, expandedIds)
    ),
    nodes: inputNodes.filter((node) => visibleIds.has(node.id)),
    termAssetCountMap: buildTermAssetCountMap(
      inputNodes,
      edges,
      termIds,
      assetIds
    ),
    termHSpacing: Math.max(
      DATA_MODE_TERM_H_SPACING,
      expandedAssetSpacing,
      termLabelSpacing
    ),
    termVSpacing: Math.max(DATA_MODE_TERM_V_SPACING, expandedAssetSpacing),
  };
}

function buildGraphProjection(
  inputNodes: OntologyNode[],
  inputEdges: OntologyEdge[],
  mergedEdges: MergedEdge[],
  explorationMode: BuildGraphDataProps['explorationMode'],
  expandedTermIds?: Set<string>
): GraphProjection {
  if (explorationMode === 'data') {
    return buildDataModeProjection(inputNodes, mergedEdges, expandedTermIds);
  }

  const edges =
    explorationMode === 'hierarchy'
      ? inputEdges.map((edge) => ({
          from: edge.from,
          to: edge.to,
          relationType: edge.relationType,
          ...(edge.inverseRelationType
            ? { inverseRelationType: edge.inverseRelationType }
            : {}),
          isBidirectional: Boolean(edge.inverseRelationType),
        }))
      : mergedEdges;

  return {
    edges,
    nodes: inputNodes,
    termAssetCountMap: new Map<string, number>(),
    termHSpacing: DATA_MODE_TERM_H_SPACING,
    termVSpacing: DATA_MODE_TERM_V_SPACING,
  };
}

function buildNodeMaps(nodes: OntologyNode[]): {
  glossaryIds: Map<string, string>;
  nodeTypes: Map<string, string>;
} {
  const glossaryIds = new Map<string, string>();
  const nodeTypes = new Map<string, string>();
  nodes.forEach((node) => {
    if (node.glossaryId) {
      glossaryIds.set(node.id, node.glossaryId);
    }
    nodeTypes.set(node.id, node.type);
  });

  return { glossaryIds, nodeTypes };
}

function getTermColor(
  termId: string,
  nodes: OntologyNode[],
  glossaryColorMap: Record<string, string>
): string {
  const glossaryId = nodes.find((node) => node.id === termId)?.glossaryId;

  return glossaryId
    ? glossaryColorMap[glossaryId] ?? DEFAULT_NODE_COLOR
    : DEFAULT_NODE_COLOR;
}

function buildAssetToTermColorMap(
  explorationMode: BuildGraphDataProps['explorationMode'],
  nodes: OntologyNode[],
  edges: MergedEdge[],
  glossaryColorMap: Record<string, string>
): Map<string, string> {
  const colorMap = new Map<string, string>();
  if (explorationMode !== 'data') {
    return colorMap;
  }
  const termIds = new Set(
    nodes
      .filter((node) => node.type !== 'dataAsset' && node.type !== 'metric')
      .map((node) => node.id)
  );
  edges.forEach((edge) => {
    const fromIsTerm = termIds.has(edge.from);
    const toIsTerm = termIds.has(edge.to);
    if (fromIsTerm && !toIsTerm) {
      colorMap.set(edge.to, getTermColor(edge.from, nodes, glossaryColorMap));
    } else if (toIsTerm && !fromIsTerm) {
      colorMap.set(edge.from, getTermColor(edge.to, nodes, glossaryColorMap));
    }
  });

  return colorMap;
}

interface GraphNodeBuildContext {
  assetToTermColorMap: Map<string, string>;
  computeNodeColor: (node: OntologyNode) => string;
  dataModeTermPositions: Record<string, { x: number; y: number }>;
  expandedTermIds?: Set<string>;
  explorationMode: BuildGraphDataProps['explorationMode'];
  isEditMode: boolean;
  neighborSet: Set<string>;
  nodePositions?: BuildGraphDataProps['nodePositions'];
  searchSets: SearchHighlightSets;
  selectedNodeId: string | null;
  studioMode: boolean;
  termAssetCountMap: Map<string, number>;
}

interface GraphNodePresentation {
  color: string;
  isDataAsset: boolean;
  isDimmed: boolean;
  isHighlighted: boolean;
  isSelected: boolean;
  label: string;
  nodeWidth: number;
  pos?: { x: number; y: number };
  studioAccentColor?: string;
}

function getGraphNodePosition(
  nodeId: string,
  isDataAsset: boolean,
  context: GraphNodeBuildContext
): { x: number; y: number } | undefined {
  if (context.explorationMode === 'hierarchy') {
    return context.nodePositions?.[nodeId];
  }
  if (context.explorationMode === 'data' && !isDataAsset) {
    return context.dataModeTermPositions[nodeId];
  }

  return undefined;
}

function getGraphNodeWidth(
  rawLabel: string,
  isDataAsset: boolean,
  context: GraphNodeBuildContext
): number {
  const estimatedWidth = estimateNodeWidth(rawLabel);
  if (context.studioMode) {
    return MODEL_NODE_MAX_WIDTH;
  }
  const shouldTruncate =
    context.explorationMode === 'model' ||
    (context.explorationMode === 'data' && !isDataAsset);

  return shouldTruncate
    ? Math.min(MODEL_NODE_MAX_WIDTH, estimatedWidth)
    : estimatedWidth;
}

function isGraphNodeSelected(
  node: OntologyNode,
  context: GraphNodeBuildContext
): boolean {
  if (context.explorationMode === 'hierarchy') {
    return (
      node.termId === context.selectedNodeId ||
      context.selectedNodeId === node.id
    );
  }

  return context.selectedNodeId === node.id;
}

function getGraphNodeDimState(
  nodeId: string,
  isSelected: boolean,
  context: GraphNodeBuildContext
): { isDimmed: boolean; isHighlighted: boolean } {
  const hasSelectedNode = context.selectedNodeId !== null;
  const isNeighbor = context.neighborSet.has(nodeId);
  const isHighlighted = hasSelectedNode && !isSelected && isNeighbor;
  const isDimmedBySelection = hasSelectedNode && !isSelected && !isNeighbor;
  const isDimmedBySearch =
    context.searchSets.nodeIds !== null &&
    !context.searchSets.nodeIds.has(nodeId);

  return {
    isDimmed: context.searchSets.active
      ? isDimmedBySearch
      : isDimmedBySelection,
    isHighlighted,
  };
}

function getGraphNodePresentation(
  node: OntologyNode,
  context: GraphNodeBuildContext
): GraphNodePresentation {
  const color = context.computeNodeColor(node);
  const rawLabel = node.originalLabel ?? node.label;
  const isDataAsset = node.type === 'dataAsset' || node.type === 'metric';
  const shouldTruncateLabel =
    context.explorationMode === 'model' ||
    (context.explorationMode === 'data' && !isDataAsset);
  const nodeWidth = getGraphNodeWidth(rawLabel, isDataAsset, context);
  const label = shouldTruncateLabel
    ? truncateNodeLabelByWidth(rawLabel, nodeWidth)
    : rawLabel;
  const isSelected = isGraphNodeSelected(node, context);
  const { isDimmed, isHighlighted } = getGraphNodeDimState(
    node.id,
    isSelected,
    context
  );

  return {
    color,
    isDataAsset,
    isDimmed,
    isHighlighted,
    isSelected,
    label,
    nodeWidth,
    pos: getGraphNodePosition(node.id, isDataAsset, context),
    studioAccentColor: context.studioMode
      ? getStudioNodeAccentColor(node)
      : undefined,
  };
}

function buildHierarchyNode(
  node: OntologyNode,
  presentation: GraphNodePresentation
): NodeData {
  const effectiveWidth = node.originalGlossary
    ? Math.max(presentation.nodeWidth, BADGE_MIN_NODE_WIDTH)
    : presentation.nodeWidth;

  return {
    id: node.id,
    data: {
      ontologyNode: node.originalNode ?? node,
      label: presentation.label,
      color: presentation.color,
      isSelected: presentation.isSelected,
      isHighlighted: presentation.isHighlighted,
      isDimmed: presentation.isDimmed,
      size: [effectiveWidth, NODE_HEIGHT],
      nodeWidth: effectiveWidth,
      glossaryId: node.glossaryId ?? '',
      hierarchyBadge: node.originalGlossary
        ? node.glossaryName ?? node.originalGlossary
        : undefined,
    },
    style: buildDefaultRectNodeStyle(
      getCanvasColor,
      presentation.label,
      [effectiveWidth, NODE_HEIGHT],
      presentation.pos
    ),
    combo: `hierarchy-combo-${node.glossaryId}`,
  };
}

function buildDataAssetNode(
  node: OntologyNode,
  presentation: GraphNodePresentation,
  context: GraphNodeBuildContext
): NodeData {
  const assetColor =
    context.assetToTermColorMap.get(node.id) ?? NODE_BORDER_COLOR;
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
      label: presentation.label,
      color: presentation.color,
      assetColor,
      isSelected: presentation.isSelected,
      isHighlighted: presentation.isHighlighted,
      isDimmed: presentation.isDimmed,
      size: [DATA_MODE_ASSET_CIRCLE_SIZE, DATA_MODE_ASSET_CIRCLE_SIZE],
      nodeWidth: presentation.nodeWidth,
      glossaryId: node.glossaryId ?? '',
    },
    style: buildDataModeAssetNodeStyle(
      getCanvasColor,
      presentation.label,
      assetColor,
      presentation.pos,
      entityTypeLabel,
      entityIconUrl
    ),
  };
}

function buildDataTermNode(
  node: OntologyNode,
  presentation: GraphNodePresentation,
  context: GraphNodeBuildContext
): NodeData {
  return {
    id: node.id,
    type: 'circle',
    data: {
      ontologyNode: node,
      label: presentation.label,
      color: presentation.color,
      isSelected: presentation.isSelected,
      isHighlighted: presentation.isHighlighted,
      isDimmed: presentation.isDimmed,
      size: [DATA_MODE_TERM_NODE_SIZE, DATA_MODE_TERM_NODE_SIZE],
      nodeWidth: presentation.nodeWidth,
      glossaryId: node.glossaryId ?? '',
      assetCount: context.termAssetCountMap.get(node.id) ?? 0,
      loadedAssetCount: node.loadedAssetCount ?? 0,
      assetsExpanded: Boolean(context.expandedTermIds?.has(node.id)),
      isLoadingAssets: node.isLoadingAssets ?? false,
    },
    style: buildDataModeTermNodeStyle(
      getCanvasColor,
      presentation.label,
      presentation.color,
      presentation.pos
    ),
  };
}

function buildModelNode(
  node: OntologyNode,
  presentation: GraphNodePresentation,
  context: GraphNodeBuildContext
): NodeData {
  const studioStyle = context.studioMode
    ? {
        label: false,
        stroke:
          node.type === 'glossaryTermIsolated'
            ? '#FEDF89'
            : getCanvasColor(NODE_BORDER_COLOR, '#E9EAEB'),
        studioLabelText: presentation.label,
        studioAccentColor:
          presentation.studioAccentColor ?? STUDIO_DEFAULT_ACCENT,
        studioEditMode: context.isEditMode,
      }
    : {};
  const combo =
    !context.studioMode && node.glossaryId
      ? { combo: `glossary-group-${node.glossaryId}` }
      : {};

  return {
    id: node.id,
    ...(context.studioMode ? { type: 'studio-term' } : {}),
    data: {
      ontologyNode: node,
      label: presentation.label,
      color: presentation.color,
      isSelected: presentation.isSelected,
      isHighlighted: presentation.isHighlighted,
      isDimmed: presentation.isDimmed,
      size: [presentation.nodeWidth, NODE_HEIGHT],
      nodeWidth: presentation.nodeWidth,
      glossaryId: node.glossaryId ?? '',
      studioMode: context.studioMode,
      studioAccentColor: presentation.studioAccentColor,
    },
    style: {
      ...buildDefaultRectNodeStyle(
        getCanvasColor,
        presentation.label,
        [presentation.nodeWidth, NODE_HEIGHT],
        presentation.pos
      ),
      ...studioStyle,
    },
    ...combo,
  };
}

function buildGraphNode(
  node: OntologyNode,
  context: GraphNodeBuildContext
): NodeData {
  const presentation = getGraphNodePresentation(node, context);
  if (context.explorationMode === 'hierarchy') {
    return buildHierarchyNode(node, presentation);
  }
  if (context.explorationMode === 'data' && presentation.isDataAsset) {
    return buildDataAssetNode(node, presentation, context);
  }
  if (context.explorationMode === 'data') {
    return buildDataTermNode(node, presentation, context);
  }

  return buildModelNode(node, presentation, context);
}

interface GraphEdgeBuildContext {
  cardinalityMap: Map<string, RelationshipType>;
  clickedEdgeId: string | null;
  customRelationColorMap: Record<string, string>;
  explorationMode: BuildGraphDataProps['explorationMode'];
  neighborSet: Set<string>;
  nodeGlossaryIds: Map<string, string>;
  nodePositions?: BuildGraphDataProps['nodePositions'];
  nodeTypes: Map<string, string>;
  searchSets: SearchHighlightSets;
  selectedNodeId: string | null;
  selectedScopedIds: Set<string> | null;
  showEdgeLabels: boolean;
  studioMode: boolean;
}

interface EdgeGroupPresentation {
  isCrossTeam: boolean;
  isDimmedBySelection: boolean;
  isHighlighted: boolean;
  isTermTermInDataMode: boolean;
}

function buildParallelEdgeGroups(
  edges: MergedEdge[]
): Map<string, MergedEdge[]> {
  const groups = new Map<string, MergedEdge[]>();
  edges.forEach((edge) => {
    // Direction is excluded so reverse relations share badge offsets.
    const key = [edge.from, edge.to].sort().join('::');
    const group = groups.get(key) ?? [];
    group.push(edge);
    groups.set(key, group);
  });

  return groups;
}

function buildGlossaryParallelEdgeCounts(
  groups: Map<string, MergedEdge[]>,
  nodeGlossaryIds: Map<string, string>
): Map<string, number> {
  const maxParallelEdges = new Map<string, number>();
  groups.forEach((group) => {
    if (group.length <= 1) {
      return;
    }
    const fromGlossary = nodeGlossaryIds.get(group[0].from);
    const toGlossary = nodeGlossaryIds.get(group[0].to);
    if (fromGlossary && fromGlossary === toGlossary) {
      maxParallelEdges.set(
        fromGlossary,
        Math.max(maxParallelEdges.get(fromGlossary) ?? 1, group.length)
      );
    }
  });

  return maxParallelEdges;
}

function isEdgeGroupHighlighted(
  edge: MergedEdge,
  context: GraphEdgeBuildContext
): boolean {
  const touchesSelectedNode =
    context.selectedNodeId === edge.from || context.selectedNodeId === edge.to;
  const touchesSelectedScope = Boolean(
    context.selectedScopedIds?.has(edge.from) ||
      context.selectedScopedIds?.has(edge.to)
  );

  return touchesSelectedNode || touchesSelectedScope;
}

function isEdgeGroupDimmed(
  edge: MergedEdge,
  context: GraphEdgeBuildContext
): boolean {
  if (context.selectedNodeId === null) {
    return false;
  }
  const touchesSelectedNode =
    context.selectedNodeId === edge.from || context.selectedNodeId === edge.to;
  const touchesSelectedScope = Boolean(
    context.selectedScopedIds?.has(edge.from) ||
      context.selectedScopedIds?.has(edge.to)
  );
  const touchesNeighbor =
    context.neighborSet.has(edge.from) || context.neighborSet.has(edge.to);

  return !touchesSelectedNode && !touchesSelectedScope && !touchesNeighbor;
}

function isDataModeTermEdge(
  edge: MergedEdge,
  context: GraphEdgeBuildContext
): boolean {
  if (context.explorationMode !== 'data') {
    return false;
  }
  const assetTypes = ['dataAsset', 'metric'];

  return (
    !assetTypes.includes(context.nodeTypes.get(edge.from) ?? '') &&
    !assetTypes.includes(context.nodeTypes.get(edge.to) ?? '')
  );
}

function getEdgeGroupPresentation(
  edge: MergedEdge,
  context: GraphEdgeBuildContext
): EdgeGroupPresentation {
  const fromGlossary = context.nodeGlossaryIds.get(edge.from);
  const toGlossary = context.nodeGlossaryIds.get(edge.to);

  return {
    isCrossTeam: Boolean(
      fromGlossary && toGlossary && fromGlossary !== toGlossary
    ),
    isDimmedBySelection: isEdgeGroupDimmed(edge, context),
    isHighlighted: isEdgeGroupHighlighted(edge, context),
    isTermTermInDataMode: isDataModeTermEdge(edge, context),
  };
}

function getRenderedEdgeColor(
  edge: MergedEdge,
  isTermTermInDataMode: boolean,
  isSemanticProjection: boolean,
  context: GraphEdgeBuildContext
): string {
  const usesDataAssetColor =
    context.explorationMode === 'data' &&
    !isTermTermInDataMode &&
    !isSemanticProjection;
  if (usesDataAssetColor) {
    return getCanvasColor(DATA_MODE_ASSET_EDGE_STROKE_COLOR, '#D9DEED');
  }
  const relationColor =
    context.customRelationColorMap[edge.relationType] ??
    RELATION_COLORS[edge.relationType] ??
    EDGE_STROKE_COLOR;

  return getCanvasColor(relationColor, '#9196B1');
}

function shouldRenderEdgeLabel(
  isClickedEdge: boolean,
  isTermTermInDataMode: boolean,
  isSemanticProjection: boolean,
  isObservedLineage: boolean,
  context: GraphEdgeBuildContext
): boolean {
  if (!context.showEdgeLabels) {
    return false;
  }
  const modeAlwaysShowsLabels =
    context.explorationMode === 'model' ||
    context.explorationMode === 'hierarchy';

  return [
    modeAlwaysShowsLabels,
    isClickedEdge,
    isTermTermInDataMode,
    isSemanticProjection,
    isObservedLineage,
  ].some(Boolean);
}

function getRenderedEdgeLabel(
  edge: MergedEdge,
  showLabel: boolean,
  studioMode: boolean
): string | undefined {
  if (!showLabel) {
    return undefined;
  }
  const relationLabel = formatRelationLabel(edge.relationType);
  const label = edge.inverseRelationType
    ? `${relationLabel} / ${formatRelationLabel(edge.inverseRelationType)}`
    : relationLabel;

  return studioMode ? label.toLocaleLowerCase() : label;
}

function getEdgeLabelOffset(
  edge: MergedEdge,
  edgeIndex: number,
  groupSize: number,
  nodePositions: BuildGraphDataProps['nodePositions']
): { labelOffsetX: number; labelOffsetY: number; step: number } {
  const step = edgeIndex - (groupSize - 1) / 2;
  let labelOffsetX = 0;
  let labelOffsetY = Math.round(step * PARALLEL_EDGE_BADGE_STEP);
  const [canonicalFrom, canonicalTo] = [edge.from, edge.to].sort();
  const fromPos = nodePositions?.[canonicalFrom];
  const toPos = nodePositions?.[canonicalTo];
  if (fromPos && toPos) {
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length > 0) {
      const offset = step * PARALLEL_EDGE_BADGE_STEP;
      labelOffsetX = Math.round((-dy / length) * offset);
      labelOffsetY = Math.round((dx / length) * offset);
    }
  }

  return { labelOffsetX, labelOffsetY, step };
}

function buildEdgeLabelStyle(
  edge: MergedEdge,
  label: string | undefined,
  isPrimary: boolean,
  isSemanticProjection: boolean,
  labelOffsetX: number,
  labelOffsetY: number,
  context: GraphEdgeBuildContext
): Record<string, unknown> {
  if (!label) {
    return {};
  }
  const cardinalityLabels =
    isPrimary && !isSemanticProjection
      ? getCardinalityEndLabels(edge.relationType, context.cardinalityMap)
      : null;

  return {
    ...getEdgeRelationLabelStyle(
      label,
      edge.relationType,
      context.customRelationColorMap[edge.relationType],
      context.studioMode
    ),
    labelPosition: 'center',
    labelAutoRotate: false,
    labelOffsetX,
    labelOffsetY,
    ...cardinalityLabels,
  };
}

function buildCommonEdgeStyle(
  labelStyle: Record<string, unknown>,
  isEdgeDimmed: boolean,
  groupSize: number,
  step: number,
  studioMode: boolean
): Record<string, unknown> {
  const curveStyle = studioMode
    ? {
        curveOffset: groupSize === 1 ? 24 : step * PARALLEL_EDGE_BADGE_STEP,
      }
    : {};
  const labelOpacity = isEdgeDimmed ? DIMMED_EDGE_LABEL_OPACITY : 1;

  return {
    ...curveStyle,
    lineAppendWidth: EDGE_LINE_APPEND_WIDTH,
    opacity: isEdgeDimmed ? DIMMED_EDGE_OPACITY : 1,
    ...labelStyle,
    // G6 merges style updates, so explicitly restore label opacity when an
    // edge leaves its dimmed state instead of retaining an invisible badge.
    labelOpacity,
    labelBackgroundOpacity: labelOpacity,
  };
}

function getRenderedEdgeDimState(
  searchKey: string,
  groupPresentation: EdgeGroupPresentation,
  searchSets: SearchHighlightSets
): boolean {
  if (!searchSets.active) {
    return groupPresentation.isDimmedBySelection;
  }

  return searchSets.edgeIds !== null && !searchSets.edgeIds.has(searchKey);
}

function getEdgeLineWidth(isEmphasized: boolean, studioMode: boolean): number {
  if (isEmphasized) {
    return studioMode ? 2.4 : 2.5;
  }

  return studioMode ? 1.8 : 1.5;
}

function buildGraphEdge(
  edge: MergedEdge,
  edgeIndex: number,
  groupSize: number,
  groupPresentation: EdgeGroupPresentation,
  context: GraphEdgeBuildContext
): EdgeData {
  const edgeId = getOntologyEdgeId(edge);
  const isPrimary = edgeIndex === 0;
  const searchKey = `${edge.from}::${edge.to}::${edge.relationType}`;
  const isEdgeDimmed = getRenderedEdgeDimState(
    searchKey,
    groupPresentation,
    context.searchSets
  );
  const isClickedEdge = edgeId === context.clickedEdgeId;
  const isSemanticProjection = edge.edgeKind === SEMANTIC_PROJECTION_EDGE_KIND;
  const isObservedLineage = edge.edgeKind === OBSERVED_LINEAGE_EDGE_KIND;
  const edgeColor = getRenderedEdgeColor(
    edge,
    groupPresentation.isTermTermInDataMode,
    isSemanticProjection,
    context
  );
  const showLabel = shouldRenderEdgeLabel(
    isClickedEdge,
    groupPresentation.isTermTermInDataMode,
    isSemanticProjection,
    isObservedLineage,
    context
  );
  const label = getRenderedEdgeLabel(edge, showLabel, context.studioMode);
  const { labelOffsetX, labelOffsetY, step } = getEdgeLabelOffset(
    edge,
    edgeIndex,
    groupSize,
    context.nodePositions
  );
  const labelStyle = buildEdgeLabelStyle(
    edge,
    label,
    isPrimary,
    isSemanticProjection,
    labelOffsetX,
    labelOffsetY,
    context
  );
  const commonStyle = buildCommonEdgeStyle(
    labelStyle,
    isEdgeDimmed,
    groupSize,
    step,
    context.studioMode
  );
  const hasArrow = context.explorationMode !== 'data' || isSemanticProjection;
  const isEmphasized = groupPresentation.isHighlighted || isClickedEdge;
  const visibleStyle = {
    stroke: edgeColor,
    lineWidth: getEdgeLineWidth(isEmphasized, context.studioMode),
    endArrow: hasArrow,
    startArrow: hasArrow && edge.isBidirectional,
    ...(isSemanticProjection ? { lineDash: [6, 4] } : {}),
    ...commonStyle,
  };
  const hiddenParallelStyle = {
    // Non-primary lines stay hidden while their independently offset badge remains visible.
    stroke: 'transparent',
    lineWidth: 0,
    endArrow: false,
    ...commonStyle,
  };

  return {
    id: edgeId,
    source: edge.from,
    target: edge.to,
    data: {
      relationshipId: edge.id,
      createdAt: edge.createdAt,
      createdBy: edge.createdBy,
      relationType: edge.relationType,
      relationshipType: edge.relationshipType,
      edgeKind: edge.edgeKind,
      provenance: edge.provenance,
      status: edge.status,
      edgeColor,
      isHighlighted: groupPresentation.isHighlighted,
      isClickedEdge,
      isCrossTeam: groupPresentation.isCrossTeam,
      isEdgeDimmed,
    },
    style: isPrimary || context.studioMode ? visibleStyle : hiddenParallelStyle,
  };
}

function buildGraphEdges(
  groups: Map<string, MergedEdge[]>,
  context: GraphEdgeBuildContext
): EdgeData[] {
  return Array.from(groups.values()).flatMap((group) => {
    const groupPresentation = getEdgeGroupPresentation(group[0], context);

    return group.map((edge, index) =>
      buildGraphEdge(edge, index, group.length, groupPresentation, context)
    );
  });
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
  // G6 stores resolved colors, so its data must be rebuilt when CSS tokens change.
  const { theme } = useTheme();
  const computeNodeColor = useCallback(
    (node: OntologyNode): string =>
      node.glossaryId && glossaryColorMap[node.glossaryId]
        ? glossaryColorMap[node.glossaryId]
        : DEFAULT_NODE_COLOR,
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

  const neighborSet = useMemo(
    () =>
      buildNeighborSet(selectedNodeId, explorationMode, inputNodes, inputEdges),
    [selectedNodeId, explorationMode, inputNodes, inputEdges]
  );

  const graphData = useMemo(() => {
    // Theme is an intentional invalidation key: G6 stores resolved CSS colors
    // in its data model even though the value is read indirectly by helpers.
    void theme;
    const searchSets = buildSearchHighlightSets(graphSearchHighlight);
    const {
      edges: edgesForGraph,
      nodes: nodesForGraph,
      termAssetCountMap,
      termHSpacing,
      termVSpacing,
    } = buildGraphProjection(
      inputNodes,
      inputEdges,
      mergedEdgesList,
      explorationMode,
      expandedTermIds
    );
    const { glossaryIds: nodeIdToGlossaryId, nodeTypes: nodeIdToType } =
      buildNodeMaps(nodesForGraph);

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

    const localAssetToTermColor = buildAssetToTermColorMap(
      explorationMode,
      nodesForGraph,
      edgesForGraph,
      glossaryColorMap
    );

    const nodeBuildContext: GraphNodeBuildContext = {
      assetToTermColorMap: localAssetToTermColor,
      computeNodeColor,
      dataModeTermPositions,
      expandedTermIds,
      explorationMode,
      isEditMode,
      neighborSet,
      nodePositions,
      searchSets,
      selectedNodeId,
      studioMode,
      termAssetCountMap,
    };
    const g6Nodes: NodeData[] = nodesForGraph.map((node) =>
      buildGraphNode(node, nodeBuildContext)
    );

    const selectedScopedIds =
      explorationMode === 'hierarchy' && selectedNodeId
        ? new Set(
            nodesForGraph
              .filter((n) => n.termId === selectedNodeId)
              .map((n) => n.id)
          )
        : null;

    const directedGroupMap = buildParallelEdgeGroups(edgesForGraph);
    const glossaryMaxParallelEdges = buildGlossaryParallelEdgeCounts(
      directedGroupMap,
      nodeIdToGlossaryId
    );
    const edgeBuildContext: GraphEdgeBuildContext = {
      cardinalityMap,
      clickedEdgeId,
      customRelationColorMap,
      explorationMode,
      neighborSet,
      nodeGlossaryIds: nodeIdToGlossaryId,
      nodePositions,
      nodeTypes: nodeIdToType,
      searchSets,
      selectedNodeId,
      selectedScopedIds,
      showEdgeLabels: settings.showEdgeLabels,
      studioMode,
    };
    const g6Edges = buildGraphEdges(directedGroupMap, edgeBuildContext);

    const extraComboPadding = (glossaryId: string): number => {
      const maxParallel = glossaryMaxParallelEdges.get(glossaryId) ?? 1;

      return Math.max(0, (maxParallel - 1) * PARALLEL_EDGE_BADGE_STEP);
    };

    const combos: ComboData[] = [];
    if (explorationMode === 'hierarchy' && hierarchyCombos.length > 0) {
      hierarchyCombos.forEach((combo) => {
        const color =
          glossaryColorMap[combo.glossaryId] ?? 'var(--color-gray-400)';
        const isComboDimmed = Boolean(
          searchSets.glossaryIds &&
            !searchSets.glossaryIds.has(combo.glossaryId)
        );
        combos.push({
          id: combo.id,
          data: {
            glossaryName: combo.label,
            color,
            isDimmed: isComboDimmed,
            extraVerticalPadding: extraComboPadding(combo.glossaryId),
          },
          style: buildComboStyle(
            combo.label,
            color,
            extraComboPadding(combo.glossaryId)
          ),
        });
      });
    } else if (explorationMode !== 'data' && !studioMode) {
      const byGlossary = new Map<string, OntologyNode[]>();
      nodesForGraph.forEach((node) => {
        if (node.glossaryId) {
          const list = byGlossary.get(node.glossaryId) ?? [];
          list.push(node);
          byGlossary.set(node.glossaryId, list);
        }
      });
      byGlossary.forEach((terms, glossaryId) => {
        if (terms.length === 0) {
          return;
        }
        const glossary = glossaries.find((g) => g.id === glossaryId);
        const name =
          terms[0].group ??
          (glossary ? glossary.displayName || glossary.name : '');
        const color = glossaryColorMap[glossaryId] ?? 'var(--color-gray-400)';
        const isComboDimmed = Boolean(
          searchSets.glossaryIds && !searchSets.glossaryIds.has(glossaryId)
        );
        combos.push({
          id: `glossary-group-${glossaryId}`,
          data: {
            glossaryName: name,
            color,
            isDimmed: isComboDimmed,
            extraVerticalPadding: extraComboPadding(glossaryId),
          },
          style: buildComboStyle(name, color, extraComboPadding(glossaryId)),
        });
      });
    }

    // Final safety net before data enters G6. G6 throws synchronously (and
    // takes down the whole canvas via the ErrorBoundary) on a duplicate node id
    // ("Node already exists") or an edge whose endpoint is missing ("Node not
    // found"). Many independent builders/derivations feed this memo, so enforce
    // both invariants once, here, rather than trusting every upstream path.
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
    isEditMode,
    studioMode,
    theme,
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
