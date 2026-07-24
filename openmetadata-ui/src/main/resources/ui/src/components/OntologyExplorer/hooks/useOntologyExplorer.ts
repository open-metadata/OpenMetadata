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

import { isAxiosError } from 'axios';
import { isEqual } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { OntologyStudioAsset } from '../../../generated/api/data/ontologyStudioAsset';
import { OntologyStudioSummary as OntologyStudioSummaryResponse } from '../../../generated/api/data/ontologyStudioSummary';
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { Metric } from '../../../generated/entity/data/metric';
import { RelationshipType } from '../../../generated/entity/data/relationshipType';
import { EntityData } from '../../../pages/TasksPage/TasksPage.interface';
import {
  getGlossariesList,
  getGlossaryTerms,
  getGlossaryTermsAssetCounts,
  getGlossaryTermsByIds,
  getOntologyStudioAssets,
  getOntologyStudioDataGraph,
  getOntologyStudioSummary,
} from '../../../rest/glossaryAPI';
import { getMetrics } from '../../../rest/metricsAPI';
import { listRelationshipTypes } from '../../../rest/ontologyAPI';
import {
  checkRdfEnabled,
  downloadGlossaryOntology,
} from '../../../rest/rdfAPI';
import {
  getEntityDetailsPath,
  getGlossaryTermDetailsPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  DATA_MODE_ASSET_LOAD_PAGE_SIZE,
  DATA_MODE_ASSET_MAX_LOAD,
  DEFAULT_GLOSSARY_TERM_RELATION_TYPES_FALLBACK,
  GLOSSARY_TERM_ASSET_COUNT_FETCH_CONCURRENCY,
  LayoutType,
  ONTOLOGY_TERMS_PAGE_SIZE,
  withoutOntologyAutocompleteAll,
} from '../OntologyExplorer.constants';
import {
  ExplorationMode,
  GraphFilters,
  GraphSettings,
  GraphViewMode,
  OntologyEdge,
  OntologyExplorerProps,
  OntologyGraphData,
  OntologyGraphHandle,
  OntologyNode,
} from '../OntologyExplorer.interface';
import {
  ASSET_BINDING_EDGE_KIND,
  ASSET_NODE_TYPE,
  ASSET_RELATION_TYPE,
  buildGraphFromAllTerms,
  buildGraphFromStudioData,
  getScopedTermNodes,
  isTermNode,
  mergeMetricsIntoGraph,
  METRIC_NODE_TYPE,
} from '../utils/graphBuilders';
import { useOntologyGraphDerived } from './useOntologyGraphDerived';
const MODEL_TERM_FIELDS = [
  TabSpecificField.RELATED_TERMS,
  TabSpecificField.CHILDREN,
  TabSpecificField.PARENT,
  TabSpecificField.OWNERS,
];

const DATA_MODE_TERM_FIELDS = [TabSpecificField.PARENT];

export const DEFAULT_SETTINGS: GraphSettings = {
  layout: LayoutType.Hierarchical,
  showEdgeLabels: true,
};

export const DEFAULT_FILTERS: GraphFilters = {
  viewMode: 'overview',
  glossaryIds: [],
  relationTypes: [],
  showIsolatedNodes: true,
  showCrossGlossaryOnly: false,
  searchQuery: '',
};

export interface UseOntologyExplorerOptions {
  scope: OntologyExplorerProps['scope'];
  entityId?: string;
  glossaryId?: string;
  termGlossaryId?: string;
  onStatsChange?: (items: string[]) => void;
  onLoadingChange?: (loading: boolean) => void;
}

interface OntologyModelLoadResult {
  graphData: OntologyGraphData | null;
  glossaries: Glossary[];
  isGlossaryListComplete: boolean;
}

async function fetchAllTermsForGlossary(
  glossary: Glossary
): Promise<GlossaryTerm[]> {
  const maxRenderedTerms = 1500;
  const terms: GlossaryTerm[] = [];
  let after: string | undefined;
  do {
    try {
      const response = await getGlossaryTerms({
        glossary: glossary.id,
        fields: [
          TabSpecificField.RELATED_TERMS,
          TabSpecificField.CHILDREN,
          TabSpecificField.PARENT,
          TabSpecificField.OWNERS,
        ],
        limit: ONTOLOGY_TERMS_PAGE_SIZE,
        after,
      });
      terms.push(...response.data);
      after = response.paging?.after;
    } catch {
      break;
    }
  } while (after && terms.length < maxRenderedTerms);

  return terms.slice(0, maxRenderedTerms);
}

async function fetchAllGlossariesPaginated(): Promise<{
  glossaries: Glossary[];
  complete: boolean;
}> {
  const collected: Glossary[] = [];
  let afterCursor: string | undefined;
  let pages = 0;
  const MAX_SAFE_PAGES = 500;
  do {
    try {
      const response = await getGlossariesList({
        fields: 'owners,tags,termCount',
        limit: 100,
        after: afterCursor,
      });
      collected.push(...response.data);
      afterCursor = response.paging?.after;
      pages += 1;
    } catch {
      return { glossaries: collected, complete: false };
    }
  } while (afterCursor && pages < MAX_SAFE_PAGES);

  return { glossaries: collected, complete: true };
}

function collectMissingRelatedTermIds(
  accumulated: GlossaryTerm[],
  loadedIds: Set<string>
): Set<string> {
  const missingIds = new Set<string>();
  for (const term of accumulated) {
    for (const relation of term.relatedTerms ?? []) {
      const id = relation.term?.id;
      if (id && !loadedIds.has(id)) {
        missingIds.add(id);
      }
    }
  }

  return missingIds;
}

