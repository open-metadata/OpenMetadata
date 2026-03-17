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

import { Input, Tabs, Typography } from '@openmetadata/ui-core-components';
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
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { Metric } from '../../generated/entity/data/metric';
import { TagSource } from '../../generated/type/tagLabel';
import { TermRelation } from '../../generated/type/termRelation';
import {
  getGlossariesList,
  getGlossaryTermAssets,
  getGlossaryTerms,
} from '../../rest/glossaryAPI';
import { getMetrics } from '../../rest/metricsAPI';
import {
  checkRdfEnabled,
  getGlossaryTermGraph,
  GraphData,
} from '../../rest/rdfAPI';
import {
  getGlossaryTermRelationSettings,
  GlossaryTermRelationType,
} from '../../rest/settingConfigAPI';
import {
  getEntityDetailsPath,
  getGlossaryTermDetailsPath,
} from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useGenericContext } from '../Customization/GenericProvider/GenericProvider';
import DetailsPanel from './DetailsPanel';
import FilterToolbar from './FilterToolbar';
import GraphSettingsPanel from './GraphSettingsPanel';
import NodeContextMenu from './NodeContextMenu';
import OntologyControlButtons from './OntologyControlButtons';
import {
  LayoutType,
  NODE_BORDER_COLOR,
  NODE_FILL_DEFAULT,
  RELATION_COLORS,
  toLayoutEngineType,
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

const DEFAULT_LIMIT = 500;
const ASSET_TERM_LIMIT = 40;
const ASSET_TOTAL_LIMIT = 200;

function isTermNode(node: OntologyNode): boolean {
  return node.type === 'glossaryTerm' || node.type === 'glossaryTermIsolated';
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

  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState<OntologyGraphData | null>(null);
  const [assetGraphData, setAssetGraphData] =
    useState<OntologyGraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<OntologyNode | null>(null);
  const [panelPosition, setPanelPosition] = useState<
    { x: number; y: number } | undefined
  >(undefined);
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
  const [savedPositions, setSavedPositions] = useState<Record<
    string,
    { x: number; y: number }
  > | null>(null);

  const modelFiltersRef = useRef<GraphFilters>(DEFAULT_FILTERS);
  const dataFiltersRef = useRef<GraphFilters>({
    ...DEFAULT_FILTERS,
  });
  // Prevents the loadAssetsForDataMode useEffect from double-fetching when
  // handleModeChange has already pre-loaded assets before switching mode.
  const assetLoadedByHandleModeChangeRef = useRef(false);

  const glossaryColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    glossaries.forEach((g, i) => {
      map[g.id] = GLOSSARY_COLORS[i % GLOSSARY_COLORS.length];
    });

    return map;
  }, [glossaries]);

  const combinedGraphData = useMemo(() => {
    if (!graphData) {
      return null;
    }
    if (explorationMode !== 'data' || !assetGraphData) {
      return graphData;
    }

    return {
      nodes: [...graphData.nodes, ...assetGraphData.nodes],
      edges: [...graphData.edges, ...assetGraphData.edges],
    };
  }, [graphData, assetGraphData, explorationMode]);

  const filteredGraphData = useMemo(() => {
    if (!combinedGraphData) {
      return null;
    }

    let filteredNodes = [...combinedGraphData.nodes];
    let filteredEdges = [...combinedGraphData.edges];

    // Filter by glossary
    if (filters.glossaryIds.length > 0) {
      const glossaryTermIds = new Set(
        filteredNodes
          .filter(
            (n) =>
              n.type !== METRIC_NODE_TYPE &&
              n.type !== ASSET_NODE_TYPE &&
              n.glossaryId &&
              filters.glossaryIds.includes(n.glossaryId)
          )
          .map((n) => n.id)
      );

      const metricIds = new Set<string>();
      const assetIds = new Set<string>();
      filteredEdges.forEach((edge) => {
        if (edge.relationType === METRIC_RELATION_TYPE) {
          if (glossaryTermIds.has(edge.to) || glossaryTermIds.has(edge.from)) {
            metricIds.add(edge.from);
            metricIds.add(edge.to);
          }

          return;
        }
        if (edge.relationType === ASSET_RELATION_TYPE) {
          if (glossaryTermIds.has(edge.to) || glossaryTermIds.has(edge.from)) {
            assetIds.add(edge.from);
            assetIds.add(edge.to);
          }
        }
      });

      filteredNodes = filteredNodes.filter((n) => {
        if (n.type === 'glossary') {
          return filters.glossaryIds.includes(n.id);
        }
        if (n.type === METRIC_NODE_TYPE) {
          return metricIds.has(n.id);
        }
        if (n.type === ASSET_NODE_TYPE) {
          return assetIds.has(n.id);
        }

        return n.glossaryId && filters.glossaryIds.includes(n.glossaryId);
      });
      const nodeIds = new Set(filteredNodes.map((n) => n.id));
      filteredEdges = filteredEdges.filter(
        (e) => nodeIds.has(e.from) && nodeIds.has(e.to)
      );
    }

    // Filter by relation type
    if (filters.relationTypes.length > 0) {
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

        return filters.relationTypes.includes(e.relationType);
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

    // Filter by search query: show matching nodes and all nodes connected to them
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase().trim();
      const matchingNodes = filteredNodes.filter(
        (n) =>
          n.label.toLowerCase().includes(query) ||
          n.fullyQualifiedName?.toLowerCase().includes(query) ||
          n.description?.toLowerCase().includes(query)
      );
      const matchingIds = new Set(matchingNodes.map((n) => n.id));
      filteredEdges.forEach((e) => {
        if (matchingIds.has(e.from) || matchingIds.has(e.to)) {
          matchingIds.add(e.from);
          matchingIds.add(e.to);
        }
      });
      filteredNodes = filteredNodes.filter((n) => matchingIds.has(n.id));
      filteredEdges = filteredEdges.filter(
        (e) => matchingIds.has(e.from) && matchingIds.has(e.to)
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
    if (
      !isHierarchyView ||
      !hierarchyGraphData ||
      (settings.layout !== LayoutType.Circular &&
        settings.layout !== LayoutType.Radial)
    ) {
      return undefined;
    }

    return computeGlossaryGroupPositions(
      hierarchyGraphData.nodes,
      toLayoutEngineType(settings.layout)
    );
  }, [isHierarchyView, hierarchyGraphData, settings.layout]);

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

  const buildAssetGraphData = useCallback(
    async (termNodes: OntologyNode[]): Promise<OntologyGraphData> => {
      const nodes: OntologyNode[] = [];
      const edges: OntologyEdge[] = [];
      const nodeIds = new Set<string>();
      const edgeKeys = new Set<string>();
      let totalAssets = 0;

      for (const termNode of termNodes) {
        if (!termNode.id || totalAssets >= ASSET_TOTAL_LIMIT) {
          break;
        }

        const limit = Math.min(100, ASSET_TOTAL_LIMIT - totalAssets);
        try {
          const response = await getGlossaryTermAssets(termNode.id, limit, 0);
          const assets = response.data ?? [];
          totalAssets += assets.length;

          assets.forEach((asset) => {
            if (!asset.id) {
              return;
            }
            if (!nodeIds.has(asset.id)) {
              nodes.push({
                id: asset.id,
                label:
                  asset.displayName ||
                  asset.name ||
                  asset.fullyQualifiedName ||
                  asset.id,
                originalLabel:
                  asset.displayName ||
                  asset.name ||
                  asset.fullyQualifiedName ||
                  asset.id,
                type: ASSET_NODE_TYPE,
                fullyQualifiedName: asset.fullyQualifiedName,
                description: asset.description,
                entityRef: asset,
              });
              nodeIds.add(asset.id);
            }

            const edgeKey = `${asset.id}-${termNode.id}-${ASSET_RELATION_TYPE}`;
            if (!edgeKeys.has(edgeKey)) {
              edges.push({
                from: asset.id,
                to: termNode.id,
                label: t('label.tagged-with'),
                relationType: ASSET_RELATION_TYPE,
              });
              edgeKeys.add(edgeKey);
            }
          });
        } catch {
          // Skip assets for this term if fetch fails
        }
      }

      return { nodes, edges };
    },
    [t]
  );

  const fetchAllMetrics = useCallback(async (): Promise<Metric[]> => {
    const allMetrics: Metric[] = [];
    let after: string | undefined;

    while (allMetrics.length < DEFAULT_LIMIT) {
      const response = await getMetrics({
        fields: 'tags',
        limit: Math.min(100, DEFAULT_LIMIT - allMetrics.length),
        after,
      });
      allMetrics.push(...response.data);
      after = response.paging?.after;
      if (!after) {
        break;
      }
    }

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

  const fetchGraphDataFromRdf = useCallback(
    async (glossaryIdParam?: string, glossaryList?: Glossary[]) => {
      try {
        const rdfData = await getGlossaryTermGraph({
          glossaryId: glossaryIdParam,
          limit: DEFAULT_LIMIT,
          includeIsolated: true,
        });

        if (rdfData.nodes && rdfData.nodes.length > 0) {
          // Check if labels are valid (not just UUIDs) - if too many UUID labels, fall back to database
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const nodesWithBadLabels = rdfData.nodes.filter(
            (node) => !node.label || uuidRegex.test(node.label)
          );

          // If more than half the nodes have bad labels, skip RDF and use database
          if (nodesWithBadLabels.length > rdfData.nodes.length / 2) {
            return null;
          }

          setDataSource(rdfData.source === 'database' ? 'database' : 'rdf');

          return convertRdfGraphToOntologyGraph(rdfData, glossaryList ?? []);
        }

        return null;
      } catch {
        return null;
      }
    },
    [convertRdfGraphToOntologyGraph]
  );

  const fetchGraphDataFromDatabase = useCallback(
    async (glossaryIdParam?: string, fetchedGlossaries?: Glossary[]) => {
      const glossariesToUse = fetchedGlossaries ?? glossaries;
      const allTerms: GlossaryTerm[] = [];

      const glossariesToFetch = glossaryIdParam
        ? glossariesToUse.filter((g) => g.id === glossaryIdParam)
        : glossariesToUse;

      for (const glossary of glossariesToFetch) {
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
          });
          allTerms.push(...termsResponse.data);
        } catch {
          // Continue with other glossaries if one fails
        }
      }

      return buildGraphFromAllTerms(allTerms, glossariesToFetch);
    },
    // Note: glossaries is intentionally excluded to prevent infinite loop
    // fetchedGlossaries parameter is always passed from fetchAllGlossaryData

    [buildGraphFromAllTerms]
  );

  const fetchAllGlossaryData = useCallback(
    async (glossaryIdParam?: string) => {
      setLoading(true);
      try {
        // Always fetch glossaries list for export functionality
        const [glossariesResponse, metricsResponse] = await Promise.all([
          getGlossariesList({
            fields: 'owners,tags',
            limit: 100,
          }),
          fetchAllMetrics().catch(() => []),
        ]);
        const fetchedGlossaries = glossariesResponse.data;
        setGlossaries(fetchedGlossaries);

        let data: OntologyGraphData | null = null;

        if (rdfEnabled) {
          data = await fetchGraphDataFromRdf(
            glossaryIdParam,
            fetchedGlossaries
          );
        }

        if (!data || data.nodes.length === 0) {
          setDataSource('database');
          data = await fetchGraphDataFromDatabase(
            glossaryIdParam,
            fetchedGlossaries
          );
        }

        const mergedData = mergeMetricsIntoGraph(data, metricsResponse);
        setGraphData(mergedData);
        setAssetGraphData(null);
        setSavedPositions(null);
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
      t,
    ]
  );

  const loadAssetsForDataMode = useCallback(async () => {
    if (!graphData) {
      return;
    }

    const termNodes = getScopedTermNodes(
      graphData.nodes,
      filters.glossaryIds,
      scope,
      entityId
    );

    const limitedTerms = termNodes.slice(0, ASSET_TERM_LIMIT);
    const assetData = await buildAssetGraphData(limitedTerms);
    setAssetGraphData(assetData);
  }, [graphData, filters.glossaryIds, scope, entityId, buildAssetGraphData]);

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
      fetchAllGlossaryData();
    } else {
      setLoading(false);
    }
  }, [scope, glossaryId, entityId, rdfEnabled, fetchAllGlossaryData]);

  useEffect(() => {
    if (explorationMode !== 'data') {
      setAssetGraphData(null);

      return;
    }

    // Skip when handleModeChange already pre-loaded assets to avoid a
    // redundant fetch that would cause an extra graph recreation.
    if (assetLoadedByHandleModeChangeRef.current) {
      assetLoadedByHandleModeChangeRef.current = false;

      return;
    }

    loadAssetsForDataMode();
  }, [explorationMode, loadAssetsForDataMode]);

  const handleZoomIn = useCallback(() => {
    graphRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    graphRef.current?.zoomOut();
  }, []);

  const handleFitToScreen = useCallback(() => {
    graphRef.current?.fitView();
  }, []);

  const handleModeChange = useCallback(
    async (mode: ExplorationMode) => {
      if (mode === 'data') {
        modelFiltersRef.current = filters;
        const nextFilters: GraphFilters = {
          ...dataFiltersRef.current,
          glossaryIds: filters.glossaryIds,
          viewMode: 'overview' satisfies GraphViewMode,
        };
        // Pre-fetch assets before switching mode so all state updates are
        // batched into a single re-render (React 18 automatic batching).
        // This avoids the double graph recreation: once when explorationMode
        // changes, and again when inputNodes.length changes after async load.
        if (graphData) {
          const termNodes = getScopedTermNodes(
            graphData.nodes,
            filters.glossaryIds,
            scope,
            entityId
          );
          const limitedTerms = termNodes.slice(0, ASSET_TERM_LIMIT);
          const assetData = await buildAssetGraphData(limitedTerms);
          // Mark so the useEffect skips the redundant load after mode switch.
          assetLoadedByHandleModeChangeRef.current = true;
          setAssetGraphData(assetData);
        }
        setExplorationMode(mode);
        setFilters(nextFilters);
      } else {
        dataFiltersRef.current = filters;
        setSelectedNode(null);
        setExplorationMode(mode);
        setFilters(modelFiltersRef.current);
      }
    },
    [filters, graphData, scope, entityId, buildAssetGraphData]
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

  const handleSettingsChange = useCallback((nextSettings: GraphSettings) => {
    setSettings((prev) => {
      if (prev.layout !== nextSettings.layout) {
        setSavedPositions(null);
      }

      return nextSettings;
    });
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

  const handleNodeFocus = useCallback((nodeId: string) => {
    if (isValidUUID(nodeId)) {
      graphRef.current?.focusNode(nodeId);
    }
  }, []);

  const handleDetailsPanelNodeClick = useCallback(
    (nodeId: string) => {
      handleNodeFocus(nodeId);
      const node = filteredGraphData?.nodes.find((n) => n.id === nodeId);
      if (node) {
        setSelectedNode(node);
      }
    },
    [handleNodeFocus, filteredGraphData]
  );

  const handleGraphNodeClick = useCallback(
    (node: OntologyNode, position?: { x: number; y: number }) => {
      setContextMenu(null);
      if (
        explorationMode === 'data' &&
        (node.type === ASSET_NODE_TYPE || node.type === METRIC_NODE_TYPE)
      ) {
        return;
      }
      setSelectedNode(node);
      setPanelPosition(position);
    },
    [explorationMode]
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
    if (!filteredGraphData) {
      return [];
    }
    const termCount = filteredGraphData.nodes.filter(
      (n) => n.type === 'glossaryTerm' || n.type === 'glossaryTermIsolated'
    ).length;
    const metricCount = filteredGraphData.nodes.filter(
      (n) => n.type === METRIC_NODE_TYPE
    ).length;
    const assetCount = filteredGraphData.nodes.filter(
      (n) => n.type === ASSET_NODE_TYPE
    ).length;
    const relationCount = filteredGraphData.edges.length;
    const isolatedCount = filteredGraphData.nodes.filter(
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
  }, [filteredGraphData, dataSource, explorationMode, t]);

  const dottedGraphBackgroundStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    backgroundImage:
      'radial-gradient(circle, rgba(148, 163, 184, 0.22) 1px, transparent 1px)',
    backgroundSize: '14px 14px',
  };

  return (
    <div
      className={classNames(
        'tw:flex tw:flex-col tw:overflow-hidden',
        className
      )}
      data-testid="ontology-explorer"
      style={{ height }}>
      {showHeader && (
        <div
          className="tw:flex tw:flex-col tw:gap-2 tw:px-5 tw:py-3 tw:mb-4"
          data-testid="ontology-explorer-header"
          style={{
            borderRadius: 12,
            border: '1px solid var(--Blue-gray-100, #EAECF5)',
            background: 'var(--colors-content-content1, #FFF)',
          }}>
          <Typography
            as="h2"
            className="tw:m-0 tw:text-md tw:font-semibold tw:text-gray-800">
            {t('label.ontology-explorer')}
          </Typography>
          {filteredGraphData && statsItems.length > 0 && (
            <div
              className="tw:flex tw:items-center tw:gap-2 tw:flex-wrap"
              data-testid="ontology-explorer-stats">
              {statsItems.map((item, index) => (
                <React.Fragment key={`${item}-${index}`}>
                  {index > 0 && (
                    <div
                      aria-hidden
                      className="tw:shrink-0 tw:self-stretch"
                      style={{
                        width: 1,
                        backgroundColor: 'var(--Blue-gray-100, #EAECF5)',
                      }}
                    />
                  )}
                  <span
                    className="tw:text-sm tw:font-medium tw:leading-5"
                    data-testid={
                      index === 0 ? 'ontology-explorer-stats-item' : undefined
                    }
                    style={{
                      color: '#414651',
                    }}>
                    {item}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:overflow-hidden">
        <div className="tw:relative tw:flex tw:min-h-100 tw:min-w-0 tw:flex-1 tw:flex-col tw:overflow-hidden">
          {/* Top filter bar */}
          <div className="tw:absolute tw:left-0 tw:right-0 tw:top-0 tw:z-50 tw:px-5 tw:pt-5">
            <div
              className="tw:border tw:rounded-[6px] tw:py-2.5 tw:px-3"
              style={{
                borderColor: NODE_BORDER_COLOR,
                background: NODE_FILL_DEFAULT,
                boxShadow:
                  '0 8px 20px 0 rgba(0, 0, 3, 0.04), 0 2px 4px 0 rgba(0, 0, 3, 0.03)',
              }}>
              <FilterToolbar
                filters={filters}
                glossaries={glossaries}
                relationTypes={relationTypes}
                viewModeDisabled={explorationMode === 'data'}
                onFiltersChange={handleFiltersChange}
                onViewModeChange={handleViewModeChange}
              />
            </div>
          </div>

          {/* Bottom center: Mode tabs + Search in Graph + Settings */}
          <div
            className={
              'tw:absolute tw:bottom-4 tw:left-1/2 tw:-translate-x-1/2 tw:z-50 ' +
              'tw:flex tw:shrink-0 tw:items-center tw:gap-2 tw:rounded-xl ' +
              'tw:border tw:border-gray-200 tw:bg-white tw:px-3 tw:py-1.5 tw:shadow-md'
            }>
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
              className="tw:min-w-54.5 tw:rounded-xl [&_input]:tw:pl-10"
              data-testid="ontology-graph-search"
              icon={SearchMd}
              inputClassName="tw:pl-10"
              placeholder={t('label.search-in-graph')}
              value={filters.searchQuery}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, searchQuery: value }))
              }
            />
            <GraphSettingsPanel
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          </div>

          {/* Bottom right: Zoom / view controls */}
          <div className="tw:absolute tw:bottom-4 tw:right-4 tw:z-50 tw:flex tw:items-center tw:gap-1 tw:rounded-lg tw:border tw:border-gray-200 tw:bg-white tw:shadow-md">
            <OntologyControlButtons
              isLoading={loading}
              onFitToScreen={handleFitToScreen}
              onRefresh={handleRefresh}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
            />
          </div>

          {loading ? (
            <div
              className="tw:relative tw:flex tw:min-h-100 tw:flex-1 tw:flex-col tw:items-center tw:justify-center"
              data-testid="ontology-graph-loading">
              <div
                className="tw:absolute tw:inset-0"
                style={dottedGraphBackgroundStyle}
              />
              <div
                aria-label={t('label.loading')}
                className="tw:z-10 tw:h-10 tw:w-10 tw:animate-spin tw:rounded-full tw:border-2 tw:border-gray-200 tw:border-t-blue-600"
                role="status"
              />
              <Typography as="p" className="tw:mt-4 tw:z-10 tw:text-gray-500">
                {t('label.loading-graph')}
              </Typography>
            </div>
          ) : !graphDataToShow || graphDataToShow.nodes.length === 0 ? (
            <div
              className="tw:relative tw:flex tw:min-h-100 tw:flex-1 tw:flex-col tw:items-center tw:justify-center"
              data-testid="ontology-graph-empty">
              <div
                className="tw:absolute tw:inset-0"
                style={dottedGraphBackgroundStyle}
              />
              <Typography
                as="p"
                className="tw:z-10 tw:text-center tw:text-gray-500">
                {filters.glossaryIds.length > 0 ||
                filters.relationTypes.length > 0
                  ? t('message.no-data-available-for-selected-filter')
                  : t('message.no-glossary-terms-found')}
              </Typography>
            </div>
          ) : (
            <div
              className="tw:absolute tw:inset-0"
              style={dottedGraphBackgroundStyle}>
              <OntologyGraph
                edges={graphDataToShow.edges}
                explorationMode={
                  isHierarchyView ? 'hierarchy' : explorationMode
                }
                focusNodeId={
                  explorationMode === 'data'
                    ? selectedNode?.id ?? entityId
                    : entityId
                }
                glossaryColorMap={glossaryColorMap}
                hierarchyCombos={
                  isHierarchyView && hierarchyGraphData
                    ? hierarchyGraphData.combos.map((c) => ({
                        id: c.id,
                        label: c.label,
                        glossaryId: c.glossaryId,
                      }))
                    : undefined
                }
                nodePositions={
                  isHierarchyView
                    ? hierarchyBakedPositions ?? undefined
                    : savedPositions ?? undefined
                }
                nodes={graphDataToShow.nodes}
                ref={graphRef}
                selectedNodeId={selectedNode?.id}
                settings={settings}
                onNodeClick={handleGraphNodeClick}
                onNodeContextMenu={handleGraphNodeContextMenu}
                onNodeDoubleClick={handleGraphNodeDoubleClick}
                onPaneClick={handleGraphPaneClick}
              />
            </div>
          )}

          {selectedNode && explorationMode !== 'data' && (
            <DetailsPanel
              edges={filteredGraphData?.edges}
              node={selectedNode}
              nodes={filteredGraphData?.nodes}
              position={panelPosition}
              relationTypes={relationTypes}
              onClose={() => {
                setSelectedNode(null);
              }}
              onNodeClick={handleDetailsPanelNodeClick}
            />
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
