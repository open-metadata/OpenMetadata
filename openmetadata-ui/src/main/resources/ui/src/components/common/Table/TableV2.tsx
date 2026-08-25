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

/**
 * TableV2 — Untitled UI migration of Table.tsx
 *
 * Drop-in replacement for Table.tsx using @openmetadata/ui-core-components.
 * Accepts the same TableComponentProps<T> interface for zero-friction adoption.
 *
 * Not in the props type (compile-time error if passed) — see UnsupportedProps:
 *  - summary, components
 *
 * Partially supported:
 *  - expandable        → tree/nested rows via record.children, plus expandedRowRender
 *  - onRow             → onClick and onDoubleClick are forwarded to the row element
 *  - onCell            → onClick, data-*, colSpan forwarded to the underlying td element
 *  - filterIcon/filterDropdown/onFilter → filter state managed internally; confirm/close close the dropdown
 *
 * Test contract — these hooks are stable and tests may rely on them:
 *   data-row-key   on every row (AntD's rc-table emits it too, so a selector
 *                  written against it survives the migration)
 *   data-level     tree depth (TableV2 only; AntD uses .ant-table-row-level-N)
 *   data-testid    table-toolbar, column-dropdown, expand-icon, filter-trigger,
 *                  filter-dropdown, column-header-content, and the table root
 *                  via the `data-testid` prop
 *
 * Sorting:
 *  - sorter: (a, b) => number  → applied client-side on full dataset before pagination
 *  - sorter: true              → visual indicator only; parent must handle via onChange
 */

import {
  Button,
  Dropdown,
  Table as UntitledTable,
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronDown, ChevronRight } from '@untitledui/icons';
import type { ColumnsType } from 'antd/es/table/interface';
import type {
  ColumnType,
  FilterValue,
  SorterResult,
  TableCurrentDataSource,
  TablePaginationConfig,
} from 'antd/lib/table/interface';
import classNames from 'classnames';
import { isEmpty, isEqual, noop } from 'lodash';
import React, {
  forwardRef,
  ReactElement,
  ReactNode,
  Ref,
  RefAttributes,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Button as AriaButton,
  ColumnResizer,
  Dialog,
  DialogTrigger,
  Popover,
  ResizableTableContainer,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ColumnIcon } from '../../../assets/svg/ic-column-customize.svg';
import { useCurrentUserPreferences } from '../../../hooks/currentUserStore/useCurrentUserStore';
import {
  getCustomizeColumnDetails,
  getReorderedColumns,
} from '../../../utils/CustomizeColumnUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import Loader from '../Loader/Loader';
import NextPrevious from '../NextPrevious/NextPrevious';
import Searchbar from '../SearchBarComponent/SearchBar.component';
import DraggableMenuItemV2 from './DraggableMenu/DraggableMenuItemV2.component';
import {
  TableColumnDropdownList,
  TableComponentProps,
} from './Table.interface';
import './table.less';
import type {
  AriaSelection,
  AriaSortDescriptor,
  FlatRow,
} from './TableV2.interface';
import {
  flattenTreeRows,
  getColumnStickyStyle,
  resolveCellValue,
  resolveColumnTitle,
} from './TableV2Utils';

/**
 * Props AntD's Table accepts that TableV2 cannot honour. Omitting them makes a
 * call site fail to compile rather than render a table that quietly lost a
 * feature:
 *  - `summary`    React Aria's collection builder discards any table child that
 *                 is not a Header or Body, so a `tfoot` never reaches the DOM,
 *                 and a summary drawn outside the table would not line up with
 *                 the columns. Needs a summary slot in ui-core-components.
 *  - `components` custom row/cell renderers have no equivalent — use
 *                 `dragAndDropHooks` for drag rows, or a column `render`.
 */
type UnsupportedProps = 'summary' | 'components';

type CustomPaginationProps = NonNullable<
  TableComponentProps<never>['customPaginationProps']
>;

/**
 * `customPaginationProps` means the parent owns paging and has already fetched
 * exactly the rows for this page — internal pagination must be off or the page
 * gets sliced twice (a 50-row server page rendered as 10). Requiring
 * `pagination={false}` alongside it makes that intent explicit at every call
 * site instead of leaving it to convention.
 */
type PaginationContract<T> =
  | {
      customPaginationProps?: undefined;
      pagination?: TableComponentProps<T>['pagination'];
    }
  | { customPaginationProps: CustomPaginationProps; pagination: false };

type TableV2Props<T extends object> = Omit<
  TableComponentProps<T>,
  UnsupportedProps | 'customPaginationProps' | 'pagination'
> &
  PaginationContract<T>;

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_INDENT_PX = 12;
const EXPANDER_GUTTER_PX = 16;

/** AntD's size scale mapped onto the core component's. */
const CORE_SIZE_BY_ANTD_SIZE: Record<string, 'compact' | 'sm' | 'md'> = {
  small: 'compact',
  middle: 'sm',
  large: 'md',
};

const toCoreSize = (size: TableComponentProps<never>['size']) =>
  CORE_SIZE_BY_ANTD_SIZE[size ?? 'middle'] ?? 'sm';

/**
 * Internal pagination is off whenever the parent owns paging, so a server page
 * is never sliced a second time.
 */
