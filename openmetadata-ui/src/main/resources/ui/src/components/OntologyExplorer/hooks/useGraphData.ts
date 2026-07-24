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
import { RelationCardinality } from '../../../generated/configuration/glossaryTermRelationSettings';
import { GlossaryTermRelationType } from '../../../rest/settingConfigAPI';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { deriveCardinality } from '../../../utils/Glossary/glossaryTermRelationUtils';
import {
  DATA_MODE_ASSET_CIRCLE_SIZE,
  DATA_MODE_ASSET_EDGE_STROKE_COLOR,
  DATA_MODE_TERM_H_SPACING,
  DATA_MODE_TERM_NODE_SIZE,
  DATA_MODE_TERM_V_SPACING,
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
import {
  computeGlossaryGroupPositions,
  computeOutermostRingRadius,
} from '../utils/layoutCalculations';

interface CardinalityInfo {
  cardinality?: RelationCardinality;
  sourceMax?: number | null;
  targetMax?: number | null;
}

function getCardinalityEndLabels(
  relationType: string,
  cardinalityMap: Map<string, CardinalityInfo>
): { startLabelText: string; endLabelText: string } | null {
  const info = cardinalityMap.get(relationType);
  if (!info?.cardinality) {
    return null;
  }
  switch (info.cardinality) {
    case RelationCardinality.OneToOne:
      return { startLabelText: '1', endLabelText: '1' };
    case RelationCardinality.OneToMany:
      return { startLabelText: '1', endLabelText: 'M' };
    case RelationCardinality.ManyToOne:
      return { startLabelText: 'M', endLabelText: '1' };
    case RelationCardinality.ManyToMany:
      return { startLabelText: 'M', endLabelText: 'M' };
    case RelationCardinality.Custom:
      return {
        startLabelText: info.sourceMax === 1 ? '1' : 'M',
        endLabelText: info.targetMax === 1 ? '1' : 'M',
      };
    default:
      return null;
  }
}

interface RelationMaps {
  inverseMap: Record<string, string>;
  symmetricSet: Set<string>;
}

function buildRelationMaps(
  configuredTypes?: GlossaryTermRelationType[]
): RelationMaps {
  const inverseMap: Record<string, string> = {};
  const symmetricSet = new Set<string>();
  configuredTypes?.forEach((rt) => {
    if (rt.inverseRelation) {
      inverseMap[rt.name] = rt.inverseRelation;
      if (!(rt.inverseRelation in inverseMap)) {
        inverseMap[rt.inverseRelation] = rt.name;
      }
    }
    if (rt.isSymmetric) {
      symmetricSet.add(rt.name);
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

export function mergeEdges(
  inputEdges: OntologyEdge[],
  configuredTypes?: GlossaryTermRelationType[]
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

      let matchIndex = -1;
      for (let j = i + 1; j < list.length; j++) {
        if (consumed.has(j)) {
          continue;
        }
        const other = list[j];
        if (other.from !== edge.to || other.to !== edge.from) {
          continue;
        }
        const isSymmetricMatch =
          isSymmetric && other.relationType === edge.relationType;
        if (
          isSymmetricMatch ||
          isInversePair(edge.relationType, other.relationType, inverseMap)
        ) {
          matchIndex = j;

          break;
        }
      }

      consumed.add(i);
      if (matchIndex < 0) {
        result.push({
          from: edge.from,
          to: edge.to,
          relationType: edge.relationType,
          isBidirectional: false,
        });

        continue;
      }
      const match = list[matchIndex];
      consumed.add(matchIndex);
      result.push({
        from: edge.from,
        to: edge.to,
        relationType: edge.relationType,
        ...(edge.relationType === match.relationType
          ? {}
          : { inverseRelationType: match.relationType }),
        isBidirectional: true,
      });
    }
  }

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
  glossaries,
  glossaryColorMap,
  layoutType,
  hierarchyCombos = [],
  graphSearchHighlight = null,
  relationTypes,
}: BuildGraphDataProps) {
  const computeNodeColor = useCallback(
    (node: OntologyNode): string =>
      node.glossaryId && glossaryColorMap[node.glossaryId]
        ? glossaryColorMap[node.glossaryId]
        : 'var(--color-blue-600)',
    [glossaryColorMap]
  );

  const mergedEdgesList = useMemo(
    () => mergeEdges(inputEdges, relationTypes),
    [inputEdges, relationTypes]
  );

  const customRelationColorMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    relationTypes?.forEach((rt) => {
      const effectiveColor = rt.isSystemDefined
        ? RELATION_META[rt.name]?.color ?? rt.color
        : rt.color ?? RELATION_META[rt.name]?.color;
      if (effectiveColor) {
        map[rt.name] = effectiveColor;
      }
    });

    return map;
  }, [relationTypes]);

  const cardinalityMap = useMemo<Map<string, CardinalityInfo>>(() => {
    const map = new Map<string, CardinalityInfo>();
    relationTypes?.forEach((rt) => {
      const cardinality =
        rt.cardinality ?? deriveCardinality(rt.sourceMax, rt.targetMax);
      map.set(rt.name, {
        cardinality,
        sourceMax: rt.sourceMax,
        targetMax: rt.targetMax,
      });
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
    let termHSpacing = DATA_MODE_TERM_H_SPACING;
    let termVSpacing = DATA_MODE_TERM_V_SPACING;

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

      if (idsToExpand.size > 0) {
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
      edgesForGraph = mergedEdgesList.filter((e) => {
        if (!visibleIds.has(e.from) || !visibleIds.has(e.to)) {
          return false;
        }
        const fromIsAsset = allAssetIds.has(e.from);
        const toIsAsset = allAssetIds.has(e.to);
        if (fromIsAsset || toIsAsset) {
          const termId = fromIsAsset ? e.to : e.from;

          return idsToExpand.has(termId);
        }

        return true;
      });
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
      const isDataAsset = node.type === 'dataAsset' || node.type === 'metric';
      const shouldTruncateLabel =
        isInModelMode || (explorationMode === 'data' && !isDataAsset);
      const estimatedWidth = estimateNodeWidth(rawLabel);
      const nodeWidth = shouldTruncateLabel
        ? Math.min(MODEL_NODE_MAX_WIDTH, estimatedWidth)
        : estimatedWidth;
      const label = shouldTruncateLabel
        ? truncateNodeLabelByWidth(rawLabel, nodeWidth)
        : rawLabel;
      const pos =
        explorationMode === 'hierarchy'
          ? nodePositions?.[node.id]
          : explorationMode === 'data'
          ? isDataAsset
            ? undefined
            : dataModeTermPositions[node.id]
          : undefined;
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
            isLoadingAssets: node.isLoadingAssets ?? false,
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

    const g6Edges: EdgeData[] = Array.from(directedGroupMap.values()).flatMap(
      (group) => {
        const rep = group[0];
        const n = group.length;

        const fromGlossary = nodeIdToGlossaryId.get(rep.from);
        const toGlossary = nodeIdToGlossaryId.get(rep.to);
        const isCrossTeam = Boolean(
          fromGlossary && toGlossary && fromGlossary !== toGlossary
        );
        const isHighlighted =
          selectedNodeId === rep.from ||
          selectedNodeId === rep.to ||
          (selectedScopedIds != null &&
            (selectedScopedIds.has(rep.from) || selectedScopedIds.has(rep.to)));
        const isDimmedBySelection =
          selectedNodeId !== null &&
          selectedNodeId !== rep.from &&
          selectedNodeId !== rep.to &&
          !(
            selectedScopedIds?.has(rep.from) || selectedScopedIds?.has(rep.to)
          ) &&
          !neighborSet.has(rep.from) &&
          !neighborSet.has(rep.to);

        const fromType = nodeIdToType.get(rep.from);
        const toType = nodeIdToType.get(rep.to);
        const isTermTermInDataMode =
          explorationMode === 'data' &&
          fromType !== 'dataAsset' &&
          fromType !== 'metric' &&
          toType !== 'dataAsset' &&
          toType !== 'metric';

        return group.map((singleEdge, i) => {
          const edgeId = `edge-${singleEdge.from}-${singleEdge.to}-${singleEdge.relationType}`;
          const isPrimary = i === 0;
          const edgeKeyStr = `${singleEdge.from}::${singleEdge.to}::${singleEdge.relationType}`;
          const isDimmedBySearch =
            Boolean(searchEdgeSet) && !searchEdgeSet!.has(edgeKeyStr);
          const isEdgeDimmed = searchHighlightActive
            ? isDimmedBySearch
            : isDimmedBySelection;
          const isClickedEdge = edgeId === clickedEdgeId;

          const rawEdgeColor =
            explorationMode === 'data' && !isTermTermInDataMode
              ? DATA_MODE_ASSET_EDGE_STROKE_COLOR
              : customRelationColorMap[singleEdge.relationType] ??
                RELATION_COLORS[singleEdge.relationType] ??
                EDGE_STROKE_COLOR;
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
            ? singleEdge.inverseRelationType
              ? `${formatRelationLabel(
                  singleEdge.relationType
                )} / ${formatRelationLabel(singleEdge.inverseRelationType)}`
              : formatRelationLabel(singleEdge.relationType)
            : undefined;

          // Offset badges perpendicular to the edge direction so they never
          // stack along the edge (which breaks for vertical edges).
          // Use the canonical (sorted) node ordering so that edges travelling
          // in opposite directions between the same pair of nodes always get the
          // same perpendicular vector — preventing both badges from being offset
          // to the same side when one edge is reversed.
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

          const cardinalityLabels =
            showLabel && isPrimary
              ? getCardinalityEndLabels(singleEdge.relationType, cardinalityMap)
              : null;

          const labelStyle = labelText
            ? {
                ...getEdgeRelationLabelStyle(
                  labelText,
                  singleEdge.relationType,
                  customRelationColorMap[singleEdge.relationType]
                ),
                labelPosition: 'center',
                labelAutoRotate: false,
                labelOffsetX,
                labelOffsetY,
                ...cardinalityLabels,
              }
            : {};

          const commonStyle = {
            lineAppendWidth: EDGE_LINE_APPEND_WIDTH,
            opacity: isEdgeDimmed ? DIMMED_EDGE_OPACITY : 1,
            ...labelStyle,
          };

          return {
            id: edgeId,
            source: singleEdge.from,
            target: singleEdge.to,
            data: {
              relationType: singleEdge.relationType,
              edgeColor,
              isHighlighted,
              isClickedEdge,
              isCrossTeam,
              isEdgeDimmed,
            },
            style: isPrimary
              ? {
                  stroke: edgeColor,
                  lineWidth: isHighlighted || isClickedEdge ? 2.5 : 1.5,
                  endArrow: explorationMode !== 'data',
                  ...commonStyle,
                }
              : {
                  // Line invisible; label group retains opacity:1 so badge shows.
                  stroke: 'transparent',
                  lineWidth: 0,
                  endArrow: false,
                  ...commonStyle,
                },
          };
        });
      }
    );

    const extraComboPadding = (glossaryId: string): number => {
      const maxParallel = glossaryMaxParallelEdges.get(glossaryId) ?? 1;

      return Math.max(0, (maxParallel - 1) * BADGE_V_STEP);
    };

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
            extraVerticalPadding: extraComboPadding(combo.glossaryId),
          },
          style: buildComboStyle(
            combo.label,
            color,
            extraComboPadding(combo.glossaryId)
          ),
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
        const glossary = glossaries.find((g) => g.id === glossaryId);
        const name =
          terms[0].group ??
          (glossary ? glossary.displayName || glossary.name : '');
        const color = glossaryColorMap[glossaryId] ?? 'var(--color-gray-400)';
        const isComboDimmed = Boolean(
          searchGlossarySet && !searchGlossarySet.has(glossaryId)
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
