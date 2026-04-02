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
import { ComboData, EdgeData, NodeData } from '@antv/g6';
import { useCallback, useMemo } from 'react';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  DATA_MODE_ASSET_CIRCLE_SIZE,
  DATA_MODE_ASSET_EDGE_STROKE_COLOR,
  DATA_MODE_TERM_NODE_SIZE,
  DIMMED_EDGE_OPACITY,
  EDGE_LINE_APPEND_WIDTH,
  EDGE_STROKE_COLOR,
  LayoutEngine,
  NODE_BORDER_COLOR,
  RELATION_COLORS,
} from '../OntologyExplorer.constants';
import {
  BuildGraphDataProps,
  MergedEdge,
  OntologyEdge,
  OntologyNode,
} from '../OntologyExplorer.interface';
import { getEntityIconUrl } from '../utils/entityIconUrls';
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
import { computeGlossaryGroupPositions } from '../utils/layoutCalculations';

const INVERSE_RELATION_PAIRS: Record<string, string> = {
  broader: 'narrower',
  narrower: 'broader',
  parentOf: 'childOf',
  childOf: 'parentOf',
  hasPart: 'partOf',
  partOf: 'hasPart',
  hasA: 'componentOf',
  componentOf: 'hasA',
  composedOf: 'partOf',
  owns: 'ownedBy',
  ownedBy: 'owns',
  manages: 'managedBy',
  managedBy: 'manages',
  contains: 'containedIn',
  containedIn: 'contains',
  hasTypes: 'typeOf',
  typeOf: 'hasTypes',
  usedToCalculate: 'calculatedFrom',
  calculatedFrom: 'usedToCalculate',
  usedBy: 'dependsOn',
  dependsOn: 'usedBy',
};

const SYMMETRIC_RELATIONS = new Set([
  'related',
  'relatedTo',
  'synonym',
  'antonym',
  'seeAlso',
]);

