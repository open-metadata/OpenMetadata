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
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TreeSelectNode } from './tree-select.types';

interface UseTreeSelectSearchOptions {
  debounceMs?: number;
  onSearch?: (searchTerm: string) => void;
}

interface UseTreeSelectSearchReturn {
  /** Debounced value — drives the async fetchData({ searchTerm }) call. */
  searchTerm: string;
  /** Raw, un-debounced input value — drives what the text box displays. */
  inputValue: string;
  setInputValue: (value: string) => void;
  clearSearch: () => void;
}

/** Debounces free-text input into a search term used to drive fetchData. */
export const useTreeSelectSearch = ({
  debounceMs = 300,
  onSearch,
}: UseTreeSelectSearchOptions): UseTreeSelectSearchReturn => {
  const [rawInputValue, setRawInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(
    () => () => clearTimeout(debounceTimerRef.current),

    []
  );

  const setInputValue = useCallback(
    (value: string) => {
      setRawInputValue(value);
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        setSearchTerm(value);
        onSearch?.(value);
      }, debounceMs);
    },
    [debounceMs, onSearch]
  );

  const clearSearch = useCallback(() => {
    clearTimeout(debounceTimerRef.current);
    setRawInputValue('');
    setSearchTerm('');
    onSearch?.('');
  }, [onSearch]);

  return { searchTerm, inputValue: rawInputValue, setInputValue, clearSearch };
};

const defaultFilterNode = <T>(node: TreeSelectNode<T>, term: string) =>
  node.label.toLowerCase().includes(term.toLowerCase());

/**
 * Pure client-side visibility computation over already-loaded tree data.
 * A node (and its ancestors) stay visible if it matches, or any descendant matches.
 */
export const getVisibleNodeIds = <T>(
  treeData: TreeSelectNode<T>[],
  searchTerm: string,
  filterNode?: (node: TreeSelectNode<T>, searchTerm: string) => boolean
): Set<string> | null => {
  if (!searchTerm) {
    return null;
  }

  const visible = new Set<string>();
  const filterFn = filterNode ?? defaultFilterNode;

  const walk = (nodes: TreeSelectNode<T>[], ancestors: string[]): boolean => {
    let hasVisibleChild = false;
    nodes.forEach((node) => {
      const matches = filterFn(node, searchTerm);
      const childVisible = node.children
        ? walk(node.children, [...ancestors, node.id])
        : false;

      if (matches || childVisible) {
        visible.add(node.id);
        ancestors.forEach((id) => visible.add(id));
        hasVisibleChild = true;
      }
    });

    return hasVisibleChild;
  };

  walk(treeData, []);

  return visible;
};
