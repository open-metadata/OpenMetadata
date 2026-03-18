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
import {
  CROSS_GLOSSARY_CURVE_OFFSET,
  CROSS_GLOSSARY_EDGE_COLOR,
  DATA_MODE_ASSET_CIRCLE_SIZE,
  DATA_MODE_TERM_NODE_SIZE,
  EDGE_LINE_APPEND_WIDTH,
  EDGE_STROKE_COLOR,
  NODE_BORDER_COLOR,
  RELATION_COLORS,
} from '../OntologyExplorer.constants';
import {
  BuildGraphDataProps,
  MergedEdge,
  OntologyEdge,
  OntologyNode,
} from '../OntologyExplorer.interface';
import {
  BADGE_MIN_NODE_WIDTH,
  estimateNodeWidth,
  NODE_HEIGHT,
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
  computeDataModePositions,
  computeGlossaryGroupPositions,
} from '../utils/layoutCalculations';

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
  clickedEdgeId,
  nodePositions,
  glossaryColorMap,
  layoutType,
  hierarchyCombos = [],
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
    let nodesForGraph: OntologyNode[];
    let edgesForGraph: MergedEdge[];
    let dataModePositions: Record<string, { x: number; y: number }> = {};
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

      const termsWithAssets = new Set<string>();
      mergedEdgesList.forEach((edge) => {
        if (allTermIds.has(edge.from) && allAssetIds.has(edge.to)) {
          termsWithAssets.add(edge.from);
        }
        if (allTermIds.has(edge.to) && allAssetIds.has(edge.from)) {
          termsWithAssets.add(edge.to);
        }
      });

      const visibleTermIds = new Set(termsWithAssets);
      mergedEdgesList.forEach((edge) => {
        if (allTermIds.has(edge.from) && allTermIds.has(edge.to)) {
          if (termsWithAssets.has(edge.from) || termsWithAssets.has(edge.to)) {
            visibleTermIds.add(edge.from);
            visibleTermIds.add(edge.to);
          }
        }
      });

      const visibleAssetIds = new Set<string>();
      if (selectedNodeId && allTermIds.has(selectedNodeId)) {
        mergedEdgesList.forEach((edge) => {
          if (edge.from === selectedNodeId && allAssetIds.has(edge.to)) {
            visibleAssetIds.add(edge.to);
          }
          if (edge.to === selectedNodeId && allAssetIds.has(edge.from)) {
            visibleAssetIds.add(edge.from);
          }
        });
      }

      termAssetCountMap = new Map<string, number>();
      mergedEdgesList.forEach((edge) => {
        if (allTermIds.has(edge.from) && allAssetIds.has(edge.to)) {
          termAssetCountMap.set(
            edge.from,
            (termAssetCountMap.get(edge.from) ?? 0) + 1
          );
        }
        if (allAssetIds.has(edge.from) && allTermIds.has(edge.to)) {
          termAssetCountMap.set(
            edge.to,
            (termAssetCountMap.get(edge.to) ?? 0) + 1
          );
        }
      });

      const visibleIds = new Set([...visibleTermIds, ...visibleAssetIds]);
      nodesForGraph = inputNodes.filter((n) => visibleIds.has(n.id));
      edgesForGraph = mergedEdgesList.filter(
        (e) => visibleIds.has(e.from) && visibleIds.has(e.to)
      );

      const visTermNodes = nodesForGraph.filter((n) => !allAssetIds.has(n.id));
      dataModePositions = computeDataModePositions(
        visTermNodes,
        edgesForGraph,
        visibleAssetIds
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
      const label = node.originalLabel ?? node.label;
      const nodeWidth = estimateNodeWidth(label);
      const pos =
        explorationMode === 'data'
          ? dataModePositions[node.id]
          : explorationMode === 'hierarchy'
          ? nodePositions?.[node.id]
          : groupPositions[node.id] ?? nodePositions?.[node.id];
      const isSelected =
        explorationMode === 'hierarchy'
          ? node.termId === selectedNodeId || selectedNodeId === node.id
          : selectedNodeId === node.id;
      const isHighlighted =
        selectedNodeId !== null && !isSelected && neighborSet.has(node.id);
      const isDimmed =
        selectedNodeId !== null && !isSelected && !neighborSet.has(node.id);

      const isInHierarchyMode = explorationMode === 'hierarchy';
      const isInDataMode = explorationMode === 'data';
      const isDataAssetOrMetric =
        node.type === 'dataAsset' || node.type === 'metric';

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

        return {
          id: node.id,
          type: 'circle',
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
            pos
          ),
        };
      }

      if (isInDataMode) {
        const sz = DATA_MODE_TERM_NODE_SIZE;
        const assetCount = termAssetCountMap.get(node.id) ?? 0;

        return {
          id: node.id,
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

    const g6Edges: EdgeData[] = edgesForGraph.map((edge, index) => {
      const edgeId = `edge-${index}-${edge.from}-${edge.to}`;
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
      const isEdgeDimmed =
        selectedNodeId !== null &&
        selectedNodeId !== edge.from &&
        selectedNodeId !== edge.to &&
        !(
          selectedScopedIds?.has(edge.from) || selectedScopedIds?.has(edge.to)
        ) &&
        !neighborSet.has(edge.from) &&
        !neighborSet.has(edge.to);
      const isClickedEdge = edgeId === clickedEdgeId;
      const edgeColor = isCrossTeam
        ? CROSS_GLOSSARY_EDGE_COLOR
        : RELATION_COLORS[edge.relationType] ?? EDGE_STROKE_COLOR;

      const fromType = nodeIdToType.get(edge.from);
      const toType = nodeIdToType.get(edge.to);
      const isTermTermInDataMode =
        explorationMode === 'data' &&
        fromType !== 'dataAsset' &&
        fromType !== 'metric' &&
        toType !== 'dataAsset' &&
        toType !== 'metric';

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
        lineWidth: isCrossTeam ? 2 : isHighlighted || isClickedEdge ? 2.5 : 1.5,
        lineAppendWidth: EDGE_LINE_APPEND_WIDTH,
        opacity: 1,
        endArrow: explorationMode !== 'data',
        ...(labelText &&
          getEdgeRelationLabelStyle(labelText, edge.relationType)),
      };
      const crossGlossaryStyle = isCrossTeam
        ? { curveOffset: CROSS_GLOSSARY_CURVE_OFFSET }
        : {};

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
          ...crossGlossaryStyle,
        },
      };
    });

    const combos: ComboData[] = [];
    if (explorationMode === 'hierarchy' && hierarchyCombos.length > 0) {
      hierarchyCombos.forEach((combo) => {
        const color =
          glossaryColorMap[combo.glossaryId] ?? 'var(--color-gray-400)';
        combos.push({
          id: combo.id,
          data: { glossaryName: combo.label, color },
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
        combos.push({
          id: `glossary-group-${glossaryId}`,
          data: { glossaryName: name, color },
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
    nodePositions,
    glossaryColorMap,
    neighborSet,
    computeNodeColor,
    clickedEdgeId,
    layoutType,
    explorationMode,
    hierarchyCombos,
  ]);

  return { graphData, mergedEdgesList, neighborSet, computeNodeColor };
}
