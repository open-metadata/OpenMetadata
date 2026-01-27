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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TreeNode, TreeSearchState } from './types';

interface UseTreeSearchOptions<T> {
  treeData: TreeNode<T>[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchable?: boolean;
  filterNode?: (node: TreeNode<T>, searchTerm: string) => boolean;
}

export const useTreeSearch = <T = unknown,>({
  treeData,
  searchTerm,
  setSearchTerm,
  searchable = true,
  filterNode,
}: UseTreeSearchOptions<T>): TreeSearchState => {
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);

  const defaultFilterNode = useCallback(
    (node: TreeNode<T>, term: string): boolean => {
      const searchLower = term.toLowerCase();

      return node.label.toLowerCase().includes(searchLower);
    },
    []
  );

  const filteredNodes = useMemo(() => {
    if (!searchable || !searchTerm) {
      return new Set<string>();
    }

    const visibleNodes = new Set<string>();
    const filterFunction = filterNode || defaultFilterNode;

    const traverseAndFilter = (
      nodes: TreeNode<T>[],
      parentPath: string[] = []
    ): boolean => {
      let hasVisibleChild = false;

      nodes.forEach((node) => {
        const nodeMatches = filterFunction(node, searchTerm);
        let childrenVisible = false;

        if (node.children) {
          childrenVisible = traverseAndFilter(node.children, [
            ...parentPath,
            node.id,
          ]);
        }

        if (nodeMatches || childrenVisible) {
          visibleNodes.add(node.id);
          // Add all parent nodes to keep tree structure
          parentPath.forEach((parentId) => visibleNodes.add(parentId));
          hasVisibleChild = true;
        }
      });

      return hasVisibleChild;
    };

    traverseAndFilter(treeData);

    return visibleNodes;
  }, [treeData, searchTerm, searchable, filterNode, defaultFilterNode]);

  const isNodeVisible = useCallback(
    (nodeId: string): boolean => {
      if (!searchable || !searchTerm) {
        return true;
      }

      return filteredNodes.has(nodeId);
    },
    [filteredNodes, searchable, searchTerm]
  );

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setHighlightedNode(null);
  }, []);

  const findFirstMatch = useCallback(() => {
    if (!searchTerm || filteredNodes.size === 0) {
      return null;
    }

    const findFirst = (nodes: TreeNode<T>[]): string | null => {
      for (const node of nodes) {
        if (filteredNodes.has(node.id)) {
          const filterFunction = filterNode || defaultFilterNode;
          if (filterFunction(node, searchTerm)) {
            return node.id;
          }
        }
        if (node.children) {
          const found = findFirst(node.children);
          if (found) {
            return found;
          }
        }
      }

      return null;
    };

    return findFirst(treeData);
  }, [treeData, searchTerm, filteredNodes, filterNode, defaultFilterNode]);

  // Highlight first match when search term changes
  useEffect(() => {
    if (searchTerm) {
      const firstMatch = findFirstMatch();
      setHighlightedNode(firstMatch);
    } else {
      setHighlightedNode(null);
    }
  }, [searchTerm, findFirstMatch]);

  return {
    searchTerm,
    filteredNodes,
    highlightedNode,
    setSearchTerm,
    clearSearch,
    isNodeVisible,
  };
};