function mergeEdges(inputEdges: OntologyEdge[]): MergedEdge[] {
  const edgeMap = new Map<string, OntologyEdge>();
  const processedPairs = new Set<string>();
  const result: MergedEdge[] = [];

  inputEdges.forEach((edge) => {
    edgeMap.set(`${edge.from}->${edge.to}`, edge);
  });

  inputEdges.forEach((edge) => {
    const pairKey = [edge.from, edge.to]
      .sort((a, b) => a.localeCompare(b))
      .join('::');
    if (processedPairs.has(pairKey)) {
      return;
    }

    const reverseEdge = edgeMap.get(`${edge.to}->${edge.from}`);
    const inverseRelation = INVERSE_RELATION_PAIRS[edge.relationType];
    const isSymmetric = SYMMETRIC_RELATIONS.has(edge.relationType);

    if (inverseRelation && reverseEdge?.relationType === inverseRelation) {
      processedPairs.add(pairKey);
      result.push({
        from: edge.from,
        to: edge.to,
        relationType: edge.relationType,
        inverseRelationType: reverseEdge.relationType,
        isBidirectional: true,
      });
    } else if (
      reverseEdge &&
      isSymmetric &&
      edge.relationType === reverseEdge.relationType
    ) {
      processedPairs.add(pairKey);
      result.push({
        from: edge.from,
        to: edge.to,
        relationType: edge.relationType,
        isBidirectional: true,
      });
    } else {
      result.push({
        from: edge.from,
        to: edge.to,
        relationType: edge.relationType,
        isBidirectional: false,
      });
    }
  });

  return result;
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
  glossaryColorMap,
  layoutType,
  hierarchyCombos = [],
  graphSearchHighlight = null,
}: BuildGraphDataProps) {
  const computeNodeColor = useCallback(
    (node: OntologyNode): string =>
      node.glossaryId && glossaryColorMap[node.glossaryId]
        ? glossaryColorMap[node.glossaryId]
        : 'var(--color-blue-600)',
    [glossaryColorMap]
  );

  const mergedEdgesList = useMemo(() => mergeEdges(inputEdges), [inputEdges]);

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
    const searchHighlightActive = Boolean(graphSearchHighlight?.active);
    let searchNodeSet: Set<string> | null = null;
    let searchEdgeSet: Set<string> | null = null;
    let searchGlossarySet: Set<string> | null = null;

    if (searchHighlightActive) {
      searchNodeSet = new Set(graphSearchHighlight?.highlightedNodeIds ?? []);
      searchEdgeSet = new Set(graphSearchHighlight?.highlightedEdgeKeys ?? []);

      if ((graphSearchHighlight?.highlightedGlossaryIds.length ?? 0) > 0) {
        searchGlossarySet = new Set(
          graphSearchHighlight?.highlightedGlossaryIds ?? []
        );
      }
    }

    let nodesForGraph: OntologyNode[];
    let edgesForGraph: MergedEdge[];
    let termAssetCountMap = new Map<string, number>();

    if (explorationMode === 'data') {
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
        mergedEdgesList.forEach((edge) => {
          if (edge.from === termId && allAssetIds.has(edge.to)) {
            visibleAssetIds.add(edge.to);
          }
          if (edge.to === termId && allAssetIds.has(edge.from)) {
            visibleAssetIds.add(edge.from);
          }
        });
      });

      termAssetCountMap = new Map<string, number>();
      inputNodes.forEach((node) => {
        if (allTermIds.has(node.id) && typeof node.assetCount === 'number') {
          termAssetCountMap.set(node.id, node.assetCount);
        }
      });
      mergedEdgesList.forEach((edge) => {
        if (allTermIds.has(edge.from) && allAssetIds.has(edge.to)) {
          if (!termAssetCountMap.has(edge.from)) {
            termAssetCountMap.set(
              edge.from,
              (termAssetCountMap.get(edge.from) ?? 0) + 1
            );
          }
        }
        if (allAssetIds.has(edge.from) && allTermIds.has(edge.to)) {
          if (!termAssetCountMap.has(edge.to)) {
            termAssetCountMap.set(
              edge.to,
              (termAssetCountMap.get(edge.to) ?? 0) + 1
            );
          }
        }
      });

      const visibleIds = new Set([...visibleTermIds, ...visibleAssetIds]);
      nodesForGraph = inputNodes.filter((n) => visibleIds.has(n.id));
      edgesForGraph = mergedEdgesList.filter(
        (e) => visibleIds.has(e.from) && visibleIds.has(e.to)
      );
    } else if (explorationMode === 'hierarchy') {
      nodesForGraph = inputNodes;
      edgesForGraph = inputEdges.map((e) => ({
        from: e.from,
        to: e.to,
        relationType: e.relationType,
        isBidirectional: false,
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

    const distinctGlossaryIds = new Set(
      nodesForGraph.map((n) => n.glossaryId).filter(Boolean)
    );
    const needsGroupLayout =
      explorationMode !== 'data' &&
      explorationMode !== 'hierarchy' &&
      distinctGlossaryIds.size > 1;

    const groupPositions: Record<string, { x: number; y: number }> =
      needsGroupLayout
        ? computeGlossaryGroupPositions(nodesForGraph, layoutType)
        : {};

    const dataModeTermPositions: Record<string, { x: number; y: number }> =
      explorationMode === 'data'
        ? computeGlossaryGroupPositions(
            nodesForGraph.filter(
              (n) => n.type !== 'dataAsset' && n.type !== 'metric'
            ),
            LayoutEngine.Dagre
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
            ? glossaryColorMap[termNode.glossaryId] ?? 'var(--color-blue-600)'
            : 'var(--color-blue-600)';
        };
        if (fromIsTerm && !toIsTerm) {
          localAssetToTermColor.set(edge.to, getTermColor(edge.from));
        } else if (toIsTerm && !fromIsTerm) {
          localAssetToTermColor.set(edge.from, getTermColor(edge.to));
        }
      });
    }

    const g6Nodes: NodeData[] = nodesForGraph.map((node) => {
      const color = computeNodeColor(node);
      const height = NODE_HEIGHT;
      const rawLabel = node.originalLabel ?? node.label;
      const isInModelMode = explorationMode === 'model';
      const estimatedWidth = estimateNodeWidth(rawLabel);
      const nodeWidth = isInModelMode
        ? Math.min(MODEL_NODE_MAX_WIDTH, estimatedWidth)
        : estimatedWidth;
      const label = isInModelMode
        ? truncateNodeLabelByWidth(rawLabel, nodeWidth)
        : rawLabel;
      const isDataAsset = node.type === 'dataAsset' || node.type === 'metric';
      const pos =
        explorationMode === 'hierarchy'
          ? nodePositions?.[node.id]
          : explorationMode === 'data'
          ? isDataAsset
            ? undefined
            : dataModeTermPositions[node.id]
          : groupPositions[node.id] ?? nodePositions?.[node.id];
      const isSelected =
        explorationMode === 'hierarchy'
          ? node.termId === selectedNodeId || selectedNodeId === node.id
          : selectedNodeId === node.id;
      const isHighlighted =
        selectedNodeId !== null && !isSelected && neighborSet.has(node.id);
      const isDimmedBySelection =
        selectedNodeId !== null && !isSelected && !neighborSet.has(node.id);
      const isDimmedBySearch =
        Boolean(searchNodeSet) && !searchNodeSet!.has(node.id);
      const isDimmed = searchHighlightActive
        ? isDimmedBySearch
        : isDimmedBySelection;

      const isInHierarchyMode = explorationMode === 'hierarchy';
      const isInDataMode = explorationMode === 'data';
      const isDataAssetOrMetric = isDataAsset;

      if (isInHierarchyMode) {
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
      }

      if (isInDataMode && isDataAssetOrMetric) {
        const sz = DATA_MODE_ASSET_CIRCLE_SIZE;
        const assetColor =
          localAssetToTermColor.get(node.id) ?? NODE_BORDER_COLOR;
        const entityTypeLabel =
          node.entityRef?.type !== undefined
            ? entityUtilClassBase.getFormattedEntityType(node.entityRef.type)
            : undefined;
        const entityIconUrl = getEntityIconUrl(node.entityRef?.type);

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
      }

      if (isInDataMode) {
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
          },
          style: buildDataModeTermNodeStyle(getCanvasColor, label, color, pos),
        };
      }

      return {
        id: node.id,
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
        },
        style: buildDefaultRectNodeStyle(
          getCanvasColor,
          label,
          [nodeWidth, height],
          pos
        ),
        ...(node.glossaryId && {
          combo: `glossary-group-${node.glossaryId}`,
        }),
      };
    });

    const selectedScopedIds =
      explorationMode === 'hierarchy' && selectedNodeId
        ? new Set(
            nodesForGraph
              .filter((n) => n.termId === selectedNodeId)
              .map((n) => n.id)
          )
        : null;

    const g6Edges: EdgeData[] = edgesForGraph.map((edge) => {
      const edgeId = `edge-${edge.from}-${edge.to}-${edge.relationType}`;
      const fromGlossary = nodeIdToGlossaryId.get(edge.from);
      const toGlossary = nodeIdToGlossaryId.get(edge.to);
      const isCrossTeam = Boolean(
        fromGlossary && toGlossary && fromGlossary !== toGlossary
      );
      const isHighlighted =
        selectedNodeId === edge.from ||
        selectedNodeId === edge.to ||
        (selectedScopedIds != null &&
          (selectedScopedIds.has(edge.from) || selectedScopedIds.has(edge.to)));
      const edgeKeyStr = `${edge.from}::${edge.to}::${edge.relationType}`;
      const isDimmedBySelection =
        selectedNodeId !== null &&
        selectedNodeId !== edge.from &&
        selectedNodeId !== edge.to &&
        !(
          selectedScopedIds?.has(edge.from) || selectedScopedIds?.has(edge.to)
        ) &&
        !neighborSet.has(edge.from) &&
        !neighborSet.has(edge.to);
      const isDimmedBySearch =
        Boolean(searchEdgeSet) && !searchEdgeSet!.has(edgeKeyStr);
      const isEdgeDimmed = searchHighlightActive
        ? isDimmedBySearch
        : isDimmedBySelection;
      const isClickedEdge = edgeId === clickedEdgeId;

      const fromType = nodeIdToType.get(edge.from);
      const toType = nodeIdToType.get(edge.to);
      const isTermTermInDataMode =
        explorationMode === 'data' &&
        fromType !== 'dataAsset' &&
        fromType !== 'metric' &&
        toType !== 'dataAsset' &&
        toType !== 'metric';

      const rawEdgeColor =
        explorationMode === 'data' && !isTermTermInDataMode
          ? DATA_MODE_ASSET_EDGE_STROKE_COLOR
          : RELATION_COLORS[edge.relationType] ?? EDGE_STROKE_COLOR;
      const edgeColor = getCanvasColor(
        rawEdgeColor,
        explorationMode === 'data' && !isTermTermInDataMode
          ? DATA_MODE_ASSET_EDGE_STROKE_COLOR
          : EDGE_STROKE_COLOR
      );

      const showLabel =
        settings.showEdgeLabels &&
        (explorationMode === 'model' ||
          explorationMode === 'hierarchy' ||
          isClickedEdge ||
          isTermTermInDataMode);
      const labelText = showLabel
        ? formatRelationLabel(
            edge.inverseRelationType
              ? `${edge.relationType} / ${edge.inverseRelationType}`
              : edge.relationType
          )
        : undefined;

      const baseEdgeStyle = {
        stroke: edgeColor,
        lineWidth: isHighlighted || isClickedEdge ? 2.5 : 1.5,
        lineAppendWidth: EDGE_LINE_APPEND_WIDTH,
        opacity: isEdgeDimmed ? DIMMED_EDGE_OPACITY : 1,
        endArrow: explorationMode !== 'data',
        ...(labelText &&
          getEdgeRelationLabelStyle(labelText, edge.relationType)),
      };

      return {
        id: edgeId,
        source: edge.from,
        target: edge.to,
        data: {
          relationType: edge.relationType,
          edgeColor,
          isHighlighted,
          isClickedEdge,
          isCrossTeam,
          isEdgeDimmed,
          edgeShapeType: 'cubic-vertical',
        },
        type: 'cubic-vertical',
        style: {
          ...baseEdgeStyle,
        },
      };
    });

    const combos: ComboData[] = [];
    if (explorationMode === 'hierarchy' && hierarchyCombos.length > 0) {
      hierarchyCombos.forEach((combo) => {
        const color =
          glossaryColorMap[combo.glossaryId] ?? 'var(--color-gray-400)';
        const isComboDimmed = Boolean(
          searchGlossarySet && !searchGlossarySet.has(combo.glossaryId)
        );
        combos.push({
          id: combo.id,
          data: {
            glossaryName: combo.label,
            color,
            isDimmed: isComboDimmed,
          },
          style: buildComboStyle(combo.label, color),
        });
      });
    } else if (explorationMode !== 'data') {
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
        const name = terms[0].group ?? glossaryId;
        const color = glossaryColorMap[glossaryId] ?? 'var(--color-gray-400)';
        const isComboDimmed = Boolean(
          searchGlossarySet && !searchGlossarySet.has(glossaryId)
        );
        combos.push({
          id: `glossary-group-${glossaryId}`,
          data: { glossaryName: name, color, isDimmed: isComboDimmed },
          style: buildComboStyle(name, color),
        });
      });
    }

    return {
      nodes: g6Nodes,
      edges: g6Edges,
      combos: combos.length > 0 ? combos : undefined,
    };
  }, [
    inputNodes,
    inputEdges,
    mergedEdgesList,
    settings.showEdgeLabels,
    selectedNodeId,
    expandedTermIds,
    nodePositions,
    glossaryColorMap,
    neighborSet,
    computeNodeColor,
    clickedEdgeId,
    layoutType,
    explorationMode,
    hierarchyCombos,
    graphSearchHighlight,
  ]);

  const assetToTermMap = useMemo(() => {
    if (explorationMode !== 'data') {
      return {} as Record<string, string>;
    }
    const map: Record<string, string> = {};
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
        map[edge.to] = edge.from;
      } else if (allAssetIds.has(edge.from) && allTermIds.has(edge.to)) {
        map[edge.from] = edge.to;
      }
    });

    return map;
  }, [explorationMode, inputNodes, mergedEdgesList]);

  return {
    graphData,
    mergedEdgesList,
    neighborSet,
    computeNodeColor,
    assetToTermMap,
  };
}
