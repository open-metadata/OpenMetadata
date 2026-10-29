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

import { NavigationItem } from '../generated/system/ui/uiCustomization';
import { NavigationTreeNode } from '../interface/sidebar.interface';

export const getNavigationItems = (
  treeData: NavigationTreeNode[],
  hiddenKeys: string[]
): NavigationItem[] => {
  return treeData.map((item) => {
    return {
      id: item.key,
      title: item.title,
      isHidden: hiddenKeys.includes(item.key as string),
      children: getNavigationItems(item.children ?? [], hiddenKeys),
    } as NavigationItem;
  });
};

// Icons are React components, so clone the hierarchy without serializing them.
const structuredCloneNavigation = (
  nodes: NavigationTreeNode[]
): NavigationTreeNode[] =>
  nodes.map((node) => ({
    ...node,
    children: node.children
      ? structuredCloneNavigation(node.children)
      : undefined,
  }));

export const moveNavigationItem = (
  treeData: NavigationTreeNode[],
  sourceKey: string,
  targetKey: string | undefined,
  dropPosition: 'before' | 'after' | 'on'
): NavigationTreeNode[] => {
  const next = structuredCloneNavigation(treeData);
  const find = (
    nodes: NavigationTreeNode[],
    key: string
  ): { nodes: NavigationTreeNode[]; index: number } | undefined => {
    for (let index = 0; index < nodes.length; index++) {
      if (nodes[index].key === key) {
        return { nodes, index };
      }
      const found = find(nodes[index].children ?? [], key);
      if (found) {
        return found;
      }
    }

    return undefined;
  };
  const source = find(next, sourceKey);
  if (!source || sourceKey === targetKey) {
    return treeData;
  }
  const [item] = source.nodes.splice(source.index, 1);
  if (targetKey === undefined) {
    next.push(item);

    return next;
  }
  // Removing the source also removes its descendants; an absent target therefore
  // rejects dropping a parent into its own subtree without losing any items.
  const target = find(next, targetKey);
  if (!target) {
    return treeData;
  }
  if (dropPosition === 'on') {
    const parent = target.nodes[target.index];
    parent.children = [item, ...(parent.children ?? [])];
  } else {
    target.nodes.splice(
      target.index + (dropPosition === 'after' ? 1 : 0),
      0,
      item
    );
  }

  return next;
};
