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
  EmptyPlaceholder,
  PaginationCardWithControls,
  Table as UntitledTable,
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronDown, ChevronRight, SearchLg } from '@untitledui/icons';
import classNames from 'classnames';
import { isEmpty, isEqual, noop } from 'lodash';
import type { ComponentProps } from 'react';
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
import { computeTotalPages } from '../../../utils/PaginationUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import Loader from '../Loader/Loader';
import NextPrevious from '../NextPrevious/NextPrevious';
import Searchbar from '../SearchBarComponent/SearchBar.component';
import DraggableMenuItemV2 from './DraggableMenu/DraggableMenuItemV2.component';
import type {
  ColumnsType,
  ColumnType,
  FilterValue,
  SorterResult,
  TableCurrentDataSource,
  TablePaginationConfig,
} from './Table.interface';
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

/**
 * AntD's size scale mapped onto the core component's.
 *
 * Only `small` is a step down; everything else, a table that sets no size
 * included, stays at `md`. Densifying by default would resize every table in
 * the app, not just the ones being migrated. `compact` is available to a call
 * site that opts into it deliberately.
 */
const CORE_SIZE_BY_ANTD_SIZE: Record<string, 'compact' | 'sm' | 'md'> = {
  compact: 'compact',
  small: 'sm',
  middle: 'md',
  large: 'md',
};

const toCoreSize = (size: TableComponentProps<never>['size']) =>
  CORE_SIZE_BY_ANTD_SIZE[size ?? 'middle'] ?? 'md';

/**
 * Cell padding per AntD size.
 *
 * The core `Table.Cell` sizes its own padding, but every cell here also carries
 * these classes, and a class beats the core's for the same property — so
 * without this map `size` changed nothing a user could see. `middle` keeps the
 * padding every migrated table already renders with; the other steps move
 * around it.
 */
const CELL_PADDING_BY_ANTD_SIZE: Record<string, string> = {
  compact: 'tw:py-1.5 tw:pl-3 tw:pr-2',
  small: 'tw:p-2',
  middle: 'tw:py-2 tw:pl-4 tw:pr-2',
  large: 'tw:py-4 tw:pl-6 tw:pr-4',
};

const toCellPaddingClass = (size: TableComponentProps<never>['size']) =>
  CELL_PADDING_BY_ANTD_SIZE[size ?? 'middle'] ??
  CELL_PADDING_BY_ANTD_SIZE.middle;

/**
 * Internal pagination is off whenever the parent owns paging, so a server page
 * is never sliced a second time.
 */
