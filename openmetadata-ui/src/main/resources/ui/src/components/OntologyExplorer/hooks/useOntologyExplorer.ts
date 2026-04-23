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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { Metric } from '../../../generated/entity/data/metric';
import {
  getGlossariesList,
  getGlossaryTerms,
  getGlossaryTermsAssetCounts,
  getGlossaryTermsById,
} from '../../../rest/glossaryAPI';
import { getMetrics } from '../../../rest/metricsAPI';
import {
  checkRdfEnabled,
  downloadGlossaryOntology,
  getGlossaryTermGraph,
} from '../../../rest/rdfAPI';
import { searchQuery } from '../../../rest/searchAPI';
import {
  getGlossaryTermRelationSettings,
  GlossaryTermRelationType,
} from '../../../rest/settingConfigAPI';
import {
  getEntityDetailsPath,
  getGlossaryTermDetailsPath,
} from '../../../utils/RouterUtils';
import { getTermQuery } from '../../../utils/SearchUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  DATA_MODE_ASSET_LOAD_PAGE_SIZE,
  DATA_MODE_MAX_RENDER_COUNT,
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
  ASSET_NODE_TYPE,
  ASSET_RELATION_TYPE,
  buildGraphFromAllTerms,
  buildGraphFromCounts,
  convertRdfGraphToOntologyGraph,
  getScopedTermNodes,
  isTermNode,
  mergeMetricsIntoGraph,
  METRIC_NODE_TYPE,
  searchHitSourceToEntityRef,
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

async function fetchAllTermsForGlossary(
  glossary: Glossary
): Promise<GlossaryTerm[]> {
  const terms: GlossaryTerm[] = [];
  let after: string | undefined;
  let pages = 0;
  const MAX_SAFE_PAGES = 50;
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
        limit: 1000,
        after,
      });
      terms.push(...response.data);
      after = response.paging?.after;
      pages += 1;
    } catch {
      break;
    }
  } while (after && pages < MAX_SAFE_PAGES);

  return terms;
}

async function fetchAllGlossariesPaginated(): Promise<Glossary[]> {
  const collected: Glossary[] = [];
  let afterCursor: string | undefined;
  let pages = 0;
  const MAX_SAFE_PAGES = 500;
  do {
    const response = await getGlossariesList({
      fields: 'owners,tags',
      limit: 100,
      after: afterCursor,
    });
    collected.push(...response.data);
    afterCursor = response.paging?.after;
    pages += 1;
  } while (afterCursor && pages < MAX_SAFE_PAGES);

  return collected;
}

