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

import { MutableRefObject, useCallback } from 'react';
import { TreeNode } from '../../atoms/asyncTreeSelect/types';

interface UseTreeKeyboardNavigationProps {
  treeApiRef: MutableRefObject<any>;
  focusedItemId: string | null;
  setFocusedItemId: (id: string | null) => void;
  getVisibleNodes: () => TreeNode[];
  expandedNodes: Set<string>;
  toggleNodeExpansion: (nodeId: string) => void;
  treeData: TreeNode[];
  inputRef: MutableRefObject<HTMLInputElement | null>;
  handleNodeClick: (node: TreeNode) => void;
  onOpenDropdown: () => void;
  onCloseDropdown: () => void;
}

export const useTreeKeyboardNavigation = ({
  treeApiRef,
  focusedItemId,
  setFocusedItemId,
  getVisibleNodes,
  expandedNodes,
  toggleNodeExpansion,
  inputRef,
  handleNodeClick,
  onOpenDropdown,
  onCloseDropdown,
}: UseTreeKeyboardNavigationProps) => {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const visibleNodes = getVisibleNodes();

      if (visibleNodes.length === 0) {
        return;
      }

      // Get current focused item index
      const currentIndex = focusedItemId
        ? visibleNodes.findIndex((n) => n.id === focusedItemId)
        : -1;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          if (!focusedItemId || currentIndex === -1) {
            // Open dropdown and focus first item
            onOpenDropdown();
            const firstNode = visibleNodes[0];
            if (firstNode) {
              setFocusedItemId(firstNode.id);
              // Ensure input stays focused
              inputRef.current?.focus();
            }
          } else {
            // Move to next item
            const nextIndex =
              currentIndex < visibleNodes.length - 1 ? currentIndex + 1 : 0;
            const nextNode = visibleNodes[nextIndex];
            setFocusedItemId(nextNode.id);
            // Ensure input stays focused
            inputRef.current?.focus();
          }

          break;

        case 'ArrowUp':
          event.preventDefault();
          if (focusedItemId && currentIndex >= 0) {
            // Move to previous item
            const prevIndex =
              currentIndex > 0 ? currentIndex - 1 : visibleNodes.length - 1;
            const prevNode = visibleNodes[prevIndex];
            setFocusedItemId(prevNode.id);
            // Ensure input stays focused
            inputRef.current?.focus();
          }

          break;

        case 'ArrowRight':
          if (focusedItemId && currentIndex >= 0) {
            event.preventDefault();
            const node = visibleNodes[currentIndex];
            if (node.children && node.children.length > 0) {
              if (!expandedNodes.has(node.id)) {
                // Expand the node
                toggleNodeExpansion(node.id);
                treeApiRef.current?.setItemExpansion?.(event, node.id, true);
              } else {
                // Move to first child - need to get updated visible nodes after expansion
                const updatedVisibleNodes = getVisibleNodes();
                const childIndex = updatedVisibleNodes.findIndex(
                  (n) => n.parent === node.id
                );
                if (childIndex >= 0) {
                  const firstChild = updatedVisibleNodes[childIndex];
                  setFocusedItemId(firstChild.id);
                  // Ensure input stays focused
                  inputRef.current?.focus();
                }
              }
            }
          }

          break;

        case 'ArrowLeft':
          if (focusedItemId && currentIndex >= 0) {
            event.preventDefault();
            const node = visibleNodes[currentIndex];
            if (expandedNodes.has(node.id)) {
              // Collapse the node
              toggleNodeExpansion(node.id);
              treeApiRef.current?.setItemExpansion?.(event, node.id, false);
            } else if (node.parent) {
              // Move to parent
              const parentNode = visibleNodes.find((n) => n.id === node.parent);
              if (parentNode) {
                setFocusedItemId(parentNode.id);
                // Ensure input stays focused
                inputRef.current?.focus();
              }
            }
          }

          break;

        case 'Enter':
        case ' ':
          if (focusedItemId && currentIndex >= 0) {
            event.preventDefault();
            const node = visibleNodes[currentIndex];
            if (node.allowSelection !== false) {
              handleNodeClick(node);
              // Ensure input stays focused
              inputRef.current?.focus();
            }
          }

          break;

        case 'Escape':
          event.preventDefault();
          onCloseDropdown();

          break;

        default:
          break;
      }
    },
    [
      treeApiRef,
      focusedItemId,
      setFocusedItemId,
      getVisibleNodes,
      expandedNodes,
      toggleNodeExpansion,
      inputRef,
      handleNodeClick,
      onOpenDropdown,
      onCloseDropdown,
    ]
  );

  return {
    handleKeyDown,
  };
};
