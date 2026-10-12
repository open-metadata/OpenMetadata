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
import type * as React from 'react';
import type { DragAndDropHooks } from 'react-aria-components';
import { NextPreviousProps } from '../NextPrevious/NextPrevious.interface';
import { SearchBarProps } from '../SearchBarComponent/SearchBar.component';

/**
 * Table typings owned by this file so no call site (or the table itself) has
 * to reach into AntD. They mirror AntD 4's shapes field for field, which keeps
 * a column or props object assignable to AntD's `<Table>` for the call sites
 * that still render it.
 */
export type SortOrder = 'descend' | 'ascend' | null;

export type CompareFn<T> = (a: T, b: T, sortOrder?: SortOrder) => number;

export type FilterValue = (React.Key | boolean)[];

export interface ColumnFilterItem {
  text: React.ReactNode;
  value: React.Key | boolean;
  children?: ColumnFilterItem[];
}

export interface FilterConfirmProps {
  closeDropdown: boolean;
}

export interface FilterDropdownProps {
  prefixCls: string;
  setSelectedKeys: (selectedKeys: React.Key[]) => void;
  selectedKeys: React.Key[];
  confirm: (param?: FilterConfirmProps) => void;
  clearFilters?: () => void;
  filters?: ColumnFilterItem[];
  close: () => void;
  visible: boolean;
}

export interface ColumnTitleProps<RecordType> {
  sortOrder?: SortOrder;
  sortColumn?: ColumnType<RecordType>;
  sortColumns?: { column: ColumnType<RecordType>; order: SortOrder }[];
  filters?: Record<string, FilterValue>;
}

export type ColumnTitle<RecordType> =
  | React.ReactNode
  | ((props: ColumnTitleProps<RecordType>) => React.ReactNode);

type GetComponentProps<DataType> = (
  data: DataType,
  index?: number
) => React.HTMLAttributes<HTMLElement> | React.TdHTMLAttributes<HTMLElement>;

export interface RenderedCell<RecordType> {
  props?: {
    key?: React.Key;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
    column?: ColumnsType<RecordType>[number];
    colSpan?: number;
    rowSpan?: number;
    hasSubColumns?: boolean;
    colStart?: number;
    colEnd?: number;
  };
  children?: React.ReactNode;
}

interface ColumnSharedType<RecordType> {
  title?: ColumnTitle<RecordType>;
  key?: React.Key;
  className?: string;
  fixed?: 'left' | 'right' | boolean;
  onHeaderCell?: GetComponentProps<ColumnsType<RecordType>[number]>;
  ellipsis?: { showTitle?: boolean } | boolean;
  align?: 'left' | 'center' | 'right';
  sorter?:
    | boolean
    | CompareFn<RecordType>
    | { compare?: CompareFn<RecordType>; multiple?: number };
  sortOrder?: SortOrder;
  defaultSortOrder?: SortOrder;
  sortDirections?: SortOrder[];
  showSorterTooltip?: boolean | { title?: React.ReactNode };
  filtered?: boolean;
  filters?: ColumnFilterItem[];
  filterDropdown?:
    | React.ReactNode
    | ((props: FilterDropdownProps) => React.ReactNode);
  filterMultiple?: boolean;
  filteredValue?: FilterValue | null;
  defaultFilteredValue?: FilterValue | null;
  filterIcon?: React.ReactNode | ((filtered: boolean) => React.ReactNode);
  filterMode?: 'menu' | 'tree';
  filterSearch?:
    | boolean
    | ((input: string, record: ColumnFilterItem) => boolean);
  onFilter?: (value: React.Key | boolean, record: RecordType) => boolean;
  filterDropdownOpen?: boolean;
  onFilterDropdownOpenChange?: (open: boolean) => void;
  filterResetToDefaultFilteredValue?: boolean;
  responsive?: ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[];
}

export interface ColumnType<RecordType> extends ColumnSharedType<RecordType> {
  colSpan?: number;
  rowSpan?: number;
  dataIndex?: string | number | readonly (string | number)[];
  render?: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cell value type varies per call site
    value: any,
    record: RecordType,
    index: number
  ) => React.ReactNode | RenderedCell<RecordType>;
  shouldCellUpdate?: (record: RecordType, prevRecord: RecordType) => boolean;
  width?: number | string;
  onCell?: GetComponentProps<RecordType>;
}

export interface ColumnGroupType<RecordType>
  extends Omit<ColumnType<RecordType>, 'dataIndex'> {
  children: ColumnsType<RecordType>;
}

export type ColumnsType<RecordType = unknown> = (
  | ColumnGroupType<RecordType>
  | ColumnType<RecordType>
)[];

export interface ExpandableConfig<RecordType> {
  expandedRowKeys?: readonly React.Key[];
  defaultExpandedRowKeys?: readonly React.Key[];
  expandedRowRender?: (
    record: RecordType,
    index: number,
    indent: number,
    expanded: boolean
  ) => React.ReactNode;
  columnTitle?: React.ReactNode;
  expandRowByClick?: boolean;
  expandIcon?: (props: {
    prefixCls: string;
    expanded: boolean;
    record: RecordType;
    expandable: boolean;
    onExpand: (
      record: RecordType,
      event: React.MouseEvent<HTMLElement>
    ) => void;
  }) => React.ReactNode;
  onExpand?: (expanded: boolean, record: RecordType) => void;
  onExpandedRowsChange?: (expandedKeys: readonly React.Key[]) => void;
  defaultExpandAllRows?: boolean;
  indentSize?: number;
  expandIconColumnIndex?: number;
  showExpandColumn?: boolean;
  expandedRowClassName?: (
    record: RecordType,
    index: number,
    indent: number
  ) => string;
  childrenColumnName?: string;
  rowExpandable?: (record: RecordType) => boolean;
  columnWidth?: number | string;
  fixed?: 'left' | 'right' | boolean;
}