async function fetchRdfGraphData(
  glossaryId: string,
  allGlossaries: Glossary[]
): Promise<{ graph: OntologyGraphData | null; source: 'rdf' | 'database' }> {
  const PAGE_SIZE = 500;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const MAX_SAFE_PAGES = 100;
  try {
    const allNodes: Parameters<
      typeof convertRdfGraphToOntologyGraph
    >[0]['nodes'] = [];
    const allEdges: Parameters<
      typeof convertRdfGraphToOntologyGraph
    >[0]['edges'] = [];
    let offset = 0;
    let source: string | undefined;
    let pages = 0;

    while (pages < MAX_SAFE_PAGES) {
      const page = await getGlossaryTermGraph({
        glossaryId,
        limit: PAGE_SIZE,
        offset,
        includeIsolated: true,
      });
      if (!page.nodes || page.nodes.length === 0) {
        break;
      }
      allNodes.push(...page.nodes);
      allEdges.push(...(page.edges ?? []));
      source = source ?? page.source;
      pages += 1;
      if (page.nodes.length < PAGE_SIZE) {
        break;
      }
      offset += PAGE_SIZE;
    }

    if (allNodes.length === 0) {
      return { graph: null, source: 'database' };
    }
    const nodesWithBadLabels = allNodes.filter(
      (node) => !node.label || uuidRegex.test(node.label)
    );
    if (nodesWithBadLabels.length > allNodes.length / 2) {
      return { graph: null, source: 'database' };
    }

    return {
      graph: convertRdfGraphToOntologyGraph(
        { nodes: allNodes, edges: allEdges },
        allGlossaries
      ),
      source: source === 'database' ? 'database' : 'rdf',
    };
  } catch {
    return { graph: null, source: 'database' };
  }
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
  const [relationTypes, setRelationTypes] = useState<
    GlossaryTermRelationType[]
  >([]);
  const [glossaries, setGlossaries] = useState<Glossary[]>([]);
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_SETTINGS);
  const [filters, setFilters] = useState<GraphFilters>(DEFAULT_FILTERS);
  const [explorationMode, setExplorationMode] =
    useState<ExplorationMode>('model');
  const [termAssetCounts, setTermAssetCounts] = useState<
    Record<string, number>
  >({});
  const [hasMoreTerms, setHasMoreTerms] = useState(false);
  const [dataModeRefreshKey, setDataModeRefreshKey] = useState(0);

  // --- Refs ---

  const graphDataRef = useRef<OntologyGraphData | null>(null);
  const explorationModeRef = useRef<ExplorationMode>('model');
  const filterFetchedGlossariesRef = useRef<Set<string>>(new Set());

  // Saves the model-mode graph when global data mode overwrites graphData so
  // it can be restored when the user switches back to model mode.
  const savedModelGraphRef = useRef<OntologyGraphData | null>(null);
  const isInGlobalDataModeRef = useRef(false);

  const pendingGlossariesRef = useRef<Glossary[]>([]);
  const partialGlossaryRef = useRef<{
    glossary: Glossary;
    afterCursor: string;
  } | null>(null);
  const isLoadingMoreRef = useRef(false);
  const lastLoadCompletedRef = useRef<number>(0);

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
    glossaryId,
    termGlossaryId,
    dataSource,
  });

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
      if (!isTermNode(termNode) || !termNode.fullyQualifiedName) {
        return;
      }

      setLoadingTermIds((prev) => new Set(prev).add(termNode.id));

      const size = Math.max(1, pageSize);
      const pageNumber = Math.floor(fromOffset / size) + 1;

      try {
        const res = await searchQuery({
          query: '**',
          pageNumber,
          pageSize: size,
          searchIndex: SearchIndex.ALL,
          queryFilter: getTermQuery({
            'tags.tagFQN': termNode.fullyQualifiedName,
          }) as Record<string, unknown>,
        });

        const hits = res.hits.hits ?? [];
        const newAssetNodes: OntologyNode[] = [];
        const newEdges: OntologyEdge[] = [];

        hits.forEach((hit) => {
          const entityRef = searchHitSourceToEntityRef(hit._source);
          if (!entityRef) {
            return;
          }
          newAssetNodes.push({
            id: entityRef.id,
            label:
              entityRef.displayName ||
              entityRef.name ||
              entityRef.fullyQualifiedName ||
              entityRef.id,
            originalLabel:
              entityRef.displayName ||
              entityRef.name ||
              entityRef.fullyQualifiedName ||
              entityRef.id,
            type: ASSET_NODE_TYPE,
            fullyQualifiedName: entityRef.fullyQualifiedName,
            description: entityRef.description,
            entityRef,
          });
          newEdges.push({
            from: entityRef.id,
            to: termNode.id,
            label: t('label.tagged-with'),
            relationType: ASSET_RELATION_TYPE,
          });
        });

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
        showErrorToast(
          isAxiosError(error) ? error : String(error),
          t('server.entity-fetch-error')
        );
      } finally {
        setLoadingTermIds((prev) => {
          const next = new Set(prev);
          next.delete(termNode.id);

          return next;
        });
      }
    },
    [t]
  );

  const fetchAllMetrics = useCallback(async (): Promise<Metric[]> => {
    const allMetrics: Metric[] = [];
    let after: string | undefined;
    let pages = 0;
    const MAX_SAFE_PAGES = 500;

    do {
      const response = await getMetrics({ fields: 'tags', limit: 100, after });
      allMetrics.push(...response.data);
      after = response.paging?.after;
      pages += 1;
    } while (after && pages < MAX_SAFE_PAGES);

    return allMetrics;
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
        const loadedIds = new Set(accumulated.map((term) => term.id));
        const missingIds = collectMissingRelatedTermIds(accumulated, loadedIds);

        if (missingIds.size > 0) {
          const CONCURRENCY = 8;
          const missingIdList = Array.from(missingIds);
          for (let i = 0; i < missingIdList.length; i += CONCURRENCY) {
            const batch = missingIdList.slice(i, i + CONCURRENCY);
            const fetched = await Promise.allSettled(
              batch.map((id) =>
                getGlossaryTermsById(id, {
                  fields: [
                    TabSpecificField.RELATED_TERMS,
                    TabSpecificField.CHILDREN,
                    TabSpecificField.PARENT,
                    TabSpecificField.OWNERS,
                  ],
                })
              )
            );
            fetched.forEach((r) => {
              if (r.status === 'fulfilled') {
                accumulated.push(r.value);
              }
            });
          }
        }
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

  const buildGraphFromCountsCb = useCallback(
    (counts: Record<string, number>) =>
      buildGraphFromCounts(counts, glossaries, t),
    [glossaries, t]
  );

  const loadDataModeTerms = useCallback(
    async (
      glossaryFilterIds: string[]
    ): Promise<{
      graphData: OntologyGraphData;
      termCounts: Record<string, number>;
    }> => {
      let counts: Record<string, number>;

      if (glossaryFilterIds.length > 0) {
        const filteredFqns = glossaries
          .filter((g) => glossaryFilterIds.includes(g.id))
          .map((g) => g.fullyQualifiedName)
          .filter((fqn): fqn is string => Boolean(fqn));

        const results = await Promise.all(
          filteredFqns.map((fqn) => getGlossaryTermsAssetCounts(fqn))
        );
        const merged: Record<string, number> = {};
        results.forEach((r) => Object.assign(merged, r));
        counts =
          Object.keys(merged).length > 0
            ? merged
            : await getGlossaryTermsAssetCounts();
      } else {
        counts = await getGlossaryTermsAssetCounts();
      }

      const termCounts = Object.fromEntries(
        Object.entries(counts).slice(0, DATA_MODE_MAX_RENDER_COUNT)
      );
      const baseGraph = buildGraphFromCountsCb(termCounts);
      const savedGraph = savedModelGraphRef.current;

      if (savedGraph && savedGraph.edges.length > 0) {
        const fqnSet = new Set(
          baseGraph.nodes
            .map((n) => n.fullyQualifiedName)
            .filter((fqn): fqn is string => Boolean(fqn))
        );
        const uuidToFqn = new Map<string, string>();
        savedGraph.nodes.forEach((n) => {
          if (n.id && n.fullyQualifiedName) {
            uuidToFqn.set(n.id, n.fullyQualifiedName);
          }
        });

        const existingEdgeKeys = new Set(
          baseGraph.edges.map((e) => `${e.from}-${e.to}`)
        );
        const termTermEdges: OntologyEdge[] = [];

        savedGraph.edges.forEach((edge) => {
          if (edge.relationType === 'parentOf') {
            return;
          }
          const fromFqn = uuidToFqn.get(edge.from);
          const toFqn = uuidToFqn.get(edge.to);
          if (
            !fromFqn ||
            !toFqn ||
            !fqnSet.has(fromFqn) ||
            !fqnSet.has(toFqn)
          ) {
            return;
          }
          const key = `${fromFqn}-${toFqn}`;
          if (!existingEdgeKeys.has(key)) {
            existingEdgeKeys.add(key);
            termTermEdges.push({
              from: fromFqn,
              to: toFqn,
              label: edge.label,
              relationType: edge.relationType,
            });
          }
        });

        return {
          graphData: {
            nodes: baseGraph.nodes,
            edges: [...baseGraph.edges, ...termTermEdges],
          },
          termCounts,
        };
      }

      return { graphData: baseGraph, termCounts };
    },
    [buildGraphFromCountsCb, glossaries]
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
        const fetchedIds = new Set(allTerms.map((term) => term.id));
        const missingIds = new Set<string>();
        allTerms.forEach((term) => {
          term.relatedTerms?.forEach((relation) => {
            const id = relation.term?.id;
            if (id && !fetchedIds.has(id)) {
              missingIds.add(id);
            }
          });
        });

        if (missingIds.size > 0) {
          const missingIdList = Array.from(missingIds);
          for (let i = 0; i < missingIdList.length; i += CONCURRENCY) {
            const batch = missingIdList.slice(i, i + CONCURRENCY);
            const fetched = await Promise.allSettled(
              batch.map((id) =>
                getGlossaryTermsById(id, {
                  fields: [
                    TabSpecificField.RELATED_TERMS,
                    TabSpecificField.CHILDREN,
                    TabSpecificField.PARENT,
                    TabSpecificField.OWNERS,
                  ],
                })
              )
            );
            fetched.forEach((r) => {
              if (r.status === 'fulfilled') {
                allTerms.push(r.value);
              }
            });
          }
        }
      }

      return buildGraphFromAllTermsCb(allTerms, glossariesToFetch);
    },
    // Note: glossaries intentionally excluded — allGlossaries param is always passed
    [buildGraphFromAllTermsCb]
  );

  const fetchAllGlossaryData = useCallback(
    async (glossaryIdParam?: string) => {
      setLoading(true);
      try {
        const [allGlossaries, metricsResponse] = await Promise.all([
          fetchAllGlossariesPaginated(),
          fetchAllMetrics().catch(() => [] as Metric[]),
        ]);

        setGlossaries(allGlossaries);

        let data: OntologyGraphData | null = null;

        if (glossaryIdParam) {
          if (rdfEnabled) {
            const { graph: rdfGraph, source } = await fetchRdfGraphData(
              glossaryIdParam,
              allGlossaries
            );
            if (rdfGraph && rdfGraph.nodes.length > 0) {
              data = rdfGraph;
              setDataSource(source);
            }
          }

          if (!data || data.nodes.length === 0) {
            setDataSource('database');
            data = await fetchGraphDataFromDatabase(
              glossaryIdParam,
              allGlossaries
            );
          }
        } else {
          setDataSource('database');
          const terms = await loadNextTermPage(allGlossaries);
          data = buildGraphFromAllTermsCb(terms, allGlossaries);
        }

        const mergedData = mergeMetricsIntoGraph(data, metricsResponse, t);
        filterFetchedGlossariesRef.current = new Set();
        setAssetGraphData(null);
        setTermAssetCounts({});
        setGraphData(mergedData);
        lastLoadCompletedRef.current = Date.now();
      } catch (error) {
        showErrorToast(
          isAxiosError(error) ? error : String(error),
          t('server.entity-fetch-error')
        );
        setGraphData(null);
      } finally {
        setLoading(false);
      }
    },
    [
      rdfEnabled,
      fetchGraphDataFromDatabase,
      fetchAllMetrics,
      loadNextTermPage,
      buildGraphFromAllTermsCb,
      t,
    ]
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
        base.edges.map((e) => `${e.from}-${e.to}`)
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
          const key = `${e.from}-${e.to}`;
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
    const initializeSettings = async () => {
      const [enabled, relSettings] = await Promise.all([
        checkRdfEnabled(),
        getGlossaryTermRelationSettings().catch(() => ({ relationTypes: [] })),
      ]);
      setRdfEnabled(enabled);
      setRelationTypes(relSettings.relationTypes);
    };
    initializeSettings();
  }, []);

  useEffect(() => {
    if (rdfEnabled === null) {
      return;
    }
    if (scope === 'global') {
      fetchAllGlossaryData();
    } else if (scope === 'glossary' && glossaryId) {
      fetchAllGlossaryData(glossaryId);
    } else if (scope === 'term' && entityId) {
      fetchAllGlossaryData(termGlossaryId);
    } else {
      setLoading(false);
    }
  }, [
    scope,
    glossaryId,
    entityId,
    termGlossaryId,
    rdfEnabled,
    fetchAllGlossaryData,
  ]);

  useEffect(() => {
    if (explorationMode !== 'data') {
      dataModeAbortGenRef.current++;
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
        }) => {
          if (dataModeAbortGenRef.current !== gen) {
            return;
          }
          setGraphData(result.graphData);
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
    if (filtered.length > 0) {
      loadMissingFilteredGlossaries(filtered);
    }
  }, [
    explorationMode,
    scope,
    filters.glossaryIds,
    loadMissingFilteredGlossaries,
  ]);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    onStatsChange?.(statsItems);
  }, [statsItems, onStatsChange]);

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

  const handleModeChange = useCallback(
    (mode: ExplorationMode) => {
      if (mode === 'data') {
        modelFiltersRef.current = filters;
        const nextFilters: GraphFilters = {
          ...dataFiltersRef.current,
          glossaryIds: filters.glossaryIds,
          viewMode: 'overview' satisfies GraphViewMode,
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
        setFilters(modelFiltersRef.current);
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
    }
  }, [
    explorationMode,
    scope,
    glossaryId,
    fetchAllGlossaryData,
    loadAssetsForDataMode,
  ]);

  const handleScrollNearEdge = useCallback(() => {
    const activeGlossaryFilter =
      withoutOntologyAutocompleteAll(filters.glossaryIds).length > 0;

    if (
      explorationMode === 'data' ||
      filters.viewMode !== 'overview' ||
      activeGlossaryFilter ||
      !hasMoreTerms ||
      isLoadingMoreRef.current ||
      scope !== 'global' ||
      Date.now() - lastLoadCompletedRef.current < 2000
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
            prev.edges.map((e) => `${e.from}-${e.to}`)
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
                (e) => !existingEdgeKeys.has(`${e.from}-${e.to}`)
              ),
            ],
          };
        });
      })
      .catch(() => {
        // keep existing graph on error
      })
      .finally(() => {
        lastLoadCompletedRef.current = Date.now();
        isLoadingMoreRef.current = false;
        setIsLoadingMore(false);
      });
  }, [
    explorationMode,
    filters.glossaryIds,
    filters.viewMode,
    hasMoreTerms,
    scope,
    loadNextTermPage,
    buildGraphFromAllTermsCb,
    glossaries,
  ]);

  const handleSettingsChange = useCallback((nextSettings: GraphSettings) => {
    setSettings(nextSettings);
  }, []);

  const handleFiltersChange = useCallback((newFilters: GraphFilters) => {
    setFilters(newFilters);
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

  return {
    graphRef,
    loading,
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
    filteredGraphData,
    hierarchyGraphData,
    hierarchyBakedPositions,
    graphSearchHighlight,
    glossaryColorMap,
    isHierarchyView,
    exportableGlossaryId,
    setFilters,
    setSelectedNode,
    handleZoomIn,
    handleZoomOut,
    handleFitToScreen,
    handleExportPng,
    handleExportSvg,
    handleExportTurtle,
    handleExportRdfXml,
    handleModeChange,
    handleViewModeChange,
    handleRefresh,
    handleScrollNearEdge,
    handleSettingsChange,
    handleFiltersChange,
    handleGraphNodeClick,
    handleGraphNodeDoubleClick,
    handleGraphPaneClick,
  };
}
