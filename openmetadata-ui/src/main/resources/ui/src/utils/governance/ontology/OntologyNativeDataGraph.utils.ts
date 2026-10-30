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
import { isAxiosError } from 'axios';
import {
  LineageNote,
  OntologyEdge,
  OntologyGraphData,
  OntologyNode,
} from '../../../components/OntologyExplorer/OntologyExplorer.interface';
import { ASSET_RELATION_TYPE } from '../../../components/OntologyExplorer/utils/graphBuilders';
import {
  Asset,
  ConceptEdge,
  Edge,
  LoadedPrefix,
  NativeOntologyAssetCluster,
  NativeOntologyDataGraphPage,
} from '../../../generated/api/data/nativeOntologyDataGraphPage';
import {
  Kind,
  NativeOntologyDataGraphPageRequest,
} from '../../../generated/api/data/nativeOntologyDataGraphPageRequest';
import { getEntityName } from '../../EntityNameUtils';

export const NATIVE_CLUSTER_PAGE_SIZE = 12;
// The server leaves this size to the client; ADR:2026-10-19-native-concept-bindings-remain-operational-metadata.
export const NATIVE_ASSET_PAGE_SIZE = 25;
export const NATIVE_CONTEXT_CONCEPT_LIMIT = 60;
export const NATIVE_INFERRED_RELATION_TYPE = 'inferred';
export const NATIVE_LINEAGE_RELATION_TYPE = 'observedLineage';

export interface NativeAssetRow {
  id: string;
  asset: Asset['asset'];
  columnCount: number;
  serviceType?: string;
}

export interface NativeCluster {
  concept: NativeOntologyAssetCluster['concept'];
  assetCount: number;
  assets: NativeAssetRow[];
  after?: string;
}

export interface NativeTopology {
  conceptEdges: ConceptEdge[];
  lineageEdges: Edge[];
}

export interface NativeDataGraph {
  clusters: NativeCluster[];
  loaded: LoadedPrefix[];
  nextClusterOffset?: number;
  contextFull: boolean;
  topology: NativeTopology;
}

export type PageFailure = 'invalid' | 'stale' | 'other';

export const EMPTY_NATIVE_TOPOLOGY: NativeTopology = {
  conceptEdges: [],
  lineageEdges: [],
};

export const EMPTY_NATIVE_DATA_GRAPH: NativeDataGraph = {
  clusters: [],
  loaded: [],
  contextFull: false,
  topology: EMPTY_NATIVE_TOPOLOGY,
};

export const clustersRequest = (
  loaded: LoadedPrefix[],
  offset: number
): NativeOntologyDataGraphPageRequest => ({
  loaded,
  page: { kind: Kind.Clusters, limit: NATIVE_CLUSTER_PAGE_SIZE, offset },
});

export const bindingsRequest = (
  loaded: LoadedPrefix[],
  conceptId: string,
  after: string
): NativeOntologyDataGraphPageRequest => ({
  loaded,
  page: {
    kind: Kind.Bindings,
    conceptId,
    after,
    limit: NATIVE_ASSET_PAGE_SIZE,
  },
});

export const topologyRequest = (
  loaded: LoadedPrefix[],
  after: string
): NativeOntologyDataGraphPageRequest => ({
  loaded,
  page: { kind: Kind.Topology, after },
});

export const classifyPageFailure = (error: unknown): PageFailure => {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status === 400) {
    return 'invalid';
  }

  return status === 412 ? 'stale' : 'other';
};

const toCluster = (cluster: NativeOntologyAssetCluster): NativeCluster => ({
  concept: cluster.concept,
  assetCount: cluster.assetCount,
  after: cluster.after,
  assets: cluster.assets.map((item) => ({
    id: item.asset.id,
    asset: item.asset,
    columnCount: item.columnCount,
    serviceType: item.serviceType,
  })),
});

