/*
 *  Copyright 2025 Collate.
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
import {
  GraphData,
  KnowledgeGraphFilters,
  KnowledgeGraphLevel,
  KnowledgeGraphMode,
  KnowledgeGraphPresentation,
  MappingCoverage,
} from '../../components/KnowledgeGraph/KnowledgeGraph.interface';
import { RelationCategory } from '../../components/KnowledgeGraph/KnowledgeGraph.relations';
import { addDeclaredOntologyProperties } from '../../utils/knowledge-graph/knowledgeGraphOntology.utils';
import {
  annotateGraphCoverage,
  buildGraphPresentation,
  filterGraphPresentation,
  getGraphDistances,
  getMappingCoverage,
  restrictToEntityLevel,
  sentenceCaseGraphLabels,
} from '../../utils/knowledge-graph/knowledgeGraphPresentation.utils';
import {
  countRelationCategories,
  graphLevelToDepth,
  resolveFocusNodeId,
  transformToG6Format,
} from '../../utils/KnowledgeGraph.utils';
import { useKnowledgeGraphColumns } from './useKnowledgeGraphColumns';
import { useKnowledgeGraphData } from './useKnowledgeGraphData';
import {
  useKnowledgeGraphConceptDetails,
  useKnowledgeGraphOntology,
} from './useKnowledgeGraphOntology';
interface ExplorerOptions {
  entityId: string;
  entityType: string;
  selectedLevel: KnowledgeGraphLevel;
  mode: KnowledgeGraphMode;
  filters: KnowledgeGraphFilters;
  refresh: number;
  excludedFamilies: RelationCategory[];
  coverageMode: string;
  presentation: KnowledgeGraphPresentation;
  expanded: string[];
  focusedNodeId?: string;
}

const getExplorerResult = (
  assets: ReturnType<typeof useKnowledgeGraphData>,
  ontology: ReturnType<typeof useKnowledgeGraphOntology>,
  mode: KnowledgeGraphMode
): ReturnType<typeof useKnowledgeGraphData> => {
  if (mode !== 'ontology') {
    return assets;
  }
  const empty: GraphData | null =
    !assets.loading && !ontology.concept ? { nodes: [], edges: [] } : null;

  return {
    ...ontology,
    loading: ontology.loading || assets.loading,
    error: ontology.error || assets.error,
    data: ontology.data ?? empty,
    unfiltered: ontology.unfiltered ?? empty,
  };
};

export const useKnowledgeGraphExplorer = ({
  entityId,
  entityType,
  selectedLevel,
  mode,
  filters,
  refresh,
  excludedFamilies,
  coverageMode,
  presentation,
  expanded,
  focusedNodeId,
}: ExplorerOptions) => {
  const { t } = useTranslation();
  const domainLabel = t('label.domain');
  const query = useMemo(
    () => ({
      entityId: entityId,
      entityType,
      depth: mode === 'ontology' ? 2 : graphLevelToDepth(selectedLevel),
      entityTypes: mode === 'ontology' ? [] : filters.entityTypes,
      relationshipTypes: mode === 'ontology' ? [] : filters.relationshipTypes,
    }),
    [entityId, entityType, selectedLevel, filters, mode]
  );
  const assetResult = useKnowledgeGraphData(query, refresh);
  const ontology = useKnowledgeGraphOntology(
    assetResult.unfiltered,
    mode,
    selectedLevel,
    filters,
    refresh
  );
  const result = getExplorerResult(assetResult, ontology, mode);
  const rootEntityId =
    mode === 'ontology' ? ontology.concept?.id ?? '' : entityId;
  const rootEntityType = mode === 'ontology' ? 'glossaryTerm' : entityType;
  const rootId = resolveFocusNodeId(
    result.unfiltered?.nodes ?? [],
    rootEntityId
  );
  const entityLevel = selectedLevel === 1;
  const labelledUnfiltered = useMemo(
    () => sentenceCaseGraphLabels(result.unfiltered),
    [result.unfiltered]
  );
  const labelledData = useMemo(
    () => sentenceCaseGraphLabels(result.data),
    [result.data]
  );
  const rawData = useMemo(
    () =>
      entityLevel
        ? restrictToEntityLevel(labelledUnfiltered, rootId, mode)
        : labelledUnfiltered,
    [entityLevel, labelledUnfiltered, rootId, mode]
  );
  const scopedData = useMemo(
    () =>
      entityLevel
        ? restrictToEntityLevel(labelledData, rootId, mode)
        : labelledData,
    [entityLevel, labelledData, rootId, mode]
  );
  const columns = useKnowledgeGraphColumns(
    entityId,
    entityType === 'table',
    refresh
  );
  const concepts = useKnowledgeGraphConceptDetails(
    rawData?.nodes ?? [],
    mode === 'ontology',
    refresh
  );
  const allData = useMemo(
    () =>
      addDeclaredOntologyProperties(
        rawData,
        rawData,
        concepts.terms,
        rootId,
        result.appliedQuery?.depth ?? 0,
        domainLabel
      ),
    [rawData, concepts.terms, rootId, result.appliedQuery?.depth, domainLabel]
  );
  const filteredData = useMemo(
    () =>
      addDeclaredOntologyProperties(
        scopedData,
        rawData,
        concepts.terms,
        rootId,
        result.appliedQuery?.depth ?? 0,
        domainLabel,
        filters
      ),
    [
      scopedData,
      rawData,
      concepts.terms,
      rootId,
      result.appliedQuery?.depth,
      domainLabel,
      filters,
    ]
  );
  const coverage = useMemo(() => {
    if (!allData) {
      return new Map<string, MappingCoverage>();
    }
    const distances = getGraphDistances(allData, rootId);
    const inspectedIds = new Set(
      [...distances]
        .filter(([, level]) => level <= (result.appliedQuery?.depth ?? 0))
        .map(([id]) => id)
    );

    return getMappingCoverage(allData, inspectedIds);
  }, [allData, rootId, result.appliedQuery?.depth]);
  const displayData = useMemo(
    () =>
      filterGraphPresentation(
        filteredData,
        rootId,
        excludedFamilies,
        coverage,
        coverageMode
      ),
    [filteredData, rootId, excludedFamilies, coverage, coverageMode]
  );
  const presented = useMemo(() => {
    if (!displayData || !allData) {
      return null;
    }
    const graph = buildGraphPresentation(
      displayData,
      allData,
      rootId,
      presentation,
      expanded,
      focusedNodeId
    );

    return {
      data: annotateGraphCoverage(
        graph.data,
        coverage,
        rootId,
        coverageMode === 'highlight'
      ),
      unfiltered: annotateGraphCoverage(
        graph.unfiltered,
        coverage,
        rootId,
        coverageMode === 'highlight'
      ),
    };
  }, [
    displayData,
    allData,
    rootId,
    presentation,
    expanded,
    focusedNodeId,
    coverage,
    coverageMode,
  ]);
  const scene = useMemo(() => {
    const original = transformToG6Format(displayData);
    const grouped = transformToG6Format(presented?.data ?? null);

    return {
      nodes: [
        ...(displayData?.nodes ?? []),
        ...(presented?.data.nodes.filter(
          (node) => node.presentation?.members
        ) ?? []),
      ],
      edges: [
        ...new Map(
          [...original.edges, ...grouped.edges].map((edge) => [edge.id, edge])
        ).values(),
      ],
    };
  }, [displayData, presented?.data]);
  const counts = useMemo(
    () => countRelationCategories(displayData),
    [displayData]
  );
  const familyCounts = useMemo(
    () => countRelationCategories(allData),
    [allData]
  );
  const detailCounts = {
    columns:
      mode === 'ontology'
        ? concepts.terms.reduce(
            (total, term) =>
              total +
              (term.effectiveAttributes ?? term.attributes ?? []).length,
            0
          )
        : columns.total,
    relationships: displayData?.edges.length ?? 0,
    coverage: [...coverage.values()].filter((value) => value === 'unmapped')
      .length,
  };

  return {
    result,
    rootEntityId,
    rootEntityType,
    displayData,
    allData,
    presented: presented ?? { data: null, unfiltered: null },
    columns,
    concepts,
    ontology,
    coverage,
    scene,
    counts,
    familyCounts,
    detailCounts,
  };
};
