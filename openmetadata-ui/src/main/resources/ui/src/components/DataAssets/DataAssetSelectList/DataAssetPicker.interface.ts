/*
 *  Copyright 2026 Collate.
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
import { SearchIndex } from 'src/enums/search.enum';
import { DataAssetAsyncSelectListProps } from '../DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';

export interface DataAssetPickerOption {
  id: string;
  label: string;
  displayName?: string;
  name?: string;
  type?: string;
}

export interface DataAssetPickerTriggerState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export interface DataAssetPickerShellProps {
  renderTrigger: (state: DataAssetPickerTriggerState) => ReactNode;
  options: DataAssetPickerOption[];
  selectionMode: 'single' | 'multiple';
  selectedIds: Set<string>;
  onToggle: (option: DataAssetPickerOption) => void;
  onOpenChange?: (isOpen: boolean) => void;
  searchable?: boolean;
  searchText?: string;
  onSearchChange?: (value: string) => void;
  showCountBar?: boolean;
  totalCount?: number;
  isLoading?: boolean;
  onScroll?: (e: React.UIEvent<HTMLElement>) => void;
  showFooterHints?: boolean;
  allowAllOption?: boolean;
  onSelectAll?: () => void;
  popoverClassName?: string;
  popoverAlign?: 'left' | 'right';
  popoverPlacement?: 'top' | 'bottom';
  placeholder?: string;
}

export interface DataAssetFilterPopoverProps {
  options: DataAssetPickerOption[];
  selectedId: string;
  onChange: (id: string) => void;
  allowAllOption?: boolean;
  allOptionLabel?: string;
  popoverClassName?: string;
  popoverAlign?: 'left' | 'right';
  placeholder?: string;
  renderTrigger?: (state: DataAssetPickerTriggerState) => ReactNode;
}

export interface DataAssetMultiSelectPopoverProps
  extends DataAssetAsyncSelectListProps {
  renderTrigger?: (state: DataAssetPickerTriggerState) => ReactNode;
  popoverClassName?: string;
  popoverAlign?: 'left' | 'right';
  popoverPlacement?: 'top' | 'bottom';
}

export interface DataAssetPickerRowProps {
  option: DataAssetPickerOption;
  isSelected: boolean;
  onSelect: (option: DataAssetPickerOption) => void;
}

export interface UseAsyncDataAssetOptionsParams {
  isOpen: boolean;
  searchIndex: SearchIndex;
  queryFilter?: Record<string, unknown>;
  debounceTimeout: number;
}
