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
import type { Config } from '@react-awesome-query-builder/ui';
import { Utils as QbUtils } from '@react-awesome-query-builder/ui';
import { isEmpty } from 'lodash';
import type { QueryFilterInterface } from '../../interface/queryFilter.interface';
import { getJsonTreeFromQueryFilter } from '../QueryBuilderPureUtils';
import { getExplorePath } from '../RouterUtils';

/** RAQB's group key for custom properties. */
const EXTENSION_FIELD = 'extension';

/**
 * Extra query-string parameters describing a builder filter, for an Explore
 * deep link.
 */
export const buildExploreUrlParams = (
  tree: unknown,
  qFilter?: QueryFilterInterface
): Record<string, string> => {
  const params: Record<string, string> = {};

  if (!isEmpty(tree)) {
    params.queryFilter = JSON.stringify(tree);
  }

  if (qFilter && !isEmpty(qFilter) && qFilter.query) {
    params.quickFilter = JSON.stringify(qFilter);
  }

  return params;
};

/**
 * Rewrites custom-property field keys into the shape Explore understands.
 *
 * A builder pinned to one entity type keys them without that segment
 * (`extension.testCp.keyword`); Explore, which offers every entity type, nests
 * them one level deeper (`extension.table.testCp.keyword`). Explore validates
 * a deep-linked tree against its own config and silently resets when a field is
 * unknown — so an un-rewritten link landed on the unfiltered estate with no
 * advanced-search chip.
 */
/**
 * RAQB's own `JsonItem` is a union whose members disagree about `properties`
 * and `children1`, so the walk uses a structural shape instead.
 */
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
  queryFilter: QueryFilterInterface,
  config: Config
): string => {
  const tree = QbUtils.sanitizeTree(
    QbUtils.loadTree(getJsonTreeFromQueryFilter(queryFilter)),
    config
  ).fixedTree;
  // Explore reads the tree, not the Elasticsearch filter, so the field keys
  // have to be ones Explore's own config recognises.
  const entityType = (config.settings as { omEntityType?: string })
    .omEntityType;
  const jsonTree = QbUtils.getTree(tree) as unknown as TreeNode;
  const exploreTree = withExploreFieldKeys(jsonTree, entityType);

  return getExplorePath({
    extraParameters: buildExploreUrlParams(exploreTree, queryFilter),
  });
};
