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
import React from 'react';

export interface FlatRow<T> {
  record: T;
  depth: number;
  actualIndex: number;
  hasChildren: boolean;
  rowKey: string;
}

/** Structural aliases to avoid a direct react-aria-components peer import. */
export type AriaKey = string | number;
export type AriaSelection = 'all' | Set<AriaKey>;
export interface AriaSortDescriptor {
  column?: AriaKey;
  direction?: 'ascending' | 'descending';
}

// ─── Local column / table type aliases (mirror antd without importing it) ─────

export type TableSortOrder = 'ascend' | 'descend' | null;
export type TableDataIndex = string | number | readonly string[];
export type TableFilterValue = (React.Key | boolean)[];

export interface TableFilterOption {
  text?: React.ReactNode;
  value: React.Key | boolean;
  children?: TableFilterOption[];
}

export interface TableFilterDropdownProps {
  prefixCls: string;
  setSelectedKeys: (keys: React.Key[]) => void;
  selectedKeys: React.Key[];
  confirm: () => void;
  clearFilters?: () => void;
  filters?: TableFilterOption[];
  visible: boolean;
  close: () => void;
}

export interface TableColumnType<T> {
  key?: React.Key;
  dataIndex?: TableDataIndex;
  title?:
    | React.ReactNode
    | ((props: {
        sortOrder?: TableSortOrder;
        sortColumn?: TableColumnType<T>;
        filters?: Record<string, TableFilterValue | null>;
      }) => React.ReactNode);
  render?: (
    value: unknown,
    record: T,
    index: number
  ) => React.ReactNode | { children: React.ReactNode; props?: Record<string, unknown> };
  sorter?: boolean | ((a: T, b: T) => number);
  sortOrder?: TableSortOrder;
  filters?: TableFilterOption[];
  filterDropdown?:
    | React.ReactNode
    | ((props: TableFilterDropdownProps) => React.ReactNode);
  filterIcon?: React.ReactNode | ((filtered: boolean) => React.ReactNode);
  onFilter?: (value: React.Key | boolean, record: T) => boolean;
  onCell?: (
    record: T,
    index?: number
  ) => React.TdHTMLAttributes<HTMLTableCellElement> & Record<string, unknown>;
  fixed?: boolean | 'left' | 'right';
  width?: string | number;
  ellipsis?: boolean | { showTitle?: boolean };
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export type TableColumnsType<T> = TableColumnType<T>[];

export interface TablePaginationConfig {
  current?: number;
  pageSize?: number;
  total?: number;
  hideOnSinglePage?: boolean;
  showSizeChanger?: boolean;
  defaultPageSize?: number;
  defaultCurrent?: number;
}

export interface TableSorterResult<T> {
  column?: TableColumnType<T>;
  columnKey?: React.Key;
  field?: React.Key | string[];
  order?: 'ascend' | 'descend' | null;
}

export interface TableCurrentDataSource<T> {
  currentDataSource: T[];
  action: 'paginate' | 'sort' | 'filter';
}
