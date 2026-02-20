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

import { useCallback, useEffect, useState } from 'react';
import { AsyncTreeSelectOptions, TreeNode } from './types';
import { useTreeData } from './useTreeData';
import { useTreeExpansion } from './useTreeExpansion';
import { useTreeSearch } from './useTreeSearch';
import { useTreeSelection } from './useTreeSelection';
import { useTreeVirtualization } from './useTreeVirtualization';

export interface UseAsyncTreeSelectReturn<T> {
  // Data
  treeData: TreeNode<T>[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  loadChildren: (parentId: string) => Promise<void>;

  // Selection
  selectedNodes: Map<string, TreeNode<T>>;
  selectedData: TreeNode<T>[];
  isNodeSelected: (nodeId: string) => boolean;
  toggleNodeSelection: (node: TreeNode<T>) => void;
  clearSelection: () => void;
  selectAll: () => void;
  removeLastSelectedOption: () => void;

  // Expansion
  expandedNodes: Set<string>;
  isNodeExpanded: (nodeId: string) => boolean;
  toggleNodeExpansion: (nodeId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;

  // Search
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  clearSearch: () => void;
  isNodeVisible: (nodeId: string) => boolean;
  highlightedNode: string | null;

  // Virtualization
  isVirtualized: boolean;
  virtualItems: unknown[];

  // Loading states
  loadingNodes: Set<string>;
}

export const useAsyncTreeSelect = <T = unknown,>(
  options: AsyncTreeSelectOptions<T>
): UseAsyncTreeSelectReturn<T> => {
  const {
    multiple = false,
    cascadeSelection = false,
    searchable = true,
    pageSize = 50,
    lazyLoad = false,
    enableVirtualization = false,
    defaultExpanded = [],
    defaultSelected = [],
    fetchData,
    onSelectionChange,
    onNodeExpand,
    onNodeCollapse,
    filterNode,
  } = options;

  // Search term state management
  const [searchTerm, setSearchTerm] = useState('');

  // Data management
  const {
    treeData,
    loading,
    error,
    loadingNodes,
    refetch,
    loadChildren: loadChildrenData,
  } = useTreeData({
    fetchData,
    searchTerm,
    pageSize,
    lazyLoad,
  });

  // Selection management
  const {
    selectedNodes,
    selectedData,
    isNodeSelected,
    toggleNodeSelection,
    clearSelection,
    selectAll,
    removeLastSelectedOption,
  } = useTreeSelection({
    multiple,
    cascadeSelection,
    defaultSelected,
    treeData,
    onSelectionChange,
  });

  // Expansion management
  const {
    expandedNodes,
    isNodeExpanded,
    toggleNodeExpansion: toggleExpansion,
    expandAll,
    collapseAll,
    expandPath,
  } = useTreeExpansion({
    defaultExpanded,
    treeData,
    onNodeExpand,
    onNodeCollapse,
  });

  // Search functionality
  const { highlightedNode, clearSearch, isNodeVisible } = useTreeSearch({
    treeData,
    searchTerm,
    setSearchTerm,
    searchable,
    filterNode,
  });

  // Virtualization
  const { virtualItems, isVirtualized } = useTreeVirtualization({
    treeData,
    expandedNodes,
    enableVirtualization,
  });

  // Utility function to find a node in the tree
  const findNodeInTree = useCallback(
    (nodes: TreeNode<T>[], id: string): TreeNode<T> | null => {
      for (const node of nodes) {
        if (node.id === id) {
          return node;
        }
        if (node.children) {
          const found = findNodeInTree(node.children, id);
          if (found) {
            return found;
          }
        }
      }

      return null;
    },
    []
  );

  // Handle node expansion
  const handleNodeExpansion = useCallback(
    (nodeId: string) => {
      toggleExpansion(nodeId);
    },
    [toggleExpansion]
  );

  // Expand path to highlighted node when search changes
  useEffect(() => {
    if (highlightedNode && searchTerm) {
      const findPath = (
        nodes: TreeNode<T>[],
        targetId: string,
        path: string[] = []
      ): string[] | null => {
        for (const node of nodes) {
          if (node.id === targetId) {
            return path;
          }
          if (node.children) {
            const foundPath = findPath(node.children, targetId, [
              ...path,
              node.id,
            ]);
            if (foundPath) {
              return foundPath;
            }
          }
        }

        return null;
      };

      const path = findPath(treeData, highlightedNode);
      if (path) {
        expandPath(path);
      }
    }
  }, [highlightedNode, searchTerm, treeData, expandPath]);

  return {
    // Data
    treeData,
    loading,
    error,
    refetch,
    loadChildren: loadChildrenData,

    // Selection
    selectedNodes,
    selectedData,
    isNodeSelected,
    toggleNodeSelection,
    clearSelection,
    selectAll,
    removeLastSelectedOption,

    // Expansion
    expandedNodes,
    isNodeExpanded,
    toggleNodeExpansion: handleNodeExpansion,
    expandAll,
    collapseAll,

    // Search
    searchTerm,
    setSearchTerm,
    clearSearch,
    isNodeVisible,
    highlightedNode,

    // Virtualization
    isVirtualized,
    virtualItems,

    // Loading states
    loadingNodes,
  };
};
