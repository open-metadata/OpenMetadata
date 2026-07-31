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
import type {
  ColumnLevelLineageNode,
  EdgeDetails,
  LineageNodeType,
  NodeData,
} from '../../components/Lineage/Lineage.interface';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import type { Column } from '../../generated/entity/data/table';
import type { TagLabel } from '../../generated/type/tagLabel';
import type { TableSearchSource } from '../../interface/search.interface';
import type { QueryFieldInterface } from '../../pages/ExplorePage/ExplorePage.interface';

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

export const prepareColumnLevelNodesFromEdges = (
  edges: EdgeDetails[],
  nodes: Record<string, LineageNodeType>,
  direction: LineageDirection = LineageDirection.Downstream
) => {
  const entityKey =
    direction === LineageDirection.Upstream ? 'fromEntity' : 'toEntity';

  return edges.reduce((acc: ColumnLevelLineageNode[], node: EdgeDetails) => {
    if ((node.columns?.length ?? 0) > 0) {
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
        return acc;
      }

      const picked = pick<NodeData['entity']>(
        entityData,
        'owners',
        'tier',
        'tags',
        'domains',
        'description'
      ) as Pick<
        TableSearchSource,
        'tags' | 'tier' | 'domains' | 'description' | 'owners' | 'id'
      >;

      const columnTagMap = buildColumnTagMap(entityData);

      for (const col of node.columns ?? []) {
        for (const fromCol of col.fromColumns || []) {
          const columnFqn =
            direction === LineageDirection.Downstream ? col.toColumn : fromCol;
          const columnTags = columnFqn ? columnTagMap.get(columnFqn) ?? [] : [];

          acc.push({
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
    }

    return acc;
  }, []);
};

export const prepareDownstreamColumnLevelNodesFromDownstreamEdges = (
  edges: EdgeDetails[],
  nodes: Record<string, LineageNodeType>
) => {
  return prepareColumnLevelNodesFromEdges(
    edges,
    nodes,
    LineageDirection.Downstream
  );
};

export const prepareUpstreamColumnLevelNodesFromUpstreamEdges = (
  edges: EdgeDetails[],
  nodes: Record<string, LineageNodeType>
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
