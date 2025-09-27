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

import { useCallback, useMemo, useState } from 'react';
import { TreeNode, TreeSelectionState } from './types';

interface UseTreeSelectionOptions<T> {
  multiple?: boolean;
  cascadeSelection?: boolean;
  defaultSelected?: string[];
  treeData: TreeNode<T>[];
  onSelectionChange?: (selected: TreeNode<T> | TreeNode<T>[] | null) => void;
}

export const useTreeSelection = <T = unknown,>({
  multiple = false,
  cascadeSelection = false,
  // defaultSelected = [], // TODO: Implement proper defaultSelected handling with Map
  treeData,
  onSelectionChange,
}: UseTreeSelectionOptions<T>): TreeSelectionState<T> => {
  const [selectedNodes, setSelectedNodes] = useState<Map<string, TreeNode<T>>>(
    new Map()
  );

  const findNodeById = useCallback(
    (nodeId: string, nodes: TreeNode<T>[]): TreeNode<T> | null => {
      for (const node of nodes) {
        if (node.id === nodeId) {
          return node;
        }
        if (node.children) {
          const found = findNodeById(nodeId, node.children);
          if (found) {
            return found;
          }
        }
      }

      return null;
    },
    []
  );

  const getAllChildrenIds = useCallback((node: TreeNode<T>): string[] => {
    const ids: string[] = [node.id];
    if (node.children) {
      node.children.forEach((child) => {
        ids.push(...getAllChildrenIds(child));
      });
    }

    return ids;
  }, []);

  const getParentNode = useCallback(
    (nodeId: string, nodes: TreeNode<T>[]): TreeNode<T> | null => {
      for (const node of nodes) {
        if (node.children) {
          const childIds = node.children.map((c) => c.id);
          if (childIds.includes(nodeId)) {
            return node;
          }
          const foundParent = getParentNode(nodeId, node.children);
          if (foundParent) {
            return foundParent;
          }
        }
      }

      return null;
    },
    []
  );

  const toggleNodeSelection = useCallback(
    (node: TreeNode<T>) => {
      const newSelectedNodes = new Map(selectedNodes);
      const nodeId = node.id;
      const isSelected = selectedNodes.has(nodeId);

      if (multiple) {
        if (cascadeSelection) {
          // Cascade selection mode: select/deselect node and all children
          if (isSelected) {
            // Deselect node and all children
            const childrenIds = getAllChildrenIds(node);
            childrenIds.forEach((id) => newSelectedNodes.delete(id));
          } else {
            // Select node and all children - need to find nodes to store full data
            const collectNodes = (n: TreeNode<T>): TreeNode<T>[] => {
              const nodes = [n];
              if (n.children) {
                n.children.forEach((child) =>
                  nodes.push(...collectNodes(child))
                );
              }

              return nodes;
            };
            const nodesToSelect = collectNodes(node);
            nodesToSelect.forEach((n) => newSelectedNodes.set(n.id, n));
          }

          // Update parent selection state - simplified for now
          // TODO: Implement cascade parent logic with Map
        } else {
          // Independent selection mode: only toggle the clicked node
          if (isSelected) {
            newSelectedNodes.delete(nodeId);
          } else {
            newSelectedNodes.set(nodeId, node);
          }
        }
      } else {
        // Single selection mode
        newSelectedNodes.clear();
        if (!isSelected) {
          newSelectedNodes.set(nodeId, node);
        }
      }

      setSelectedNodes(newSelectedNodes);

      // Notify parent component
      if (onSelectionChange) {
        const selectedData = Array.from(newSelectedNodes.values());

        if (multiple) {
          onSelectionChange(selectedData);
        } else {
          onSelectionChange(selectedData.length > 0 ? selectedData[0] : null);
        }
      }
    },
    [
      selectedNodes,
      multiple,
      cascadeSelection,
      treeData,
      getAllChildrenIds,
      getParentNode,
      findNodeById,
      onSelectionChange,
    ]
  );

  const isNodeSelected = useCallback(
    (nodeId: string) => selectedNodes.has(nodeId),
    [selectedNodes]
  );

  const clearSelection = useCallback(() => {
    setSelectedNodes(new Map());
    onSelectionChange?.(multiple ? [] : null);
  }, [multiple, onSelectionChange]);

  const selectAll = useCallback(() => {
    const allNodesMap = new Map<string, TreeNode<T>>();
    const collectAllNodes = (nodes: TreeNode<T>[]) => {
      nodes.forEach((node) => {
        allNodesMap.set(node.id, node);
        if (node.children) {
          collectAllNodes(node.children);
        }
      });
    };
    collectAllNodes(treeData);

    setSelectedNodes(allNodesMap);

    if (onSelectionChange && multiple) {
      onSelectionChange(Array.from(allNodesMap.values()));
    }
  }, [treeData, multiple, onSelectionChange]);

  // Memoize selectedData to prevent unnecessary re-renders
  const selectedData = useMemo(
    () => Array.from(selectedNodes.values()),
    [selectedNodes]
  );

  const getSelectedNodes = useCallback(() => selectedData, [selectedData]);

  const removeLastSelectedOption = useCallback(() => {
    if (selectedData.length > 0) {
      const lastNode = selectedData[selectedData.length - 1];
      toggleNodeSelection(lastNode);
    }
  }, [selectedData, toggleNodeSelection]);

  return {
    selectedNodes,
    selectedData,
    isNodeSelected,
    toggleNodeSelection,
    clearSelection,
    selectAll,
    getSelectedNodes,
    removeLastSelectedOption,
  };
};
