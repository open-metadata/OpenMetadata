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
import { TableProps } from 'antd/lib/table';
import { NextPreviousProps } from '../NextPrevious/NextPrevious.interface';
import { SearchBarProps } from '../SearchBarComponent/SearchBar.component';

export interface TableComponentProps<T> extends TableProps<T> {
  containerClassName?: string; // Applied to the table container
  resizableColumns?: boolean;
  /** Filter's in ReactNode that will be aligned with TableColumnFilter. Example: GlossaryTableFilter */
  extraTableFilters?: React.ReactNode;
  extraTableFiltersClassName?: string;
  /** Columns that will be visible by default in the Table */
  defaultVisibleColumns?: string[];
  /** Columns that will be statically visible in the Table and will not be Filtered */
  staticVisibleColumns?: string[];
  searchProps?: SearchBarProps & {
    onClear?: () => void;
    value?: string;
    searchDebounceTime?: number;
  };
  customPaginationProps?: NextPreviousProps & {
    showPagination: boolean;
  };
  entityType?: string;
}

export interface TableColumnDropdownList {
  label: string;
  value: string;
}