function studioAssetNode(asset: OntologyStudioAsset): OntologyNode {
  const label =
    asset.entity.displayName ??
    asset.entity.name ??
    asset.entity.fullyQualifiedName ??
    asset.entity.id;

  return {
    id: asset.entity.id,
    columnCount: asset.columnCount,
    description: asset.entity.description,
    entityRef: asset.entity,
    fullyQualifiedName: asset.entity.fullyQualifiedName,
    label,
    originalLabel: label,
    serviceLabel:
      asset.serviceType ?? asset.service?.displayName ?? asset.service?.name,
    type: ASSET_NODE_TYPE,
  };
}

// Hydrates cross-glossary related terms referenced by the input array, in
// place. Walks term.relatedTerms transitively up to MAX_RESOLUTION_DEPTH
// levels, batching by Id (BATCH_SIZE matches the backend MAX_BATCH_BY_IDS).
//
// Failure semantics: if a single batch fails (network/5xx), its Ids are
// remembered in a skip set so subsequent depth passes don't retry them,
// but the rest of the loop still runs — best-effort hydration matches the
// old per-Id Promise.allSettled behavior on the client.
async function resolveRelatedTerms(terms: GlossaryTerm[]): Promise<void> {
  // BATCH_SIZE matches the backend MAX_BATCH_BY_IDS (100), which is sized
  // to keep the comma-encoded ids list well below Jetty's 8 KB
  // request-header limit.
  const BATCH_SIZE = 100;
  const MAX_RESOLUTION_DEPTH = 5;
  const loadedIds = new Set(terms.map((term) => term.id ?? ''));
  const skippedIds = new Set<string>();

  for (let depth = 0; depth < MAX_RESOLUTION_DEPTH; depth++) {
    const allMissing = collectMissingRelatedTermIds(terms, loadedIds);
    const missingIds = Array.from(allMissing).filter(
      (id) => !skippedIds.has(id)
    );
    if (missingIds.length === 0) {
      return;
    }

    for (let i = 0; i < missingIds.length; i += BATCH_SIZE) {
      const batch = missingIds.slice(i, i + BATCH_SIZE);
      try {
        const fetched = await getGlossaryTermsByIds(batch, {
          fields: [
            TabSpecificField.RELATED_TERMS,
            TabSpecificField.CHILDREN,
            TabSpecificField.PARENT,
            TabSpecificField.OWNERS,
          ],
        });
        fetched.forEach((term) => {
          terms.push(term);
          loadedIds.add(term.id ?? '');
        });
      } catch {
        // This batch is dead for the rest of the run. Remember the Ids so
        // collectMissingRelatedTermIds doesn't hand them back next depth
        // pass, but let the other batches in this pass still execute.
        batch.forEach((id) => skippedIds.add(id));
      }
    }
  }
}

