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
import type { QueryFilterInterface } from '../../interface/queryFilter.interface';
import { getExplorePath } from '../RouterUtils';

// RAQB's group key for custom properties.
const EXTENSION_FIELD = 'extension';

// The `queryFilter` param for an Explore link. Explore reads its advanced search as a root conjunction over groups,
// so a filter from a single-group builder becomes one group under an AND root: the modal then shows that builder's
// rules as they were, and searches with the same filter.
// ADR:2026-11-19-explore-urls-carry-the-elasticsearch-filter-not-the-tree
export const getExploreQueryFilterParam = (
  queryFilter: QueryFilterInterface
): string => JSON.stringify({ query: { bool: { must: [queryFilter.query] } } });

// Extra query-string parameters describing a builder filter, for an Explore deep link: the builder's own filter opens
// as the Advanced Search, and the filter the builder searched with (scoped to its entity type) applies as the quick
// filter — scoping a filter can nest its group inside another, which the Advanced Search cannot show.
export const buildExploreUrlParams = (
  builderFilter?: QueryFilterInterface,
  scopedFilter: QueryFilterInterface | undefined = builderFilter
): Record<string, string> =>
  builderFilter?.query
    ? {
        queryFilter: getExploreQueryFilterParam(builderFilter),
        quickFilter: JSON.stringify(scopedFilter),
      }
    : {};

// Rewrites custom-property field keys into the shape Explore understands.
// RAQB's own `JsonItem` is a union whose members disagree about `properties` and `children1`, so the walk uses a
// structural shape instead.
export type TreeNode = {
  properties?: { field?: string } & Record<string, unknown>;
  children1?: Record<string, TreeNode> | TreeNode[];
} & Record<string, unknown>;

const rewriteNode = (
  node: TreeNode,
  prefix: string,
  entityType: string
): TreeNode => {
  const field = node.properties?.field;
  const needsEntitySegment =
    typeof field === 'string' &&
    field.startsWith(prefix) &&
    !field.startsWith(`${prefix}${entityType}.`);

  const children = node.children1;
  let rewrittenChildren: TreeNode['children1'];

  if (Array.isArray(children)) {
    rewrittenChildren = children.map((child) =>
      rewriteNode(child, prefix, entityType)
    );
  } else if (children) {
    rewrittenChildren = Object.fromEntries(
      Object.entries(children).map(([id, child]) => [
        id,
        rewriteNode(child, prefix, entityType),
      ])
    );
  }

  return {
    ...node,
    ...(needsEntitySegment && {
      properties: {
        ...node.properties,
        field: `${prefix}${entityType}.${(field as string).slice(
          prefix.length
        )}`,
      },
    }),
    ...(rewrittenChildren && { children1: rewrittenChildren }),
  };
};

export const withExploreFieldKeys = (
  tree: TreeNode,
  entityType?: string
): TreeNode =>
  entityType ? rewriteNode(tree, `${EXTENSION_FIELD}.`, entityType) : tree;

export const getQueryBuilderExploreUrl = (
  builderFilter: QueryFilterInterface,
  scopedFilter?: QueryFilterInterface
): string =>
  getExplorePath({
    extraParameters: buildExploreUrlParams(builderFilter, scopedFilter),
  });