export const applyClustersPage = (
  graph: NativeDataGraph,
  page: NativeOntologyDataGraphPage
): NativeDataGraph => {
  const incoming = new Map(
    (page.clusters ?? []).map((cluster) => [
      cluster.concept.id,
      toCluster(cluster),
    ])
  );
  const replaced = graph.clusters.map(
    (cluster) => incoming.get(cluster.concept.id) ?? cluster
  );
  const known = new Set(graph.clusters.map((cluster) => cluster.concept.id));

  return {
    ...graph,
    clusters: [
      ...replaced,
      ...[...incoming.values()].filter(
        (cluster) => !known.has(cluster.concept.id)
      ),
    ],
    loaded: page.loaded,
    nextClusterOffset: page.nextClusterOffset,
    contextFull: page.contextFull,
  };
};

const countColumnPaths = (
  columns: { columnPath: string[] }[] | undefined
): number =>
  new Set((columns ?? []).map((column) => JSON.stringify(column.columnPath)))
    .size;

export const applyBindingsPage = (
  graph: NativeDataGraph,
  conceptId: string,
  page: NativeOntologyDataGraphPage
): NativeDataGraph => {
  const bindings = page.bindings;
  if (!bindings) {
    return graph;
  }

  return {
    ...graph,
    loaded: page.loaded,
    contextFull: page.contextFull,
    clusters: graph.clusters.map((cluster) => {
      if (cluster.concept.id !== conceptId) {
        return cluster;
      }
      const have = new Set(cluster.assets.map((row) => row.id));
      const added = bindings.assets
        .filter((binding) => !have.has(binding.assetId))
        .map(
          (binding): NativeAssetRow => ({
            id: binding.assetId,
            asset: binding.asset,
            columnCount: countColumnPaths(binding.columns),
            serviceType: binding.serviceType,
          })
        );

      return {
        ...cluster,
        assets: [...cluster.assets, ...added],
        after: bindings.after,
      };
    }),
  };
};

const conceptEdgeKey = (edge: ConceptEdge) =>
  `${edge.fromConceptId}|${edge.toConceptId}|${edge.propertyIri}`;
const lineageEdgeKey = (edge: Edge) => `${edge.fromEntity}|${edge.toEntity}`;

const mergeUnique = <T>(
  current: T[],
  incoming: T[],
  keyOf: (item: T) => string
): T[] => {
  const merged = new Map(current.map((item) => [keyOf(item), item]));
  incoming.forEach((item) => merged.set(keyOf(item), item));

  return [...merged.values()];
};

export const stageTopologyPage = (
  staged: NativeTopology,
  page: NativeOntologyDataGraphPage['topology']
): NativeTopology => ({
  conceptEdges: mergeUnique(staged.conceptEdges, page.edges, conceptEdgeKey),
  lineageEdges: mergeUnique(
    staged.lineageEdges,
    page.lineageEdges,
    lineageEdgeKey
  ),
});

const assetNodeId = (conceptId: string, assetId: string) =>
  `asset:${conceptId}:${assetId}`;

const toConceptNode = (
  cluster: NativeCluster,
  isLoadingAssets: boolean
): OntologyNode => {
  const loadedAssetCount = cluster.after
    ? cluster.assets.length
    : Math.max(cluster.assetCount, cluster.assets.length);

  return {
    id: cluster.concept.id,
    label: getEntityName(cluster.concept),
    type: 'ontologyConcept',
    assetCount: cluster.assetCount,
    loadedAssetCount,
    isLoadingAssets,
    isDataModeSeed: true,
    entityRef: cluster.concept,
  };
};

const toAssetNode = (
  conceptId: string,
  row: NativeAssetRow,
  lineageNotes?: LineageNote[]
): OntologyNode => ({
  id: assetNodeId(conceptId, row.id),
  label: getEntityName(row.asset),
  type: 'dataAsset',
  entityRef: row.asset,
  fullyQualifiedName: row.asset.fullyQualifiedName,
  serviceLabel: row.serviceType,
  columnCount: row.columnCount,
  lineageNotes,
});

