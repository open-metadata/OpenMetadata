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

import { useCallback, useEffect, useRef, useState } from 'react';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  TreeDataFetcher,
  TreeDataFetcherParams,
  TreeNode,
  TreeState,
} from './types';

interface UseTreeDataOptions<T> {
  fetchData: TreeDataFetcher<T>;
  searchTerm?: string;
  pageSize?: number;
  lazyLoad?: boolean;
  initialData?: TreeNode<T>[];
}

interface UseTreeDataReturn<T> {
  treeData: TreeNode<T>[];
  loading: boolean;
  error: string | null;
  loadingNodes: Set<string>;
  refetch: () => Promise<void>;
  loadChildren: (parentId: string) => Promise<void>;
  clearCache: () => void;
  hasCache: (parentId: string) => boolean;
}

export const useTreeData = <T = unknown,>({
  fetchData,
  searchTerm = '',
  pageSize = 50,
  initialData = [],
}: UseTreeDataOptions<T>): UseTreeDataReturn<T> => {
  const [state, setState] = useState<TreeState<T>>({
    data: initialData,
    loading: false,
    error: null,
    searchTerm: '',
    expandedNodes: new Set(),
    selectedNodes: new Set(),
    loadingNodes: new Set(),
    cachedData: new Map(),
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchTreeData = useCallback(
    async (params: TreeDataFetcherParams) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      try {
        setState((prev) => ({
          ...prev,
          loading: !params.parentId,
          error: null,
          loadingNodes: params.parentId
            ? new Set([...prev.loadingNodes, params.parentId])
            : prev.loadingNodes,
        }));

        const response = await fetchData({
          ...params,
          pageSize,
        });

        setState((prev) => {
          const newState = { ...prev };

          if (params.parentId) {
            newState.cachedData = new Map(prev.cachedData);
            newState.cachedData.set(params.parentId, response.nodes);

            newState.data = insertChildrenIntoTree(
              prev.data,
              params.parentId,
              response.nodes
            );

            const updatedLoadingNodes = new Set(prev.loadingNodes);
            updatedLoadingNodes.delete(params.parentId);
            newState.loadingNodes = updatedLoadingNodes;
          } else {
            newState.data = response.nodes;
            if (!params.searchTerm) {
              newState.cachedData = new Map();
              newState.cachedData.set('root', response.nodes);
            }
          }

          newState.loading = false;

          return newState;
        });
      } catch (error) {
        if (!abortControllerRef.current?.signal.aborted) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to fetch tree data';

          setState((prev) => ({
            ...prev,
            loading: false,
            error: errorMessage,
            loadingNodes: params.parentId
              ? new Set(
                  [...prev.loadingNodes].filter((id) => id !== params.parentId)
                )
              : new Set(),
          }));

          showErrorToast(errorMessage);
        }
      }
    },
    [fetchData, pageSize]
  );

  useEffect(() => {
    if (searchTerm) {
      fetchTreeData({ searchTerm });
    } else {
      // Always fetch initial data when search is cleared (empty string)
      // Or when not in lazy load mode, or when there's no data yet
      fetchTreeData({ searchTerm: '' });
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [searchTerm]);

  const loadChildren = useCallback(
    async (parentId: string) => {
      if (state.cachedData.has(parentId)) {
        setState((prev) => ({
          ...prev,
          data: insertChildrenIntoTree(
            prev.data,
            parentId,
            prev.cachedData.get(parentId) || []
          ),
        }));

        return;
      }

      if (!state.loadingNodes.has(parentId)) {
        await fetchTreeData({ parentId });
      }
    },
    [state.cachedData, state.loadingNodes, fetchTreeData]
  );

  const refetch = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      cachedData: new Map(),
    }));
    await fetchTreeData({ searchTerm: state.searchTerm });
  }, [fetchTreeData, state.searchTerm]);

  const clearCache = useCallback(() => {
    setState((prev) => ({
      ...prev,
      cachedData: new Map(),
    }));
  }, []);

  const hasCache = useCallback(
    (parentId: string) => {
      return state.cachedData.has(parentId);
    },
    [state.cachedData]
  );

  return {
    treeData: state.data,
    loading: state.loading,
    error: state.error,
    loadingNodes: state.loadingNodes,
    refetch,
    loadChildren,
    clearCache,
    hasCache,
  };
};

function insertChildrenIntoTree<T>(
  nodes: TreeNode<T>[],
  parentId: string,
  children: TreeNode<T>[]
): TreeNode<T>[] {
  return nodes.map((node) => {
    if (node.id === parentId) {
      return {
        ...node,
        children: children,
      };
    }
    if (node.children) {
      return {
        ...node,
        children: insertChildrenIntoTree(node.children, parentId, children),
      };
    }

    return node;
  });
}
