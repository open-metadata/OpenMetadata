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
import { SearchIndex } from '../../../../../enums/search.enum';
import {
  Aggregations,
  SearchResponse,
} from '../../../../../interface/search.interface';
import { ExploreQuickFilterField } from '../../../../Explore/ExplorePage.interface';
import { SearchDropdownOption } from '../../../../SearchDropdown/SearchDropdown.interface';

export interface UrlStateConfig {
  searchKey?: string;
  filterKeys: string[];
  pageKey?: string;
  pageSizeKey?: string;
  defaultPageSize?: number;
}

export interface UrlState {
  searchQuery: string;
  filters: Record<string, string[]>;
  currentPage: number;
  pageSize: number;
}

export interface UrlStateHook {
  urlState: UrlState;
  parsedFilters: ExploreQuickFilterField[];
  setSearchQuery: (query: string) => void;
  setFilters: (filters: ExploreQuickFilterField[]) => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  resetFilters: () => void;
  resetAll: () => void;
}

export interface DataFetchingConfig<T> {
  searchIndex: string;
  baseFilter?: string;
  pageSize?: number;
  transform?: (data: SearchResponse<SearchIndex>) => T[];
}

export interface DataFetchingResult<T> {
  entities: T[];
  loading: boolean;
  error: Error | null;
  totalEntities: number;
  refetch: () => void;
}

export interface PaginationState {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalEntities: number;
  setCurrentPage: (page: number) => void;
}

export interface SelectionState {
  selectedEntities: string[];
  isAllSelected: boolean;
  isIndeterminate: boolean;
  handleSelectAll: (checked: boolean) => void;
  handleSelect: (id: string, checked: boolean) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
}

export interface FilterField {
  key: string;
  aggregationField: string;
  processor?: (options: SearchDropdownOption[]) => SearchDropdownOption[];
}

export interface FilterOptions {
  [key: string]: SearchDropdownOption[];
}

export interface FilterConfig {
  key: string;
  labelKey: string;
  searchKey: string;
  optionsKey: string;
  selectedKey: string;
}

export interface ColumnConfig<T> {
  key: string;
  labelKey: string;
  render: string;
  getValue?: (entity: T) => ReactNode | string | number | null;
  customRenderer?: string;
}

export interface CellRenderer<T> {
  [key: string]: (entity: T, column?: ColumnConfig<T>) => ReactNode;
}

export interface ActionHandlers<T> {
  onEntityClick?: (entity: T) => void;
  onAddClick?: () => void;
  onDeleteClick?: (entities: T[]) => void;
  onEditClick?: (entity: T) => void;
}

export interface ListingData<T> {
  entities: T[];
  loading: boolean;
  totalEntities: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  columns: ColumnConfig<T>[];
  renderers: CellRenderer<T>;
  selectedEntities: string[];
  isAllSelected: boolean;
  isIndeterminate: boolean;
  handleSelectAll: (checked: boolean) => void;
  handleSelect: (id: string, checked: boolean) => void;
  isSelected: (id: string) => boolean;
  clearSelection: () => void;
  urlState: UrlState;
  parsedFilters: ExploreQuickFilterField[];
  actionHandlers: ActionHandlers<T>;
  filterOptions?: FilterOptions;
  aggregations?: Aggregations | null;
  handleSearchChange: (query: string) => void;
  handleFilterChange: (filters: ExploreQuickFilterField[]) => void;
  handlePageChange: (page: number) => void;
  handlePageSizeChange?: (pageSize: number) => void;
  refetch: (options?: { silent?: boolean }) => void | Promise<void>;
}

export interface TableViewConfig<T> {
  listing: ListingData<T>;
  enableSelection?: boolean;
  entityLabelKey?: string;
  customTableRow?: React.ComponentType<Record<string, unknown>>;
}

export interface DropdownConfig {
  key: string;
  labelKey: string;
  searchKey: string;
  options: SearchDropdownOption[];
  selectedOptions: SearchDropdownOption[];
  onChange: (values: SearchDropdownOption[]) => void;
  onSearch: (term: string) => void;
}
