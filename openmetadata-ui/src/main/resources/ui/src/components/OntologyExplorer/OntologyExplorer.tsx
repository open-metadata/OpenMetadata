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

import {
  Card,
  Divider,
  Input,
  SlideoutMenu,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { SearchMd } from '@untitledui/icons';
import { isAxiosError } from 'axios';
import classNames from 'classnames';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { Metric } from '../../generated/entity/data/metric';
import { EntityReference } from '../../generated/entity/type';
import { TagSource } from '../../generated/type/tagLabel';
import { TermRelation } from '../../generated/type/termRelation';
import {
  getGlossariesList,
  getGlossaryTerms,
  getGlossaryTermsAssetCounts,
  getGlossaryTermsById,
} from '../../rest/glossaryAPI';
import { getMetrics } from '../../rest/metricsAPI';
import {
  checkRdfEnabled,
  downloadGlossaryOntology,
  getGlossaryTermGraph,
  GraphData,
} from '../../rest/rdfAPI';
import { searchQuery } from '../../rest/searchAPI';
import {
  getGlossaryTermRelationSettings,
  GlossaryTermRelationType,
} from '../../rest/settingConfigAPI';
import {
  getEntityDetailsPath,
  getGlossaryTermDetailsPath,
} from '../../utils/RouterUtils';
import { getTermQuery } from '../../utils/SearchUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useGenericContext } from '../Customization/GenericProvider/GenericProvider';
import EntitySummaryPanel from '../Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { buildOntologySlideoutEntityDetails } from './buildOntologySlideoutEntityDetails';
import ExportGraphPanel from './ExportGraphPanel';
import FilterToolbar from './FilterToolbar';
import GraphSettingsPanel from './GraphSettingsPanel';
import NodeContextMenu from './NodeContextMenu';
import OntologyControlButtons from './OntologyControlButtons';
import {
  DATA_MODE_ASSET_LOAD_PAGE_SIZE,
  DATA_MODE_MAX_RENDER_COUNT,
  GLOSSARY_TERM_ASSET_COUNT_FETCH_CONCURRENCY,
  LayoutEngine,
  LayoutType,
  ONTOLOGY_TERMS_PAGE_SIZE,
  RELATION_COLORS,
  toLayoutEngineType,
  withoutOntologyAutocompleteAll,
} from './OntologyExplorer.constants';
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
} from './OntologyExplorer.interface';
import OntologyGraph from './OntologyGraphG6';
import { OntologyNodeRelationsContent } from './OntologyNodeRelationsContent';
import { computeGraphSearchHighlight } from './utils/graphSearchHighlight';
import { buildHierarchyGraphs } from './utils/hierarchyGraphBuilder';
import { computeGlossaryGroupPositions } from './utils/layoutCalculations';

const isValidUUID = (str: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  return uuidRegex.test(str);
};

const GLOSSARY_COLORS = [
  '#3062d4', // Primary blue (lineage style)
  '#7c3aed', // Purple
  '#059669', // Emerald
  '#dc2626', // Red
  '#ea580c', // Orange
  '#0891b2', // Cyan
  '#4f46e5', // Indigo
  '#ca8a04', // Yellow
  '#be185d', // Pink
  '#0d9488', // Teal
];

const METRIC_NODE_TYPE = 'metric';
const METRIC_RELATION_TYPE = 'metricFor';
const ASSET_NODE_TYPE = 'dataAsset';
const ASSET_RELATION_TYPE = 'hasGlossaryTerm';

const ONTOLOGY_GRAPH_BACKDROP_CLASS =
  'tw:absolute tw:inset-0 tw:z-0 tw:bg-primary tw:[background-image:radial-gradient(circle,rgba(148,163,184,0.22)_1px,transparent_1px)] tw:[background-size:14px_14px]';

const ONTOLOGY_TOOLBAR_CARD_CLASS =
  'tw:z-1 tw:border tw:border-utility-gray-blue-100 tw:ring-0 tw:shadow-md';

const DEFAULT_SETTINGS: GraphSettings = {
  layout: LayoutType.Hierarchical,
  showEdgeLabels: true,
};

const DEFAULT_FILTERS: GraphFilters = {
  viewMode: 'overview',
  glossaryIds: [],
  relationTypes: [],
  showIsolatedNodes: true,
  showCrossGlossaryOnly: false,
  searchQuery: '',
};

const ONTOLOGY_ENTITY_SUMMARY_SLIDEOUT_WIDTH = 576;

function isTermNode(node: OntologyNode): boolean {
  return node.type === 'glossaryTerm' || node.type === 'glossaryTermIsolated';
}

function isDataAssetLikeNode(node: OntologyNode): boolean {
  return node.type === ASSET_NODE_TYPE || node.type === METRIC_NODE_TYPE;
}

