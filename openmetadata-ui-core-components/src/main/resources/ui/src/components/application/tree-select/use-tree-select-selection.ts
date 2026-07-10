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
import { useCallback, useMemo, useState } from 'react';
import type { TreeSelectNode } from './tree-select.types';

interface UseTreeSelectSelectionOptions<T> {
  multiple?: boolean;
  cascadeSelection?: boolean;
  treeData: TreeSelectNode<T>[];
  onChange?: (value: TreeSelectNode<T> | TreeSelectNode<T>[] | null) => void;
}

interface UseTreeSelectSelectionReturn<T> {
  selectedData: TreeSelectNode<T>[];
  isNodeSelected: (nodeId: string) => boolean;
  toggleNodeSelection: (
    node: TreeSelectNode<T>,
    parentNode?: TreeSelectNode<T>
  ) => void;
  setSelection: (nodes: TreeSelectNode<T>[]) => void;
  clearSelection: () => void;
  removeLastSelectedOption: () => void;
}

const getAllChildrenIds = <T>(node: TreeSelectNode<T>): string[] => {
  const ids = [node.id];
  node.children?.forEach((child) => ids.push(...getAllChildrenIds(child)));

  return ids;
};

const collectNodes = <T>(node: TreeSelectNode<T>): TreeSelectNode<T>[] => {
  const nodes = [node];
  node.children?.forEach((child) => nodes.push(...collectNodes(child)));

  return nodes;
};

const findParentNode = <T>(
  nodeId: string,
  nodes: TreeSelectNode<T>[]
): TreeSelectNode<T> | null => {
  for (const node of nodes) {
    if (node.children) {
      if (node.children.some((child) => child.id === nodeId)) {
        return node;
      }
      const found = findParentNode(nodeId, node.children);
      if (found) {
        return found;
      }
    }
  }

  return null;
};

export const useTreeSelectSelection = <T = unknown>({
  multiple = false,
  cascadeSelection = false,
  treeData,
  onChange,
}: UseTreeSelectSelectionOptions<T>): UseTreeSelectSelectionReturn<T> => {
  const [selectedNodes, setSelectedNodes] = useState<
    Map<string, TreeSelectNode<T>>
  >(new Map());

  const notify = useCallback(
    (next: Map<string, TreeSelectNode<T>>) => {
      if (!onChange) {
        return;
      }
      const nextData = Array.from(next.values());
      onChange(multiple ? nextData : nextData[0] ?? null);
    },
    [multiple, onChange]
  );

  const toggleNodeSelection = useCallback(
    (node: TreeSelectNode<T>, parentNode?: TreeSelectNode<T>) => {
      const next = new Map(selectedNodes);
      const isSelected = selectedNodes.has(node.id);

      if (!multiple) {
        next.clear();
        if (!isSelected) {
          next.set(node.id, node);
        }
      } else if (node.isParentMutuallyExclusive) {
        const parent = parentNode ?? findParentNode(node.id, treeData);
        parent?.children?.forEach((sibling) => {
          if (sibling.id !== node.id) {
            next.delete(sibling.id);
          }
        });
        if (isSelected) {
          next.delete(node.id);
        } else {
          next.set(node.id, node);
        }
      } else if (cascadeSelection) {
        if (isSelected) {
          getAllChildrenIds(node).forEach((id) => next.delete(id));
        } else {
          collectNodes(node).forEach((n) => next.set(n.id, n));
        }
      } else if (isSelected) {
        next.delete(node.id);
      } else {
        next.set(node.id, node);
      }

      setSelectedNodes(next);
      notify(next);
    },
    [selectedNodes, multiple, cascadeSelection, treeData, notify]
  );

  const setSelection = useCallback((nodes: TreeSelectNode<T>[]) => {
    setSelectedNodes(new Map(nodes.map((node) => [node.id, node])));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodes(new Map());
    onChange?.(multiple ? [] : null);
  }, [multiple, onChange]);

  const selectedData = useMemo(
    () => Array.from(selectedNodes.values()),
    [selectedNodes]
  );

  const removeLastSelectedOption = useCallback(() => {
    const last = selectedData[selectedData.length - 1];
    if (last) {
      toggleNodeSelection(last);
    }
  }, [selectedData, toggleNodeSelection]);

  return {
    selectedData,
    isNodeSelected: (nodeId: string) => selectedNodes.has(nodeId),
    toggleNodeSelection,
    setSelection,
    clearSelection,
    removeLastSelectedOption,
  };
};
