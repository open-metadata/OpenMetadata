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
 * Unsupported in v1 (accepted but ignored):
 *  - components  (AntD custom cell/header renderers)
 *
 * Not in props type (compile-time error if passed):
 *  - className   → use containerClassName instead
 *
 * Partially supported:
 *  - expandable        → tree/nested rows via record.children; expandedRowRender not supported
 *  - onRow             → onClick and onDoubleClick are forwarded to the row element
 *  - onCell            → onClick, data-*, colSpan forwarded to the underlying td element
 *  - filterIcon/filterDropdown/onFilter → filter state managed internally; confirm/close close the dropdown
 *
 * Sorting:
 *  - sorter: (a, b) => number  → applied client-side on full dataset before pagination
 *  - sorter: true              → visual indicator only; parent must handle via onChange
 */

import {
  Button,
  Dropdown,
  Table as UntitledTable,
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
import { isEmpty, isEqual } from 'lodash';
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
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import Loader from '../Loader/Loader';
import NextPrevious from '../NextPrevious/NextPrevious';
import Searchbar from '../SearchBarComponent/SearchBar.component';
import DraggableMenuItem from './DraggableMenu/DraggableMenuItem.component';
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

type TableV2Props<T extends object> = TableComponentProps<T>;

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
  const [propsColumns, setPropsColumns] = useState<ColumnsType<T>>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);
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

  const clientPagination = useMemo(() => {
    if (rest.pagination === false) {
      return null;
    }
    const cfg = (rest.pagination ?? {}) as TablePaginationConfig;

    return {
      pageSize: (cfg.pageSize as number) ?? 10,
      hideOnSinglePage: cfg.hideOnSinglePage ?? false,
    };
  }, [rest.pagination]);

  const sortedDataSource = useMemo((): T[] => {
    const data = (rest.dataSource ?? []) as T[];
    if (!sortState.columnKey || !sortState.direction) {
      return data;
    }
    const col = propsColumns.find((c, idx) => {
      const key = String(c.key ?? (c as ColumnType<T>).dataIndex ?? idx);

      return key === sortState.columnKey;
    }) as ColumnType<T> | undefined;

    if (!col?.sorter || typeof col.sorter !== 'function') {
      return data;
    }
    const compareFn = col.sorter as (a: T, b: T) => number;
    const sorted = [...data].sort((a, b) => compareFn(a, b));

    return sortState.direction === 'descending' ? sorted.reverse() : sorted;
  }, [rest.dataSource, sortState, propsColumns]);

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
          (c, idx) =>
            String(c.key ?? (c as ColumnType<T>).dataIndex ?? idx) === colKey
        ) as ColumnType<T> | undefined;

        return col?.onFilter
          ? selectedKeys.some((key) =>
              col.onFilter!(key as React.Key | boolean, record)
            )
          : true;
      })
    );
  }, [sortedDataSource, filterState, propsColumns]);

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

  // ─── Column customization (identical to Table.tsx) ───────────────────────

  const handleMoveItem = useCallback(
    (updatedList: TableColumnDropdownList[]) => {
      setDropdownColumnList(updatedList);
      setPropsColumns(getReorderedColumns(updatedList, propsColumns));
    },
    [propsColumns]
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
      const newDirection = descriptor.direction ?? null;
      setSortState({ columnKey: newKey, direction: newDirection });

      if (!rest.onChange) {
        return;
      }
      const matchedCol = propsColumns.find((c, colIdx) => {
        const resolvedKey = String(
          c.key ?? (c as ColumnType<T>).dataIndex ?? colIdx
        );

        return resolvedKey === descriptor.column;
      }) as ColumnType<T> | undefined;

      rest.onChange(
        {
          current: internalCurrentPage,
          pageSize: clientPagination?.pageSize ?? 10,
          total: filteredDataSource.length,
        } as TablePaginationConfig,
        {} as Record<string, FilterValue | null>,
        {
          column: matchedCol,
          columnKey: String(descriptor.column ?? ''),
          field: String(descriptor.column ?? ''),
          order:
            descriptor.direction === 'ascending'
              ? 'ascend'
              : descriptor.direction === 'descending'
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
      const filteredColumns = (rest.columns ?? []).filter(
        (item) =>
          columnDropdownSelections.includes(item.key as string) ||
          (rest.staticVisibleColumns ?? []).includes(item.key as string)
      );

      setPropsColumns(getReorderedColumns(dropdownColumnList, filteredColumns));
    } else {
      setPropsColumns(rest.columns ?? []);
    }
  }, [
    isCustomizeColumnEnable,
    rest.columns,
    columnDropdownSelections,
    rest.staticVisibleColumns,
    dropdownColumnList,
  ]);

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

    return flattenTreeRows(
      pagedDataSource,
      getRowKey,
      expandedKeys,
      rest.expandable.rowExpandable as ((r: T) => boolean) | undefined
    );
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
      className={classNames('table-container', rest.containerClassName)}
      ref={ref}>
      <div
        className={classNames('p-x-md', {
          'p-y-md':
            searchProps || rest.extraTableFilters || isCustomizeColumnEnable,
        })}>
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
                    <div className="d-flex justify-between items-center w-52 p-x-md p-b-xss border-bottom">
                      <span
                        className="text-sm text-grey-muted font-medium"
                        data-testid="column-dropdown-title">
                        {t('label.column')}
                      </span>
                      <Button
                        color="link-color"
                        data-testid="column-dropdown-action-button"
                        size="sm"
                        onPress={() => handleBulkColumnAction()}>
                        {dropdownColumnList.length ===
                        columnDropdownSelections.length
                          ? t('label.hide-all')
                          : t('label.view-all')}
                      </Button>
                    </div>
                    {dropdownColumnList.map(
                      (item: TableColumnDropdownList, index: number) => (
                        <DraggableMenuItem
                          currentItem={item}
                          index={index}
                          itemList={dropdownColumnList}
                          key={item.value}
                          selectedOptions={columnDropdownSelections}
                          onMoveItem={handleMoveItem}
                          onSelect={handleColumnItemSelect}
                        />
                      )
                    )}
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
          <div className="tw:absolute tw:inset-0 tw:z-10 tw:flex tw:items-center tw:justify-center tw:bg-white/60">
            <Loader />
          </div>
        )}

        {(() => {
          const tableContent = (
            <UntitledTable
              stickyHeader
              aria-label="data-table"
              className={rest.resizableColumns ? 'tw:table-fixed' : undefined}
              containerStyle={
                scroll?.y
                  ? {
                      maxHeight: scroll.y as string | number,
                      overflowY: 'auto',
                    }
                  : undefined
              }
              dragAndDropHooks={dragAndDropHooks}
              selectedKeys={
                rest.rowSelection?.selectedRowKeys
                  ? new Set(rest.rowSelection.selectedRowKeys.map(String))
                  : undefined
              }
              selectionBehavior={rest.rowSelection ? 'toggle' : undefined}
              selectionMode={selectionMode}
              size={rest.size === 'small' ? 'sm' : 'md'}
              sortDescriptor={
                sortState.columnKey && sortState.direction
                  ? {
                      column: sortState.columnKey,
                      direction: sortState.direction,
                    }
                  : undefined
              }
              onSelectionChange={handleSelectionChange}
              onSortChange={handleSortChange}>
              <UntitledTable.Header className="tw:px-2">
                {propsColumns.map((col, colIdx) => {
                  const colType = col as ColumnType<T>;
                  const colKey = String(col.key ?? colType.dataIndex ?? colIdx);
                  const colWidth =
                    columnWidths[colKey] ??
                    (colType.width as number | undefined);

                  const stickyStyle = getColumnStickyStyle(colType.fixed, 2);

                  return (
                    <UntitledTable.Head
                      allowsSorting={!!colType.sorter}
                      className="tw:py-2 tw:pl-4 tw:pr-2 tw:text-sm tw:text-tertiary"
                      id={colKey}
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
                      <div className="tw:flex tw:items-center tw:gap-1">
                        {resolveColumnTitle(colType, propsColumns)}
                        {Boolean(colType.filters || colType.filterDropdown) && (
                          <DialogTrigger
                            isOpen={openFilterKey === colKey}
                            onOpenChange={(isOpen) =>
                              setOpenFilterKey(isOpen ? colKey : null)
                            }>
                            <Button
                              aria-label="filter"
                              className="tw:ml-1 tw:p-0 tw:bg-transparent tw:border-0 tw:cursor-pointer tw:inline-flex tw:items-center"
                              color="tertiary">
                              {typeof colType.filterIcon === 'function'
                                ? colType.filterIcon(
                                    Boolean(filterState[colKey]?.length)
                                  )
                                : colType.filterIcon ?? null}
                            </Button>
                            <Popover placement="bottom right">
                              <Dialog className="tw:outline-none">
                                <div
                                  className="tw:bg-primary tw:shadow-lg tw:ring-1 tw:ring-secondary_alt tw:rounded-lg"
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
                        tw:after:bg-[--color-border-secondary] tw:data-[resizing]:after:w-0.5 tw:data-[resizing]:after:bg-[--color-border-brand]"
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
                {flatRows.map((flatRow) => {
                  const { record, actualIndex, depth, hasChildren, rowKey } =
                    flatRow;
                  const rowHandlers = rest.onRow?.(record, actualIndex) ?? {};
                  const isExpanded = expandedKeys.has(rowKey);

                  return (
                    <UntitledTable.Row
                      className={classNames(
                        'tw:group tw:transition-colors tw:hover:bg-secondary tw:data-[selected]:bg-secondary',
                        typeof rest.rowClassName === 'function'
                          ? rest.rowClassName(record, actualIndex, depth)
                          : rest.rowClassName
                      )}
                      data-level={depth}
                      data-row-key={rowKey}
                      draggable={
                        dragAndDropHooks
                          ? undefined
                          : (rowHandlers.draggable as boolean | undefined)
                      }
                      id={rowKey}
                      key={rowKey}
                      onClick={rowHandlers.onClick}
                      onDoubleClick={rowHandlers.onDoubleClick}
                      onDragEnd={
                        dragAndDropHooks ? undefined : rowHandlers.onDragEnd
                      }
                      onDragEnter={
                        dragAndDropHooks ? undefined : rowHandlers.onDragEnter
                      }
                      onDragLeave={
                        dragAndDropHooks ? undefined : rowHandlers.onDragLeave
                      }
                      onDragOver={
                        dragAndDropHooks ? undefined : rowHandlers.onDragOver
                      }
                      onDragStart={
                        dragAndDropHooks ? undefined : rowHandlers.onDragStart
                      }
                      onDrop={
                        dragAndDropHooks ? undefined : rowHandlers.onDrop
                      }>
                      {propsColumns.map((col, colIdx) => {
                        const colType = col as ColumnType<T>;
                        const cellKey = String(
                          col.key ?? colType.dataIndex ?? colIdx
                        );
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
                              ...(showExpandInCell
                                ? { paddingLeft: `${16 + depth * 12}px` }
                                : {}),
                              ...cellHandlerProps.style,
                            }}>
                            <div
                              className={classNames(
                                'tw:flex tw:items-start tw:gap-1 tw:max-w-full'
                              )}>
                              {showExpandInCell && (
                                <div className="tw:flex-shrink-0">
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
                    </UntitledTable.Row>
                  );
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
