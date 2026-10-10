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

import { cloneDeep } from 'lodash';
import type { getTreeDataForNavigationItems } from '../../../../../../../utils/CustomizaNavigation/CustomizeNavigation';

export type NavigationTreeNode = ReturnType<
  typeof getTreeDataForNavigationItems
>[number];

export type NavDropPosition = 'before' | 'after' | 'on';

/** Remove the node with `key` (and its subtree) from `nodes`, returning it. */
const takeNode = (
  nodes: NavigationTreeNode[],
  key: string
): NavigationTreeNode | undefined => {
  for (let i = 0; i < nodes.length; i++) {
    if (String(nodes[i].key) === key) {
      return nodes.splice(i, 1)[0];
    }
    const children = nodes[i].children;
    if (children) {
      const found = takeNode(children, key);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
};

/** Insert `node` relative to `targetKey`; returns false if the target is gone. */
const insertNode = (
  nodes: NavigationTreeNode[],
  node: NavigationTreeNode,
  targetKey: string,
  position: NavDropPosition
): boolean => {
  for (let i = 0; i < nodes.length; i++) {
    if (String(nodes[i].key) === targetKey) {
      if (position === 'on') {
        nodes[i].children = [node, ...(nodes[i].children ?? [])];
      } else {
        nodes.splice(position === 'before' ? i : i + 1, 0, node);
      }

      return true;
    }
    const children = nodes[i].children;
    if (children && insertNode(children, node, targetKey, position)) {
      return true;
    }
  }

  return false;
};

/**
 * Reorder the navigation tree: move `sourceKey` next to / into `targetKey`.
 * A drop that can't locate the target (or onto itself) returns the tree
 * unchanged.
 */
export const moveNavNode = (
  tree: NavigationTreeNode[],
  sourceKey: string,
  targetKey: string,
  position: NavDropPosition
): NavigationTreeNode[] => {
  if (sourceKey === targetKey) {
    return tree;
  }
  const next = cloneDeep(tree);
  const node = takeNode(next, sourceKey);
  if (!node || !insertNode(next, node, targetKey, position)) {
    return tree;
  }

  return next;
};

/** Move `sourceKey` to the end of the root level. */
export const moveNavNodeToRoot = (
  tree: NavigationTreeNode[],
  sourceKey: string
): NavigationTreeNode[] => {
  const next = cloneDeep(tree);
  const node = takeNode(next, sourceKey);
  if (!node) {
    return tree;
  }
  next.push(node);

  return next;
};

/** Keys of every node that has children (for default-expanded state). */
export const getParentKeys = (tree: NavigationTreeNode[]): string[] =>
  tree.flatMap((node) =>
    node.children?.length
      ? [String(node.key), ...getParentKeys(node.children)]
      : []
  );
