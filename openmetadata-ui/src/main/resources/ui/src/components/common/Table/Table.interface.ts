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
import type { DragAndDropHooks } from 'react-aria-components';
import { NextPreviousProps } from '../NextPrevious/NextPrevious.interface';
import { SearchBarProps } from '../SearchBarComponent/SearchBar.component';

/**
 * Table types re-exported so this file is the single place that reaches into
 * AntD's table typings. Call sites reference them from here, which is what lets
 * the underlying table be swapped without touching ~100 files: only the
 * right-hand side of these lines has to change.
 */
export type { TableProps } from 'antd/lib/table';
export type {
  ColumnGroupType,
  ColumnsType,
  ColumnTitle,
  ColumnType,
  ExpandableConfig,
  FilterDropdownProps,
  FilterValue,
  SorterResult,
  SortOrder,
  TableCurrentDataSource,
  TablePaginationConfig,
  TableRowSelection,
} from 'antd/lib/table/interface';

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
  searchProps?: SearchBarProps;
  customPaginationProps?: NextPreviousProps & {
    showPagination: boolean;
  };
  entityType?: string;
  /** CSS class applied to every data cell. Defaults to 'tw:py-2 tw:pl-4 tw:pr-2 tw:align-top'. */
  cellClassName?: string;
  /** React Aria drag-and-drop hooks returned by `useDragAndDrop`. */
  dragAndDropHooks?: DragAndDropHooks;
  /**
   * Called when a row is activated (clicked/Enter). When provided together with
   * `rowSelection`, React Aria performs this action on row click while selection
   * is limited to the selection checkbox — the row no longer toggles selection.
   */
  onRowAction?: (key: React.Key) => void;
  'data-testid'?: string;
}

export interface TableColumnDropdownList {
  label: string;
  value: string;
}