const resolveClientPagination = <T,>(
  pagination: TableComponentProps<T>['pagination'],
  pageSizeOverride: number | null,
  hasParentPagination: boolean,
  rowCount: number
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
    // A `total` larger than the rows in hand means the parent fetched one page
    // and is driving the rest itself. AntD renders those rows as-is and reports
    // page changes through `onChange`; slicing them again would leave every
    // page after the first empty.
    serverTotal:
      typeof cfg.total === 'number' && cfg.total > rowCount
        ? cfg.total
        : undefined,
    controlledCurrent:
      typeof cfg.current === 'number' ? cfg.current : undefined,
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
        {renderDetail(
          flatRow.record,
          flatRow.actualIndex,
          flatRow.depth,
          isExpanded
        )}
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
type RowInteractionProps = React.ComponentProps<typeof UntitledTable.Row> &
  Record<string, unknown>;

/**
 * Forwards whatever `onRow` returned. Call sites hang test ids, aria
 * attributes and mouse handlers off it, so an allowlist silently drops things
 * nobody notices until the UI is in front of them.
 *
 * `onAction` is what makes `onClick` work at all: React Aria strips a row's
 * click handler unless the row is interactive. The empty action marks it
 * interactive so the call site's handler still receives a real MouseEvent,
 * without adding a second activation path that would fire it twice.
 *
 * One thing does not survive: React Aria's Row owns drag and drop and never
 * attaches native HTML5 drag handlers passed as props. Rows are dragged
 * through `dragAndDropHooks`, not through `onRow`.
 */
const getRowInteractionProps = (
  rowHandlers: RowInteractionProps
): RowInteractionProps => ({
  ...rowHandlers,
  onAction: rowHandlers.onClick ? noop : undefined,
});

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
/**
 * AntD's `bordered` draws a full grid. Rows already carry their own horizontal
 * rule, so this adds the outer frame and the vertical separators, dropping the
 * trailing one so the frame is not doubled.
 */
const BORDERED_CLASSES = [
  'tw:border tw:border-secondary',
  'tw:[&_th]:border-r tw:[&_th]:border-secondary tw:[&_th:last-child]:border-r-0',
  'tw:[&_td]:border-r tw:[&_td]:border-secondary tw:[&_td:last-child]:border-r-0',
].join(' ');

/**
 * AntD aligns a column's header and its cells together from `align`. Nothing
 * read it here, so a column asking to be right-aligned got right-aligned cells
 * only where the call site had also styled them by hand — leaving the header
 * on the other side of the table from its values.
 */
const ALIGN_CLASS: Record<string, string> = {
  center: 'tw:text-center',
  right: 'tw:text-right',
};

/**
 * A header cell is not laid out by `text-align`: the core `Table.Head` puts its
 * label, tooltip and sort arrow in a flex group, and flex items ignore the
 * property. Aligning the header means justifying that group — `& > div` is it —
 * or a right-aligned column keeps its title on the left of its own values.
 */
const HEADER_ALIGN_CLASS: Record<string, string> = {
  center: 'tw:[&>div]:justify-center',
  right: 'tw:[&>div]:justify-end',
};

const getAlignClass = (align?: string) =>
  align ? ALIGN_CLASS[align] : undefined;

const getHeaderAlignClass = (align?: string) =>
  align ? HEADER_ALIGN_CLASS[align] : undefined;

const COLUMN_ID_PREFIX = 'col:';

/**
 * Unique React Aria row ids, and a map back to the call site's own row keys.
 *
 * `rowKey` is not guaranteed unique — ListViewTab keys rows by
 * `name-status-key` and its executions repeat — and AntD renders duplicates
 * anyway (with a console warning). React Aria treats the id as the collection
 * key and keeps only the first, silently dropping rows. Suffixing repeats keeps
 * every row while `data-row-key` still carries the original.
 */
const disambiguate = (keys: string[]): string[] => {
  // Checked against every id already emitted, not just against repeats of the
  // same base: for ['dup', 'dup', 'dup-1'] a naive counter produces
  // ['dup', 'dup-1', 'dup-1'] and the fabricated id collides with the real
  // one — reintroducing exactly the silent row drop this is here to prevent.
  const used = new Set<string>();

  return keys.map((key) => {
    let candidate = key;
    let count = 1;
    while (used.has(candidate)) {
      candidate = `${key}-${count}`;
      count += 1;
    }
    used.add(candidate);

    return candidate;
  });
};

const getRowIds = (rowKeys: string[]) => disambiguate(rowKeys);

const getColumnKeys = <T,>(columns: ColumnsType<T>): string[] =>
  columns.map((col, idx) =>
    String(col.key ?? (col as ColumnType<T>).dataIndex ?? idx)
  );

const getColumnIds = (columnKeys: string[]): string[] =>
  disambiguate(columnKeys.map((key) => `${COLUMN_ID_PREFIX}${key}`));

const matchesFilterEntry = <T extends object>(
  record: T,
  colKey: string,
  selectedKeys: React.Key[],
  columns: ColumnsType<T>,
  columnIds: string[]
): boolean => {
  const col = columns.find((_c, idx) => columnIds[idx] === colKey) as
    | ColumnType<T>
    | undefined;

  const onFilter = col?.onFilter;

  return onFilter
    ? selectedKeys.some((key) => onFilter(key as React.Key | boolean, record))
    : true;
};

const setColumnFilterKeys =
  (
    setFilterState: React.Dispatch<
      React.SetStateAction<Record<string, React.Key[]>>
    >,
    colKey: string
  ) =>
  (keys: React.Key[]): void =>
    setFilterState((prev) => ({ ...prev, [colKey]: keys }));

const clearColumnFilter =
  (
    setFilterState: React.Dispatch<
      React.SetStateAction<Record<string, React.Key[]>>
    >,
    colKey: string
  ) =>
  (): void =>
    setFilterState((prev) => {
      const next = { ...prev };
      delete next[colKey];

      return next;
    });

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
        hasParentPagination,
        (rest.dataSource ?? []).length
      ),
    [rest.pagination, pageSizeOverride, hasParentPagination, rest.dataSource]
  );

  const isCustomizeColumnEnable = useMemo(
    () =>
      !isEmpty(rest.staticVisibleColumns) && !isEmpty(defaultVisibleColumns),
    [rest.staticVisibleColumns, defaultVisibleColumns]
  );

  /**
   * `scroll.x` only counts as a width when it is one. AntD accepts
   * `scroll={{ x: true }}` to mean "allow sideways scroll, size by content" —
   * treating that `true` as a width set `width: true` on the table (dropped by
   * React) and, worse, switched on the pixel min-width floors, pinning every
   * sized column on a table that was never going to overflow.
   */
  const scrollWidth =
    typeof scroll?.x === 'number' || typeof scroll?.x === 'string'
      ? scroll.x
      : undefined;

  /**
   * AntD's `scroll={{ x: 'max-content' }}` means "size the table by its
   * content and let the wrapper scroll" — which is auto table layout. Keeping
   * the forced fixed layout here made Chrome compute the table's max-content
   * from the header row alone, so a table of pixel columns plus one unsized
   * one never grew past its headers: the pixel floors held their columns and
   * the unsized column was crushed to its header's width (to nothing, on a
   * narrow viewport — the glossary terms table's Description column in the
   * merge queue). Auto layout sizes it from the rows, exactly as AntD did.
   */
  const sizeByContent = scroll?.x === 'max-content';

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
   * Total of the columns' pixel widths, but only for a table that should
   * stretch to fill: no horizontal scroll, no resizing, and every column
   * sized in pixels.
   *
   * A fixed-layout table whose columns are all narrower than the table used to
   * have the leftover spread across them by the browser. Chrome 151 stopped
   * doing that for widths declared on the cells — it still does it for widths
   * on `<col>`, which is where AntD put them, so the same table filled under
   * AntD and stopped short here. React Aria owns the `<table>` and gives us no
   * `<colgroup>` to write into, so express each width as its share of the
   * total instead: a percentage stretches in every engine, and the columns
   * keep their relative proportions either way.
   */
  const pixelWidthTotal = useMemo((): number | null => {
    if (scrollWidth !== undefined || rest.resizableColumns) {
      return null;
    }
    const widths = propsColumns.map((col) => (col as ColumnType<T>).width);
    if (!widths.length || !widths.every((w) => typeof w === 'number')) {
      return null;
    }
    const total = (widths as number[]).reduce((sum, w) => sum + w, 0);

    // The shares deliberately add up to 100% even on a selecting table, where
    // the core injects a checkbox column ahead of the declared ones and sizes
    // it by class (`tw:w-11`, `tw:w-9`). A fixed-layout table resolves that
    // pixel column first and scales the percentages down around it — measured
    // at 1088px: the checkbox keeps its 44px and the data columns take 777 and
    // 259. Reserving the checkbox's width out of the total instead makes it
    // absorb the leftover and balloon to ~195px.
    return total > 0 ? total : null;
  }, [propsColumns, scrollWidth, rest.resizableColumns]);

  const toColumnWidth = useCallback(
    (width: number | string | undefined) =>
      pixelWidthTotal && typeof width === 'number'
        ? `${(width / pixelWidthTotal) * 100}%`
        : width,
    [pixelWidthTotal]
  );

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
      direction: toAriaDirection(
        col.sortOrder === 'descend' ? 'descend' : 'ascend'
      ),
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
      activeFilters.every(([colKey, selectedKeys]) =>
        matchesFilterEntry(
          record,
          colKey,
          selectedKeys,
          propsColumns,
          columnIds
        )
      )
    );
  }, [sortedDataSource, filterState, propsColumns, columnIds]);

  const currentPage =
    clientPagination?.controlledCurrent ?? internalCurrentPage;

  /**
   * AntD reports page navigation through `onChange`, which is how a
   * server-paged table refetches. Without this the pager only moved internal
   * state and a parent driving its own fetch never heard about it.
   */
  const handlePageChange = useCallback(
    (nextPage: number) => {
      setInternalCurrentPage(nextPage);
      rest.onChange?.(
        {
          current: nextPage,
          pageSize: clientPagination?.pageSize ?? DEFAULT_PAGE_SIZE,
          total: clientPagination?.serverTotal ?? filteredDataSource.length,
        } as TablePaginationConfig,
        {} as Record<string, FilterValue | null>,
        {} as SorterResult<T>,
        {
          currentDataSource: filteredDataSource,
          action: 'paginate',
        } as TableCurrentDataSource<T>
      );
    },
    [rest.onChange, clientPagination, filteredDataSource]
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
      // AntD reports a page-size change through `onChange` as well, which is
      // the only callback a server-paged table has to refetch on. Without it
      // the picker moves and nothing else happens.
      rest.onChange?.(
        {
          current: 1,
          pageSize: size,
          total: clientPagination?.serverTotal ?? filteredDataSource.length,
        } as TablePaginationConfig,
        {} as Record<string, FilterValue | null>,
        {} as SorterResult<T>,
        {
          currentDataSource: filteredDataSource,
          action: 'paginate',
        } as TableCurrentDataSource<T>
      );
    },
    [clientPagination, rest.onChange, filteredDataSource]
  );

  const pagedDataSource = useMemo((): T[] => {
    // The parent already fetched exactly this page when it reports a larger
    // `total` than it handed over.
    if (!clientPagination || clientPagination.serverTotal) {
      return filteredDataSource;
    }
    const start = (currentPage - 1) * clientPagination.pageSize;

    return filteredDataSource.slice(start, start + clientPagination.pageSize);
  }, [filteredDataSource, clientPagination, currentPage]);

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

  /**
   * One identity per rendered row: the React Aria id, the key the call site
   * asked for, and the record itself. Deriving disabled rows and selection from
   * this — rather than re-deriving keys against a different array — keeps them
   * in step with what is actually on screen.
   */
  const rowEntries = useMemo(() => {
    const ids = getRowIds(flatRows.map((row) => row.rowKey));

    return flatRows.map((row, idx) => ({
      id: ids[idx],
      key: row.rowKey,
      record: row.record,
    }));
  }, [flatRows]);

  const rowIds = useMemo(() => rowEntries.map((e) => e.id), [rowEntries]);

  const rowEntryById = useMemo(
    () => new Map(rowEntries.map((entry) => [entry.id, entry])),
    [rowEntries]
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

    // Keyed by React Aria id off the rendered rows. Deriving these from
    // `filteredDataSource` instead meant that whenever `rowKey` was absent and
    // fell back to the array index, the disabled set used whole-dataset
    // positions while the rows used page-relative ones — disabling the wrong
    // rows on every page after the first.
    return new Set(
      rowEntries
        .filter(({ record }) => getCheckboxProps(record).disabled)
        .map(({ id }) => id)
    );
  }, [rest.rowSelection, rowEntries]);

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

      let sortOrder: SorterResult<T>['order'] = null;
      if (newDirection === 'ascending') {
        sortOrder = 'ascend';
      } else if (newDirection === 'descending') {
        sortOrder = 'descend';
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
          order: sortOrder,
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
    if (clientPagination?.serverTotal) {
      return;
    }
    const maxPage = clientPagination
      ? Math.ceil(dataSourceLength / clientPagination.pageSize) || 1
      : 1;
    if (internalCurrentPage > maxPage) {
      setInternalCurrentPage(1);
    }
  }, [dataSourceLength, clientPagination, internalCurrentPage]);

  /** The core pager shows its size control only when handed a handler. */
  const sizeChangerProps = useMemo(() => {
    if (!clientPagination?.showSizeChanger) {
      return {};
    }
    const { pageSizeOptions } = clientPagination;

    return {
      onPageSizeChange: handlePageSizeChange,
      ...(pageSizeOptions.length ? { pageSizeOptions } : {}),
    };
  }, [clientPagination, handlePageSizeChange]);

  /**
   * Resolves an aria selection back to the caller's keys and rows.
   *
   * Against `rowEntries`, which is the flattened visible rows paired with the
   * ids React Aria actually reports. Two things fall out of that: an expanded
   * child is resolved like any other row rather than being missed inside its
   * parent record, and two rows sharing a `rowKey` stay distinct — resolving by
   * key handed the call site both when only one was selected.
   */
  const handleSelectionChange = useCallback(
    (keys: AriaSelection) => {
      if (!rest.rowSelection?.onChange) {
        return;
      }
      const selected =
        keys === 'all'
          ? rowEntries
          : [...keys]
              .map((key) => rowEntryById.get(String(key)))
              .filter((entry): entry is (typeof rowEntries)[number] =>
                Boolean(entry)
              );

      rest.rowSelection.onChange(
        selected.map(({ key }) => key),
        selected.map(({ record }) => record),
        { type: selectionMode === 'single' ? 'single' : 'multiple' }
      );
    },
    [rest.rowSelection, rowEntries, rowEntryById, selectionMode]
  );

  const renderRowCells = (flatRow: FlatRow<T>) => {
    const { record, actualIndex, depth, hasChildren, rowKey } = flatRow;
    const isExpanded = expandedKeys.has(rowKey);

    return propsColumns.map((col, colIdx) => {
      const colType = col as ColumnType<T>;
      const cellKey = columnIds[colIdx];
      const stickyStyle = getColumnStickyStyle(colType.fixed, 1);

      const isFirstColumn = colIdx === 0;
      const showExpandInCell = rest.expandable && isFirstColumn;
      const ExpandIcon = rest.expandable?.expandIcon;
      const cellHandlerProps =
        (colType.onCell?.(
          record,
          actualIndex
        ) as React.TdHTMLAttributes<HTMLTableCellElement>) ?? {};

      let expandIndicator: React.ReactNode = null;
      if (showExpandInCell) {
        if (hasChildren && ExpandIcon) {
          expandIndicator = (
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
          );
        } else if (hasChildren) {
          expandIndicator = (
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
          );
        } else if (ExpandIcon) {
          expandIndicator = (
            <ExpandIcon
              expandable={false}
              expanded={false}
              prefixCls=""
              record={record}
              onExpand={(_rec, _e) => {}}
            />
          );
        } else {
          expandIndicator = <span className="tw:inline-block tw:w-4 tw:mr-1" />;
        }
      }

      let cellContent: React.ReactNode = resolveCellValue(
        colType,
        record,
        actualIndex
      );
      if (colType.ellipsis) {
        // `flex-1 min-w-0` only mean anything inside the flex row an expander
        // creates; without one the wrapper is `display: contents` and this div
        // is a block child of the cell, which already fills it. `truncate` is
        // what does the work either way.
        cellContent = (
          <div
            className={classNames('tw:truncate', {
              'tw:flex-1 tw:min-w-0': showExpandInCell,
            })}>
            {cellContent}
          </div>
        );
      } else if (showExpandInCell) {
        // Same shrink permission without imposing `truncate`: a flex item's
        // min-width is `auto`, so a nowrap value the call site ellipsizes
        // itself (an AntD Typography link, say) could never shrink to the cell
        // and painted across the neighbouring columns instead.
        cellContent = <div className="tw:min-w-0 tw:flex-1">{cellContent}</div>;
      }

      return (
        <UntitledTable.Cell
          {...cellHandlerProps}
          className={classNames(
            colType.ellipsis && 'tw:overflow-hidden',
            // A cell must never spill into its neighbour. An
            // unbreakable string — a long name with no spaces,
            // an FQN — otherwise overflows a width-constrained
            // cell and lands on the column beside it, covering
            // whatever is there and swallowing clicks on it.
            'tw:break-words',
            rest.cellClassName ??
              // `.ant-table-cell { vertical-align: top }` in
              // the app's own stylesheet, so every legacy
              // table tops its cells — stock AntD sets none,
              // which is what made this look like the browser
              // default. A row whose tallest cell wraps has
              // the rest of its values sitting on the first
              // line, not floating in the middle.
              classNames(toCellPaddingClass(rest.size), 'tw:align-top'),
            getAlignClass(colType.align),
            'tw:group-data-[dragging]:opacity-40',
            'tw:group-data-[drop-target]:bg-[#e8f4ff] tw:group-data-[drop-target]:outline tw:group-data-[drop-target]:outline-2',
            'tw:group-data-[drop-target]:outline-dashed tw:group-data-[drop-target]:outline-[--color-border-brand] tw:group-data-[drop-target]:-outline-offset-2'
          )}
          key={cellKey}
          style={{
            ...(columnWidths[cellKey] !== undefined ||
            colType.width !== undefined
              ? {
                  width: toColumnWidth(
                    columnWidths[cellKey] ?? (colType.width as number)
                  ),
                  // Scrollable pixel columns only — see the
                  // header cell.
                  ...(scrollWidth !== undefined &&
                  typeof colType.width === 'number'
                    ? { minWidth: colType.width }
                    : {}),
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
            // Only a laid-out box when it has an expander to
            // place beside the value. AntD puts cell content
            // straight into the <td>, and a flex parent with
            // `max-w-full` collapsed anything a cell rendered
            // inline — a Glossary Terms dropdown came out a
            // few pixels wide.
            className={classNames({
              'tw:flex tw:gap-1 tw:max-w-full': showExpandInCell,
              'tw:contents': !showExpandInCell,
            })}>
            {showExpandInCell && (
              <div className="tw:flex tw:items-center tw:shrink-0">
                {expandIndicator}
              </div>
            )}
            {cellContent}
          </div>
        </UntitledTable.Cell>
      );
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const showCustomPagination =
    customPaginationProps && customPaginationProps.showPagination;
  const showClientPagination =
    clientPagination &&
    !(
      clientPagination.hideOnSinglePage &&
      // Server-paged: the rows in hand are one page by definition, so only
      // the reported total says whether there is anything to page to.
      (clientPagination.serverTotal ?? filteredDataSource.length) <=
        clientPagination.pageSize
    );

  let paginationFooter: React.ReactNode = null;
  if (showCustomPagination) {
    paginationFooter = (
      <div>
        <NextPrevious {...customPaginationProps} />
      </div>
    );
  } else if (showClientPagination) {
    paginationFooter = (
      <div>
        {/*
          The core pager rather than NextPrevious: it navigates by page
          number instead of one step at a time, and it is react-aria rather
          than AntD, which is the point of the migration. `total` here is a
          page count, not a row count.
        */}
        <PaginationCardWithControls
          page={currentPage}
          pageSize={clientPagination.pageSize}
          total={computeTotalPages(
            clientPagination.pageSize,
            clientPagination.serverTotal ?? filteredDataSource.length
          )}
          onPageChange={handlePageChange}
          {...sizeChangerProps}
        />
      </div>
    );
  }

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
        // `tw:relative` anchors the loading overlay below. Without it the
        // overlay's `inset-0` resolves against the viewport instead of the
        // table, so it dims the whole page and centres the spinner wherever
        // the viewport happens to be rather than over the rows it is masking.
        className="tw:relative tw:flex tw:flex-col tw:w-full"
        data-testid={dataTestId}
        style={scrollStyle}>
        {rest.title && (
          // AntD's table-level title slot: a band above the table, handed the
          // rows currently on screen. Call sites hang bulk actions off it.
          <div className="tw:px-4 tw:py-2" data-testid="table-title">
            {rest.title(pagedDataSource)}
          </div>
        )}

        {isLoading && (
          <div className="tw:absolute tw:inset-0 tw:z-10 tw:flex tw:items-center tw:justify-center tw:bg-primary/60">
            <Loader />
          </div>
        )}

        {(() => {
          const tableContent = (
            <UntitledTable
              aria-label="data-table"
              // AntD sticks the header only when the call site asks for it —
              // via `sticky`, or `scroll.y`, which gives the body its own
              // scroll container. Sticking it unconditionally put a
              // `z-index: 10` header above anything the page later drew over
              // the table, drawers and modals included.
              className={classNames(rest.className, {
                [BORDERED_CLASSES]: rest.bordered,
                // The legacy wrapper hardcoded `table-layout: fixed` after its
                // prop spread, so every call site it served got fixed columns
                // and none could opt out. Default to the same, but honour an
                // explicit `tableLayout` — the tables that came straight from
                // AntD were sized by content and need to stay that way.
                // Resizing needs fixed regardless: an auto table re-solves its
                // own widths and swallows the drag.
                'tw:table-fixed':
                  rest.resizableColumns ||
                  (rest.tableLayout !== 'auto' && !sizeByContent),
                'tw:table-auto':
                  !rest.resizableColumns &&
                  (rest.tableLayout === 'auto' || sizeByContent),
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
              dragAndDropHooks={
                /*
                 * `ui-core-components` bundles react-aria-components 1.16 while
                 * the app resolves 1.17, so the two `DragAndDropHooks`
                 * declarations are structurally identical but nominally
                 * distinct. Call sites build these with the app's
                 * `useDragAndDrop`, which is the copy that has to stay
                 * assignable; the cast is confined to this one hand-off and
                 * disappears once the versions converge.
                 */
                dragAndDropHooks as ComponentProps<
                  typeof UntitledTable
                >['dragAndDropHooks']
              }
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
              stickyHeader={Boolean(rest.sticky) || Boolean(scroll?.y)}
              style={
                // AntD reads `scroll.x` as the table's own width and lets the
                // wrapper scroll: `width: <x>; min-width: 100%`. Without it the
                // table is squeezed into its container instead, and columns
                // that cannot wrap spill over their neighbours.
                scrollWidth !== undefined
                  ? {
                      width: scrollWidth,
                      minWidth: '100%',
                    }
                  : undefined
              }
              onRowAction={
                rest.onRowAction
                  ? (key) =>
                      rest.onRowAction?.(
                        rowEntryById.get(String(key))?.key ?? String(key)
                      )
                  : undefined
              }
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
                      className={classNames(
                        toCellPaddingClass(rest.size),
                        // The same rule covers `th`: a header sits on the first
                        // line of a row its own cells may wrap past.
                        'tw:align-top tw:text-sm tw:text-tertiary',
                        getAlignClass(colType.align),
                        getHeaderAlignClass(colType.align)
                      )}
                      id={colKey}
                      isRowHeader={rowHeaderColumn.isRowHeader ?? colIdx === 0}
                      key={colKey}
                      style={{
                        ...(colWidth !== undefined
                          ? {
                              width: toColumnWidth(colWidth),
                              // A floor only holds a pixel column open where
                              // the table is allowed to overflow. Without
                              // `scroll.x` it instead pins every column at its
                              // declared width, so a fixed-layout table stops
                              // spreading the leftover space and leaves a gap
                              // after the last column — AntD puts its widths on
                              // `<col>` with no floor and always fills. A
                              // percentage floor is worse still: rounded up per
                              // column it totals over 100% and raises a
                              // scrollbar on a table that fits.
                              ...(scrollWidth !== undefined &&
                              typeof colWidth === 'number'
                                ? { minWidth: colWidth }
                                : {}),
                            }
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
                                        setSelectedKeys: setColumnFilterKeys(
                                          setFilterState,
                                          colKey
                                        ),
                                        selectedKeys: filterState[colKey] ?? [],
                                        confirm: () => setOpenFilterKey(null),
                                        clearFilters: clearColumnFilter(
                                          setFilterState,
                                          colKey
                                        ),
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
                    // The padding is the placeholder's breathing room and
                    // belongs to whatever fills the slot: a call site's own
                    // placeholder needs it as much as the fallback does, and
                    // without it the empty state crowds the header.
                    <div className="tw:py-8 tw:text-center tw:text-sm tw:text-fg-tertiary">
                      {
                        // AntD fell back to its own <Empty> illustration, not
                        // bare text, so a table with no rows read as an empty
                        // state rather than a stray label. Call sites that pass
                        // `locale.emptyText` still win — most hand in their own
                        // ErrorPlaceHolder or FilterTablePlaceHolder.
                        (rest.locale?.emptyText as ReactNode) ?? (
                          <EmptyPlaceholder
                            icon={
                              <SearchLg className="tw:text-fg-brand-primary" />
                            }
                            title={t('label.no-data')}
                            variant="blank"
                          />
                        )
                      }
                    </div>
                  )
                }>
                {flatRows.flatMap((flatRow, flatIndex) => {
                  const { record, actualIndex, depth, rowKey } = flatRow;
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
                      id={rowIds[flatIndex]}
                      key={rowIds[flatIndex]}
                      {...getRowInteractionProps(rowHandlers)}>
                      {renderRowCells(flatRow)}
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

      {paginationFooter}
    </div>
  );
};

type TableV2WithGenerics = <T extends object>(
  props: TableV2Props<T> & RefAttributes<HTMLDivElement>
) => ReactElement | null;

export default forwardRef(TableV2) as unknown as TableV2WithGenerics;