function getScopedTermNodes(
  nodes: OntologyNode[],
  glossaryIds: string[],
  scope: OntologyExplorerProps['scope'],
  entityId?: string
): OntologyNode[] {
  let termNodes = nodes.filter(isTermNode);

  if (glossaryIds.length > 0) {
    termNodes = termNodes.filter(
      (node) => node.glossaryId && glossaryIds.includes(node.glossaryId)
    );
  }

  if (scope === 'term' && entityId) {
    termNodes = termNodes.filter((node) => node.id === entityId);
  }

  return termNodes;
}

function searchHitSourceToEntityRef(source: unknown): EntityReference | null {
  if (!source || typeof source !== 'object') {
    return null;
  }
  const s = source as Record<string, unknown>;
  const id = s.id;
  const typeField = s.entityType ?? s.type;
  const fqn = s.fullyQualifiedName;
  if (
    typeof id !== 'string' ||
    typeof typeField !== 'string' ||
    typeof fqn !== 'string'
  ) {
    return null;
  }

  return {
    id,
    type: typeField,
    name: typeof s.name === 'string' ? s.name : undefined,
    displayName: typeof s.displayName === 'string' ? s.displayName : undefined,
    fullyQualifiedName: fqn,
    description: typeof s.description === 'string' ? s.description : undefined,
  };
}

