/*
 *  Copyright 2024 Collate.
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

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTermRelationType } from '../../../rest/settingConfigAPI';
import {
  LayoutEngine,
  RELATION_COLORS,
  toLayoutEngineType,
  withoutOntologyAutocompleteAll,
} from '../OntologyExplorer.constants';
import {
  ExplorationMode,
  GraphFilters,
  GraphSettings,
  OntologyEdge,
  OntologyExplorerProps,
  OntologyGraphData,
  OntologyNode,
} from '../OntologyExplorer.interface';
import {
  ASSET_NODE_TYPE,
  ASSET_RELATION_TYPE,
  GLOSSARY_COLORS,
  METRIC_NODE_TYPE,
} from '../utils/graphBuilders';
import { computeGraphSearchHighlight } from '../utils/graphSearchHighlight';
import { buildHierarchyGraphs } from '../utils/hierarchyGraphBuilder';
import { computeGlossaryGroupPositions } from '../utils/layoutCalculations';

export interface UseOntologyGraphDerivedOptions {
  graphData: OntologyGraphData | null;
  assetGraphData: OntologyGraphData | null;
  loadingTermIds: Set<string>;
  termAssetCounts: Record<string, number>;
  filters: GraphFilters;
  explorationMode: ExplorationMode;
  glossaries: Glossary[];
  relationTypes: GlossaryTermRelationType[];
  settings: GraphSettings;
  scope: OntologyExplorerProps['scope'];
  glossaryId?: string;
  termGlossaryId?: string;
  dataSource: 'rdf' | 'database';
}

export function useOntologyGraphDerived({
  graphData,
  assetGraphData,
  loadingTermIds,
  termAssetCounts,
  filters,
  explorationMode,
  glossaries,
  relationTypes,
  settings,
  scope,
  glossaryId,
  termGlossaryId,
  dataSource,
}: UseOntologyGraphDerivedOptions) {
  const { t } = useTranslation();

  const glossaryColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    glossaries.forEach((g, i) => {
      map[g.id] = GLOSSARY_COLORS[i % GLOSSARY_COLORS.length];
    });

    return map;
  }, [glossaries]);

  const loadedAssetCountPerTerm = useMemo(() => {
    const counts: Record<string, number> = {};
    assetGraphData?.edges.forEach((e) => {
      if (e.relationType === ASSET_RELATION_TYPE) {
        counts[e.to] = (counts[e.to] ?? 0) + 1;
      }
    });

    return counts;
  }, [assetGraphData]);

  const combinedGraphData = useMemo(() => {
    if (!graphData) {
      return null;
    }

    if (explorationMode === 'data') {
      const nodesWithAssetCounts = graphData.nodes.map((node) => {
        if (
          node.type !== 'glossaryTerm' &&
          node.type !== 'glossaryTermIsolated'
        ) {
          return node;
        }

        return {
          ...node,
          assetCount: termAssetCounts[node.id] ?? 0,
          loadedAssetCount: loadedAssetCountPerTerm[node.id] ?? 0,
          isLoadingAssets: loadingTermIds.has(node.id),
        };
      });

      if (!assetGraphData) {
        return { nodes: nodesWithAssetCounts, edges: graphData.edges };
      }

      const mergedNodeIds = new Set(nodesWithAssetCounts.map((n) => n.id));
      const mergedNodes = [...nodesWithAssetCounts];
      assetGraphData.nodes.forEach((n) => {
        if (!mergedNodeIds.has(n.id)) {
          mergedNodeIds.add(n.id);
          mergedNodes.push(n);
        }
      });

      const edgeKey = (e: OntologyEdge) =>
        `${e.from}-${e.to}-${e.relationType}`;
      const mergedEdgeKeys = new Set(graphData.edges.map(edgeKey));
      const mergedEdges = [...graphData.edges];
      assetGraphData.edges.forEach((e) => {
        const k = edgeKey(e);
        if (!mergedEdgeKeys.has(k)) {
          mergedEdgeKeys.add(k);
          mergedEdges.push(e);
        }
      });

      return { nodes: mergedNodes, edges: mergedEdges };
    }

    return graphData;
  }, [
    graphData,
    assetGraphData,
    explorationMode,
    termAssetCounts,
    loadedAssetCountPerTerm,
    loadingTermIds,
  ]);

  const filteredGraphData = useMemo(() => {
    if (!combinedGraphData) {
      return null;
    }

    let filteredNodes = [...combinedGraphData.nodes];
    let filteredEdges = [...combinedGraphData.edges];

    const glossaryFilterIds = withoutOntologyAutocompleteAll(
      filters.glossaryIds
    );
    const relationTypeFilterIds = withoutOntologyAutocompleteAll(
      filters.relationTypes
    );

    if (glossaryFilterIds.length > 0) {
      const glossaryTermIds = new Set(
        filteredNodes
          .filter(
            (n) =>
              n.type !== METRIC_NODE_TYPE &&
              n.type !== ASSET_NODE_TYPE &&
              n.glossaryId &&
              glossaryFilterIds.includes(n.glossaryId)
          )
          .map((n) => n.id)
      );

      const edgeKey = (e: OntologyEdge) =>
        `${e.from}-${e.to}-${e.relationType}`;
      const glossaryNeighborIds = new Set<string>(glossaryTermIds);
      const glossaryEdgeKeys = new Set<string>();

      filteredEdges.forEach((edge) => {
        const isIncidentToGlossary =
          glossaryTermIds.has(edge.from) || glossaryTermIds.has(edge.to);
        if (!isIncidentToGlossary) {
          return;
        }
        glossaryNeighborIds.add(edge.from);
        glossaryNeighborIds.add(edge.to);
        glossaryEdgeKeys.add(edgeKey(edge));
      });

      filteredNodes = filteredNodes.filter((n) => {
        if (n.type === 'glossary') {
          return glossaryFilterIds.includes(n.id);
        }

        return glossaryNeighborIds.has(n.id);
      });
      filteredEdges = filteredEdges.filter((e) =>
        glossaryEdgeKeys.has(edgeKey(e))
      );
    }

    if (relationTypeFilterIds.length > 0) {
      const nodeTypeMap = new Map(filteredNodes.map((n) => [n.id, n.type]));

      // Snapshot which nodes have any edge before relation-type filtering.
      // This distinguishes truly isolated nodes (never had an edge) from nodes
      // that are connected but whose edge type doesn't match the active filter.
      const nodesWithAnyEdge = new Set<string>();
      filteredEdges.forEach((e) => {
        nodesWithAnyEdge.add(e.from);
        nodesWithAnyEdge.add(e.to);
      });

      filteredEdges = filteredEdges.filter((e) => {
        const fromType = nodeTypeMap.get(e.from);
        const toType = nodeTypeMap.get(e.to);
        if (
          explorationMode === 'data' &&
          (fromType === ASSET_NODE_TYPE ||
            fromType === METRIC_NODE_TYPE ||
            toType === ASSET_NODE_TYPE ||
            toType === METRIC_NODE_TYPE)
        ) {
          return true;
        }

        return relationTypeFilterIds.includes(e.relationType);
      });

      const connectedByRelationType = new Set<string>();
      filteredEdges.forEach((e) => {
        connectedByRelationType.add(e.from);
        connectedByRelationType.add(e.to);
      });
      // Keep a node when:
      //   - it has a matching-type edge, OR
      //   - showIsolatedNodes is on AND it had no edges at all before this filter
      //     (a truly isolated term, not a term whose edges were just filtered away)
      // Glossary root nodes are never kept here — they are structural labels with
      // no edges; the glossary filter block already controls their visibility.
      filteredNodes = filteredNodes.filter(
        (n) =>
          connectedByRelationType.has(n.id) ||
          (filters.showIsolatedNodes &&
            n.type !== 'glossary' &&
            !nodesWithAnyEdge.has(n.id))
      );
    }

    if (filters.showCrossGlossaryOnly) {
      const nodeById = new Map(filteredNodes.map((node) => [node.id, node]));
      filteredEdges = filteredEdges.filter((edge) => {
        const fromGlossary = nodeById.get(edge.from)?.glossaryId;
        const toGlossary = nodeById.get(edge.to)?.glossaryId;

        return fromGlossary && toGlossary && fromGlossary !== toGlossary;
      });

      const nodeIds = new Set<string>();
      filteredEdges.forEach((edge) => {
        nodeIds.add(edge.from);
        nodeIds.add(edge.to);
      });
      filteredNodes = filteredNodes.filter((node) => nodeIds.has(node.id));
    }

    if (!filters.showIsolatedNodes) {
      const connectedIds = new Set<string>();
      filteredEdges.forEach((e) => {
        connectedIds.add(e.from);
        connectedIds.add(e.to);
      });
      filteredNodes = filteredNodes.filter(
        (n) => connectedIds.has(n.id) || n.type === 'glossary'
      );
    }

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [combinedGraphData, filters, explorationMode]);

  const isHierarchyView = filters.viewMode === 'hierarchy';

  const hierarchyGraphData = useMemo(() => {
    if (!isHierarchyView || !filteredGraphData) {
      return null;
    }

    const terms = filteredGraphData.nodes.filter(
      (n) => n.type !== ASSET_NODE_TYPE && n.type !== METRIC_NODE_TYPE
    );
    const termIds = new Set(terms.map((term) => term.id));
    const relations = filteredGraphData.edges.filter(
      (e) => termIds.has(e.from) && termIds.has(e.to)
    );
    const glossaryNames: Record<string, string> = {};
    glossaries.forEach((g) => {
      if (g.id && g.name) {
        glossaryNames[g.id] = g.name;
      }
    });

    return buildHierarchyGraphs({
      terms,
      relations,
      relationSettings: { relationTypes },
      relationColors: RELATION_COLORS,
      glossaryNames,
    });
  }, [isHierarchyView, filteredGraphData, relationTypes, glossaries]);

  const graphDataToShow = useMemo(() => {
    if (isHierarchyView && hierarchyGraphData) {
      return {
        nodes: hierarchyGraphData.nodes,
        edges: hierarchyGraphData.edges.map((e) => ({
          from: e.from,
          to: e.to,
          relationType: e.relationType,
          label: e.relationType,
        })),
      };
    }

    return filteredGraphData;
  }, [isHierarchyView, hierarchyGraphData, filteredGraphData]);

  const hierarchyBakedPositions = useMemo(() => {
    if (!isHierarchyView || !hierarchyGraphData) {
      return undefined;
    }
    const engine = toLayoutEngineType(settings.layout);
    if (engine !== LayoutEngine.Circular) {
      return undefined;
    }

    return computeGlossaryGroupPositions(hierarchyGraphData.nodes, engine);
  }, [hierarchyGraphData, isHierarchyView, settings.layout]);

  const graphSearchHighlight = useMemo(() => {
    if (!graphDataToShow) {
      return null;
    }

    return computeGraphSearchHighlight(
      graphDataToShow.nodes,
      graphDataToShow.edges,
      filters.searchQuery,
      glossaries,
      relationTypes
    );
  }, [graphDataToShow, filters.searchQuery, glossaries, relationTypes]);

  const exportableGlossaryId =
    scope === 'glossary'
      ? glossaryId
      : scope === 'term'
      ? termGlossaryId
      : undefined;

  const exportableGlossaryName = exportableGlossaryId
    ? glossaries.find((g) => g.id === exportableGlossaryId)?.name ??
      exportableGlossaryId
    : undefined;

  const statsItems = useMemo(() => {
    if (!graphDataToShow) {
      return [];
    }
    const termCount = graphDataToShow.nodes.filter(
      (n) => n.type === 'glossaryTerm' || n.type === 'glossaryTermIsolated'
    ).length;
    const metricCount = graphDataToShow.nodes.filter(
      (n) => n.type === METRIC_NODE_TYPE
    ).length;
    const assetCount =
      explorationMode === 'data'
        ? graphDataToShow.nodes
            .filter(
              (n) =>
                n.type === 'glossaryTerm' || n.type === 'glossaryTermIsolated'
            )
            .reduce((sum, n) => sum + ((n as OntologyNode).assetCount ?? 0), 0)
        : graphDataToShow.nodes.filter((n) => n.type === ASSET_NODE_TYPE)
            .length;
    const relationCount = graphDataToShow.edges.length;
    const isolatedCount = graphDataToShow.nodes.filter(
      (n) => n.type === 'glossaryTermIsolated'
    ).length;
    const sourceLabel = dataSource === 'rdf' ? ' (RDF)' : '';

    return [
      `${termCount} ${t('label.term-plural')}`,
      ...(metricCount > 0
        ? [`${metricCount} ${t('label.metric-plural')}`]
        : []),
      ...(explorationMode === 'data' && assetCount > 0
        ? [`${assetCount} ${t('label.data-asset-plural')}`]
        : []),
      `${relationCount} ${t('label.relation-plural')}`,
      `${isolatedCount} ${t('label.isolated')}${sourceLabel}`,
    ];
  }, [graphDataToShow, dataSource, explorationMode, t]);

  return {
    filteredGraphData,
    hierarchyGraphData,
    graphDataToShow,
    hierarchyBakedPositions,
    graphSearchHighlight,
    glossaryColorMap,
    statsItems,
    isHierarchyView,
    exportableGlossaryId,
    exportableGlossaryName,
  };
}
