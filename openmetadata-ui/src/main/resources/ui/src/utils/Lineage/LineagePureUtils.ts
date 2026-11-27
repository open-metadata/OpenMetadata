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

import { get, omit, pick } from 'lodash';
import type { ColumnLevelLineageNode } from '../../components/Lineage/Lineage.interface';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import type { Column } from '../../generated/entity/data/table';
import { DependencyType } from '../../generated/type/entityLineage';
import type { TagLabel } from '../../generated/type/tagLabel';
import type {
  EdgeDetails,
  EntityLineageResponse,
  NodeData,
} from '../../interface/lineage.interface';
import type { TableSearchSource } from '../../interface/search.interface';
import type { QueryFieldInterface } from '../../pages/ExplorePage/ExplorePage.interface';

export const isIndirectEdgeDetails = (
  edge?: Pick<EdgeDetails, 'dependencyType'>
): boolean => edge?.dependencyType === DependencyType.Indirect;

const addAdjacencyEdge = (
  adjacency: Map<string, string[]>,
  source: string,
  target: string
) => {
  const neighbors = adjacency.get(source) ?? [];
  neighbors.push(target);
  adjacency.set(source, neighbors);
};

const traverseReachable = (
  rootId: string,
  adjacency: Map<string, string[]>,
  reachable: Set<string>
) => {
  const queue = [rootId];
  const visited = new Set<string>([rootId]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        reachable.add(next);
        queue.push(next);
      }
    }
  }
};

const collectReachableNodeIds = (
  rootId: string,
  keptEdges: EdgeDetails[]
): Set<string> => {
  const forward = new Map<string, string[]>();
  const backward = new Map<string, string[]>();
  for (const edge of keptEdges) {
    addAdjacencyEdge(forward, edge.fromEntity.id, edge.toEntity.id);
    addAdjacencyEdge(backward, edge.toEntity.id, edge.fromEntity.id);
  }

  const reachable = new Set<string>([rootId]);
  traverseReachable(rootId, forward, reachable);
  traverseReachable(rootId, backward, reachable);

  return reachable;
};

/**
 * Filters out INDIRECT lineage edges and any nodes reachable only through
 * those hidden indirect edges when `showIndirectEdges` is `false`.
 */
export const applyIndirectEdgeVisibility = <T extends EntityLineageResponse>(
  lineage: T,
  showIndirectEdges: boolean,
  rootFqn?: string
): T => {
  if (showIndirectEdges) {
    return lineage;
  }

  const edges = lineage.edges ?? [];
  if (!edges.some(isIndirectEdgeDetails)) {
    return lineage;
  }

  const keptEdges = edges.filter((edge) => !isIndirectEdgeDetails(edge));
  const nodes = lineage.nodes ?? [];
  const rootId =
    lineage.entity?.id ??
    (rootFqn
      ? nodes.find((node) => node.fullyQualifiedName === rootFqn)?.id
      : undefined);

  if (!rootId) {
    const connectedIds = new Set(
      keptEdges.flatMap((edge) => [edge.fromEntity.id, edge.toEntity.id])
    );

    return {
      ...lineage,
      nodes: nodes.filter((node) => connectedIds.has(node.id)),
      edges: keptEdges,
    };
  }

  const reachable = collectReachableNodeIds(rootId, keptEdges);

  return {
    ...lineage,
    nodes: nodes.filter((node) => reachable.has(node.id)),
    edges: keptEdges.filter(
      (edge) =>
        reachable.has(edge.fromEntity.id) && reachable.has(edge.toEntity.id)
    ),
  };
};

const buildColumnTagMap = <T>(
  entityData: T & { columns?: Column[] }
): Map<string, TagLabel[]> => {
  const map = new Map<string, TagLabel[]>();
  const columns = entityData.columns;
  if (columns) {
    for (const col of columns) {
      if (col.children) {
        buildColumnTagMap({
          columns: col.children,
        }).forEach((tags, fqn) => {
          map.set(fqn, tags);
        });
      }
      if (col.fullyQualifiedName && col.tags) {
        map.set(col.fullyQualifiedName, col.tags);
      }
    }
  }

  return map;
};