const buildInferredEdges = (
  edges: ConceptEdge[],
  conceptIds: Set<string>
): OntologyEdge[] =>
  edges
    .filter(
      (edge) =>
        edge.fromConceptId !== edge.toConceptId &&
        conceptIds.has(edge.fromConceptId) &&
        conceptIds.has(edge.toConceptId)
    )
    .map((edge) => ({
      id: `inferred:${conceptEdgeKey(edge)}`,
      from: edge.fromConceptId,
      to: edge.toConceptId,
      label: edge.label,
      relationType: NATIVE_INFERRED_RELATION_TYPE,
      edgeKind: 'semanticProjection',
    }));

interface LineageRow {
  conceptId: string;
  nodeId: string;
  label: string;
}

interface NativeLineage {
  edges: OntologyEdge[];
  notesByNodeId: Map<string, LineageNote[]>;
}

// Lineage between two rows of one card has no card-to-card edge to draw, so
// each row names the table on its other end instead.
const buildLineage = (
  edges: Edge[],
  clusters: NativeCluster[],
  lineageLabel: string
): NativeLineage => {
  const rowsByAsset = new Map<string, LineageRow[]>();
  clusters.forEach((cluster) =>
    cluster.assets.forEach((row) =>
      rowsByAsset.set(row.id, [
        ...(rowsByAsset.get(row.id) ?? []),
        {
          conceptId: cluster.concept.id,
          nodeId: assetNodeId(cluster.concept.id, row.id),
          label: getEntityName(row.asset),
        },
      ])
    )
  );
  const joined = new Map<string, OntologyEdge>();
  const notesByNodeId = new Map<string, LineageNote[]>();
  const note = (nodeId: string, lineageNote: LineageNote) =>
    notesByNodeId.set(nodeId, [
      ...(notesByNodeId.get(nodeId) ?? []),
      lineageNote,
    ]);
  edges.forEach((edge) => {
    (rowsByAsset.get(edge.fromEntity) ?? []).forEach((from) =>
      (rowsByAsset.get(edge.toEntity) ?? []).forEach((to) => {
        if (from.nodeId === to.nodeId) {
          return;
        }
        if (from.conceptId === to.conceptId) {
          note(from.nodeId, { direction: 'downstream', label: to.label });
          note(to.nodeId, { direction: 'upstream', label: from.label });

          return;
        }
        joined.set(`${from.nodeId}|${to.nodeId}`, {
          id: `lineage:${from.nodeId}:${to.nodeId}`,
          from: from.conceptId,
          to: to.conceptId,
          label: lineageLabel,
          relationType: NATIVE_LINEAGE_RELATION_TYPE,
          edgeKind: 'observedLineage',
          lineage: {
            from: { nodeId: from.nodeId, label: from.label },
            to: { nodeId: to.nodeId, label: to.label },
          },
        });
      })
    );
  });

  return { edges: [...joined.values()], notesByNodeId };
};

export const buildNativeDataGraph = (
  graph: NativeDataGraph,
  loadingConceptIds: ReadonlySet<string>,
  lineageLabel: string
): OntologyGraphData => {
  const conceptIds = new Set(graph.clusters.map((item) => item.concept.id));
  const lineage = buildLineage(
    graph.topology.lineageEdges,
    graph.clusters,
    lineageLabel
  );
  const nodes = graph.clusters.flatMap((cluster) => [
    toConceptNode(cluster, loadingConceptIds.has(cluster.concept.id)),
    ...cluster.assets.map((row) =>
      toAssetNode(
        cluster.concept.id,
        row,
        lineage.notesByNodeId.get(assetNodeId(cluster.concept.id, row.id))
      )
    ),
  ]);
  const assetEdges = graph.clusters.flatMap((cluster) =>
    cluster.assets.map(
      (row): OntologyEdge => ({
        id: `binding:${cluster.concept.id}:${row.id}`,
        from: cluster.concept.id,
        to: assetNodeId(cluster.concept.id, row.id),
        label: '',
        relationType: ASSET_RELATION_TYPE,
        edgeKind: 'assetBinding',
      })
    )
  );

  return {
    nodes,
    edges: [
      ...assetEdges,
      ...buildInferredEdges(graph.topology.conceptEdges, conceptIds),
      ...lineage.edges,
    ],
  };
};
