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
import { toast } from '@/components/application/toast/toast-store';
import type {
  TreeSelectDataFetcher,
  TreeSelectDataFetcherParams,
  TreeSelectNode,
} from './tree-select.types';

interface TreeSelectDataState<T> {
  data: TreeSelectNode<T>[];
  loading: boolean;
  error: string | null;
  loadingNodes: Set<string>;
  cachedData: Map<string, TreeSelectNode<T>[]>;
}

interface UseTreeSelectDataOptions<T> {
  fetchData: TreeSelectDataFetcher<T>;
  searchTerm?: string;
  pageSize?: number;
}

interface UseTreeSelectDataReturn<T> {
  treeData: TreeSelectNode<T>[];
  loading: boolean;
  error: string | null;
  loadingNodes: Set<string>;
  loadChildren: (parentId: string) => Promise<void>;
}

const insertChildrenIntoTree = <T>(
  nodes: TreeSelectNode<T>[],
  parentId: string,
  children: TreeSelectNode<T>[]
): TreeSelectNode<T>[] =>
  nodes.map((node) => {
    if (node.id === parentId) {
      return { ...node, children };
    }
    if (node.children) {
      return {
        ...node,
        children: insertChildrenIntoTree(node.children, parentId, children),
      };
    }

    return node;
  });

export const useTreeSelectData = <T = unknown>({
  fetchData,
  searchTerm = '',
  pageSize = 50,
}: UseTreeSelectDataOptions<T>): UseTreeSelectDataReturn<T> => {
  const [state, setState] = useState<TreeSelectDataState<T>>({
    data: [],
    loading: false,
    error: null,
    loadingNodes: new Set(),
    cachedData: new Map(),
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingNodesRef = useRef<Set<string>>(new Set());
  const cachedDataRef = useRef<Map<string, TreeSelectNode<T>[]>>(new Map());

  const fetchTreeData = useCallback(
    async (params: TreeSelectDataFetcherParams) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (params.parentId) {
        loadingNodesRef.current = new Set(loadingNodesRef.current).add(
          params.parentId
        );
      }

      setState((prev) => ({
        ...prev,
        loading: !params.parentId,
        error: null,
        loadingNodes: loadingNodesRef.current,
      }));

      try {
        const response = await fetchData({
          ...params,
          pageSize,
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          if (params.parentId) {
            const nextLoadingNodes = new Set(loadingNodesRef.current);
            nextLoadingNodes.delete(params.parentId);
            loadingNodesRef.current = nextLoadingNodes;
            setState((prev) => ({ ...prev, loadingNodes: nextLoadingNodes }));
          }

          return;
        }

        setState((prev) => {
          const nextLoadingNodes = new Set(loadingNodesRef.current);
          let nextData = prev.data;
          let nextCachedData = cachedDataRef.current;

          if (params.parentId) {
            nextCachedData = new Map(cachedDataRef.current);
            nextCachedData.set(params.parentId, response.nodes);
            nextData = insertChildrenIntoTree(
              prev.data,
              params.parentId,
              response.nodes
            );
            nextLoadingNodes.delete(params.parentId);
          } else {
            nextData = response.nodes;
            if (!params.searchTerm) {
              nextCachedData = new Map([['root', response.nodes]]);
            }
          }

          cachedDataRef.current = nextCachedData;
          loadingNodesRef.current = nextLoadingNodes;

          return {
            ...prev,
            data: nextData,
            cachedData: nextCachedData,
            loadingNodes: nextLoadingNodes,
            loading: false,
          };
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const errorMessage =
          error instanceof Error ? error.message : 'Failed to fetch tree data';

        const nextLoadingNodes = params.parentId
          ? new Set(
              Array.from(loadingNodesRef.current).filter(
                (id) => id !== params.parentId
              )
            )
          : new Set<string>();
        loadingNodesRef.current = nextLoadingNodes;

        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
          loadingNodes: nextLoadingNodes,
        }));

        toast.error(errorMessage);
      }
    },
    [fetchData, pageSize]
  );

  useEffect(() => {
    fetchTreeData({ searchTerm });

    return () => {
      abortControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const loadChildren = useCallback(
    async (parentId: string) => {
      const cached = cachedDataRef.current.get(parentId);
      if (cached) {
        setState((prev) => ({
          ...prev,
          data: insertChildrenIntoTree(prev.data, parentId, cached),
        }));

        return;
      }

      if (!loadingNodesRef.current.has(parentId)) {
        await fetchTreeData({ parentId });
      }
    },
    [fetchTreeData]
  );

  return {
    treeData: state.data,
    loading: state.loading,
    error: state.error,
    loadingNodes: state.loadingNodes,
    loadChildren,
  };
};
