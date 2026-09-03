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

const COLOR_BLUE_600 = 'var(--color-blue-600)';

const STUDIO_DEFAULT_ACCENT = '#84CAFF';
const STUDIO_COMPLIANCE_ACCENT = '#DC6803';
const STUDIO_ISOLATED_ACCENT = '#F79009';

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

function buildSharedEdgeFields(edge: OntologyEdge): Partial<MergedEdge> {
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

function buildSingleMergedEdge(
  edge: OntologyEdge,
  isSymmetric: boolean
): MergedEdge {
  return {
    ...buildSharedEdgeFields(edge),
    from: edge.from,
    to: edge.to,
    relationType: edge.relationType,
    isBidirectional: isSymmetric,
  };
}

function buildPairMergedEdge(
  edge: OntologyEdge,
  match: OntologyEdge
): MergedEdge {
  return {
    ...buildSharedEdgeFields(edge),
    from: edge.from,
    to: edge.to,
    relationType: edge.relationType,
    ...(edge.relationType === match.relationType
      ? {}
      : { inverseRelationType: match.relationType }),
    isBidirectional: true,
  };
}

function findReverseMatchIndex(
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

export function mergeEdges(
  inputEdges: OntologyEdge[],
  configuredTypes?: RelationshipType[]
): MergedEdge[] {
  const { inverseMap, symmetricSet } = buildRelationMaps(configuredTypes);
  const pairGroups = new Map<string, OntologyEdge[]>();
  inputEdges.forEach((edge) => {
    const pairKey = [edge.from, edge.to]
      .sort((a, b) => a.localeCompare(b))
      .join('::');
    const list = pairGroups.get(pairKey) ?? [];
    list.push(edge);
    pairGroups.set(pairKey, list);
  });

  const result: MergedEdge[] = [];
  for (const list of pairGroups.values()) {
    const consumed = new Set<number>();
    for (let i = 0; i < list.length; i++) {
      if (consumed.has(i)) {
        continue;
      }
      const edge = list[i];
      const isSymmetric = symmetricSet.has(edge.relationType);
      const matchIndex = findReverseMatchIndex(
        list,
        i + 1,
        edge,
        isSymmetric,
        consumed,
        inverseMap
      );

      consumed.add(i);
      if (matchIndex < 0) {
        result.push(buildSingleMergedEdge(edge, isSymmetric));

        continue;
      }
      const match = list[matchIndex];
      consumed.add(matchIndex);
      result.push(buildPairMergedEdge(edge, match));
    }
  }

  return result;
}

interface NodeVisualState {
  color: string;
  label: string;
  nodeWidth: number;
  pos?: { x: number; y: number };
  studioAccentColor?: string;
  isSelected: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
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
    const buildSearchHighlightSets = () => {
      const active = Boolean(graphSearchHighlight?.active);
      if (!active) {
        return {
          searchHighlightActive: active,
          searchNodeSet: null as Set<string> | null,
          searchEdgeSet: null as Set<string> | null,
          searchGlossarySet: null as Set<string> | null,
        };
      }
      const searchGlossarySet =
        (graphSearchHighlight?.highlightedGlossaryIds.length ?? 0) > 0
          ? new Set(graphSearchHighlight?.highlightedGlossaryIds ?? [])
          : null;

      return {
        searchHighlightActive: active,
        searchNodeSet: new Set(graphSearchHighlight?.highlightedNodeIds ?? []),
        searchEdgeSet: new Set(graphSearchHighlight?.highlightedEdgeKeys ?? []),
        searchGlossarySet,
      };
    };
    const {
      searchHighlightActive,
      searchNodeSet,
      searchEdgeSet,
      searchGlossarySet,
    } = buildSearchHighlightSets();

    const computeDataModeElements = () => {
      const allAssetIds = new Set(
        inputNodes
          .filter((n) => n.type === 'dataAsset' || n.type === 'metric')
          .map((n) => n.id)
      );
      const allTermIds = new Set(
        inputNodes.filter((n) => !allAssetIds.has(n.id)).map((n) => n.id)
      );

      const visibleTermIds = new Set(allTermIds);

      const visibleAssetIds = new Set<string>();
      const idsToExpand =
        expandedTermIds && expandedTermIds.size > 0
          ? expandedTermIds
          : new Set<string>();
      idsToExpand.forEach((termId) => {
        if (!allTermIds.has(termId)) {
          return;
        }
        for (const edge of mergedEdgesList) {
          if (edge.from === termId && allAssetIds.has(edge.to)) {
            visibleAssetIds.add(edge.to);
          }
          if (edge.to === termId && allAssetIds.has(edge.from)) {
            visibleAssetIds.add(edge.from);
          }
        }
      });

      let termHSpacing = DATA_MODE_TERM_H_SPACING;
      let termVSpacing = DATA_MODE_TERM_V_SPACING;
      if (idsToExpand.size > 0) {
        let maxFootprint = 0;
        idsToExpand.forEach((termId) => {
          if (!allTermIds.has(termId)) {
            return;
          }
          let visibleCount = 0;
          for (const edge of mergedEdgesList) {
            if (edge.from === termId && allAssetIds.has(edge.to)) {
              visibleCount++;
            }
            if (edge.to === termId && allAssetIds.has(edge.from)) {
              visibleCount++;
            }
          }
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
      }

      const LABEL_SPACING_GAP = 56;
      const maxTermLabelWidth = inputNodes.reduce((max, n) => {
        if (allAssetIds.has(n.id)) {
          return max;
        }
        const rawLabel = n.originalLabel ?? n.label;
        const w = Math.min(MODEL_NODE_MAX_WIDTH, estimateNodeWidth(rawLabel));

        return Math.max(max, w);
      }, 0);
      if (maxTermLabelWidth > 0) {
        termHSpacing = Math.max(
          termHSpacing,
          maxTermLabelWidth + LABEL_SPACING_GAP
        );
      }

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
          termAssetCountMap.set(
            edge.to,
            (termAssetCountMap.get(edge.to) ?? 0) + 1
          );
        }
      });

      const visibleIds = new Set([...visibleTermIds, ...visibleAssetIds]);
      const nodesForGraph = inputNodes.filter((n) => visibleIds.has(n.id));
      const edgesForGraph = mergedEdgesList.filter((e) => {
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

      return {
        nodesForGraph,
        edgesForGraph,
        termAssetCountMap,
        termHSpacing,
        termVSpacing,
      };
    };

    let nodesForGraph: OntologyNode[];
    let edgesForGraph: MergedEdge[];
    let termAssetCountMap = new Map<string, number>();
    let termHSpacing = DATA_MODE_TERM_H_SPACING;
    let termVSpacing = DATA_MODE_TERM_V_SPACING;

    if (explorationMode === 'data') {
      const dataElements = computeDataModeElements();
      nodesForGraph = dataElements.nodesForGraph;
      edgesForGraph = dataElements.edgesForGraph;
      termAssetCountMap = dataElements.termAssetCountMap;
      termHSpacing = dataElements.termHSpacing;
      termVSpacing = dataElements.termVSpacing;
    } else if (explorationMode === 'hierarchy') {
      nodesForGraph = inputNodes;
      edgesForGraph = inputEdges.map((e) => ({
        from: e.from,
        to: e.to,
        relationType: e.relationType,
        ...(e.inverseRelationType
          ? { inverseRelationType: e.inverseRelationType }
          : {}),
        isBidirectional: Boolean(e.inverseRelationType),
      }));
    } else {
      nodesForGraph = inputNodes;
      edgesForGraph = mergedEdgesList;
    }

    const nodeIdToGlossaryId = new Map<string, string>();
    const nodeIdToType = new Map<string, string>();
    nodesForGraph.forEach((n) => {
      if (n.glossaryId) {
        nodeIdToGlossaryId.set(n.id, n.glossaryId);
      }
      nodeIdToType.set(n.id, n.type);
    });

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

    const localAssetToTermColor = new Map<string, string>();
    if (explorationMode === 'data') {
      const termIdSet = new Set(
        nodesForGraph
          .filter((n) => n.type !== 'dataAsset' && n.type !== 'metric')
          .map((n) => n.id)
      );
      edgesForGraph.forEach((edge) => {
        const fromIsTerm = termIdSet.has(edge.from);
        const toIsTerm = termIdSet.has(edge.to);
        const getTermColor = (termId: string) => {
          const termNode = nodesForGraph.find((n) => n.id === termId);

          return termNode?.glossaryId
            ? glossaryColorMap[termNode.glossaryId] ?? COLOR_BLUE_600
            : COLOR_BLUE_600;
        };
        if (fromIsTerm && !toIsTerm) {
          localAssetToTermColor.set(edge.to, getTermColor(edge.from));
        } else if (toIsTerm && !fromIsTerm) {
          localAssetToTermColor.set(edge.from, getTermColor(edge.to));
        }
      });
    }

    const getNodeLabelMetrics = (node: OntologyNode) => {
      const rawLabel = node.originalLabel ?? node.label;
      const isDataAsset = node.type === 'dataAsset' || node.type === 'metric';
      const isInModelMode = explorationMode === 'model';
      const shouldTruncateLabel =
        isInModelMode || (explorationMode === 'data' && !isDataAsset);
      const estimatedWidth = estimateNodeWidth(rawLabel);

      let nodeWidth: number;
      if (studioMode) {
        nodeWidth = MODEL_NODE_MAX_WIDTH;
      } else if (shouldTruncateLabel) {
        nodeWidth = Math.min(MODEL_NODE_MAX_WIDTH, estimatedWidth);
      } else {
        nodeWidth = estimatedWidth;
      }

      const label = shouldTruncateLabel
        ? truncateNodeLabelByWidth(rawLabel, nodeWidth)
        : rawLabel;
      const studioAccentColor = studioMode
        ? getStudioNodeAccentColor(node)
        : undefined;

      return { isDataAsset, nodeWidth, label, studioAccentColor };
    };

    const computeNodePosition = (
      node: OntologyNode,
      isDataAsset: boolean
    ): { x: number; y: number } | undefined => {
      if (explorationMode === 'hierarchy') {
        return nodePositions?.[node.id];
      }
      if (explorationMode === 'data') {
        return isDataAsset ? undefined : dataModeTermPositions[node.id];
      }

      return undefined;
    };

    const computeNodeSelectionState = (node: OntologyNode) => {
      const isSelected =
        explorationMode === 'hierarchy'
          ? node.termId === selectedNodeId || selectedNodeId === node.id
          : selectedNodeId === node.id;
      const isHighlighted =
        selectedNodeId !== null && !isSelected && neighborSet.has(node.id);
      const isDimmedBySelection =
        selectedNodeId !== null && !isSelected && !neighborSet.has(node.id);
      const isDimmedBySearch =
        searchNodeSet != null && !searchNodeSet.has(node.id);
      const isDimmed = searchHighlightActive
        ? isDimmedBySearch
        : isDimmedBySelection;

      return { isSelected, isHighlighted, isDimmed };
    };

    const buildHierarchyNode = (
      node: OntologyNode,
      state: NodeVisualState
    ): NodeData => {
      const {
        color,
        label,
        nodeWidth,
        pos,
        isSelected,
        isHighlighted,
        isDimmed,
      } = state;
      const height = NODE_HEIGHT;
      const comboId = `hierarchy-combo-${node.glossaryId}`;
      const ontologyNode = node.originalNode ?? node;
      const effectiveWidth = node.originalGlossary
        ? Math.max(nodeWidth, BADGE_MIN_NODE_WIDTH)
        : nodeWidth;

      return {
        id: node.id,
        data: {
          ontologyNode,
          label,
          color,
          isSelected,
          isHighlighted,
          isDimmed,
          size: [effectiveWidth, height],
          nodeWidth: effectiveWidth,
          glossaryId: node.glossaryId ?? '',
          hierarchyBadge: node.originalGlossary
            ? node.glossaryName ?? node.originalGlossary
            : undefined,
        },
        style: buildDefaultRectNodeStyle(
          getCanvasColor,
          label,
          [effectiveWidth, height],
          pos
        ),
        combo: comboId,
      };
    };

    const buildDataAssetNode = (
      node: OntologyNode,
      state: NodeVisualState
    ): NodeData => {
      const {
        color,
        label,
        nodeWidth,
        pos,
        isSelected,
        isHighlighted,
        isDimmed,
      } = state;
      const sz = DATA_MODE_ASSET_CIRCLE_SIZE;
      const assetColor =
        localAssetToTermColor.get(node.id) ?? NODE_BORDER_COLOR;
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
          label,
          color,
          assetColor,
          isSelected,
          isHighlighted,
          isDimmed,
          size: [sz, sz],
          nodeWidth,
          glossaryId: node.glossaryId ?? '',
        },
        style: buildDataModeAssetNodeStyle(
          getCanvasColor,
          label,
          assetColor,
          pos,
          entityTypeLabel,
          entityIconUrl
        ),
      };
    };

    const buildDataTermNode = (
      node: OntologyNode,
      state: NodeVisualState
    ): NodeData => {
      const {
        color,
        label,
        nodeWidth,
        pos,
        isSelected,
        isHighlighted,
        isDimmed,
      } = state;
      const sz = DATA_MODE_TERM_NODE_SIZE;
      const assetCount = termAssetCountMap.get(node.id) ?? 0;
      const assetsExpanded = Boolean(expandedTermIds?.has(node.id));

      return {
        id: node.id,
        type: 'circle',
        data: {
          ontologyNode: node,
          label,
          color,
          isSelected,
          isHighlighted,
          isDimmed,
          size: [sz, sz],
          nodeWidth,
          glossaryId: node.glossaryId ?? '',
          assetCount,
          loadedAssetCount: node.loadedAssetCount ?? 0,
          assetsExpanded,
          isLoadingAssets: node.isLoadingAssets ?? false,
        },
        style: buildDataModeTermNodeStyle(getCanvasColor, label, color, pos),
      };
    };

    const buildDefaultNode = (
      node: OntologyNode,
      state: NodeVisualState
    ): NodeData => {
      const {
        color,
        label,
        nodeWidth,
        pos,
        studioAccentColor,
        isSelected,
        isHighlighted,
        isDimmed,
      } = state;
      const height = NODE_HEIGHT;

      return {
        id: node.id,
        ...(studioMode ? { type: 'studio-term' } : {}),
        data: {
          ontologyNode: node,
          label,
          color,
          isSelected,
          isHighlighted,
          isDimmed,
          size: [nodeWidth, height],
          nodeWidth,
          glossaryId: node.glossaryId ?? '',
          studioMode,
          studioAccentColor,
        },
        style: {
          ...buildDefaultRectNodeStyle(
            getCanvasColor,
            label,
            [nodeWidth, height],
            pos
          ),
          ...(studioMode && {
            label: false,
            stroke:
              node.type === 'glossaryTermIsolated' ? '#FEDF89' : '#E9EAEB',
            studioLabelText: label,
            studioAccentColor: studioAccentColor ?? STUDIO_DEFAULT_ACCENT,
            studioEditMode: isEditMode,
          }),
        },
        ...(!studioMode &&
          node.glossaryId && {
            combo: `glossary-group-${node.glossaryId}`,
          }),
      };
    };

    const g6Nodes: NodeData[] = nodesForGraph.map((node) => {
      const color = computeNodeColor(node);
      const { isDataAsset, nodeWidth, label, studioAccentColor } =
        getNodeLabelMetrics(node);
      const pos = computeNodePosition(node, isDataAsset);
      const { isSelected, isHighlighted, isDimmed } =
        computeNodeSelectionState(node);
      const state: NodeVisualState = {
        color,
        label,
        nodeWidth,
        pos,
        studioAccentColor,
        isSelected,
        isHighlighted,
        isDimmed,
      };

      if (explorationMode === 'hierarchy') {
        return buildHierarchyNode(node, state);
      }
      if (explorationMode === 'data' && isDataAsset) {
        return buildDataAssetNode(node, state);
      }
      if (explorationMode === 'data') {
        return buildDataTermNode(node, state);
      }

      return buildDefaultNode(node, state);
    });

    const selectedScopedIds =
      explorationMode === 'hierarchy' && selectedNodeId
        ? new Set(
            nodesForGraph
              .filter((n) => n.termId === selectedNodeId)
              .map((n) => n.id)
          )
        : null;

    const BADGE_V_STEP = 44; // px between badge centres (badge height ~22px + gap)

    // Use an undirected (sorted) pair key so that edges between the same two
    // nodes are always in the same group regardless of which direction they
    // travel (e.g. A→B "narrower/broader" and B→A "partOf" must share a group
    // so their badges are offset together rather than drawn as two overlapping lines).
    const directedGroupMap = new Map<string, MergedEdge[]>();
    edgesForGraph.forEach((edge) => {
      const key = [edge.from, edge.to].sort().join('::');
      const group = directedGroupMap.get(key) ?? [];
      group.push(edge);
      directedGroupMap.set(key, group);
    });

    const glossaryMaxParallelEdges = new Map<string, number>();
    directedGroupMap.forEach((group) => {
      if (group.length <= 1) {
        return;
      }
      const fromGlossary = nodeIdToGlossaryId.get(group[0].from);
      const toGlossary = nodeIdToGlossaryId.get(group[0].to);
      if (fromGlossary && fromGlossary === toGlossary) {
        const prev = glossaryMaxParallelEdges.get(fromGlossary) ?? 1;
        glossaryMaxParallelEdges.set(
          fromGlossary,
          Math.max(prev, group.length)
        );
      }
    });

    const isCrossTeamEdge = (from?: string, to?: string): boolean =>
      Boolean(from && to && from !== to);

    const isEdgeGroupHighlighted = (rep: MergedEdge): boolean =>
      selectedNodeId === rep.from ||
      selectedNodeId === rep.to ||
      (selectedScopedIds != null &&
        (selectedScopedIds.has(rep.from) || selectedScopedIds.has(rep.to)));

    const isEdgeGroupDimmed = (rep: MergedEdge): boolean =>
      selectedNodeId !== null &&
      selectedNodeId !== rep.from &&
      selectedNodeId !== rep.to &&
      !(selectedScopedIds?.has(rep.from) || selectedScopedIds?.has(rep.to)) &&
      !neighborSet.has(rep.from) &&
      !neighborSet.has(rep.to);

    const isTermTermEdgeInDataMode = (
      fromType?: string,
      toType?: string
    ): boolean =>
      explorationMode === 'data' &&
      fromType !== 'dataAsset' &&
      fromType !== 'metric' &&
      toType !== 'dataAsset' &&
      toType !== 'metric';

    const getEdgeColor = (
      singleEdge: MergedEdge,
      isTermTermInDataMode: boolean,
      isSemanticProjection: boolean
    ): string => {
      const useDataAssetColor =
        explorationMode === 'data' &&
        !isTermTermInDataMode &&
        !isSemanticProjection;
      const rawEdgeColor = useDataAssetColor
        ? DATA_MODE_ASSET_EDGE_STROKE_COLOR
        : customRelationColorMap[singleEdge.relationType] ??
          RELATION_COLORS[singleEdge.relationType] ??
          EDGE_STROKE_COLOR;

      return getCanvasColor(
        rawEdgeColor,
        useDataAssetColor
          ? DATA_MODE_ASSET_EDGE_STROKE_COLOR
          : EDGE_STROKE_COLOR
      );
    };

    const getShowLabel = (
      isClickedEdge: boolean,
      isTermTermInDataMode: boolean,
      isSemanticProjection: boolean,
      isObservedLineage: boolean
    ): boolean =>
      Boolean(
        settings.showEdgeLabels &&
          (explorationMode === 'model' ||
            explorationMode === 'hierarchy' ||
            isClickedEdge ||
            isTermTermInDataMode ||
            isSemanticProjection ||
            isObservedLineage)
      );

    const getEdgeDisplayLabel = (
      showLabel: boolean,
      singleEdge: MergedEdge
    ): string | undefined => {
      if (!showLabel) {
        return undefined;
      }
      const labelText = singleEdge.inverseRelationType
        ? `${formatRelationLabel(
            singleEdge.relationType
          )} / ${formatRelationLabel(singleEdge.inverseRelationType)}`
        : formatRelationLabel(singleEdge.relationType);

      return studioMode && labelText
        ? labelText.toLocaleLowerCase()
        : labelText;
    };

    const computeLabelOffsets = (
      i: number,
      n: number,
      singleEdge: MergedEdge
    ): { step: number; labelOffsetX: number; labelOffsetY: number } => {
      // Offset badges perpendicular to the edge direction so they never
      // stack along the edge (which breaks for vertical edges). Use the
      // canonical (sorted) node ordering so that edges travelling in opposite
      // directions between the same pair of nodes always get the same
      // perpendicular vector.
      const step = i - (n - 1) / 2;
      let labelOffsetX = 0;
      let labelOffsetY = Math.round(step * BADGE_V_STEP);
      const [canonicalFrom, canonicalTo] = [
        singleEdge.from,
        singleEdge.to,
      ].sort();
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
    };

    const getEdgeCardinalityLabels = (
      showLabel: boolean,
      isPrimary: boolean,
      isSemanticProjection: boolean,
      singleEdge: MergedEdge
    ) =>
      showLabel && isPrimary && !isSemanticProjection
        ? getCardinalityEndLabels(singleEdge.relationType, cardinalityMap)
        : null;

    const buildEdgeLabelStyle = (
      displayLabel: string | undefined,
      singleEdge: MergedEdge,
      labelOffsetX: number,
      labelOffsetY: number,
      cardinalityLabels: {
        startLabelText: string;
        endLabelText: string;
      } | null
    ): Record<string, unknown> =>
      displayLabel
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

    const buildEdgeCommonStyle = (
      n: number,
      step: number,
      isEdgeDimmed: boolean,
      labelStyle: Record<string, unknown>
    ): Record<string, unknown> => ({
      ...(studioMode
        ? { curveOffset: n === 1 ? 24 : step * BADGE_V_STEP }
        : {}),
      lineAppendWidth: EDGE_LINE_APPEND_WIDTH,
      opacity: isEdgeDimmed ? DIMMED_EDGE_OPACITY : 1,
      ...labelStyle,
      // Always restore label opacity when not dimmed: G6 merges style updates,
      // so an edge that un-dims would otherwise keep the stale dimmed label
      // opacity and render a bold line with an invisible relation label.
      ...(isEdgeDimmed
        ? {
            labelOpacity: DIMMED_EDGE_LABEL_OPACITY,
            labelBackgroundOpacity: DIMMED_EDGE_LABEL_OPACITY,
          }
        : { labelOpacity: 1, labelBackgroundOpacity: 1 }),
    });

    const buildEdgeVisibleStyle = (
      edgeColor: string,
      isHighlighted: boolean,
      isClickedEdge: boolean,
      isSemanticProjection: boolean,
      singleEdge: MergedEdge,
      commonStyle: Record<string, unknown>
    ): Record<string, unknown> => {
      const hasArrow = explorationMode !== 'data' || isSemanticProjection;
      const highlightedLineWidth = studioMode ? 2.4 : 2.5;
      const defaultLineWidth = studioMode ? 1.8 : 1.5;

      return {
        stroke: edgeColor,
        lineWidth:
          isHighlighted || isClickedEdge
            ? highlightedLineWidth
            : defaultLineWidth,
        endArrow: hasArrow,
        startArrow: hasArrow && singleEdge.isBidirectional,
        ...(isSemanticProjection ? { lineDash: [6, 4] } : {}),
        ...commonStyle,
      };
    };

    const buildEdgeData = (
      singleEdge: MergedEdge,
      i: number,
      groupFlags: {
        n: number;
        isCrossTeam: boolean;
        isHighlighted: boolean;
        isDimmedBySelection: boolean;
        isTermTermInDataMode: boolean;
      }
    ): EdgeData => {
      const { n, isCrossTeam, isHighlighted, isDimmedBySelection } = groupFlags;
      const { isTermTermInDataMode } = groupFlags;
      const edgeId = getOntologyEdgeId(singleEdge);
      const isPrimary = i === 0;
      const edgeKeyStr = `${singleEdge.from}::${singleEdge.to}::${singleEdge.relationType}`;
      const isDimmedBySearch =
        searchEdgeSet != null && !searchEdgeSet.has(edgeKeyStr);
      const isEdgeDimmed = searchHighlightActive
        ? isDimmedBySearch
        : isDimmedBySelection;
      const isClickedEdge = edgeId === clickedEdgeId;
      const isSemanticProjection =
        singleEdge.edgeKind === SEMANTIC_PROJECTION_EDGE_KIND;
      const isObservedLineage =
        singleEdge.edgeKind === OBSERVED_LINEAGE_EDGE_KIND;

      const edgeColor = getEdgeColor(
        singleEdge,
        isTermTermInDataMode,
        isSemanticProjection
      );
      const showLabel = getShowLabel(
        isClickedEdge,
        isTermTermInDataMode,
        isSemanticProjection,
        isObservedLineage
      );
      const displayLabel = getEdgeDisplayLabel(showLabel, singleEdge);
      const { step, labelOffsetX, labelOffsetY } = computeLabelOffsets(
        i,
        n,
        singleEdge
      );
      const cardinalityLabels = getEdgeCardinalityLabels(
        showLabel,
        isPrimary,
        isSemanticProjection,
        singleEdge
      );
      const labelStyle = buildEdgeLabelStyle(
        displayLabel,
        singleEdge,
        labelOffsetX,
        labelOffsetY,
        cardinalityLabels
      );
      const commonStyle = buildEdgeCommonStyle(
        n,
        step,
        isEdgeDimmed,
        labelStyle
      );
      const visibleStyle = buildEdgeVisibleStyle(
        edgeColor,
        isHighlighted,
        isClickedEdge,
        isSemanticProjection,
        singleEdge,
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
          isCrossTeam,
          isEdgeDimmed,
        },
        style:
          isPrimary || studioMode
            ? visibleStyle
            : {
                // Line invisible; label group retains opacity:1 so badge shows.
                stroke: 'transparent',
                lineWidth: 0,
                endArrow: false,
                ...commonStyle,
              },
      };
    };

    const g6Edges: EdgeData[] = Array.from(directedGroupMap.values()).flatMap(
      (group) => {
        const rep = group[0];
        const fromGlossary = nodeIdToGlossaryId.get(rep.from);
        const toGlossary = nodeIdToGlossaryId.get(rep.to);
        const fromType = nodeIdToType.get(rep.from);
        const toType = nodeIdToType.get(rep.to);
        const groupFlags = {
          n: group.length,
          isCrossTeam: isCrossTeamEdge(fromGlossary, toGlossary),
          isHighlighted: isEdgeGroupHighlighted(rep),
          isDimmedBySelection: isEdgeGroupDimmed(rep),
          isTermTermInDataMode: isTermTermEdgeInDataMode(fromType, toType),
        };

        return group.map((singleEdge, i) =>
          buildEdgeData(singleEdge, i, groupFlags)
        );
      }
    );

    const extraComboPadding = (glossaryId: string): number => {
      const maxParallel = glossaryMaxParallelEdges.get(glossaryId) ?? 1;

      return Math.max(0, (maxParallel - 1) * BADGE_V_STEP);
    };

    const buildHierarchyCombos = (): ComboData[] =>
      hierarchyCombos.map((combo) => {
        const color =
          glossaryColorMap[combo.glossaryId] ?? 'var(--color-gray-400)';
        const isComboDimmed = Boolean(
          searchGlossarySet && !searchGlossarySet.has(combo.glossaryId)
        );

        return {
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
        };
      });

    const buildGlossaryCombos = (): ComboData[] => {
      const byGlossary = new Map<string, OntologyNode[]>();
      nodesForGraph.forEach((node) => {
        if (node.glossaryId) {
          const list = byGlossary.get(node.glossaryId) ?? [];
          list.push(node);
          byGlossary.set(node.glossaryId, list);
        }
      });

      const result: ComboData[] = [];
      for (const [glossaryId, terms] of byGlossary.entries()) {
        if (terms.length === 0) {
          continue;
        }
        const glossary = glossaries.find((g) => g.id === glossaryId);
        const name =
          terms[0].group ??
          (glossary ? glossary.displayName || glossary.name : '');
        const color = glossaryColorMap[glossaryId] ?? 'var(--color-gray-400)';
        const isComboDimmed = Boolean(
          searchGlossarySet && !searchGlossarySet.has(glossaryId)
        );
        result.push({
          id: `glossary-group-${glossaryId}`,
          data: {
            glossaryName: name,
            color,
            isDimmed: isComboDimmed,
            extraVerticalPadding: extraComboPadding(glossaryId),
          },
          style: buildComboStyle(name, color, extraComboPadding(glossaryId)),
        });
      }

      return result;
    };

    const buildCombos = (): ComboData[] => {
      if (explorationMode === 'hierarchy' && hierarchyCombos.length > 0) {
        return buildHierarchyCombos();
      }
      if (explorationMode !== 'data' && !studioMode) {
        return buildGlossaryCombos();
      }

      return [];
    };

    const combos: ComboData[] = buildCombos();

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
