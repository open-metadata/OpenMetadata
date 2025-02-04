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
import { DataNode } from 'antd/lib/tree';
import { NavigationItem } from '../../generated/system/ui/uiCustomization';

export const filterAndArrangeTreeByKeys = <
  T extends { key: string | number; children?: T[] }
>(
  tree: T[],
  keys: Array<string | number>
): T[] => {
  // Sort nodes according to the keys order
  function sortByKeys(nodeArray: T[]) {
    return nodeArray.sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
  }

  // Helper function to recursively filter and arrange the tree
  function filterAndArrange(node: T) {
    // If the current node's key is in the keys array, process it
    if (keys.includes(node.key)) {
      // If the node has children, we recursively filter and arrange them
      if (node.children && node.children.length > 0) {
        node.children = node.children
          .map(filterAndArrange) // Recursively filter and arrange children
          .filter((t): t is T => t !== null); // Remove any undefined children

        // Sort the children according to the order of the keys array
        node.children = sortByKeys(node.children);
      }

      return node; // Return the node if it has the required key
    }

    return null; // Return null if the key doesn't match
  }

  // Apply the filter and arrange function to the entire tree
  let filteredTree = tree
    .map(filterAndArrange)
    .filter((t): t is T => t !== null);

  // Sort the filtered tree based on the order of keys at the root level
  filteredTree = sortByKeys(filteredTree);

  return filteredTree;
};

export const getNestedKeys = <
  T extends { key: string | number; children?: T[] }
>(
  data: T[]
): string[] =>
  data.reduce((acc: string[], item: T): string[] => {
    if (item.children) {
      return [
        ...acc,
        item.key as string,
        ...getNestedKeys(item.children ?? []),
      ];
    }

    return [...acc, item.key as string];
  }, [] as string[]);

export const getNavigationItems = (items: DataNode[]): NavigationItem[] =>
  items
    .map((item) =>
      item.children
        ? ({
            id: item.key,
            title: item.title,
            pageId: item.key,
            children: getNavigationItems(item.children),
          } as NavigationItem)
        : ({
            id: item.key,
            title: item.title,
            pageId: item.key,
          } as NavigationItem)
    )
    .filter(Boolean);

export const getNestedKeysFromNavigationItems = (data: NavigationItem[]) =>
  data.reduce((acc: string[], item: NavigationItem): string[] => {
    if (item.children) {
      return [
        ...acc,
        item.id,
        ...getNestedKeysFromNavigationItems(item.children),
      ];
    }

    return [...acc, item.id];
  }, [] as string[]);