export function useOntologyExplorer({
  scope,
  entityId,
  glossaryId,
  termGlossaryId,
  onStatsChange,
  onLoadingChange,
}: UseOntologyExplorerOptions) {
  const { t } = useTranslation();
  const graphRef = useRef<OntologyGraphHandle | null>(null);

  // --- State ---

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [graphData, setGraphData] = useState<OntologyGraphData | null>(null);
  const [assetGraphData, setAssetGraphData] =
    useState<OntologyGraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<OntologyNode | null>(null);
  const [expandedTermIds, setExpandedTermIds] = useState<Set<string>>(
    new Set()
  );
  const [loadingTermIds, setLoadingTermIds] = useState<Set<string>>(new Set());
  const [rdfEnabled, setRdfEnabled] = useState<boolean | null>(null);
  const [dataSource, setDataSource] = useState<'rdf' | 'database'>('database');
  const [relationTypes, setRelationTypes] = useState<RelationshipType[]>([]);
  const [glossaries, setGlossaries] = useState<Glossary[]>([]);
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_SETTINGS);
  const [filters, setFilters] = useState<GraphFilters>(DEFAULT_FILTERS);
  const [explorationMode, setExplorationMode] =
    useState<ExplorationMode>('model');
  const [termAssetCounts, setTermAssetCounts] = useState<
    Record<string, number>
  >({});
  const [hasMoreTerms, setHasMoreTerms] = useState(false);
  const [glossaryListComplete, setGlossaryListComplete] = useState(false);
  const [dataModeRefreshKey, setDataModeRefreshKey] = useState(0);
  const [dataModeTotalTermCount, setDataModeTotalTermCount] = useState(0);
  const [studioSummary, setStudioSummary] =
    useState<OntologyStudioSummaryResponse>();

  // --- Refs ---

  const graphDataRef = useRef<OntologyGraphData | null>(null);
  const explorationModeRef = useRef<ExplorationMode>('model');
  const filterFetchedGlossariesRef = useRef<Set<string>>(new Set());

  // Saves the model-mode graph when global data mode overwrites graphData so
  // it can be restored when the user switches back to model mode.
  const savedModelGraphRef = useRef<OntologyGraphData | null>(null);
  const isInGlobalDataModeRef = useRef(false);

  const assetFetchControllers = useRef<Map<string, AbortController>>(new Map());
  const scrollThrottleRef = useRef<number>(0);
  const pendingGlossariesRef = useRef<Glossary[]>([]);
  const partialGlossaryRef = useRef<{
    glossary: Glossary;
    afterCursor: string;
  } | null>(null);
  const isLoadingMoreRef = useRef(false);
  const lastLoadCompletedRef = useRef<number>(0);
  const modelLoadGenerationRef = useRef(0);

  const modelFiltersRef = useRef<GraphFilters>(DEFAULT_FILTERS);
  const dataFiltersRef = useRef<GraphFilters>({ ...DEFAULT_FILTERS });
  const dataModeInitialLoadUsesSpinnerRef = useRef(false);
  const dataModeAbortGenRef = useRef(0);
  const hasEnteredDataModeRef = useRef(false);

  useEffect(() => {
    graphDataRef.current = graphData;
  }, [graphData]);

  useEffect(() => {
    explorationModeRef.current = explorationMode;
  }, [explorationMode]);

  const glossariesRef = useRef<Glossary[]>(glossaries);
  glossariesRef.current = glossaries;

  const {
    combinedGraphData,
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
  } = useOntologyGraphDerived({
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
    entityId,
    glossaryId,
    termGlossaryId,
    dataSource,
  });

  const loadedTermCount = useMemo(
    () => (graphData?.nodes ?? []).filter(isTermNode).length,
    [graphData]
  );

  const totalTermCount = useMemo(
    () =>
      glossaryListComplete
        ? glossaries.reduce((acc, g) => acc + (g.termCount ?? 0), 0)
        : undefined,
    [glossaries, glossaryListComplete]
  );
  const hasMoreDataTerms =
    explorationMode === 'data' &&
    loadedTermCount < Math.min(dataModeTotalTermCount, 60);

  // --- Data fetching callbacks ---

  const fetchTermAssetCounts = useCallback(
    async (
      termNodes: OntologyNode[],
      glossaryFilterIds: string[],
      append = false
    ) => {
      if (termNodes.length === 0) {
        if (!append) {
          setTermAssetCounts({});
        }

        return;
      }

      try {
        let scopedGlossaryId: string | undefined;
        if (scope === 'glossary') {
          scopedGlossaryId = glossaryId;
        } else if (scope === 'term') {
          scopedGlossaryId = termGlossaryId;
        }
        const termGlossaryIds = new Set(
          termNodes
            .map((termNode) => termNode.glossaryId)
            .filter((id): id is string => Boolean(id))
        );
        const requestedGlossaryIds = scopedGlossaryId
          ? [scopedGlossaryId]
          : glossaryFilterIds.length > 0
          ? glossaryFilterIds.filter((id) => termGlossaryIds.has(id))
          : [];
        const glossaryFqnsToFetch = requestedGlossaryIds
          .map(
            (id) =>
              glossaries.find((glossary) => glossary.id === id)
                ?.fullyQualifiedName
          )
          .filter((fqn): fqn is string => Boolean(fqn));

        const mergedResponse: Record<string, number> = {};
        if (glossaryFqnsToFetch.length > 0) {
          const { length } = glossaryFqnsToFetch;
          const batchSize = GLOSSARY_TERM_ASSET_COUNT_FETCH_CONCURRENCY;
          for (let i = 0; i < length; i += batchSize) {
            const batch = glossaryFqnsToFetch.slice(i, i + batchSize);
            const responses = await Promise.all(
              batch.map((fqn) => getGlossaryTermsAssetCounts(fqn))
            );
            responses.forEach((response) => {
              Object.assign(mergedResponse, response);
            });
          }
        } else {
          Object.assign(mergedResponse, await getGlossaryTermsAssetCounts());
        }

        const counts: Record<string, number> = {};
        termNodes.forEach((termNode) => {
          const lookupKeys = [
            termNode.fullyQualifiedName,
            termNode.originalLabel,
            termNode.label,
          ].filter((key): key is string => Boolean(key));
          const matchedKey = lookupKeys.find((key) => key in mergedResponse);
          if (matchedKey) {
            counts[termNode.id] = mergedResponse[matchedKey];
          }
        });

        if (append) {
          setTermAssetCounts((prev) => ({ ...prev, ...counts }));
        } else {
          setTermAssetCounts(counts);
        }
      } catch {
        if (!append) {
          setTermAssetCounts({});
        }
      }
    },
    [scope, glossaryId, termGlossaryId, glossaries]
  );

  const appendTermAssetsForTerm = useCallback(
    async (termNode: OntologyNode, pageSize: number, fromOffset = 0) => {
      if (!isTermNode(termNode)) {
        return;
      }

      assetFetchControllers.current.get(termNode.id)?.abort();
      const controller = new AbortController();
      assetFetchControllers.current.set(termNode.id, controller);

      setLoadingTermIds((prev) => new Set(prev).add(termNode.id));

      const size = Math.min(DATA_MODE_ASSET_MAX_LOAD, Math.max(1, pageSize));

      try {
        const response = await getOntologyStudioAssets(
          termNode.id,
          size,
          fromOffset,
          controller.signal
        );

        if (controller.signal.aborted) {
          return;
        }

        const newAssetNodes = response.data.map(studioAssetNode);
        const newEdges: OntologyEdge[] = newAssetNodes.map((assetNode) => ({
          from: assetNode.id,
          to: termNode.id,
          label: t('label.tagged-with'),
          relationType: ASSET_RELATION_TYPE,
          edgeKind: ASSET_BINDING_EDGE_KIND,
        }));
        setTermAssetCounts((previous) => ({
          ...previous,
          [termNode.id]: response.paging.total,
        }));

        setAssetGraphData((prev) => {
          const prevNodes = prev?.nodes ?? [];
          const prevEdges = prev?.edges ?? [];
          const nodeIds = new Set(prevNodes.map((n) => n.id));
          const edgeKeys = new Set(
            prevEdges.map((e) => `${e.from}-${e.to}-${e.relationType}`)
          );
          const mergedNodes = [...prevNodes];
          const mergedEdges = [...prevEdges];

          newAssetNodes.forEach((n) => {
            if (!nodeIds.has(n.id)) {
              mergedNodes.push(n);
              nodeIds.add(n.id);
            }
          });
          newEdges.forEach((e) => {
            const key = `${e.from}-${e.to}-${e.relationType}`;
            if (!edgeKeys.has(key)) {
              mergedEdges.push(e);
              edgeKeys.add(key);
            }
          });

          return { nodes: mergedNodes, edges: mergedEdges };
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          showErrorToast(
            isAxiosError(error) ? error : String(error),
            t('server.entity-fetch-error')
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingTermIds((prev) => {
            const next = new Set(prev);
            next.delete(termNode.id);

            return next;
          });
        }
        assetFetchControllers.current.delete(termNode.id);
      }
    },
    [t]
  );

  const fetchVisibleMetrics = useCallback(async (): Promise<Metric[]> => {
    const response = await getMetrics({ fields: 'tags', limit: 300 });

    return response.data;
  }, []);

  const fetchTermsForGlossary = useCallback(
    async (
      glossary: Glossary,
      afterCursor?: string,
      fields: TabSpecificField[] = MODEL_TERM_FIELDS
    ): Promise<{ terms: GlossaryTerm[]; nextCursor?: string }> => {
      try {
        const response = await getGlossaryTerms({
          glossary: glossary.id,
          fields,
          limit: ONTOLOGY_TERMS_PAGE_SIZE,
          after: afterCursor,
        });

        return { terms: response.data, nextCursor: response.paging?.after };
      } catch {
        return { terms: [] };
      }
    },
    []
  );

  const loadNextTermPage = useCallback(
    async (glossaryList?: Glossary[]): Promise<GlossaryTerm[]> => {
      if (glossaryList) {
        pendingGlossariesRef.current = [...glossaryList];
        partialGlossaryRef.current = null;
      }

      const isDataMode = explorationModeRef.current === 'data';
      const fieldsToFetch = isDataMode
        ? DATA_MODE_TERM_FIELDS
        : MODEL_TERM_FIELDS;
      const accumulated: GlossaryTerm[] = [];

      if (partialGlossaryRef.current) {
        const { glossary, afterCursor } = partialGlossaryRef.current;
        const { terms, nextCursor } = await fetchTermsForGlossary(
          glossary,
          afterCursor,
          fieldsToFetch
        );
        accumulated.push(...terms);
        partialGlossaryRef.current = nextCursor
          ? { glossary, afterCursor: nextCursor }
          : null;
      }

      while (
        accumulated.length < ONTOLOGY_TERMS_PAGE_SIZE &&
        pendingGlossariesRef.current.length > 0
      ) {
        const glossary = pendingGlossariesRef.current.shift()!;
        const { terms, nextCursor } = await fetchTermsForGlossary(
          glossary,
          undefined,
          fieldsToFetch
        );
        accumulated.push(...terms);
        if (nextCursor) {
          partialGlossaryRef.current = { glossary, afterCursor: nextCursor };

          break;
        }
      }

      setHasMoreTerms(
        pendingGlossariesRef.current.length > 0 ||
          partialGlossaryRef.current !== null
      );

      if (!isDataMode) {
        await resolveRelatedTerms(accumulated);
      }

      return accumulated;
    },
    [fetchTermsForGlossary]
  );

  const buildGraphFromAllTermsCb = useCallback(
    (terms: GlossaryTerm[], glossaryList: Glossary[]) =>
      buildGraphFromAllTerms(terms, glossaryList, t),
    [t]
  );

  const loadDataModeTerms = useCallback(
    async (
      glossaryFilterIds: string[],
      offset = 0
    ): Promise<{
      graphData: OntologyGraphData;
      termCounts: Record<string, number>;
      total: number;
    }> => {
      const selectedGlossary = glossaries.find((glossary) =>
        glossaryFilterIds.includes(glossary.id)
      );
      const response = await getOntologyStudioDataGraph({
        assetPreviewSize: 4,
        limit: 12,
        offset,
        parent: selectedGlossary?.fullyQualifiedName,
      });
      const termCounts = Object.fromEntries(
        response.clusters.map((cluster) => [
          cluster.term.id,
          cluster.assetCount,
        ])
      );

      return {
        graphData: buildGraphFromStudioData(response, glossaries, t),
        termCounts,
        total: response.paging.total,
      };
    },
    [glossaries, t]
  );

  const fetchGraphDataFromDatabase = useCallback(
    async (glossaryIdParam?: string, allGlossaries?: Glossary[]) => {
      const glossariesToUse = allGlossaries ?? glossariesRef.current;
      const glossariesToFetch = glossaryIdParam
        ? glossariesToUse.filter((g) => g.id === glossaryIdParam)
        : glossariesToUse;

      const CONCURRENCY = 8;
      const allTerms: GlossaryTerm[] = [];
      for (let i = 0; i < glossariesToFetch.length; i += CONCURRENCY) {
        const batch = glossariesToFetch.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((g) => fetchAllTermsForGlossary(g))
        );
        results.forEach((r) => {
          if (r.status === 'fulfilled') {
            allTerms.push(...r.value);
          }
        });
      }

      if (glossaryIdParam) {
        await resolveRelatedTerms(allTerms);
      }

      return buildGraphFromAllTermsCb(allTerms, glossariesToFetch);
    },
    // Note: glossaries intentionally excluded — allGlossaries param is always passed
    [buildGraphFromAllTermsCb]
  );

  const loadOntologyModel = useCallback(
    async (glossaryIdParam?: string) => {
      const [glossaryResult, metrics] = await Promise.all([
        fetchAllGlossariesPaginated(),
        fetchVisibleMetrics().catch(() => [] as Metric[]),
      ]);
      const model = glossaryIdParam
        ? await fetchGraphDataFromDatabase(
            glossaryIdParam,
            glossaryResult.glossaries
          )
        : buildGraphFromAllTermsCb(
            await loadNextTermPage(glossaryResult.glossaries),
            glossaryResult.glossaries
          );

      return {
        graphData: mergeMetricsIntoGraph(model, metrics, t),
        glossaries: glossaryResult.glossaries,
        isGlossaryListComplete: glossaryResult.complete,
      } satisfies OntologyModelLoadResult;
    },
    [
      fetchGraphDataFromDatabase,
      fetchVisibleMetrics,
      loadNextTermPage,
      buildGraphFromAllTermsCb,
      t,
    ]
  );

  const commitOntologyModel = useCallback((result: OntologyModelLoadResult) => {
    setGlossaries(result.glossaries);
    setGlossaryListComplete(result.isGlossaryListComplete);
    setDataSource('database');
    filterFetchedGlossariesRef.current = new Set();
    setAssetGraphData(null);
    setTermAssetCounts({});
    setFetchError(false);
    setGraphData(result.graphData);
    lastLoadCompletedRef.current = Date.now();
  }, []);

  const fetchAllGlossaryData = useCallback(
    async (glossaryIdParam?: string) => {
      const generation = ++modelLoadGenerationRef.current;
      setLoading(true);
      try {
        const result = await loadOntologyModel(glossaryIdParam);
        if (generation === modelLoadGenerationRef.current) {
          commitOntologyModel(result);
        }
      } catch (error) {
        if (generation === modelLoadGenerationRef.current) {
          showErrorToast(
            isAxiosError(error) ? error : String(error),
            t('server.entity-fetch-error')
          );
          setFetchError(true);
          setGraphData(null);
        }
      } finally {
        if (generation === modelLoadGenerationRef.current) {
          setLoading(false);
        }
      }
    },
    [commitOntologyModel, loadOntologyModel, t]
  );

  const loadAssetsForDataMode = useCallback(async () => {
    const data = graphDataRef.current;
    if (!data) {
      return;
    }

    const gen = dataModeAbortGenRef.current;
    const useSpinner = dataModeInitialLoadUsesSpinnerRef.current;
    if (useSpinner) {
      dataModeInitialLoadUsesSpinnerRef.current = false;
      setLoading(true);
    }

    try {
      const glossaryFilterIds = withoutOntologyAutocompleteAll(
        filters.glossaryIds
      );
      const termNodes = getScopedTermNodes(
        data.nodes,
        glossaryFilterIds,
        scope,
        entityId
      );
      await fetchTermAssetCounts(termNodes, glossaryFilterIds);
      if (dataModeAbortGenRef.current !== gen) {
        return;
      }
      setAssetGraphData(null);
    } finally {
      if (useSpinner && dataModeAbortGenRef.current === gen) {
        setLoading(false);
      }
    }
  }, [filters.glossaryIds, scope, entityId, fetchTermAssetCounts]);

  const mergeGraphResults = useCallback((results: OntologyGraphData[]) => {
    setGraphData((prev) => {
      const base = prev ?? { nodes: [], edges: [] };
      const existingNodeIds = new Set(base.nodes.map((n) => n.id));
      const existingEdgeKeys = new Set(
        base.edges.map((e) => `${e.from}-${e.to}-${e.relationType}`)
      );
      const newNodes = [...base.nodes];
      const newEdges = [...base.edges];

      results.forEach((result) => {
        result.nodes.forEach((n) => {
          if (!existingNodeIds.has(n.id)) {
            newNodes.push(n);
            existingNodeIds.add(n.id);
          }
        });
        result.edges.forEach((e) => {
          const key = `${e.from}-${e.to}-${e.relationType}`;
          if (!existingEdgeKeys.has(key)) {
            newEdges.push(e);
            existingEdgeKeys.add(key);
          }
        });
      });

      return { nodes: newNodes, edges: newEdges };
    });
  }, []);

  const loadMissingFilteredGlossaries = useCallback(
    async (filtered: string[]) => {
      const loadedGlossaryIds = new Set(
        (graphDataRef.current?.nodes ?? [])
          .filter((n) => n.glossaryId)
          .map((n) => n.glossaryId!)
      );
      const unloaded = filtered.filter(
        (id) =>
          !loadedGlossaryIds.has(id) &&
          !filterFetchedGlossariesRef.current.has(id)
      );
      if (unloaded.length === 0) {
        return;
      }

      setLoading(true);
      try {
        const results = await Promise.all(
          unloaded.map((id) => fetchGraphDataFromDatabase(id))
        );
        unloaded.forEach((id) => filterFetchedGlossariesRef.current.add(id));
        mergeGraphResults(results);
      } catch {
        // keep existing graph on error
      } finally {
        setLoading(false);
      }
    },
    [fetchGraphDataFromDatabase, mergeGraphResults]
  );

  // --- Effects ---

  useEffect(() => {
    return () => {
      modelLoadGenerationRef.current += 1;
      graphRef.current = null;
      assetFetchControllers.current.forEach((c) => c.abort());
      assetFetchControllers.current.clear();
    };
  }, []);

  useEffect(() => {
    const initializeSettings = async () => {
      const [enabled, relSettings] = await Promise.all([
        checkRdfEnabled(),
        listRelationshipTypes({ limit: 1000 }).catch(() => ({
          data: DEFAULT_GLOSSARY_TERM_RELATION_TYPES_FALLBACK,
        })),
      ]);
      setRdfEnabled(enabled);
      setRelationTypes(relSettings.data);
    };
    initializeSettings();
  }, []);

  useEffect(() => {
    if (scope === 'global') {
      fetchAllGlossaryData();
    } else if (scope === 'glossary' && glossaryId) {
      fetchAllGlossaryData(glossaryId);
    } else if (scope === 'term' && entityId) {
      fetchAllGlossaryData(termGlossaryId);
    } else {
      setLoading(false);
    }
  }, [scope, glossaryId, entityId, termGlossaryId, fetchAllGlossaryData]);

  useEffect(() => {
    if (explorationMode !== 'data') {
      dataModeAbortGenRef.current++;
      setDataModeTotalTermCount(0);
      if (hasEnteredDataModeRef.current) {
        setLoading(false);
        hasEnteredDataModeRef.current = false;
      }
      setAssetGraphData(null);
      dataModeInitialLoadUsesSpinnerRef.current = false;
      if (isInGlobalDataModeRef.current && savedModelGraphRef.current) {
        setGraphData(savedModelGraphRef.current);
        savedModelGraphRef.current = null;
      }
      isInGlobalDataModeRef.current = false;

      return;
    }

    hasEnteredDataModeRef.current = true;

    if (scope !== 'global') {
      loadAssetsForDataMode();

      return;
    }

    if (!isInGlobalDataModeRef.current) {
      savedModelGraphRef.current = graphDataRef.current;
      isInGlobalDataModeRef.current = true;
    }

    const glossaryFilterIds = withoutOntologyAutocompleteAll(
      filters.glossaryIds
    );
    const gen = ++dataModeAbortGenRef.current;
    setLoading(true);
    setGraphData(null);
    setTermAssetCounts({});
    loadDataModeTerms(glossaryFilterIds)
      .then(
        (result: {
          graphData: OntologyGraphData;
          termCounts: Record<string, number>;
          total: number;
        }) => {
          if (dataModeAbortGenRef.current !== gen) {
            return;
          }
          setGraphData(result.graphData);
          setDataModeTotalTermCount(result.total);
          setTermAssetCounts(result.termCounts);
          setAssetGraphData(null);
        }
      )
      .catch(() => {})
      .finally(() => {
        if (dataModeAbortGenRef.current === gen) {
          setLoading(false);
        }
      });
  }, [
    explorationMode,
    scope,
    filters.glossaryIds,
    loadAssetsForDataMode,
    loadDataModeTerms,
    dataModeRefreshKey,
  ]);

  useEffect(() => {
    if (explorationMode !== 'model' || scope !== 'global') {
      return;
    }
    const filtered = withoutOntologyAutocompleteAll(filters.glossaryIds);
    if (filtered.length > 0 && !loading) {
      void loadMissingFilteredGlossaries(filtered);
    }
  }, [
    explorationMode,
    scope,
    filters.glossaryIds,
    graphData,
    loading,
    loadMissingFilteredGlossaries,
  ]);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    if (scope !== 'global' || glossaries.length === 0) {
      return;
    }
    const controller = new AbortController();
    const selectedIds = withoutOntologyAutocompleteAll(filters.glossaryIds);
    const parent = glossaries.find((glossary) =>
      selectedIds.includes(glossary.id)
    )?.fullyQualifiedName;
    getOntologyStudioSummary({ limit: 5, offset: 0, parent }, controller.signal)
      .then(setStudioSummary)
      .catch(() => setStudioSummary(undefined));

    return () => controller.abort();
  }, [filters.glossaryIds, glossaries, scope]);

  const resolvedStatsItems = useMemo(
    () =>
      studioSummary
        ? [
            `${studioSummary.totalTerms} ${t('label.term-plural')}`,
            `${studioSummary.totalRelations} ${t('label.relation-plural')}`,
            `${studioSummary.isolatedTerms} ${t('label.isolated')}`,
          ]
        : statsItems,
    [statsItems, studioSummary, t]
  );

  useEffect(() => {
    onStatsChange?.(resolvedStatsItems);
  }, [onStatsChange, resolvedStatsItems]);

  // --- Event handlers ---

  const handleZoomIn = useCallback(() => {
    graphRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    graphRef.current?.zoomOut();
  }, []);

  const handleFitToScreen = useCallback(() => {
    graphRef.current?.fitView();
  }, []);

  const handleExportPng = useCallback(async () => {
    try {
      await graphRef.current?.exportAsPng();
    } catch {
      showErrorToast(t('server.unexpected-error'));
    }
  }, [t]);

  const handleExportSvg = useCallback(async () => {
    try {
      await graphRef.current?.exportAsSvg();
    } catch {
      showErrorToast(t('server.unexpected-error'));
    }
  }, [t]);

  const handleOntologyExportError = useCallback(
    async (error: unknown) => {
      if (isAxiosError(error)) {
        const data = error.response?.data;
        if (data instanceof Blob) {
          try {
            const text = await data.text();
            const parsed = JSON.parse(text);
            showErrorToast(
              parsed?.message ?? parsed?.error ?? t('message.export-failed')
            );

            return;
          } catch {
            // blob wasn't JSON — fall through to generic message
          }
        }
        showErrorToast(
          error.response?.data?.message ?? t('message.export-failed')
        );
      } else {
        showErrorToast(t('message.export-failed'));
      }
    },
    [t]
  );

  const handleExportTurtle = useCallback(async () => {
    if (!exportableGlossaryId || !exportableGlossaryName) {
      return;
    }
    try {
      await downloadGlossaryOntology(
        exportableGlossaryId,
        exportableGlossaryName,
        'turtle'
      );
    } catch (error) {
      await handleOntologyExportError(error);
    }
  }, [exportableGlossaryId, exportableGlossaryName, handleOntologyExportError]);

  const handleExportRdfXml = useCallback(async () => {
    if (!exportableGlossaryId || !exportableGlossaryName) {
      return;
    }
    try {
      await downloadGlossaryOntology(
        exportableGlossaryId,
        exportableGlossaryName,
        'rdfxml'
      );
    } catch (error) {
      await handleOntologyExportError(error);
    }
  }, [exportableGlossaryId, exportableGlossaryName, handleOntologyExportError]);

  const handleExportJsonLd = useCallback(async () => {
    if (!exportableGlossaryId || !exportableGlossaryName) {
      return;
    }
    try {
      await downloadGlossaryOntology(
        exportableGlossaryId,
        exportableGlossaryName,
        'jsonld'
      );
    } catch (error) {
      await handleOntologyExportError(error);
    }
  }, [exportableGlossaryId, exportableGlossaryName, handleOntologyExportError]);

  const handleModeChange = useCallback(
    (mode: ExplorationMode) => {
      if (mode === 'data') {
        modelFiltersRef.current = filters;
        const nextFilters: GraphFilters = {
          ...filters,
          viewMode: 'overview' satisfies GraphViewMode,
          showCrossGlossaryOnly: false,
        };
        if (graphData) {
          dataModeInitialLoadUsesSpinnerRef.current = true;
          setLoading(true);
        }
        setExplorationMode(mode);
        setFilters(nextFilters);
      } else {
        dataFiltersRef.current = filters;
        setSelectedNode(null);
        setExpandedTermIds(new Set());
        setExplorationMode(mode);
        setFilters({
          ...filters,
          viewMode: modelFiltersRef.current.viewMode,
          showCrossGlossaryOnly: modelFiltersRef.current.showCrossGlossaryOnly,
        });
        setTermAssetCounts({});
      }
    },
    [filters, graphData]
  );

  const getNodePath = useCallback((node: OntologyNode) => {
    if (node.entityRef?.type && node.entityRef?.fullyQualifiedName) {
      const entityType = Object.values(EntityType).find(
        (v) => v === node.entityRef!.type
      );
      if (entityType) {
        return getEntityDetailsPath(
          entityType,
          node.entityRef.fullyQualifiedName
        );
      }
    }
    if (node.type === METRIC_NODE_TYPE && node.fullyQualifiedName) {
      return getEntityDetailsPath(EntityType.METRIC, node.fullyQualifiedName);
    }
    if (node.fullyQualifiedName) {
      return getGlossaryTermDetailsPath(node.fullyQualifiedName);
    }

    return '';
  }, []);

  const handleRefresh = useCallback(() => {
    if (explorationMode === 'data') {
      setExpandedTermIds(new Set());
      if (scope === 'global') {
        setDataModeRefreshKey((k) => k + 1);
      } else {
        dataModeInitialLoadUsesSpinnerRef.current = true;
        loadAssetsForDataMode();
      }

      return;
    }
    if (scope === 'global') {
      fetchAllGlossaryData();
    } else if (scope === 'glossary' && glossaryId) {
      fetchAllGlossaryData(glossaryId);
    } else if (scope === 'term') {
      fetchAllGlossaryData(termGlossaryId);
    }
  }, [
    explorationMode,
    scope,
    glossaryId,
    termGlossaryId,
    fetchAllGlossaryData,
    loadAssetsForDataMode,
  ]);

  const performDataModeLoadMore = useCallback(() => {
    const loadedTerms =
      graphDataRef.current?.nodes.filter(isTermNode).length ?? 0;
    const boundedTotal = Math.min(dataModeTotalTermCount, 60);
    if (
      scope !== 'global' ||
      loadedTerms >= boundedTotal ||
      isLoadingMoreRef.current
    ) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    const glossaryFilterIds = withoutOntologyAutocompleteAll(
      filters.glossaryIds
    );
    loadDataModeTerms(glossaryFilterIds, loadedTerms)
      .then((result) => {
        mergeGraphResults([result.graphData]);
        setTermAssetCounts((previous) => ({
          ...previous,
          ...result.termCounts,
        }));
        setDataModeTotalTermCount(result.total);
      })
      .catch(() => undefined)
      .finally(() => {
        isLoadingMoreRef.current = false;
        setIsLoadingMore(false);
      });
  }, [
    dataModeTotalTermCount,
    filters.glossaryIds,
    loadDataModeTerms,
    mergeGraphResults,
    scope,
  ]);

  const performLoadMore = useCallback(() => {
    if (explorationMode === 'data') {
      performDataModeLoadMore();

      return;
    }
    const activeGlossaryFilter =
      withoutOntologyAutocompleteAll(filters.glossaryIds).length > 0;

    if (
      activeGlossaryFilter ||
      !hasMoreTerms ||
      isLoadingMoreRef.current ||
      scope !== 'global'
    ) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    loadNextTermPage()
      .then((terms) => {
        const newPageData = buildGraphFromAllTermsCb(terms, glossaries);
        setGraphData((prev) => {
          if (!prev) {
            return newPageData;
          }
          const existingNodeIds = new Set(prev.nodes.map((n) => n.id));
          const existingEdgeKeys = new Set(
            prev.edges.map((e) => `${e.from}-${e.to}-${e.relationType}`)
          );

          return {
            ...prev,
            nodes: [
              ...prev.nodes,
              ...newPageData.nodes.filter((n) => !existingNodeIds.has(n.id)),
            ],
            edges: [
              ...prev.edges,
              ...newPageData.edges.filter(
                (e) =>
                  !existingEdgeKeys.has(`${e.from}-${e.to}-${e.relationType}`)
              ),
            ],
          };
        });
      })
      .catch(() => {})
      .finally(() => {
        lastLoadCompletedRef.current = Date.now();
        isLoadingMoreRef.current = false;
        setIsLoadingMore(false);
      });
  }, [
    explorationMode,
    filters.glossaryIds,
    hasMoreTerms,
    scope,
    loadNextTermPage,
    buildGraphFromAllTermsCb,
    glossaries,
    performDataModeLoadMore,
  ]);

  const handleLoadMore = useCallback(() => {
    performLoadMore();
  }, [performLoadMore]);

  const handleScrollNearEdge = useCallback(() => {
    const now = Date.now();
    if (now - scrollThrottleRef.current < 150) {
      return;
    }
    scrollThrottleRef.current = now;

    if (now - lastLoadCompletedRef.current < 2000) {
      return;
    }

    performLoadMore();
  }, [performLoadMore]);

  const handleSettingsChange = useCallback((nextSettings: GraphSettings) => {
    setSettings((prev) => (isEqual(prev, nextSettings) ? prev : nextSettings));
  }, []);

  const handleFiltersChange = useCallback((newFilters: GraphFilters) => {
    setFilters((prev) => (isEqual(prev, newFilters) ? prev : newFilters));
  }, []);

  const handleViewModeChange = useCallback((viewMode: GraphViewMode) => {
    setFilters((prev) => ({
      ...prev,
      viewMode,
      showCrossGlossaryOnly: viewMode === 'crossGlossary',
    }));
  }, []);

  const handleGraphNodeClick = useCallback(
    (
      node: OntologyNode,
      _position?: { x: number; y: number },
      meta?: {
        dataModeAssetBadgeClick?: boolean;
        dataModeLoadMoreBadgeClick?: boolean;
      }
    ) => {
      if (explorationMode === 'data' && isTermNode(node)) {
        if (meta?.dataModeLoadMoreBadgeClick) {
          const loaded = node.loadedAssetCount ?? 0;
          void appendTermAssetsForTerm(
            node,
            DATA_MODE_ASSET_LOAD_PAGE_SIZE,
            loaded
          );
          setSelectedNode(null);

          return;
        }
        if (meta?.dataModeAssetBadgeClick) {
          setExpandedTermIds((prev) => {
            const wasExpanded = prev.has(node.id);
            const next = new Set(prev);
            if (wasExpanded) {
              next.delete(node.id);
            } else {
              next.add(node.id);
              const count = termAssetCounts[node.id] ?? node.assetCount ?? 0;
              if (count > 0) {
                void appendTermAssetsForTerm(
                  node,
                  DATA_MODE_ASSET_LOAD_PAGE_SIZE,
                  0
                );
              }
            }

            return next;
          });
          setSelectedNode(null);

          return;
        }
      }
      setSelectedNode(node);
    },
    [explorationMode, appendTermAssetsForTerm, termAssetCounts]
  );

  const handleGraphNodeDoubleClick = useCallback(
    (node: OntologyNode) => {
      const path = getNodePath(node);
      if (!path) {
        return;
      }
      window.open(path, '_blank');
    },
    [getNodePath]
  );

  const handleGraphPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleNodeDataUpdate = useCallback(
    (nodeId: string, updatedData: EntityData) => {
      const applyToNode = (node: OntologyNode): OntologyNode => {
        if (node.id !== nodeId) {
          return node;
        }
        const newLabel =
          updatedData.displayName || updatedData.name || node.label;

        return {
          ...node,
          label: newLabel,
          originalLabel: newLabel,
          ...('description' in updatedData && {
            description: updatedData.description,
          }),
          searchSource: {
            ...node.searchSource,
            ...(updatedData as unknown as Record<string, unknown>),
          },
        };
      };

      setAssetGraphData((prev) =>
        prev ? { ...prev, nodes: prev.nodes.map(applyToNode) } : prev
      );

      setGraphData((prev) =>
        prev ? { ...prev, nodes: prev.nodes.map(applyToNode) } : prev
      );

      setSelectedNode((prev) => (prev ? applyToNode(prev) : prev));
    },
    []
  );

  return {
    graphRef,
    loading,
    fetchError,
    isLoadingMore,
    glossaries,
    relationTypes,
    settings,
    filters,
    explorationMode,
    selectedNode,
    expandedTermIds,
    rdfEnabled,
    graphDataToShow,
    combinedGraphData,
    filteredGraphData,
    hierarchyGraphData,
    hierarchyBakedPositions,
    graphSearchHighlight,
    glossaryColorMap,
    isHierarchyView,
    exportableGlossaryId,
    hasMoreDataTerms,
    studioSummary,
    hasMoreTerms,
    loadedTermCount,
    totalTermCount,
    setFilters,
    setSelectedNode,
    handleZoomIn,
    handleZoomOut,
    handleFitToScreen,
    handleExportPng,
    handleExportSvg,
    handleExportTurtle,
    handleExportRdfXml,
    handleExportJsonLd,
    handleModeChange,
    handleViewModeChange,
    handleRefresh,
    handleLoadMore,
    handleScrollNearEdge,
    handleSettingsChange,
    handleFiltersChange,
    handleGraphNodeClick,
    handleGraphNodeDoubleClick,
    handleGraphPaneClick,
    handleNodeDataUpdate,
  };
}
