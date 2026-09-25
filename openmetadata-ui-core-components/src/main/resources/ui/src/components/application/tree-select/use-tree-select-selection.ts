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
import { useCallback, useMemo, useRef, useState } from 'react';
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
  /** Selected vs selectable descendants, for a parent's checked/partial state. */
  getDescendantSelection: (node: TreeSelectNode<T>) => DescendantSelection;
  toggleNodeSelection: (
    node: TreeSelectNode<T>,
    parentNode?: TreeSelectNode<T>
  ) => void;
  setSelection: (nodes: TreeSelectNode<T>[]) => void;
  clearSelection: () => void;
  removeLastSelectedOption: () => void;
}

export interface DescendantSelection {
  selected: number;
  total: number;
  hasLoadedChildren: boolean;
}

// A loaded branch's children decide the row outright; unexpanded, its own membership does.
export const getNodeSelectionState = (
  { selected, total, hasLoadedChildren }: DescendantSelection,
  isSelected: boolean
) => {
  const isFullySelected = hasLoadedChildren
    ? selected === total
    : isSelected || (total > 0 && selected === total);

  return {
    isFullySelected,
    isPartiallySelected: !isFullySelected && selected > 0,
  };
};

const getAllChildrenIds = <T>(node: TreeSelectNode<T>): string[] => {
  const ids = [node.id];
  node.children?.forEach((child) => ids.push(...getAllChildrenIds(child)));

  return ids;
};

// A node whose children are mutually exclusive: it renders no control of its own.
export const hasExclusiveChildren = <T>(node: TreeSelectNode<T>): boolean =>
  node.hasExclusiveChildren ??
  node.children?.some((child) => child.isParentMutuallyExclusive) ??
  false;

// A cascade cannot choose between mutually exclusive siblings, so it stops at
// them and at the group node above them, which is not selectable either.
const collectNodes = <T>(node: TreeSelectNode<T>): TreeSelectNode<T>[] => {
  const nodes = [node];
  node.children
    ?.filter(
      (child) =>
        !child.isParentMutuallyExclusive && !hasExclusiveChildren(child)
    )
    .forEach((child) => nodes.push(...collectNodes(child)));

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
  const parentOfSelected = useRef<Map<string, string>>(new Map());
  // Read inside stable callbacks, so their identity never depends on the tree.
  const treeDataRef = useRef(treeData);
  treeDataRef.current = treeData;

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
        if (parent) {
          // A search-filtered tree can drop a seeded sibling, so fall back to
          // its own hint and then to whatever parent was discovered earlier.
          next.forEach((selected, selectedId) => {
            if (selectedId === node.id) {
              return;
            }
            const selectedParent =
              selected.parentId ??
              parentOfSelected.current.get(selectedId) ??
              findParentNode(selectedId, treeDataRef.current)?.id;
            if (selectedParent === parent.id) {
              next.delete(selectedId);
            }
          });
          parentOfSelected.current.set(node.id, parent.id);
        }
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
    // Keep parents discovered earlier — a search-filtered tree cannot re-resolve
    // them — and drop only the entries no longer selected.
    const parents = new Map(parentOfSelected.current);
    const ids = new Set(nodes.map((node) => node.id));
    parents.forEach((_parentId, id) => {
      if (!ids.has(id)) {
        parents.delete(id);
      }
    });
    nodes.forEach((node) => {
      const parentId =
        node.parentId ?? findParentNode(node.id, treeDataRef.current)?.id;
      if (parentId) {
        parents.set(node.id, parentId);
      }
    });
    parentOfSelected.current = parents;
    setSelectedNodes(new Map(nodes.map((node) => [node.id, node])));
  }, []);

  const getDescendantSelection = useCallback(
    (node: TreeSelectNode<T>) => {
      let loadedTotal = 0;
      const selectedIds = new Set<string>();
      const walk = (current: TreeSelectNode<T>) => {
        current.children?.forEach((child) => {
          if (child.allowSelection !== false) {
            loadedTotal += 1;
            if (selectedNodes.has(child.id)) {
              selectedIds.add(child.id);
            }
          }
          walk(child);
        });
      };
      walk(node);

      // A collapsed branch has nothing to walk, so count selections naming it as parent.
      selectedNodes.forEach((selected, id) => {
        if (selected.parentId === node.id) {
          selectedIds.add(id);
        }
      });

      return {
        selected: selectedIds.size,
        // Loaded children reflect pruning, but a truncated page must defer to the badge.
        total:
          loadedTotal > 0 && !node.hasMoreChildren
            ? loadedTotal
            : node.count ?? loadedTotal,
        hasLoadedChildren: loadedTotal > 0,
      };
    },
    [selectedNodes]
  );

  const clearSelection = useCallback(() => {
    parentOfSelected.current = new Map();
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

  const isNodeSelected = useCallback(
    (nodeId: string) => selectedNodes.has(nodeId),
    [selectedNodes]
  );

  return {
    selectedData,
    isNodeSelected,
    getDescendantSelection,
    toggleNodeSelection,
    setSelection,
    clearSelection,
    removeLastSelectedOption,
  };
};
