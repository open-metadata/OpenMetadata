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

// Keyed by node id, so the root listing needs one no node can collide with.
const ROOT_CACHE_KEY = '\u0000root';

/** A branch's loaded children plus what it takes to ask for the next page. */
interface BranchPage<T> {
  nodes: TreeSelectNode<T>[];
  hasMore?: boolean;
  total?: number;
  cursor?: string;
}

interface TreeSelectDataState<T> {
  data: TreeSelectNode<T>[];
  loading: boolean;
  /** A root page appended to what is already shown, rather than replacing it. */
  loadingMore: boolean;
  error: string | null;
  loadingNodes: Set<string>;
  cachedData: Map<string, BranchPage<T>>;
  /** Paging state for the root listing, mirroring BranchPage for a branch. */
  rootPage: Omit<BranchPage<T>, 'nodes'>;
}

interface UseTreeSelectDataOptions<T> {
  fetchData: TreeSelectDataFetcher<T>;
  searchTerm?: string;
  pageSize?: number;
  onFetchError?: (error: unknown) => void;
  // False holds off every fetch, so a closed picker on each row costs no request.
  enabled?: boolean;
}

interface UseTreeSelectDataReturn<T> {
  treeData: TreeSelectNode<T>[];
  loading: boolean;
  error: string | null;
  loadingNodes: Set<string>;
  loadChildren: (parentId: string) => Promise<void>;
  loadMoreChildren: (parentId: string) => Promise<void>;
  /** Set when the root listing is a truncated page. */
  hasMoreRoot: boolean;
  /** Root total, when the source reports one. */
  rootTotal?: number;
  loadingMoreRoot: boolean;
  loadMoreRoot: () => Promise<void>;
}

const insertChildrenIntoTree = <T>(
  nodes: TreeSelectNode<T>[],
  parentId: string,
  page: BranchPage<T>,
  append = false
): TreeSelectNode<T>[] =>
  nodes.map((node) => {
    if (node.id === parentId) {
      const children = append
        ? [...(node.children ?? []), ...page.nodes]
        : page.nodes;

      // An empty result must not make it a leaf, or it loses its chevron.
      return {
        ...node,
        children,
        hasMoreChildren: page.hasMore === true,
        childrenTotal: page.total,
        childrenCursor: page.cursor,
        isLeaf: children.length > 0 ? false : node.isLeaf,
      };
    }
    if (node.children) {
      return {
        ...node,
        children: insertChildrenIntoTree(node.children, parentId, page, append),
      };
    }

    return node;
  });

const findNode = <T>(
  nodes: TreeSelectNode<T>[],
  id: string
): TreeSelectNode<T> | undefined => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const found = node.children && findNode(node.children, id);
    if (found) {
      return found;
    }
  }

  return undefined;
};

export const useTreeSelectData = <T = unknown>({
  fetchData,
  searchTerm = '',
  pageSize = 50,
  onFetchError,
  enabled = true,
}: UseTreeSelectDataOptions<T>): UseTreeSelectDataReturn<T> => {
  const [state, setState] = useState<TreeSelectDataState<T>>({
    data: [],
    loading: false,
    loadingMore: false,
    error: null,
    loadingNodes: new Set(),
    cachedData: new Map(),
    rootPage: {},
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingNodesRef = useRef<Set<string>>(new Set());
  const cachedDataRef = useRef<Map<string, BranchPage<T>>>(new Map());
  // Read inside stable callbacks, so `loadMoreChildren` never needs the tree.
  const dataRef = useRef<TreeSelectNode<T>[]>([]);
  dataRef.current = state.data;
  // Same reason as dataRef: `loadMoreRoot` must not depend on the tree.
  const rootPageRef = useRef<Omit<BranchPage<T>, 'nodes'>>({});
  rootPageRef.current = state.rootPage;
  const loadingMoreRef = useRef(false);
  loadingMoreRef.current = state.loadingMore;

  const fetchTreeData = useCallback(
    async (params: TreeSelectDataFetcherParams, append = false) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (params.parentId) {
        loadingNodesRef.current = new Set(loadingNodesRef.current).add(
          params.parentId
        );
      }

      const isRootAppend = !params.parentId && append;
      setState((prev) => ({
        ...prev,
        loading: !params.parentId && !append,
        loadingMore: isRootAppend,
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
          let nextRootPage = prev.rootPage;

          if (params.parentId) {
            const previous = cachedDataRef.current.get(params.parentId);
            const page: BranchPage<T> = {
              nodes:
                append && previous
                  ? [...previous.nodes, ...response.nodes]
                  : response.nodes,
              hasMore: response.hasMore,
              total: response.total,
              cursor: response.nextCursor,
            };

            nextCachedData = new Map(cachedDataRef.current);
            nextCachedData.set(params.parentId, page);
            nextData = insertChildrenIntoTree(
              prev.data,
              params.parentId,
              { ...page, nodes: response.nodes },
              append
            );
            nextLoadingNodes.delete(params.parentId);
          } else {
            nextData = append
              ? [...prev.data, ...response.nodes]
              : response.nodes;
            nextRootPage = {
              hasMore: response.hasMore,
              total: response.total,
              cursor: response.nextCursor,
            };
            if (!params.searchTerm) {
              nextCachedData = new Map([[ROOT_CACHE_KEY, { nodes: nextData }]]);
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
            loadingMore: false,
            rootPage: nextRootPage,
          };
        });
      } catch (error) {
        if (controller.signal.aborted) {
          if (params.parentId) {
            const nextLoadingNodes = new Set(loadingNodesRef.current);
            nextLoadingNodes.delete(params.parentId);
            loadingNodesRef.current = nextLoadingNodes;
            setState((prev) => ({ ...prev, loadingNodes: nextLoadingNodes }));
          }

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
          loadingMore: false,
          error: errorMessage,
          loadingNodes: nextLoadingNodes,
        }));

        // A consumer that knows its transport can render a translated message
        // (and its own retry); the raw `error.message` is an axios string like
        // "Request failed with status code 500".
        if (onFetchError) {
          onFetchError(error);
        } else {
          toast.error(errorMessage);
        }
      }
    },
    [fetchData, pageSize, onFetchError]
  );

  useEffect(() => {
    if (enabled) {
      fetchTreeData({ searchTerm });
    }

    return () => {
      abortControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, enabled]);

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

  // The next page of an already-loaded branch, appended to what it has.
  const loadMoreChildren = useCallback(
    async (parentId: string) => {
      const node = findNode(dataRef.current, parentId);
      if (!node?.hasMoreChildren || loadingNodesRef.current.has(parentId)) {
        return;
      }

      await fetchTreeData({ parentId, after: node.childrenCursor }, true);
    },
    [fetchTreeData]
  );

  // The next page of the root listing, appended to what is already shown.
  const loadMoreRoot = useCallback(async () => {
    if (!rootPageRef.current.hasMore || loadingMoreRef.current) {
      return;
    }

    await fetchTreeData(
      { after: rootPageRef.current.cursor, searchTerm },
      true
    );
  }, [fetchTreeData, searchTerm]);

  return {
    treeData: state.data,
    loading: state.loading,
    error: state.error,
    loadingNodes: state.loadingNodes,
    loadChildren,
    loadMoreChildren,
    hasMoreRoot: state.rootPage.hasMore === true,
    rootTotal: state.rootPage.total,
    loadingMoreRoot: state.loadingMore,
    loadMoreRoot,
  };
};