const OntologyExplorer: React.FC<OntologyExplorerProps> = ({
  scope,
  entityId: propEntityId,
  glossaryId,
  className,
  showHeader = true,
  height = 'calc(100vh - 200px)',
}) => {
  const { t } = useTranslation();
  const graphRef = useRef<OntologyGraphHandle | null>(null);

  const contextData = useGenericContext<GlossaryTerm>();
  const entityId =
    propEntityId ?? (scope === 'term' ? contextData?.data?.id : undefined);
  const termGlossaryId =
    scope === 'term' ? contextData?.data?.glossary?.id : undefined;

  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [graphData, setGraphData] = useState<OntologyGraphData | null>(null);
  const [assetGraphData, setAssetGraphData] =
    useState<OntologyGraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<OntologyNode | null>(null);
  const [expandedTermIds, setExpandedTermIds] = useState<Set<string>>(
    new Set()
  );
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
  const [contextMenu, setContextMenu] = useState<{
    node: OntologyNode;
    position: { x: number; y: number };
  } | null>(null);
  const [termAssetCounts, setTermAssetCounts] = useState<
    Record<string, number>
  >({});
  const [hasMoreTerms, setHasMoreTerms] = useState(false);

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
  const dataFiltersRef = useRef<GraphFilters>({
    ...DEFAULT_FILTERS,
  });
  const dataModeInitialLoadUsesSpinnerRef = useRef(false);

  useEffect(() => {
    graphDataRef.current = graphData;
  }, [graphData]);

  useEffect(() => {
    explorationModeRef.current = explorationMode;
  }, [explorationMode]);

  const glossariesRef = useRef<Glossary[]>(glossaries);
  glossariesRef.current = glossaries;

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

    // Filter by glossary
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

      // Keep glossary terms plus their directly related nodes/edges
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

    // Filter by relation type
    if (relationTypeFilterIds.length > 0) {
      const nodeTypeMap = new Map(filteredNodes.map((n) => [n.id, n.type]));
      filteredEdges = filteredEdges.filter((e) => {
        const fromType = nodeTypeMap.get(e.from);
        const toType = nodeTypeMap.get(e.to);
        // In data mode, always show asset/metric edges regardless of filter
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
    }

    // Filter cross-glossary relations only
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

    // Filter isolated nodes
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
  }, [combinedGraphData, filters]);

  const isHierarchyView = filters.viewMode === 'hierarchy';

  const hierarchyGraphData = useMemo(() => {
    if (!isHierarchyView || !filteredGraphData) {
      return null;
    }

    const terms = filteredGraphData.nodes.filter(
      (n) =>
        n.type !== 'dataAsset' &&
        n.type !== 'metric' &&
        n.type !== METRIC_NODE_TYPE
    );
    const termIds = new Set(terms.map((t) => t.id));
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
    if (engine !== LayoutEngine.Circular && engine !== LayoutEngine.Radial) {
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

  const mergeMetricsIntoGraph = useCallback(
    (graph: OntologyGraphData | null, metricList: Metric[]) => {
      if (!graph || metricList.length === 0) {
        return graph;
      }

      const nodes = [...graph.nodes];
      const edges = [...graph.edges];
      const nodeIds = new Set(nodes.map((n) => n.id));
      const edgeKeys = new Set(
        edges.map((edge) => `${edge.from}-${edge.to}-${edge.relationType}`)
      );
      const termByFqn = new Map<string, OntologyNode>();

      nodes.forEach((node) => {
        if (node.fullyQualifiedName) {
          termByFqn.set(node.fullyQualifiedName, node);
        }
      });

      metricList.forEach((metric) => {
        const glossaryTags =
          metric.tags?.filter((tag) => tag.source === TagSource.Glossary) ?? [];

        if (glossaryTags.length === 0 || !metric.id) {
          return;
        }

        const relatedTerms = glossaryTags
          .map((tag) => termByFqn.get(tag.tagFQN))
          .filter((term): term is OntologyNode => Boolean(term));

        if (relatedTerms.length === 0) {
          return;
        }

        if (!nodeIds.has(metric.id)) {
          nodes.push({
            id: metric.id,
            label: metric.displayName || metric.name,
            originalLabel: metric.displayName || metric.name,
            type: METRIC_NODE_TYPE,
            fullyQualifiedName: metric.fullyQualifiedName,
            description: metric.description,
            group: t('label.metric-plural'),
            entityRef: {
              id: metric.id,
              name: metric.name,
              displayName: metric.displayName,
              type: EntityType.METRIC,
              fullyQualifiedName: metric.fullyQualifiedName,
              description: metric.description,
            },
          });
          nodeIds.add(metric.id);
        }

        relatedTerms.forEach((term) => {
          const edgeKey = `${metric.id}-${term.id}-${METRIC_RELATION_TYPE}`;
          if (!edgeKeys.has(edgeKey)) {
            edges.push({
              from: metric.id,
              to: term.id,
              label: 'Metric for',
              relationType: METRIC_RELATION_TYPE,
            });
            edgeKeys.add(edgeKey);
          }
        });
      });

      return { nodes, edges };
    },
    [t]
  );

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
        const scopedGlossaryId =
          scope === 'glossary'
            ? glossaryId
            : scope === 'term'
            ? termGlossaryId
            : undefined;
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
      const response = await getMetrics({
        fields: 'tags',
        limit: 100,
        after,
      });
      allMetrics.push(...response.data);
      after = response.paging?.after;
      pages += 1;
    } while (after && pages < MAX_SAFE_PAGES);

    return allMetrics;
  }, []);

  const convertRdfGraphToOntologyGraph = useCallback(
    (rdfData: GraphData, glossaryList: Glossary[]): OntologyGraphData => {
      // Create mapping from glossary name to ID for lookups
      const glossaryNameToId = new Map<string, string>();
      glossaryList.forEach((g) => {
        glossaryNameToId.set(g.name.toLowerCase(), g.id);
        if (g.fullyQualifiedName) {
          glossaryNameToId.set(g.fullyQualifiedName.toLowerCase(), g.id);
        }
      });

      const nodes: OntologyNode[] = rdfData.nodes.map((node) => {
        // Extract glossary name from group or FQN
        let glossaryId: string | undefined;
        if (node.group) {
          glossaryId = glossaryNameToId.get(node.group.toLowerCase());
        }
        if (!glossaryId && node.fullyQualifiedName) {
          const glossaryName = node.fullyQualifiedName.split('.')[0];
          glossaryId = glossaryNameToId.get(glossaryName.toLowerCase());
        }

        // Determine the best label - fallback to extracting from FQN if label looks like a UUID
        let nodeLabel = node.label;
        const isUuidLabel =
          nodeLabel &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            nodeLabel
          );

        if (!nodeLabel || isUuidLabel) {
          // Try to extract label from fullyQualifiedName (last part after the last dot)
          if (node.fullyQualifiedName) {
            const parts = node.fullyQualifiedName.split('.');
            nodeLabel = parts[parts.length - 1];
          } else if (node.title) {
            nodeLabel = node.title;
          } else {
            nodeLabel = node.id;
          }
        }

        return {
          id: node.id,
          label: nodeLabel,
          type: node.type || 'glossaryTerm',
          fullyQualifiedName: node.fullyQualifiedName,
          description: node.description,
          glossaryId,
          group: node.group,
        };
      });

      // Deduplicate edges, preferring specific relation types over 'relatedTo'
      const edgeMap = new Map<string, OntologyEdge>();
      rdfData.edges.forEach((edge) => {
        const relationType = edge.relationType || 'relatedTo';
        const nodePairKey = [edge.from, edge.to].sort().join('-');
        const existingEdge = edgeMap.get(nodePairKey);

        // Add if no existing edge, or replace if new type is more specific
        if (
          !existingEdge ||
          (existingEdge.relationType === 'relatedTo' &&
            relationType !== 'relatedTo')
        ) {
          edgeMap.set(nodePairKey, {
            from: edge.from,
            to: edge.to,
            label: edge.label || relationType,
            relationType: relationType,
          });
        }
      });

      return { nodes, edges: Array.from(edgeMap.values()) };
    },
    []
  );

  const buildGraphFromAllTerms = useCallback(
    (terms: GlossaryTerm[], glossaryList: Glossary[]): OntologyGraphData => {
      const nodesMap = new Map<string, OntologyNode>();
      const edges: OntologyEdge[] = [];
      const edgeSet = new Set<string>();

      terms.forEach((term) => {
        if (!term.id || !isValidUUID(term.id)) {
          return;
        }

        const hasRelations =
          (term.relatedTerms && term.relatedTerms.length > 0) ||
          (term.children && term.children.length > 0) ||
          term.parent;

        nodesMap.set(term.id, {
          id: term.id,
          label: term.displayName || term.name,
          type: hasRelations ? 'glossaryTerm' : 'glossaryTermIsolated',
          fullyQualifiedName: term.fullyQualifiedName,
          description: term.description,
          glossaryId: term.glossary?.id,
          group: glossaryList.find((g) => g.id === term.glossary?.id)?.name,
          owners: term.owners,
        });

        if (term.relatedTerms && term.relatedTerms.length > 0) {
          term.relatedTerms.forEach((relation: TermRelation) => {
            const relatedTermRef = relation.term;
            const relationType = relation.relationType || 'relatedTo';
            if (relatedTermRef?.id && isValidUUID(relatedTermRef.id)) {
              // Use node-pair key (without relationType) to avoid duplicate edges
              const nodePairKey = [term.id, relatedTermRef.id].sort().join('-');

              // Check if we already have an edge for this node pair
              if (!edgeSet.has(nodePairKey)) {
                edgeSet.add(nodePairKey);
                edges.push({
                  from: term.id,
                  to: relatedTermRef.id,
                  label: relationType,
                  relationType: relationType,
                });
              } else if (relationType !== 'relatedTo') {
                // If we have a more specific relationType, update the existing edge
                const existingEdgeIndex = edges.findIndex(
                  (e) =>
                    [e.from, e.to].sort().join('-') === nodePairKey &&
                    e.relationType === 'relatedTo'
                );
                if (existingEdgeIndex !== -1) {
                  edges[existingEdgeIndex] = {
                    from: term.id,
                    to: relatedTermRef.id,
                    label: relationType,
                    relationType: relationType,
                  };
                }
              }
            }
          });
        }

        if (term.parent?.id && isValidUUID(term.parent.id)) {
          const edgeKey = `parent-${term.parent.id}-${term.id}`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edges.push({
              from: term.parent.id,
              to: term.id,
              label: t('label.parent'),
              relationType: 'parentOf',
            });
          }
        }
      });

      const nodeIds = new Set(nodesMap.keys());
      const validEdges = edges.filter(
        (e) => nodeIds.has(e.from) && nodeIds.has(e.to)
      );

      return { nodes: Array.from(nodesMap.values()), edges: validEdges };
    },
    [t]
  );

  const buildGraphFromCounts = useCallback(
    (counts: Record<string, number>): OntologyGraphData => {
      const fqnSet = new Set(Object.keys(counts));
      const nodes: OntologyNode[] = [];
      const edges: OntologyEdge[] = [];
      const edgeSet = new Set<string>();

      fqnSet.forEach((fqn) => {
        const parts = fqn.split('.');
        const label = parts[parts.length - 1];
        const glossaryFqn = parts[0];
        const glossary = glossaries.find(
          (g) => g.fullyQualifiedName === glossaryFqn || g.name === glossaryFqn
        );

        nodes.push({
          id: fqn,
          label,
          type: 'glossaryTerm',
          fullyQualifiedName: fqn,
          glossaryId: glossary?.id,
          group: glossary?.name ?? glossaryFqn,
          originalLabel: fqn,
        });

        if (parts.length > 2) {
          const parentFqn = parts.slice(0, -1).join('.');
          if (fqnSet.has(parentFqn)) {
            const edgeKey = `parent-${parentFqn}-${fqn}`;
            if (!edgeSet.has(edgeKey)) {
              edgeSet.add(edgeKey);
              edges.push({
                from: parentFqn,
                to: fqn,
                label: t('label.parent'),
                relationType: 'parentOf',
              });
            }
          }
        }
      });

      return { nodes, edges };
    },
    [glossaries, t]
  );

  const fetchGraphDataFromRdf = useCallback(
    async (glossaryIdParam?: string, glossaryList?: Glossary[]) => {
      const PAGE_SIZE = 500;
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const MAX_SAFE_PAGES = 100;
      try {
        const allNodes: GraphData['nodes'] = [];
        const allEdges: GraphData['edges'] = [];
        let offset = 0;
        let source: string | undefined;
        let pages = 0;

        while (pages < MAX_SAFE_PAGES) {
          const page = await getGlossaryTermGraph({
            glossaryId: glossaryIdParam,
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
          return null;
        }

        const nodesWithBadLabels = allNodes.filter(
          (node) => !node.label || uuidRegex.test(node.label)
        );

        if (nodesWithBadLabels.length > allNodes.length / 2) {
          return null;
        }

        setDataSource(source === 'database' ? 'database' : 'rdf');

        return convertRdfGraphToOntologyGraph(
          { nodes: allNodes, edges: allEdges },
          glossaryList ?? []
        );
      } catch {
        return null;
      }
    },
    [convertRdfGraphToOntologyGraph]
  );

  const MODEL_TERM_FIELDS = [
    TabSpecificField.RELATED_TERMS,
    TabSpecificField.CHILDREN,
    TabSpecificField.PARENT,
    TabSpecificField.OWNERS,
  ];

  const DATA_MODE_TERM_FIELDS = [TabSpecificField.PARENT];

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

        return {
          terms: response.data,
          nextCursor: response.paging?.after,
        };
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

        if (nextCursor) {
          partialGlossaryRef.current = { glossary, afterCursor: nextCursor };
        } else {
          partialGlossaryRef.current = null;
        }
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

      const hasMore =
        pendingGlossariesRef.current.length > 0 ||
        partialGlossaryRef.current !== null;
      setHasMoreTerms(hasMore);

      if (!isDataMode) {
        // Fetch cross-glossary referenced terms that are not in the current page
        // so their edges can be rendered. These are fetched individually by id,
        // not by walking their glossary (which may not be loaded yet).
        const loadedIds = new Set(accumulated.map((t) => t.id));
        const missingIds = new Set<string>();
        accumulated.forEach((term) => {
          term.relatedTerms?.forEach((relation) => {
            const id = relation.term?.id;
            if (id && !loadedIds.has(id)) {
              missingIds.add(id);
            }
          });
        });

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

      const baseGraph = buildGraphFromCounts(termCounts);

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

      return {
        graphData: baseGraph,
        termCounts,
      };
    },
    [buildGraphFromCounts, glossaries]
  );

  const fetchGraphDataFromDatabase = useCallback(
    async (glossaryIdParam?: string, allGlossaries?: Glossary[]) => {
      const glossariesToUse = allGlossaries ?? glossariesRef.current;

      const glossariesToFetch = glossaryIdParam
        ? glossariesToUse.filter((g) => g.id === glossaryIdParam)
        : glossariesToUse;

      const CONCURRENCY = 8;
      const MAX_SAFE_PAGES = 50;
      const fetchAllTermsForGlossary = async (
        glossary: Glossary
      ): Promise<GlossaryTerm[]> => {
        const terms: GlossaryTerm[] = [];
        let after: string | undefined;
        let pages = 0;
        do {
          try {
            const termsResponse = await getGlossaryTerms({
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
            terms.push(...termsResponse.data);
            after = termsResponse.paging?.after;
            pages += 1;
          } catch {
            break;
          }
        } while (after && pages < MAX_SAFE_PAGES);

        return terms;
      };

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

      // When fetching a single glossary (scoped view), related terms from
      // other glossaries are not included. Fetch them so their edges render.
      if (glossaryIdParam) {
        const fetchedIds = new Set(allTerms.map((t) => t.id));
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

      return buildGraphFromAllTerms(allTerms, glossariesToFetch);
    },
    // Note: glossaries is intentionally excluded to prevent infinite loop
    // allGlossaries parameter is always passed from fetchAllGlossaryData

    [buildGraphFromAllTerms]
  );

  const fetchAllGlossaryData = useCallback(
    async (glossaryIdParam?: string) => {
      setLoading(true);
      try {
        const [allGlossaries, metricsResponse] = await Promise.all([
          (async () => {
            const collected = [];
            let afterCursor: string | undefined;
            let pages = 0;
            const MAX_SAFE_PAGES = 500;
            do {
              const glossariesResponse = await getGlossariesList({
                fields: 'owners,tags',
                limit: 100,
                after: afterCursor,
              });
              collected.push(...glossariesResponse.data);
              afterCursor = glossariesResponse.paging?.after;
              pages += 1;
            } while (afterCursor && pages < MAX_SAFE_PAGES);

            return collected;
          })(),
          fetchAllMetrics().catch(() => []),
        ]);
        setGlossaries(allGlossaries);

        let data: OntologyGraphData | null = null;

        if (glossaryIdParam) {
          // Scoped view: try RDF first, fall back to database
          if (rdfEnabled) {
            data = await fetchGraphDataFromRdf(glossaryIdParam, allGlossaries);
          }

          if (!data || data.nodes.length === 0) {
            setDataSource('database');
            data = await fetchGraphDataFromDatabase(
              glossaryIdParam,
              allGlossaries
            );
          }
        } else {
          // Global view: walk glossaries sequentially, stop at PAGE_SIZE terms
          setDataSource('database');
          const terms = await loadNextTermPage(allGlossaries);
          data = buildGraphFromAllTerms(terms, allGlossaries);
        }

        const mergedData = mergeMetricsIntoGraph(data, metricsResponse);
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
      fetchGraphDataFromRdf,
      fetchGraphDataFromDatabase,
      fetchAllMetrics,
      mergeMetricsIntoGraph,
      loadNextTermPage,
      buildGraphFromAllTerms,
      t,
    ]
  );

  const loadAssetsForDataMode = useCallback(async () => {
    const data = graphDataRef.current;
    if (!data) {
      return;
    }

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
      setAssetGraphData(null);
    } finally {
      if (useSpinner) {
        setLoading(false);
      }
    }
  }, [filters.glossaryIds, scope, entityId, fetchTermAssetCounts]);

  // Initialize settings
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

  // Fetch data when scope changes
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
      setAssetGraphData(null);
      dataModeInitialLoadUsesSpinnerRef.current = false;
      if (isInGlobalDataModeRef.current && savedModelGraphRef.current) {
        setGraphData(savedModelGraphRef.current);
        savedModelGraphRef.current = null;
      }
      isInGlobalDataModeRef.current = false;

      return;
    }

    if (scope !== 'global') {
      // Scoped data mode: fetch counts for existing model-mode graph
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
    setLoading(true);
    setGraphData(null);
    setTermAssetCounts({});
    loadDataModeTerms(glossaryFilterIds)
      .then(
        (result: {
          graphData: OntologyGraphData;
          termCounts: Record<string, number>;
        }) => {
          setGraphData(result.graphData);
          setTermAssetCounts(result.termCounts);
          setAssetGraphData(null);
        }
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [
    explorationMode,
    scope,
    filters.glossaryIds,
    loadAssetsForDataMode,
    loadDataModeTerms,
  ]);
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
    await graphRef.current?.exportAsPng();
  }, []);

  const handleExportSvg = useCallback(async () => {
    await graphRef.current?.exportAsSvg();
  }, []);

  // Resolve the single glossary ID applicable in the current scope so we know
  // which glossary to export as an ontology file.
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

  const handleOntologyExportError = useCallback(
    async (error: unknown) => {
      if (isAxiosError(error)) {
        // Export endpoint returns a blob — read the blob as text to extract
        // the backend error message (e.g. "RDF service not enabled").
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

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenuFocus = useCallback((node: OntologyNode) => {
    setSelectedNode(node);
    graphRef.current?.focusNode(node.id);
  }, []);

  const handleContextMenuViewDetails = useCallback((node: OntologyNode) => {
    setSelectedNode(node);
  }, []);

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

  const handleContextMenuOpenInNewTab = useCallback(
    (node: OntologyNode) => {
      const path = getNodePath(node);
      if (!path) {
        return;
      }
      window.open(path, '_blank');
    },
    [getNodePath]
  );

  const handleRefresh = useCallback(() => {
    if (scope === 'global') {
      fetchAllGlossaryData();
    } else if (scope === 'glossary' && glossaryId) {
      fetchAllGlossaryData(glossaryId);
    }
  }, [scope, glossaryId, fetchAllGlossaryData]);

  const handleScrollNearEdge = useCallback(() => {
    const activeGlossaryFilter =
      withoutOntologyAutocompleteAll(filters.glossaryIds).length > 0;

    if (
      explorationMode === 'data' ||
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
        const newPageData = buildGraphFromAllTerms(terms, glossaries);
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
    hasMoreTerms,
    scope,
    loadNextTermPage,
    buildGraphFromAllTerms,
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
      setContextMenu(null);
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
        setSelectedNode(node);

        return;
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

  const handleGraphNodeContextMenu = useCallback(
    (node: OntologyNode, position: { x: number; y: number }) => {
      setContextMenu({ node, position });
    },
    []
  );

  const handleGraphPaneClick = useCallback(() => {
    setContextMenu(null);
    setSelectedNode(null);
  }, []);

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
            .reduce((sum, n) => sum + (n.assetCount ?? 0), 0)
        : graphDataToShow.nodes.filter((n) => n.type === ASSET_NODE_TYPE)
            .length;
    const relationCount = graphDataToShow.edges.length;
    const isolatedCount = graphDataToShow.nodes.filter(
      (n) => n.type === 'glossaryTermIsolated'
    ).length;
    const sourceLabel = dataSource === 'rdf' ? ' (RDF)' : '';
    const items: string[] = [
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

    return items;
  }, [graphDataToShow, dataSource, explorationMode, t]);

  const renderGraphContent = () => {
    if (loading && !graphDataToShow) {
      return (
        <div
          className="tw:absolute tw:inset-0 tw:z-3 tw:flex tw:flex-col tw:items-center tw:justify-center"
          data-testid="ontology-graph-loading">
          <div
            aria-label={t('label.loading')}
            className="tw:h-10 tw:w-10 tw:animate-spin tw:rounded-full tw:border-2 tw:border-border-secondary tw:border-t-(--color-bg-brand-solid)"
            role="status"
          />
          <Typography as="p" className="tw:mt-4 tw:text-tertiary">
            {t('label.loading-graph')}
          </Typography>
        </div>
      );
    }

    if (
      isHierarchyView &&
      hierarchyGraphData !== null &&
      hierarchyGraphData.edges.length === 0
    ) {
      return (
        <div
          className="tw:absolute tw:inset-0 tw:z-3 tw:flex tw:flex-col tw:items-center tw:justify-center"
          data-testid="ontology-graph-hierarchy-empty">
          <Typography as="p" className="tw:text-center tw:text-tertiary">
            {t('message.no-hierarchical-relations-found')}
          </Typography>
        </div>
      );
    }

    if (!graphDataToShow || graphDataToShow.nodes.length === 0) {
      const hasActiveFilter =
        withoutOntologyAutocompleteAll(filters.glossaryIds).length > 0 ||
        withoutOntologyAutocompleteAll(filters.relationTypes).length > 0;

      return (
        <div
          className="tw:absolute tw:inset-0 tw:z-3 tw:flex tw:flex-col tw:items-center tw:justify-center"
          data-testid="ontology-graph-empty">
          <Typography as="p" className="tw:text-center tw:text-tertiary">
            {hasActiveFilter
              ? t('message.no-data-available-for-selected-filter')
              : t('message.no-glossary-terms-found')}
          </Typography>
        </div>
      );
    }

    return (
      <>
        {filters.searchQuery.trim() ? (
          <div
            aria-hidden
            className="tw:pointer-events-none tw:absolute tw:inset-0 tw:z-1 tw:bg-gray-950/6"
          />
        ) : null}
        <div className="tw:relative tw:z-1 tw:h-full tw:w-full tw:min-h-0">
          <OntologyGraph
            edges={graphDataToShow.edges}
            expandedTermIds={
              explorationMode === 'data' ? expandedTermIds : undefined
            }
            explorationMode={isHierarchyView ? 'hierarchy' : explorationMode}
            focusNodeId={
              explorationMode === 'data'
                ? selectedNode?.id ?? entityId
                : entityId
            }
            glossaryColorMap={glossaryColorMap}
            graphSearchHighlight={graphSearchHighlight}
            hierarchyCombos={
              isHierarchyView && hierarchyGraphData
                ? hierarchyGraphData.combos.map((c) => ({
                    id: c.id,
                    label: c.label,
                    glossaryId: c.glossaryId,
                  }))
                : undefined
            }
            nodePositions={hierarchyBakedPositions}
            nodes={graphDataToShow.nodes}
            ref={graphRef}
            selectedNodeId={
              explorationMode === 'data' && expandedTermIds.size > 1
                ? null
                : selectedNode?.id
            }
            settings={settings}
            onNodeClick={handleGraphNodeClick}
            onNodeContextMenu={handleGraphNodeContextMenu}
            onNodeDoubleClick={handleGraphNodeDoubleClick}
            onPaneClick={handleGraphPaneClick}
            onScrollNearEdge={handleScrollNearEdge}
          />
          {isLoadingMore && (
            <>
              <div className="tw:absolute tw:inset-0 tw:z-1 tw:cursor-wait" />
              <div className="tw:pointer-events-none tw:absolute tw:bottom-20 tw:left-1/2 tw:z-2 tw:-translate-x-1/2">
                <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-full tw:border tw:border-utility-gray-blue-100 tw:bg-white tw:px-4 tw:py-2 tw:shadow-md">
                  <div
                    aria-label={t('label.loading')}
                    className="tw:h-4 tw:w-4 tw:animate-spin tw:rounded-full tw:border-2 tw:border-border-secondary tw:border-t-(--color-bg-brand-solid)"
                    role="status"
                  />
                  <Typography size="text-sm" weight="medium">
                    {t('label.loading-more-terms')}
                  </Typography>
                </div>
              </div>
            </>
          )}
        </div>
      </>
    );
  };

  return (
    <div
      className={classNames(
        'tw:flex tw:flex-col tw:overflow-hidden',
        { 'ontology-slideout-open': Boolean(selectedNode) },
        className
      )}
      data-testid="ontology-explorer"
      style={{ height }}>
      {showHeader && (
        <Card
          className="tw:mb-4 tw:flex tw:flex-col tw:px-5 tw:py-3"
          data-testid="ontology-explorer-header">
          <Typography size="text-sm" weight="medium">
            {t('label.ontology-explorer')}
          </Typography>
          {filteredGraphData && statsItems.length > 0 && (
            <div
              className="tw:flex tw:flex-wrap tw:items-center tw:gap-2"
              data-testid="ontology-explorer-stats">
              {statsItems.map((item, index) => (
                <React.Fragment key={`${item}-${index}`}>
                  {index > 0 ? (
                    <Divider
                      className="tw:h-4 tw:self-center"
                      orientation="vertical"
                    />
                  ) : null}
                  <Typography
                    data-testid={
                      index === 0 ? 'ontology-explorer-stats-item' : undefined
                    }
                    size="text-sm"
                    weight="regular">
                    {item}
                  </Typography>
                </React.Fragment>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:overflow-hidden">
        <div className="tw:relative tw:flex tw:min-h-0 tw:min-w-0 tw:flex-1 tw:flex-col tw:overflow-hidden">
          {/* Top filter bar — only on the standalone global page */}
          {scope === 'global' && (
            <div className="tw:absolute tw:left-0 tw:right-0 tw:top-0 tw:z-1 tw:px-4 tw:pt-5">
              <Card className="tw:rounded-md tw:border tw:border-utility-gray-blue-100 tw:px-3 tw:py-2.5 tw:ring-0 tw:shadow-sm">
                <FilterToolbar
                  filters={filters}
                  glossaries={glossaries}
                  relationTypes={relationTypes}
                  viewModeDisabled={explorationMode === 'data'}
                  onClearAll={() => setFilters(DEFAULT_FILTERS)}
                  onFiltersChange={handleFiltersChange}
                  onViewModeChange={handleViewModeChange}
                />
              </Card>
            </div>
          )}

          {/* Bottom center: Mode tabs + Search in Graph + Settings */}
          <Card
            className={classNames(
              'tw:absolute tw:bottom-4 tw:left-1/2 tw:flex tw:-translate-x-1/2 tw:items-center tw:gap-2 tw:px-3 tw:py-1.5',
              ONTOLOGY_TOOLBAR_CARD_CLASS
            )}>
            <Tabs
              className="tw:w-fit!"
              selectedKey={explorationMode}
              onSelectionChange={(key) => {
                if (key === 'model' || key === 'data') {
                  handleModeChange(key as ExplorationMode);
                }
              }}>
              <Tabs.List
                items={[
                  { label: t('label.model'), id: 'model' },
                  { label: t('label.data'), id: 'data' },
                ]}
                size="sm"
                type="button-border"
              />
              <Tabs.Panel className="tw:hidden" id="model" />
              <Tabs.Panel className="tw:hidden" id="data" />
            </Tabs>
            <Input
              data-testid="ontology-graph-search"
              icon={SearchMd}
              inputClassName="tw:pl-10"
              placeholder={t('label.search-in-graph')}
              value={filters.searchQuery}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, searchQuery: value }))
              }
            />
            <ExportGraphPanel
              onExportPng={handleExportPng}
              onExportRdfXml={
                rdfEnabled && exportableGlossaryId
                  ? handleExportRdfXml
                  : undefined
              }
              onExportSvg={handleExportSvg}
              onExportTurtle={
                rdfEnabled && exportableGlossaryId
                  ? handleExportTurtle
                  : undefined
              }
            />
            <GraphSettingsPanel
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          </Card>

          {/* Bottom right: Zoom / view controls */}
          <Card
            className={classNames(
              'tw:absolute tw:bottom-4 tw:right-4 tw:flex tw:items-center tw:gap-1 tw:p-1',
              ONTOLOGY_TOOLBAR_CARD_CLASS
            )}>
            <OntologyControlButtons
              isLoading={loading}
              onFitToScreen={handleFitToScreen}
              onRefresh={handleRefresh}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
            />
          </Card>

          <div
            className={classNames(
              ONTOLOGY_GRAPH_BACKDROP_CLASS,
              'tw:overflow-hidden'
            )}>
            {renderGraphContent()}
          </div>

          {selectedNode && (
            <SlideoutMenu
              isDismissable
              isOpen
              className="tw:z-2"
              dialogClassName="tw:gap-0 tw:items-stretch tw:min-h-0 tw:overflow-hidden tw:p-0"
              width={ONTOLOGY_ENTITY_SUMMARY_SLIDEOUT_WIDTH}
              onOpenChange={(isOpen) => {
                if (!isOpen) {
                  setSelectedNode(null);
                }
              }}>
              {({ close }) => (
                <EntitySummaryPanel
                  isSideDrawer
                  entityDetails={buildOntologySlideoutEntityDetails(
                    selectedNode
                  )}
                  handleClosePanel={() => {
                    setSelectedNode(null);
                    close();
                  }}
                  key={selectedNode.id}
                  ontologyExplorerRelationsSlot={
                    isDataAssetLikeNode(selectedNode) ? undefined : (
                      <OntologyNodeRelationsContent
                        edges={filteredGraphData?.edges ?? []}
                        node={selectedNode}
                        nodes={filteredGraphData?.nodes ?? []}
                        relationTypes={relationTypes}
                      />
                    )
                  }
                  panelPath={
                    isDataAssetLikeNode(selectedNode)
                      ? 'glossary-term-assets-tab'
                      : 'ontology-explorer'
                  }
                  sideDrawerOverviewOnly={isDataAssetLikeNode(selectedNode)}
                />
              )}
            </SlideoutMenu>
          )}

          {contextMenu && (
            <NodeContextMenu
              node={contextMenu.node}
              position={contextMenu.position}
              onClose={handleContextMenuClose}
              onFocus={handleContextMenuFocus}
              onOpenInNewTab={handleContextMenuOpenInNewTab}
              onViewDetails={handleContextMenuViewDetails}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default OntologyExplorer;
