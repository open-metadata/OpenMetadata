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
import { TreeDataFetcher, TreeNode } from '../atoms/asyncTreeSelect/types';

export interface MUIAsyncTreeSelectProps<T = unknown> {
  // Core props
  label?: ReactNode;
  placeholder?: string;
  helperText?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  autoFocus?: boolean;

  // Tree data props
  fetchData: TreeDataFetcher<T>;
  value?: TreeNode<T> | TreeNode<T>[] | null;
  onChange?: (value: TreeNode<T> | TreeNode<T>[] | null) => void;

  // Tree behavior
  multiple?: boolean;
  searchable?: boolean;
  lazyLoad?: boolean;
  showCheckbox?: boolean;
  showIcon?: boolean;
  cascadeSelection?: boolean;

  // Default states
  defaultExpanded?: string[];
  defaultSelected?: string[];

  // Customization
  debounceMs?: number;
  pageSize?: number;
  maxHeight?: number;
  minWidth?: number;
  noDataMessage?: string;
  loadingMessage?: string;
  searchPlaceholder?: string;

  // Callbacks
  onNodeExpand?: (nodeId: string) => void;
  onNodeCollapse?: (nodeId: string) => void;
  onSearch?: (searchTerm: string) => void;

  // Custom renderers
  renderNode?: (node: TreeNode<T>, isSelected: boolean) => ReactNode;
  filterNode?: (node: TreeNode<T>, searchTerm: string) => boolean;

  // Future features
  enableVirtualization?: boolean;
  enableDragDrop?: boolean;
  enableContextMenu?: boolean;
}
