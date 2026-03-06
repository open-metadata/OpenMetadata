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

/**
 * TableV2 — Untitled UI migration of Table.tsx
 *
 * Drop-in replacement for Table.tsx using @openmetadata/ui-core-components.
 * Accepts the same TableComponentProps<T> interface for zero-friction adoption.
 *
 * Unsupported in v1 (accepted but ignored):
 *  - expandable  (React Aria has no built-in expandable rows)
 *  - components  (AntD custom cell/header renderers)
 */

import {
  Button,
  Dropdown,
  Table as UntitledTable,
} from '@openmetadata/ui-core-components';
import type {
  ColumnType,
  FilterValue,
  SortOrder,
  SorterResult,
  TableCurrentDataSource,
  TablePaginationConfig,
} from 'antd/lib/table/interface';
import type { ColumnsType } from 'antd/es/table/interface';
import { Resizable } from 'react-resizable';
import type { ResizeCallbackData } from 'react-resizable';
import 'react-resizable/css/styles.css';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import {
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

type TableV2Props<T extends object> = TableComponentProps<T>;

/** Structural aliases to avoid a direct react-aria-components peer import. */
type AriaKey = string | number;
type AriaSelection = 'all' | Set<AriaKey>;
interface AriaSortDescriptor {
  column?: AriaKey;
  direction?: 'ascending' | 'descending';
}

const TableV2 = <T extends object>(
  {
    loading,
    searchProps,
    customPaginationProps,
    entityType,
    defaultVisibleColumns,
    'data-testid': dataTestId,
    ...rest
  }: TableV2Props<T>,
  ref: Ref<HTMLDivElement> | null | undefined
) => {
  const { t } = useTranslation();
  const { type } = useGenericContext();
  const [propsColumns, setPropsColumns] = useState<ColumnsType<T>>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);
  const [dropdownColumnList, setDropdownColumnList] = useState<
    TableColumnDropdownList[]
  >([]);
  const [columnDropdownSelections, setColumnDropdownSelections] = useState<
    string[]
  >([]);
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
    if (!rest.pagination) {
      return null;
    }
    const cfg = rest.pagination as TablePaginationConfig;

    return {
      pageSize: (cfg.pageSize as number) ?? 10,
      hideOnSinglePage: cfg.hideOnSinglePage ?? false,
    };
  }, [rest.pagination]);

  const pagedDataSource = useMemo((): T[] => {
    const data = (rest.dataSource ?? []) as T[];
    if (!clientPagination) {
      return data;
    }
    const start = (internalCurrentPage - 1) * clientPagination.pageSize;

    return data.slice(start, start + clientPagination.pageSize);
  }, [rest.dataSource, clientPagination, internalCurrentPage]);

  const isCustomizeColumnEnable = useMemo(
    () =>
      !isEmpty(rest.staticVisibleColumns) && !isEmpty(defaultVisibleColumns),
    [rest.staticVisibleColumns, defaultVisibleColumns]
  );

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
        return String((record as Record<string, unknown>)[rest.rowKey]);
      }

      return String(index);
    },
    [rest.rowKey]
  );

  // ─── Row selection ────────────────────────────────────────────────────────

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
      const dataSource = (rest.dataSource ?? []) as T[];
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
    [rest.rowSelection, rest.dataSource, getRowKey]
  );

  // ─── Column resize ────────────────────────────────────────────────────────

  const handleColumnResize = useCallback(
    (colKey: string) =>
      (_: React.SyntheticEvent, { size }: ResizeCallbackData) => {
        setColumnWidths((prev) => ({ ...prev, [colKey]: size.width }));
      },
    []
  );

  // ─── Sorting ──────────────────────────────────────────────────────────────

  const handleSortChange = useCallback(
    (descriptor: AriaSortDescriptor) => {
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
        {} as TablePaginationConfig,
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
    [rest.onChange, propsColumns, rest.dataSource]
  );

  // ─── Search ───────────────────────────────────────────────────────────────

  const handleSearchAction = (value: string) => {
    searchProps?.onSearch?.(value);
  };

  // ─── Column state effects (identical to Table.tsx) ────────────────────────

  useEffect(() => {
    if (isCustomizeColumnEnable) {
      setDropdownColumnList(
        getCustomizeColumnDetails<T>(rest.columns, rest.staticVisibleColumns)
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

  useEffect(() => {
    setInternalCurrentPage(1);
  }, [rest.dataSource]);

  // ─── Cell value resolver ──────────────────────────────────────────────────

  const resolveCellValue = useCallback(
    (col: ColumnType<T>, record: T, index: number): ReactNode => {
      const { dataIndex, render } = col;
      const rawValue = Array.isArray(dataIndex)
        ? dataIndex.reduce(
            (obj: unknown, key) =>
              (obj as Record<string, unknown>)?.[key as string],
            record as unknown
          )
        : typeof dataIndex === 'string'
        ? (record as Record<string, unknown>)[dataIndex]
        : undefined;

      if (render) {
        const rendered = render(rawValue, record, index);
        if (
          rendered !== null &&
          typeof rendered === 'object' &&
          'children' in rendered &&
          !('$$typeof' in rendered)
        ) {
          return (rendered as { children: ReactNode }).children;
        }

        return rendered as ReactNode;
      }

      return rawValue !== undefined && rawValue !== null
        ? String(rawValue)
        : null;
    },
    []
  );

  // ─── Column title resolver ────────────────────────────────────────────────

  const resolveColumnTitle = useCallback(
    (col: ColumnType<T>): ReactNode => {
      if (typeof col.title === 'function') {
        const sortedColumn = propsColumns.find(
          (c) => (c as ColumnType<T>).sortOrder
        ) as ColumnType<T> | undefined;

        return (
          col.title as (props: {
            sortOrder?: SortOrder;
            sortColumn?: ColumnType<T>;
            filters?: Record<string, FilterValue | null>;
          }) => ReactNode
        )({
          sortOrder: col.sortOrder ?? null,
          sortColumn: sortedColumn,
          filters: {},
        });
      }

      return col.title as ReactNode;
    },
    [propsColumns]
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className={classNames('table-container', rest.containerClassName)}
      data-testid={dataTestId}
      ref={ref}>
      <div
        className={classNames('p-x-md', {
          'p-y-md':
            searchProps || rest.extraTableFilters || isCustomizeColumnEnable,
        })}>
        <div className="d-flex">
          {searchProps ? (
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
          ) : null}
          {(rest.extraTableFilters || isCustomizeColumnEnable) && (
            <div
              className={classNames(
                'd-flex justify-end items-center gap-5',
                rest.extraTableFiltersClassName
              )}
              style={searchProps ? { flex: 1 } : undefined}>
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
        className="tw:relative"
        style={{
          ...(rest.scroll?.x ? { overflowX: 'auto' } : {}),
          ...(rest.scroll?.y
            ? { overflowY: 'auto', maxHeight: rest.scroll.y }
            : {}),
        }}>
        {isLoading && (
          <div className="tw:absolute tw:inset-0 tw:z-10 tw:flex tw:items-center tw:justify-center tw:bg-white/60">
            <Loader />
          </div>
        )}

        <UntitledTable
          aria-label="data-table"
          selectionBehavior={rest.rowSelection ? 'toggle' : undefined}
          selectionMode={selectionMode}
          size={rest.size === 'small' ? 'sm' : 'md'}
          onSelectionChange={handleSelectionChange}
          onSortChange={handleSortChange}>
          <UntitledTable.Header className="tw:px-2">
            {propsColumns.map((col, colIdx) => {
              const colType = col as ColumnType<T>;
              const colKey = String(col.key ?? colType.dataIndex ?? colIdx);
              const colWidth =
                columnWidths[colKey] ?? (colType.width as number) ?? 150;

              const headNode = (
                <UntitledTable.Head
                  allowsSorting={!!colType.sorter}
                  className="tw:pl-4 tw:pr-2 tw:text-sm tw:text-tertiary"
                  id={colKey}
                  key={colKey}
                  style={
                    rest.resizableColumns
                      ? { width: colWidth, minWidth: colWidth }
                      : undefined
                  }>
                  {resolveColumnTitle(colType)}
                </UntitledTable.Head>
              );

              return rest.resizableColumns ? (
                <Resizable
                  draggableOpts={{ enableUserSelectHack: false }}
                  height={0}
                  key={colKey}
                  minConstraints={[80, 0]}
                  width={colWidth}
                  onResize={handleColumnResize(colKey)}>
                  {headNode}
                </Resizable>
              ) : (
                headNode
              );
            })}
          </UntitledTable.Header>

          <UntitledTable.Body
            renderEmptyState={() =>
              isLoading ? null : (
                <div className="tw:py-8 tw:text-center tw:text-sm tw:text-fg-tertiary">
                  {(rest.locale?.emptyText as ReactNode) ?? t('label.no-data')}
                </div>
              )
            }>
            {pagedDataSource.map((record, pageLocalIdx) => {
              const actualIndex = clientPagination
                ? (internalCurrentPage - 1) * clientPagination.pageSize +
                  pageLocalIdx
                : pageLocalIdx;

              return (
                <UntitledTable.Row
                  className={
                    typeof rest.rowClassName === 'function'
                      ? rest.rowClassName(record, actualIndex, 0)
                      : rest.rowClassName
                  }
                  data-row-key={getRowKey(record, actualIndex)}
                  id={getRowKey(record, actualIndex)}
                  key={getRowKey(record, actualIndex)}>
                  {propsColumns.map((col, colIdx) => {
                    const cellKey = String(
                      col.key ?? (col as ColumnType<T>).dataIndex ?? colIdx
                    );

                    return (
                      <UntitledTable.Cell
                        className={
                          rest.cellClassName ??
                          'tw:py-2 tw:pl-4 tw:pr-2 tw:align-top'
                        }
                        key={cellKey}
                        style={
                          rest.resizableColumns
                            ? {
                                width:
                                  columnWidths[cellKey] ??
                                  ((col as ColumnType<T>).width as number) ??
                                  150,
                              }
                            : undefined
                        }>
                        {resolveCellValue(
                          col as ColumnType<T>,
                          record,
                          actualIndex
                        )}
                      </UntitledTable.Cell>
                    );
                  })}
                </UntitledTable.Row>
              );
            })}
          </UntitledTable.Body>
        </UntitledTable>
      </div>

      {customPaginationProps && customPaginationProps.showPagination ? (
        <div>
          <NextPrevious {...customPaginationProps} />
        </div>
      ) : clientPagination &&
        !(
          clientPagination.hideOnSinglePage &&
          (rest.dataSource ?? []).length <= clientPagination.pageSize
        ) ? (
        <div>
          <NextPrevious
            isNumberBased
            currentPage={internalCurrentPage}
            pageSize={clientPagination.pageSize}
            paging={{ total: (rest.dataSource ?? []).length }}
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