const resolveClientPagination = <T,>(
  pagination: TableComponentProps<T>['pagination'],
  pageSizeOverride: number | null,
  hasParentPagination: boolean
) => {
  if (pagination === false || hasParentPagination) {
    return null;
  }
  const cfg = (pagination ?? {}) as TablePaginationConfig;

  return {
    pageSize: pageSizeOverride ?? (cfg.pageSize as number) ?? DEFAULT_PAGE_SIZE,
    hideOnSinglePage: cfg.hideOnSinglePage ?? false,
    showSizeChanger: cfg.showSizeChanger ?? false,
    pageSizeOptions: (cfg.pageSizeOptions ?? []).map(Number),
    onShowSizeChange: cfg.onShowSizeChange,
  };
};

/** Tree depth is drawn as left padding on the cell that carries the expander. */
const getIndentStyle = (
  showExpander: boolean,
  depth: number,
  indentSize: number | undefined
): React.CSSProperties =>
  showExpander
    ? {
        paddingLeft: `${
          EXPANDER_GUTTER_PX + depth * (indentSize ?? DEFAULT_INDENT_PX)
        }px`,
      }
    : {};

const toAriaDirection = (order: 'ascend' | 'descend') =>
  order === 'descend' ? ('descending' as const) : ('ascending' as const);

/**
 * React Aria always opens a fresh sort on 'ascending'. AntD lets a column say
 * which way the first click should go via `sortDirections`, so honour the head
 * of that list when the sort moves to a different column.
 */
const resolveSortDirection = <T,>(
  column: ColumnType<T> | undefined,
  isFirstClickOnColumn: boolean,
  fallback: 'ascending' | 'descending' | null
) => {
  const preferred = column?.sortDirections?.[0];

  if (!isFirstClickOnColumn || !preferred) {
    return fallback;
  }

  return toAriaDirection(preferred);
};

/**
 * `expandedRowRender` draws a detail panel in a row of its own beneath the
 * record, spanning every column — AntD's shape, rebuilt on the core Row/Cell.
 */
const buildExpandedDetailRow = <T extends object>(
  expandable: TableComponentProps<T>['expandable'],
  flatRow: FlatRow<T>,
  isExpanded: boolean,
  columnCount: number
) => {
  const renderDetail = expandable?.expandedRowRender;

  if (!renderDetail || !isExpanded || !flatRow.hasChildren) {
    return null;
  }

  return (
    <UntitledTable.Row
      id={`${flatRow.rowKey}-expanded`}
      key={`${flatRow.rowKey}-expanded`}>
      <UntitledTable.Cell
        className="tw:py-2 tw:pl-4 tw:pr-2"
        colSpan={columnCount}>
        {renderDetail(flatRow.record, flatRow.actualIndex, flatRow.depth, isExpanded)}
      </UntitledTable.Cell>
    </UntitledTable.Row>
  );
};

/**
 * Row-level DOM wiring. When `dragAndDropHooks` is supplied React Aria owns drag
 * and drop, so the call site's native HTML5 drag handlers must not also be
 * attached — they would fight each other.
 *
 * `onAction` is what makes `onClick` work at all: React Aria strips a row's
 * click handler unless the row is interactive. The empty action marks it
 * interactive so the call site's handler still receives a real MouseEvent,
 * without adding a second activation path that would fire it twice.
 */
/**
 * Derived from the row component's own props rather than from
 * `HTMLAttributes`: React Aria's Row types several of these itself, so a
 * hand-written shape drifts from what the component actually accepts.
 */
type RowInteractionProps = Pick<
  React.ComponentProps<typeof UntitledTable.Row>,
  | 'draggable'
  | 'onAction'
  | 'onClick'
  | 'onDoubleClick'
  | 'onDragEnd'
  | 'onDragEnter'
  | 'onDragLeave'
  | 'onDragOver'
  | 'onDragStart'
  | 'onDrop'
>;

const getRowInteractionProps = (
  rowHandlers: RowInteractionProps,
  hasAriaDragAndDrop: boolean
): RowInteractionProps => {
  const activation = {
    onAction: rowHandlers.onClick ? noop : undefined,
    onClick: rowHandlers.onClick,
    onDoubleClick: rowHandlers.onDoubleClick,
  };

  if (hasAriaDragAndDrop) {
    return activation;
  }

  const {
    draggable,
    onDragEnd,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDragStart,
    onDrop,
  } = rowHandlers;

  return {
    ...activation,
    draggable,
    onDragEnd,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDragStart,
    onDrop,
  };
};

/**
 * React Aria keys rows and columns in one namespace, so a column id is only safe
 * if nothing else in the table can produce it. Two things break that, and AntD
 * tolerates both:
 *
 *  - two columns sharing a `key` — AntD renders both; React Aria collapses them
 *    and the row then has more cells than there are columns;
 *  - a row whose key equals a column's key — common here, where schema tables
 *    render an entity's columns as rows with names like `name` or `description`.
 *    The column disappears and the table throws "Cell count must match column
 *    count. Found 3 cells and 0 columns."
 *
 * Prefixing keeps column ids clear of row ids, and suffixing repeats keeps them
 * unique among themselves. Both are internal: `columnKeys` carries the original
 * key for anything reported back to the call site.
 */
const COLUMN_ID_PREFIX = 'col:';

const getColumnKeys = <T,>(columns: ColumnsType<T>): string[] =>
  columns.map((col, idx) =>
    String(col.key ?? (col as ColumnType<T>).dataIndex ?? idx)
  );

