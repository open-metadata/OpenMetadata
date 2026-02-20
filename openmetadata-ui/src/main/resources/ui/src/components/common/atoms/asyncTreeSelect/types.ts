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

import { ReactNode } from 'react';

export interface TreeNode<T = unknown> {
  id: string;
  label: string;
  value: string;
  children?: TreeNode<T>[];
  data?: T;
  isLeaf?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  parent?: string;
  allowSelection?: boolean;
  lazyLoad?: boolean;
  hasChildren?: boolean;
}

export interface TreeDataFetcherParams {
  searchTerm?: string;
  parentId?: string;
  page?: number;
  pageSize?: number;
}

export interface TreeDataResponse<T = unknown> {
  nodes: TreeNode<T>[];
  hasMore?: boolean;
  total?: number;
}

export type TreeDataFetcher<T = unknown> = (
  params: TreeDataFetcherParams
) => Promise<TreeDataResponse<T>>;

export interface AsyncTreeSelectOptions<T = unknown> {
  multiple?: boolean;
  cascadeSelection?: boolean;
  searchable?: boolean;
  debounceMs?: number;
  pageSize?: number;
  lazyLoad?: boolean;
  enableVirtualization?: boolean;
  defaultExpanded?: string[];
  defaultSelected?: string[];
  maxHeight?: number;
  placeholder?: string;
  noDataMessage?: string;
  loadingMessage?: string;
  fetchData: TreeDataFetcher<T>;
  onSelectionChange?: (selected: TreeNode<T> | TreeNode<T>[] | null) => void;
  onNodeExpand?: (nodeId: string) => void;
  onNodeCollapse?: (nodeId: string) => void;
  renderNode?: (node: TreeNode<T>) => ReactNode;
  filterNode?: (node: TreeNode<T>, searchTerm: string) => boolean;
}

export interface TreeState<T = unknown> {
  data: TreeNode<T>[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  expandedNodes: Set<string>;
  selectedNodes: Set<string>;
  loadingNodes: Set<string>;
  cachedData: Map<string, TreeNode<T>[]>;
}

export interface TreeSelectionState<T = unknown> {
  selectedNodes: Map<string, TreeNode<T>>;
  selectedData: TreeNode<T>[];
  isNodeSelected: (nodeId: string) => boolean;
  toggleNodeSelection: (node: TreeNode<T>) => void;
  clearSelection: () => void;
  selectAll: () => void;
  getSelectedNodes: () => TreeNode<T>[];
  removeLastSelectedOption: () => void;
}

export interface TreeExpansionState {
  expandedNodes: Set<string>;
  isNodeExpanded: (nodeId: string) => boolean;
  toggleNodeExpansion: (nodeId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  expandPath: (path: string[]) => void;
}

export interface TreeSearchState {
  searchTerm: string;
  filteredNodes: Set<string>;
  highlightedNode: string | null;
  setSearchTerm: (term: string) => void;
  clearSearch: () => void;
  isNodeVisible: (nodeId: string) => boolean;
}

export interface VirtualizationConfig {
  enabled: boolean;
  itemHeight: number;
  overscan: number;
  containerHeight: number;
}