export interface TableRowSelection<T> {
  preserveSelectedRowKeys?: boolean;
  type?: 'checkbox' | 'radio';
  selectedRowKeys?: React.Key[];
  defaultSelectedRowKeys?: React.Key[];
  onChange?: (
    selectedRowKeys: React.Key[],
    selectedRows: T[],
    info: { type: 'all' | 'none' | 'invert' | 'single' | 'multiple' }
  ) => void;
  getCheckboxProps?: (record: T) => { disabled?: boolean; name?: string };
  onSelect?: (
    record: T,
    selected: boolean,
    selectedRows: T[],
    nativeEvent: Event
  ) => void;
  onSelectAll?: (selected: boolean, selectedRows: T[], changeRows: T[]) => void;
  hideSelectAll?: boolean;
  fixed?: 'left' | 'right' | boolean;
  columnWidth?: string | number;
  columnTitle?: React.ReactNode;
  checkStrictly?: boolean;
  renderCell?: (
    value: boolean,
    record: T,
    index: number,
    originNode: React.ReactNode
  ) => React.ReactNode | RenderedCell<T>;
}

export interface TableCurrentDataSource<RecordType> {
  currentDataSource: RecordType[];
  action: 'paginate' | 'sort' | 'filter';
}

export interface SorterResult<RecordType> {
  column?: ColumnType<RecordType>;
  order?: SortOrder;
  field?: React.Key | readonly React.Key[];
  columnKey?: React.Key;
}

export interface TablePaginationConfig {
  className?: string;
  style?: React.CSSProperties;
  current?: number;
  defaultCurrent?: number;
  pageSize?: number;
  defaultPageSize?: number;
  total?: number;
  pageSizeOptions?: string[] | number[];
  hideOnSinglePage?: boolean;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean | { goButton?: React.ReactNode };
  showLessItems?: boolean;
  showTitle?: boolean;
  simple?: boolean;
  disabled?: boolean;
  size?: 'default' | 'small';
  position?: (
    | 'topLeft'
    | 'topCenter'
    | 'topRight'
    | 'bottomLeft'
    | 'bottomCenter'
    | 'bottomRight'
  )[];
  onChange?: (page: number, pageSize: number) => void;
  onShowSizeChange?: (current: number, size: number) => void;
  itemRender?: (
    page: number,
    type: 'page' | 'prev' | 'next' | 'jump-prev' | 'jump-next',
    element: React.ReactNode
  ) => React.ReactNode;
  showTotal?: (total: number, range: [number, number]) => React.ReactNode;
}

export interface TableLocale {
  filterTitle?: string;
  filterConfirm?: React.ReactNode;
  filterReset?: React.ReactNode;
  filterEmptyText?: React.ReactNode;
  filterCheckall?: React.ReactNode;
  filterSearchPlaceholder?: string;
  emptyText?: React.ReactNode | (() => React.ReactNode);
  selectAll?: React.ReactNode;
  selectNone?: React.ReactNode;
  selectInvert?: React.ReactNode;
  selectionAll?: React.ReactNode;
  sortTitle?: string;
  expand?: string;
  collapse?: string;
  triggerDesc?: string;
  triggerAsc?: string;
  cancelSort?: string;
}

export interface TableProps<RecordType> {
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  dataSource?: readonly RecordType[];
  columns?: ColumnsType<RecordType>;
  rowKey?: string | ((record: RecordType, index?: number) => React.Key);
  tableLayout?: 'auto' | 'fixed';
  scroll?: {
    x?: number | true | string;
    y?: number | string;
    scrollToFirstRowOnChange?: boolean;
  };
  expandable?: ExpandableConfig<RecordType>;
  indentSize?: number;
  rowClassName?:
    | string
    | ((record: RecordType, index: number, indent: number) => string);
  title?: (data: readonly RecordType[]) => React.ReactNode;
  footer?: (data: readonly RecordType[]) => React.ReactNode;
  summary?: (data: readonly RecordType[]) => React.ReactNode;
  showHeader?: boolean;
  onRow?: GetComponentProps<RecordType>;
  onHeaderRow?: GetComponentProps<readonly ColumnType<RecordType>[]>;
  sticky?:
    | boolean
    | {
        offsetHeader?: number;
        offsetSummary?: number;
        offsetScroll?: number;
        getContainer?: () => Window | HTMLElement;
      };
  pagination?: false | TablePaginationConfig;
  loading?:
    | boolean
    | {
        spinning?: boolean;
        size?: 'small' | 'default' | 'large';
        tip?: React.ReactNode;
        delay?: number;
        indicator?: React.ReactElement<HTMLElement>;
        className?: string;
        style?: React.CSSProperties;
        wrapperClassName?: string;
      };
  size?: 'small' | 'middle' | 'large';
  bordered?: boolean;
  locale?: TableLocale;
  onChange?: (
    pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<RecordType> | SorterResult<RecordType>[],
    extra: TableCurrentDataSource<RecordType>
  ) => void;
  rowSelection?: TableRowSelection<RecordType>;
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement;
  sortDirections?: SortOrder[];
  showSorterTooltip?: boolean | { title?: React.ReactNode };
}

export interface TableComponentProps<T> extends TableProps<T> {
  containerClassName?: string; // Applied to the table container
  /**
   * Applied to the inner div that owns `scroll.x`/`scroll.y`'s overflow.
   * Only pass this alongside `tw:flex tw:flex-col` on `containerClassName`
   * and a bounded-height ancestor, or the flex chain collapses.
   */
  scrollContainerClassName?: string;
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
