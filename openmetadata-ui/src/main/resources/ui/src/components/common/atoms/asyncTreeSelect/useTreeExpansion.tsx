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

import { useCallback, useState } from 'react';
import { TreeExpansionState, TreeNode } from './types';

interface UseTreeExpansionOptions<T> {
  defaultExpanded?: string[];
  treeData: TreeNode<T>[];
  onNodeExpand?: (nodeId: string) => void;
  onNodeCollapse?: (nodeId: string) => void;
}

export const useTreeExpansion = <T = unknown,>({
  defaultExpanded = [],
  treeData,
  onNodeExpand,
  onNodeCollapse,
}: UseTreeExpansionOptions<T>): TreeExpansionState => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(defaultExpanded)
  );

  const isNodeExpanded = useCallback(
    (nodeId: string) => expandedNodes.has(nodeId),
    [expandedNodes]
  );

  const toggleNodeExpansion = useCallback(
    (nodeId: string) => {
      setExpandedNodes((prev) => {
        const newExpanded = new Set(prev);
        if (newExpanded.has(nodeId)) {
          newExpanded.delete(nodeId);
          onNodeCollapse?.(nodeId);
        } else {
          newExpanded.add(nodeId);
          onNodeExpand?.(nodeId);
        }

        return newExpanded;
      });
    },
    [onNodeExpand, onNodeCollapse]
  );

  const expandAll = useCallback(() => {
    const allNodeIds: string[] = [];
    const collectAllIds = (nodes: TreeNode<T>[]) => {
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          allNodeIds.push(node.id);
          collectAllIds(node.children);
        }
      });
    };
    collectAllIds(treeData);
    setExpandedNodes(new Set(allNodeIds));
  }, [treeData]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  const expandPath = useCallback((path: string[]) => {
    setExpandedNodes((prev) => {
      const newExpanded = new Set(prev);
      path.forEach((nodeId) => newExpanded.add(nodeId));

      return newExpanded;
    });
  }, []);

  return {
    expandedNodes,
    isNodeExpanded,
    toggleNodeExpansion,
    expandAll,
    collapseAll,
    expandPath,
  };
};