type PickedEntityFields = Pick<
  TableSearchSource,
  'tags' | 'tier' | 'domains' | 'description' | 'owners' | 'id'
>;

const buildColumnLevelNodesForColumns = (
  node: EdgeDetails,
  nodeDepth: number,
  picked: PickedEntityFields,
  columnTagMap: Map<string, TagLabel[]>,
  direction: LineageDirection
): ColumnLevelLineageNode[] => {
  const columnLevelNodes: ColumnLevelLineageNode[] = [];

  for (const col of node.columns ?? []) {
    for (const fromCol of col.fromColumns || []) {
      const columnFqn =
        direction === LineageDirection.Downstream ? col.toColumn : fromCol;
      const columnTags = columnFqn ? columnTagMap.get(columnFqn) ?? [] : [];

      columnLevelNodes.push({
        ...omit(node, 'columns'),
        fromColumn: fromCol,
        toColumn: col.toColumn,
        docId: fromCol + '->' + col.toColumn,
        nodeDepth,
        ...picked,
        tags: columnTags,
      } as ColumnLevelLineageNode);
    }
  }

  return columnLevelNodes;
};

const buildColumnLevelNodesForEdge = (
  node: EdgeDetails,
  nodes: Record<string, NodeData>,
  entityKey: 'fromEntity' | 'toEntity',
  direction: LineageDirection
): ColumnLevelLineageNode[] => {
  if ((node.columns?.length ?? 0) === 0) {
    return [];
  }

  const entityData = get(
    nodes[node[entityKey].fullyQualifiedName ?? ''],
    'entity'
  );
  const nodeDepth = get(
    nodes[node[entityKey].fullyQualifiedName ?? ''],
    'nodeDepth',
    0
  );

  if (!entityData) {
    return [];
  }

  const picked = pick<NodeData['entity']>(
    entityData,
    'owners',
    'tier',
    'tags',
    'domains',
    'description'
  ) as PickedEntityFields;

  const columnTagMap = buildColumnTagMap(entityData);

  return buildColumnLevelNodesForColumns(
    node,
    nodeDepth,
    picked,
    columnTagMap,
    direction
  );
};

export const prepareColumnLevelNodesFromEdges = (
  edges: EdgeDetails[],
  nodes: Record<string, NodeData>,
  direction: LineageDirection = LineageDirection.Downstream
) => {
  const entityKey =
    direction === LineageDirection.Upstream ? 'fromEntity' : 'toEntity';

  return edges.reduce((acc: ColumnLevelLineageNode[], node: EdgeDetails) => {
    acc.push(
      ...buildColumnLevelNodesForEdge(node, nodes, entityKey, direction)
    );

    return acc;
  }, []);
};

export const prepareDownstreamColumnLevelNodesFromDownstreamEdges = (
  edges: EdgeDetails[],
  nodes: Record<string, NodeData>
) => {
  return prepareColumnLevelNodesFromEdges(
    edges,
    nodes,
    LineageDirection.Downstream
  );
};

export const prepareUpstreamColumnLevelNodesFromUpstreamEdges = (
  edges: EdgeDetails[],
  nodes: Record<string, NodeData>
) => {
  return prepareColumnLevelNodesFromEdges(
    edges,
    nodes,
    LineageDirection.Upstream
  );
};

export const getSearchNameEsQuery = (
  searchText: string
): QueryFieldInterface => {
  return {
    bool: {
      should: [
        {
          wildcard: {
            ['name.keyword']: {
              value: `*${searchText}*`,
            },
          },
        },
        {
          wildcard: {
            ['displayName.keyword']: {
              value: `*${searchText}*`,
            },
          },
        },
      ],
    },
  };
};
