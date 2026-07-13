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
import type { ReactNode } from 'react';

export interface TreeSelectNode<T = unknown> {
  id: string;
  label: string;
  value: string;
  children?: TreeSelectNode<T>[];
  data?: T;
  isLeaf?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  allowSelection?: boolean;
  lazyLoad?: boolean;
  isParentMutuallyExclusive?: boolean;
}

export interface TreeSelectDataFetcherParams {
  searchTerm?: string;
  parentId?: string;
  pageSize?: number;
  signal?: AbortSignal;
}

export interface TreeSelectDataResponse<T = unknown> {
  nodes: TreeSelectNode<T>[];
  hasMore?: boolean;
  total?: number;
}

export type TreeSelectDataFetcher<T = unknown> = (
  params: TreeSelectDataFetcherParams
) => Promise<TreeSelectDataResponse<T>>;

export interface TreeSelectProps<T = unknown> {
  /** Label text rendered above the field. */
  label?: string;
  /** Placeholder shown in the trigger when nothing is selected. */
  placeholder?: string;
  /** Helper text rendered below the field. */
  hint?: ReactNode;
  tooltip?: string;
  required?: boolean;
  disabled?: boolean;
  isInvalid?: boolean;
  size?: 'sm' | 'md';
  autoFocus?: boolean;
  'data-testid'?: string;
  popoverClassName?: string;

  /** Async data source. Called for root nodes, on node expand (lazy load), and on search. */
  fetchData: TreeSelectDataFetcher<T>;
  value?: TreeSelectNode<T> | TreeSelectNode<T>[] | null;
  onChange?: (value: TreeSelectNode<T> | TreeSelectNode<T>[] | null) => void;

  multiple?: boolean;
  /** @default false */
  searchable?: boolean;
  /** @default false */
  lazyLoad?: boolean;
  /** @default true */
  showCheckbox?: boolean;
  /** @default true */
  showIcon?: boolean;
  /** Selecting a node also selects/deselects all of its descendants. @default false */
  cascadeSelection?: boolean;

  /** @default 300 */
  debounceMs?: number;
  /** @default 50 */
  pageSize?: number;

  noDataMessage?: string;
  loadingMessage?: string;
  searchPlaceholder?: string;

  onNodeExpand?: (nodeId: string) => void;
  onNodeCollapse?: (nodeId: string) => void;
  onSearch?: (searchTerm: string) => void;

  /**
   * Override the default case-insensitive label match, e.g. to disable
   * client-side filtering when the server already filtered.
   */
  filterNode?: (node: TreeSelectNode<T>, searchTerm: string) => boolean;
}