const getColumnIds = (columnKeys: string[]): string[] => {
  const seen = new Map<string, number>();

  return columnKeys.map((key) => {
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);

    return count === 0
      ? `${COLUMN_ID_PREFIX}${key}`
      : `${COLUMN_ID_PREFIX}${key}-${count}`;
  });
};

const TableV2 = <T extends object>(
  {
    loading,
    searchProps,
    customPaginationProps,
    entityType,
    defaultVisibleColumns,
    dragAndDropHooks,
    'data-testid': dataTestId,
    scroll,
    ...rest
  }: TableV2Props<T>,
  ref: Ref<HTMLDivElement> | null | undefined
) => {
  const { t } = useTranslation();
  const { type } = useGenericContext();
  const [reorderedList, setReorderedList] = useState<
    TableColumnDropdownList[] | null
  >(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);
  const [pageSizeOverride, setPageSizeOverride] = useState<number | null>(null);
  const [sortState, setSortState] = useState<{
    columnKey: string | null;
    direction: 'ascending' | 'descending' | null;
  }>({ columnKey: null, direction: null });
  const [dropdownColumnList, setDropdownColumnList] = useState<
    TableColumnDropdownList[]
  >([]);
  const [columnDropdownSelections, setColumnDropdownSelections] = useState<
    string[]
  >([]);
  const [internalExpandedKeys, setInternalExpandedKeys] = useState<Set<string>>(
    new Set()
  );
  const [filterState, setFilterState] = useState<Record<string, React.Key[]>>(
    {}
  );
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const {
    preferences: { selectedEntityTableColumns },
    setPreference,
  } = useCurrentUserPreferences();

  const isLoading = useMemo(
    () =>
      (loading as { spinning?: boolean })?.spinning ??
      (loading as boolean) ??
      false,
    [loading]
  );

  const entityKey = useMemo(() => entityType ?? type, [type, entityType]);

  // The props type already requires `pagination={false}` alongside
  // `customPaginationProps`; this keeps the page intact even when that contract
  // is bypassed at an untyped boundary.
  const hasParentPagination = Boolean(customPaginationProps);

  const clientPagination = useMemo(
    () =>
      resolveClientPagination(
        rest.pagination,
        pageSizeOverride,
        hasParentPagination
      ),
    [rest.pagination, pageSizeOverride, hasParentPagination]
  );

  /**
   * Changing the page size invalidates the current page — AntD resets to the
   * first page, and so must we, or a reader on page 6 of 12 lands past the end
   * of a now-shorter list.
   */
  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSizeOverride(size);
      setInternalCurrentPage(1);
      clientPagination?.onShowSizeChange?.(1, size);
    },
    [clientPagination]
  );

  const isCustomizeColumnEnable = useMemo(
    () =>
      !isEmpty(rest.staticVisibleColumns) && !isEmpty(defaultVisibleColumns),
    [rest.staticVisibleColumns, defaultVisibleColumns]
  );

  const scrollStyle = useMemo((): React.CSSProperties => {
    if (!scroll) {
      return {};
    }

    return {
      ...(scroll.x ? { overflowX: 'auto' } : {}),
    };
  }, [scroll?.x]);

  /**
   * Derived, not state: seeding this from an effect left the first render with
   * zero columns, and React Aria registers the column collection on that render
   * — the body then renders cells against an empty header and throws "Cell
   * count must match column count".
   */
  const propsColumns = useMemo((): ColumnsType<T> => {
    const columns = rest.columns ?? [];
    if (!isCustomizeColumnEnable) {
      return columns;
    }
    const visible = columns.filter(
      (item) =>
        columnDropdownSelections.includes(item.key as string) ||
        (rest.staticVisibleColumns ?? []).includes(item.key as string)
    );

    return getReorderedColumns(reorderedList ?? dropdownColumnList, visible);
  }, [
    rest.columns,
    isCustomizeColumnEnable,
    columnDropdownSelections,
    rest.staticVisibleColumns,
    reorderedList,
    dropdownColumnList,
  ]);

  const columnKeys = useMemo(() => getColumnKeys(propsColumns), [propsColumns]);
  const columnIds = useMemo(() => getColumnIds(columnKeys), [columnKeys]);

  /**
   * A column carrying `sortOrder` drives the sort, exactly as in AntD — the
   * prop is controlled by the parent and outranks whatever the user last
   * clicked. Falls back to the internal (uncontrolled) state when no column
   * declares one.
   */
  const controlledSort = useMemo(() => {
    const idx = propsColumns.findIndex((c) => (c as ColumnType<T>).sortOrder);
    if (idx === -1) {
      return null;
    }
    const col = propsColumns[idx] as ColumnType<T>;

    return {
      columnKey: columnIds[idx],
      direction: toAriaDirection(col.sortOrder === 'descend' ? 'descend' : 'ascend'),
    };
  }, [propsColumns, columnIds]);

  const effectiveSort = controlledSort ?? sortState;

  const sortedDataSource = useMemo((): T[] => {
    const data = (rest.dataSource ?? []) as T[];
    if (!effectiveSort.columnKey || !effectiveSort.direction) {
      return data;
    }
    const col = propsColumns.find(
      (_c, idx) => columnIds[idx] === effectiveSort.columnKey
    ) as ColumnType<T> | undefined;

    if (!col?.sorter || typeof col.sorter !== 'function') {
      return data;
    }
    const compareFn = col.sorter as (a: T, b: T) => number;
    const sorted = [...data].sort((a, b) => compareFn(a, b));

    return effectiveSort.direction === 'descending' ? sorted.reverse() : sorted;
  }, [rest.dataSource, effectiveSort, propsColumns, columnIds]);

  const filteredDataSource = useMemo((): T[] => {
    const activeFilters = Object.entries(filterState).filter(
      ([, keys]) => keys.length > 0
    );
    if (!activeFilters.length) {
      return sortedDataSource;
    }

    return sortedDataSource.filter((record) =>
      activeFilters.every(([colKey, selectedKeys]) => {
        const col = propsColumns.find(
          (_c, idx) => columnIds[idx] === colKey
        ) as ColumnType<T> | undefined;

        return col?.onFilter
          ? selectedKeys.some((key) =>
              col.onFilter!(key as React.Key | boolean, record)
            )
          : true;
      })
    );
  }, [sortedDataSource, filterState, propsColumns, columnIds]);

  const pagedDataSource = useMemo((): T[] => {
    if (!clientPagination) {
      return filteredDataSource;
    }
    const start = (internalCurrentPage - 1) * clientPagination.pageSize;

    return filteredDataSource.slice(start, start + clientPagination.pageSize);
  }, [filteredDataSource, clientPagination, internalCurrentPage]);

  const expandedKeys = useMemo<Set<string>>(() => {
    if (!rest.expandable) {
      return new Set<string>();
    }

    return rest.expandable.expandedRowKeys
      ? new Set(rest.expandable.expandedRowKeys.map(String))
      : internalExpandedKeys;
  }, [rest.expandable, internalExpandedKeys]);

  // ─── Column customization (identical to Table.tsx) ───────────────────────

  const handleMoveItem = useCallback(
    (updatedList: TableColumnDropdownList[]) => {
      setDropdownColumnList(updatedList);
      setReorderedList(updatedList);
    },
    []
  );

  const handleColumnItemSelect = useCallback(
    (key: string, selected: boolean) => {
      const updatedSelections = selected
        ? [...columnDropdownSelections, key]
        : columnDropdownSelections.filter((item) => item !== key);

      setPreference({
        selectedEntityTableColumns: {
          ...selectedEntityTableColumns,
          [entityKey]: updatedSelections,
        },
      });

      setColumnDropdownSelections(updatedSelections);
    },
    [columnDropdownSelections, selectedEntityTableColumns, entityKey]
  );

  const handleBulkColumnAction = useCallback(() => {
    if (dropdownColumnList.length === columnDropdownSelections.length) {
      setColumnDropdownSelections([]);
      setPreference({
        selectedEntityTableColumns: {
          ...selectedEntityTableColumns,
          [entityKey]: [],
        },
      });
    } else {
      const columns = dropdownColumnList.map((option) => option.value);
      setColumnDropdownSelections(columns);
      setPreference({
        selectedEntityTableColumns: {
          ...selectedEntityTableColumns,
          [entityKey]: columns,
        },
      });
    }
  }, [
    dropdownColumnList,
    columnDropdownSelections,
    selectedEntityTableColumns,
    entityKey,
  ]);

  // ─── Row key ──────────────────────────────────────────────────────────────

  const getRowKey = useCallback(
    (record: T, index: number): string => {
      if (typeof rest.rowKey === 'function') {
        return String((rest.rowKey as (record: T) => string | number)(record));
      }
      if (typeof rest.rowKey === 'string') {
        const val = (record as Record<string, unknown>)[rest.rowKey];

        return val !== undefined && val !== null ? String(val) : String(index);
      }

      return String(index);
    },
    [rest.rowKey]
  );

  // ─── Expand toggle ────────────────────────────────────────────────────────

  const handleExpandToggle = useCallback(
    (record: T, rowKey: string) => {
      const isExpanded = expandedKeys.has(rowKey);
      const next = isExpanded
        ? new Set([...expandedKeys].filter((k) => k !== rowKey))
        : new Set([...expandedKeys, rowKey]);

      if (!rest.expandable?.expandedRowKeys) {
        setInternalExpandedKeys(next);
      }
      rest.expandable?.onExpand?.(!isExpanded, record);
      rest.expandable?.onExpandedRowsChange?.([...next]);
    },
    [expandedKeys, rest.expandable]
  );

  // ─── Row selection ────────────────────────────────────────────────────────

  // AntD default rowSelection.type is 'checkbox', which maps to 'multiple'.
  // Passing type: undefined with a truthy rowSelection object also yields 'multiple'.
  const selectionMode = useMemo((): 'none' | 'single' | 'multiple' => {
    if (!rest.rowSelection) {
      return 'none';
    }

    return rest.rowSelection.type === 'radio' ? 'single' : 'multiple';
  }, [rest.rowSelection]);

  /**
   * AntD blocks selection per row through `getCheckboxProps().disabled`, leaving
   * the row itself interactive. `disabledBehavior="selection"` is React Aria's
   * equivalent: the row keeps focus and row actions, only selection is refused.
   */
  const disabledRowKeys = useMemo((): Set<string> | undefined => {
    const getCheckboxProps = rest.rowSelection?.getCheckboxProps;
    if (!getCheckboxProps) {
      return undefined;
    }

    return new Set(
      filteredDataSource
        .map((record, index) => ({ key: getRowKey(record, index), record }))
        .filter(({ record }) => getCheckboxProps(record).disabled)
        .map(({ key }) => key)
    );
  }, [rest.rowSelection, filteredDataSource, getRowKey]);

  const handleSelectionChange = useCallback(
    (keys: AriaSelection) => {
      if (!rest.rowSelection?.onChange) {
        return;
      }
      const dataSource = filteredDataSource;
      const selectedKeys =
        keys === 'all'
          ? dataSource.map((r, i) => getRowKey(r, i))
          : [...keys].map(String);
      const selectedRows = dataSource.filter((r, i) =>
        selectedKeys.includes(getRowKey(r, i))
      );

      rest.rowSelection.onChange(selectedKeys, selectedRows, {
        type: selectionMode === 'single' ? 'single' : 'multiple',
      });
    },
    [rest.rowSelection, filteredDataSource, getRowKey, selectionMode]
  );

  // ─── Column resize (via React Aria ColumnResizer) ──────────────────────────

  const handleColumnResize = useCallback(
    (widths: Map<string | number | symbol, number | string>) => {
      setColumnWidths((prev) => {
        const next = { ...prev };
        widths.forEach((w, k) => {
          next[String(k)] = Number(w);
        });

        return next;
      });
    },
    []
  );

  // ─── Sorting ──────────────────────────────────────────────────────────────

  const handleSortChange = useCallback(
    (descriptor: AriaSortDescriptor) => {
      const newKey = descriptor.column ? String(descriptor.column) : null;
      const clickedIndex = columnIds.findIndex((id) => id === newKey);
      const clickedColumn = propsColumns[clickedIndex] as
        | ColumnType<T>
        | undefined;
      const reportedKey = columnKeys[clickedIndex] ?? '';

      const newDirection = resolveSortDirection(
        clickedColumn,
        sortState.columnKey !== newKey,
        descriptor.direction ?? null
      );
      setSortState({ columnKey: newKey, direction: newDirection });

      if (!rest.onChange) {
        return;
      }


      rest.onChange(
        {
          current: internalCurrentPage,
          pageSize: clientPagination?.pageSize ?? 10,
          total: filteredDataSource.length,
        } as TablePaginationConfig,
        {} as Record<string, FilterValue | null>,
        {
          column: clickedColumn,
          columnKey: reportedKey,
          field: reportedKey,
          order:
            newDirection === 'ascending'
              ? 'ascend'
              : newDirection === 'descending'
              ? 'descend'
              : null,
        } as SorterResult<T>,
        {
          currentDataSource: (rest.dataSource ?? []) as T[],
          action: 'sort',
        } as TableCurrentDataSource<T>
      );
    },
    [
      rest.onChange,
      propsColumns,
      rest.dataSource,
      internalCurrentPage,
      clientPagination,
      sortState.columnKey,
      columnIds,
      columnKeys,
    ]
  );

  // ─── Search ───────────────────────────────────────────────────────────────

  const handleSearchAction = (value: string) => {
    searchProps?.onSearch?.(value);
  };

  // ─── Column state effects (identical to Table.tsx) ────────────────────────

  useEffect(() => {
    if (isCustomizeColumnEnable) {
      const newList = getCustomizeColumnDetails<T>(
        rest.columns,
        rest.staticVisibleColumns
      );
      setDropdownColumnList((prev) =>
        isEqual(prev, newList) ? prev : newList
      );
    }
  }, [isCustomizeColumnEnable, rest.columns, rest.staticVisibleColumns]);

  useEffect(() => {
    if (isCustomizeColumnEnable) {
      setColumnDropdownSelections(
        selectedEntityTableColumns?.[entityKey] ?? defaultVisibleColumns ?? []
      );
    }
  }, [
    isCustomizeColumnEnable,
    selectedEntityTableColumns,
    entityKey,
    defaultVisibleColumns,
  ]);

  const dataSourceLength = filteredDataSource.length;
  useEffect(() => {
    const maxPage = clientPagination
      ? Math.ceil(dataSourceLength / clientPagination.pageSize) || 1
      : 1;
    if (internalCurrentPage > maxPage) {
      setInternalCurrentPage(1);
    }
  }, [dataSourceLength, clientPagination, internalCurrentPage]);

  /** NextPrevious renders its page-size dropdown only when handed a handler. */
  const sizeChangerProps = useMemo(() => {
    if (!clientPagination?.showSizeChanger) {
      return {};
    }
    const { pageSizeOptions } = clientPagination;

    return {
      onShowSizeChange: handlePageSizeChange,
      ...(pageSizeOptions.length ? { pageSizeOptions } : {}),
    };
  }, [clientPagination, handlePageSizeChange]);


  // ─── Flat rows (tree data flattened with depth tracking) ──────────────────

  const flatRows = useMemo<FlatRow<T>[]>(() => {
    if (!rest.expandable) {
      return pagedDataSource.map((record, idx) => {
        const actualIndex = clientPagination
          ? (internalCurrentPage - 1) * clientPagination.pageSize + idx
          : idx;

        return {
          record,
          depth: 0,
          actualIndex,
          hasChildren: false,
          rowKey: getRowKey(record, actualIndex),
        };
      });
    }

    const rows = flattenTreeRows(
      pagedDataSource,
      getRowKey,
      expandedKeys,
      rest.expandable.rowExpandable as ((r: T) => boolean) | undefined
    );

    // With `expandedRowRender` the detail panel is the child, so a row is
    // expandable even though it carries no `children` array — which is all
    // `flattenTreeRows` looks at.
    if (!rest.expandable.expandedRowRender) {
      return rows;
    }
    const rowExpandable = rest.expandable.rowExpandable as
      | ((r: T) => boolean)
      | undefined;

    return rows.map((row) => ({
      ...row,
      hasChildren: rowExpandable ? rowExpandable(row.record) : true,
    }));
  }, [
    pagedDataSource,
    rest.expandable,
    expandedKeys,
    getRowKey,
    internalCurrentPage,
    clientPagination,
  ]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className={classNames(
        'table-container',
        'tw:[&_tbody_tr:hover_td]:bg-secondary',
        rest.containerClassName
      )}
      ref={ref}>
      <div
        className={classNames('p-x-md', {
          'p-y-md':
            searchProps || rest.extraTableFilters || isCustomizeColumnEnable,
        })}
        data-testid="table-toolbar">
        <div className="tw:flex tw:items-center">
          {searchProps && (
            <div style={{ flex: 1 }}>
              <Searchbar
                {...searchProps}
                removeMargin
                placeholder={searchProps?.placeholder ?? t('label.search')}
                searchValue={searchProps?.searchValue}
                typingInterval={searchProps?.typingInterval ?? 500}
                onSearch={handleSearchAction}
              />
            </div>
          )}
          {(rest.extraTableFilters || isCustomizeColumnEnable) && (
            <div
              className={classNames(
                'd-flex justify-end items-center gap-5',
                rest.extraTableFiltersClassName
              )}
              style={{ flex: 1 }}>
              {rest.extraTableFilters}
              {isCustomizeColumnEnable && (
                <Dropdown.Root>
                  <Button
                    color="tertiary"
                    data-testid="column-dropdown"
                    iconLeading={ColumnIcon}
                    size="sm"
                    title={t('label.show-or-hide-column-plural')}>
                    {t('label.customize')}
                  </Button>
                  <Dropdown.Popover>
                    <Dropdown.Menu>
                      <Dropdown.SectionHeader className="tw:px-3 tw:py-1.5  tw:flex tw:justify-between tw:items-center">
                        <Typography
                          className="tw:text-tertiary"
                          data-testid="column-dropdown-title"
                          weight="medium">
                          {t('label.column')}
                        </Typography>
                        <Button
                          color="link-color"
                          data-testid="column-dropdown-action-button"
                          size="xs"
                          onClick={handleBulkColumnAction}>
                          {dropdownColumnList.length ===
                          columnDropdownSelections.length
                            ? t('label.hide-all')
                            : t('label.view-all')}
                        </Button>
                      </Dropdown.SectionHeader>

                      <Dropdown.Separator />
                      <Dropdown.Section>
                        {dropdownColumnList.map((item, index) => (
                          <DraggableMenuItemV2
                            currentItem={item}
                            index={index}
                            itemList={dropdownColumnList}
                            key={item.value}
                            selectedOptions={columnDropdownSelections}
                            onMoveItem={handleMoveItem}
                            onSelect={handleColumnItemSelect}
                          />
                        ))}
                      </Dropdown.Section>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown.Root>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        className="tw:flex tw:flex-col tw:w-full"
        data-testid={dataTestId}
        style={scrollStyle}>
        {isLoading && (
          <div className="tw:absolute tw:inset-0 tw:z-10 tw:flex tw:items-center tw:justify-center tw:bg-primary/60">
            <Loader />
          </div>
        )}

        {(() => {
          const tableContent = (
            <UntitledTable
              stickyHeader
              aria-label="data-table"
              className={classNames(rest.className, {
                'tw:table-fixed': rest.resizableColumns,
              })}
              containerStyle={
                scroll?.y
                  ? {
                      maxHeight: scroll.y as string | number,
                      overflowY: 'auto',
                    }
                  : undefined
              }
              disabledBehavior="selection"
              disabledKeys={disabledRowKeys}
              dragAndDropHooks={dragAndDropHooks}
              selectedKeys={
                rest.rowSelection?.selectedRowKeys
                  ? new Set(rest.rowSelection.selectedRowKeys.map(String))
                  : undefined
              }
              selectionBehavior={rest.rowSelection ? 'toggle' : undefined}
              selectionMode={selectionMode}
              size={toCoreSize(rest.size)}
              sortDescriptor={
                effectiveSort.columnKey && effectiveSort.direction
                  ? {
                      column: effectiveSort.columnKey,
                      direction: effectiveSort.direction,
                    }
                  : undefined
              }
              onRowAction={rest.onRowAction}
              onSelectionChange={handleSelectionChange}
              onSortChange={handleSortChange}>
              <UntitledTable.Header className="tw:px-2">
                {propsColumns.map((col, colIdx) => {
                  const colType = col as ColumnType<T>;
                  const rowHeaderColumn = colType as ColumnType<T> & {
                    isRowHeader?: boolean;
                  };
                  const colKey = columnIds[colIdx];
                  const colWidth =
                    columnWidths[colKey] ??
                    (colType.width as number | undefined);

                  const stickyStyle = getColumnStickyStyle(colType.fixed, 2);

                  return (
                    <UntitledTable.Head
                      allowsSorting={!!colType.sorter}
                      className="tw:py-2 tw:pl-4 tw:pr-2 tw:text-sm tw:text-tertiary"
                      id={colKey}
                      isRowHeader={rowHeaderColumn.isRowHeader ?? colIdx === 0}
                      key={colKey}
                      style={{
                        ...(rest.size === 'small' ? { padding: '8px' } : {}),
                        ...(colWidth !== undefined
                          ? { width: colWidth, minWidth: colWidth }
                          : {}),
                        ...(rest.resizableColumns
                          ? { position: 'relative' }
                          : {}),
                        ...stickyStyle,
                      }}>
                      <div
                        className="tw:flex tw:items-center tw:gap-1"
                        data-testid="column-header-content">
                        {resolveColumnTitle(colType, propsColumns)}
                        {Boolean(colType.filters || colType.filterDropdown) && (
                          <DialogTrigger
                            isOpen={openFilterKey === colKey}
                            onOpenChange={(isOpen) =>
                              setOpenFilterKey(isOpen ? colKey : null)
                            }>
                            {/*
                              `DialogTrigger` opens its popover through a React
                              Aria `PressResponder`, which only reaches a React
                              Aria pressable child. A core `Button` here is not
                              one — it warns "PressResponder was rendered
                              without a pressable child" and the dropdown never
                              opens. */}
                            <AriaButton
                              aria-label="filter"
                              className="tw:ml-1 tw:p-0 tw:bg-transparent tw:border-0 tw:cursor-pointer tw:inline-flex tw:items-center"
                              data-testid="filter-trigger">
                              {typeof colType.filterIcon === 'function'
                                ? colType.filterIcon(
                                    Boolean(filterState[colKey]?.length)
                                  )
                                : colType.filterIcon ?? null}
                            </AriaButton>
                            <Popover placement="bottom right">
                              <Dialog className="tw:outline-none">
                                <div
                                  className="tw:bg-primary tw:shadow-lg tw:outline-1 tw:outline-secondary_alt tw:rounded-lg"
                                  data-testid="filter-dropdown"
                                  style={{ minWidth: '200px' }}>
                                  {typeof colType.filterDropdown === 'function'
                                    ? colType.filterDropdown({
                                        prefixCls: 'ant-table-filter-dropdown',
                                        setSelectedKeys: (keys) =>
                                          setFilterState((prev) => ({
                                            ...prev,
                                            [colKey]: keys,
                                          })),
                                        selectedKeys: filterState[colKey] ?? [],
                                        confirm: () => setOpenFilterKey(null),
                                        clearFilters: () =>
                                          setFilterState((prev) => {
                                            const next = { ...prev };
                                            delete next[colKey];

                                            return next;
                                          }),
                                        filters: colType.filters,
                                        visible: true,
                                        close: () => setOpenFilterKey(null),
                                      })
                                    : colType.filterDropdown}
                                </div>
                              </Dialog>
                            </Popover>
                          </DialogTrigger>
                        )}
                      </div>
                      {rest.resizableColumns && (
                        <ColumnResizer
                          className="tw:absolute tw:right-0 tw:top-1/4 tw:h-1/2 tw:w-2 tw:cursor-col-resize 
                        tw:touch-none tw:after:absolute tw:after:left-1/2 tw:after:h-full tw:after:w-px tw:after:-translate-x-1/2 tw:after:content-[''] 
                        tw:after:bg-border-secondary tw:data-[resizing]:after:w-0.5 tw:data-[resizing]:after:bg-border-brand"
                        />
                      )}
                    </UntitledTable.Head>
                  );
                })}
              </UntitledTable.Header>

              <UntitledTable.Body
                renderEmptyState={() =>
                  isLoading ? null : (
                    <div className="tw:py-8 tw:text-center tw:text-sm tw:text-fg-tertiary">
                      {(rest.locale?.emptyText as ReactNode) ??
                        t('label.no-data')}
                    </div>
                  )
                }>
                {flatRows.flatMap((flatRow) => {
                  const { record, actualIndex, depth, hasChildren, rowKey } =
                    flatRow;
                  // AntD types `onRow`'s return as HTMLAttributes<any>, while
                  // React Aria's Row types several of the same handlers itself.
                  // This is the boundary between the two, narrowed once.
                  const rowHandlers = (rest.onRow?.(record, actualIndex) ??
                    {}) as RowInteractionProps;
                  const isExpanded = expandedKeys.has(rowKey);
                  const detailRow = buildExpandedDetailRow(
                    rest.expandable,
                    flatRow,
                    isExpanded,
                    propsColumns.length
                  );

                  return [
                    <UntitledTable.Row
                      className={classNames(
                        'tw:group tw:transition-colors tw:hover:bg-secondary tw:data-[selected]:bg-secondary',
                        typeof rest.rowClassName === 'function'
                          ? rest.rowClassName(record, actualIndex, depth)
                          : rest.rowClassName
                      )}
                      data-level={depth}
                      data-row-key={rowKey}
                      id={rowKey}
                      key={rowKey}
                      {...getRowInteractionProps(
                        rowHandlers,
                        Boolean(dragAndDropHooks)
                      )}>
                      {propsColumns.map((col, colIdx) => {
                        const colType = col as ColumnType<T>;
                        const cellKey = columnIds[colIdx];
                        const stickyStyle = getColumnStickyStyle(
                          colType.fixed,
                          1
                        );

                        const isFirstColumn = colIdx === 0;
                        const showExpandInCell =
                          rest.expandable && isFirstColumn;
                        const ExpandIcon = rest.expandable?.expandIcon;
                        const cellHandlerProps =
                          (colType.onCell?.(
                            record,
                            actualIndex
                          ) as React.TdHTMLAttributes<HTMLTableCellElement>) ??
                          {};

                        return (
                          <UntitledTable.Cell
                            {...cellHandlerProps}
                            className={classNames(
                              colType.ellipsis && 'tw:overflow-hidden',
                              rest.cellClassName ??
                                'tw:py-2 tw:pl-4 tw:pr-2 tw:align-top',
                              'tw:group-data-[dragging]:opacity-40',
                              'tw:group-data-[drop-target]:bg-[#e8f4ff] tw:group-data-[drop-target]:outline tw:group-data-[drop-target]:outline-2',
                              'tw:group-data-[drop-target]:outline-dashed tw:group-data-[drop-target]:outline-[--color-border-brand] tw:group-data-[drop-target]:-outline-offset-2'
                            )}
                            key={cellKey}
                            style={{
                              ...(rest.size === 'small' && !rest.cellClassName
                                ? { padding: '8px' }
                                : {}),
                              ...(columnWidths[cellKey] !== undefined ||
                              colType.width !== undefined
                                ? {
                                    width:
                                      columnWidths[cellKey] ??
                                      (colType.width as number),
                                    minWidth:
                                      (colType.width as number) ?? undefined,
                                  }
                                : {}),
                              ...stickyStyle,
                              ...getIndentStyle(
                                Boolean(showExpandInCell),
                                depth,
                                rest.indentSize
                              ),
                              ...cellHandlerProps.style,
                            }}>
                            <div
                              className={classNames(
                                'tw:flex tw:gap-1 tw:max-w-full'
                              )}>
                              {showExpandInCell && (
                                <div className="tw:flex tw:items-center tw:shrink-0">
                                  {hasChildren ? (
                                    ExpandIcon ? (
                                      <ExpandIcon
                                        expandable={hasChildren}
                                        expanded={isExpanded}
                                        prefixCls=""
                                        record={record}
                                        onExpand={(rec, e) => {
                                          e.stopPropagation();
                                          handleExpandToggle(rec as T, rowKey);
                                        }}
                                      />
                                    ) : (
                                      <button
                                        aria-expanded={isExpanded}
                                        className="tw:p-0 tw:bg-transparent tw:border-0 tw:cursor-pointer tw:mr-1 tw:inline-flex"
                                        data-testid="expand-icon"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleExpandToggle(record, rowKey);
                                        }}>
                                        {isExpanded ? (
                                          <ChevronDown className="tw:size-4" />
                                        ) : (
                                          <ChevronRight className="tw:size-4" />
                                        )}
                                      </button>
                                    )
                                  ) : ExpandIcon ? (
                                    <ExpandIcon
                                      expandable={false}
                                      expanded={false}
                                      prefixCls=""
                                      record={record}
                                      onExpand={(_rec, _e) => {}}
                                    />
                                  ) : (
                                    <span className="tw:inline-block tw:w-4 tw:mr-1" />
                                  )}
                                </div>
                              )}
                              {colType.ellipsis ? (
                                <div className="tw:flex-1 tw:min-w-0 tw:truncate">
                                  {resolveCellValue(
                                    colType,
                                    record,
                                    actualIndex
                                  )}
                                </div>
                              ) : (
                                resolveCellValue(colType, record, actualIndex)
                              )}
                            </div>
                          </UntitledTable.Cell>
                        );
                      })}
                    </UntitledTable.Row>,
                    detailRow,
                  ].filter(Boolean);
                })}
              </UntitledTable.Body>
            </UntitledTable>
          );

          return rest.resizableColumns ? (
            <ResizableTableContainer
              className="tw:overflow-auto tw:relative"
              onResize={handleColumnResize}>
              {tableContent}
            </ResizableTableContainer>
          ) : (
            tableContent
          );
        })()}
      </div>

      {rest.footer && (
        <div className="tw:px-4 tw:py-2 tw:text-sm tw:text-tertiary">
          {rest.footer(pagedDataSource)}
        </div>
      )}

      {customPaginationProps && customPaginationProps.showPagination ? (
        <div>
          <NextPrevious {...customPaginationProps} />
        </div>
      ) : clientPagination &&
        !(
          clientPagination.hideOnSinglePage &&
          filteredDataSource.length <= clientPagination.pageSize
        ) ? (
        <div>
          <NextPrevious
            isNumberBased
            currentPage={internalCurrentPage}
            pageSize={clientPagination.pageSize}
            paging={{ total: filteredDataSource.length }}
            pagingHandler={({ currentPage }) =>
              setInternalCurrentPage(currentPage)
            }
            {...sizeChangerProps}
          />
        </div>
      ) : null}
    </div>
  );
};

type TableV2WithGenerics = <T extends object>(
  props: TableV2Props<T> & RefAttributes<HTMLDivElement>
) => ReactElement | null;

export default forwardRef(TableV2) as unknown as TableV2WithGenerics;
