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
 *  - resizableColumns  (react-antd-column-resize is AntD-specific)
 *  - expandable        (React Aria has no built-in expandable rows)
 *  - components        (AntD custom cell/header renderers)
 *  - scroll            (handled via CSS overflow on the container)
 */

import { Table as UntitledTable } from '@openmetadata/ui-core-components';
import { Button, Col, Dropdown, Row, Typography } from 'antd';
import {
  ColumnType,
  FilterValue,
  SorterResult,
  TableCurrentDataSource,
  TablePaginationConfig,
} from 'antd/lib/table/interface';
import { ColumnsType } from 'antd/es/table/interface';
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
    ...rest
  }: TableV2Props<T>,
  ref: Ref<HTMLDivElement> | null | undefined
) => {
  const { t } = useTranslation();
  const { type } = useGenericContext();
  const [propsColumns, setPropsColumns] = useState<ColumnsType<T>>([]);
  const [isDropdownVisible, setIsDropdownVisible] = useState<boolean>(false);
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

  const menu = useMemo(
    () => ({
      items: [
        {
          key: 'header',
          label: (
            <div className="d-flex justify-between items-center w-52 p-x-md p-b-xss border-bottom">
              <Typography.Text
                className="text-sm text-grey-muted font-medium"
                data-testid="column-dropdown-title">
                {t('label.column')}
              </Typography.Text>
              <Button
                className="text-primary text-sm p-0"
                data-testid="column-dropdown-action-button"
                type="text"
                onClick={handleBulkColumnAction}>
                {dropdownColumnList.length === columnDropdownSelections.length
                  ? t('label.hide-all')
                  : t('label.view-all')}
              </Button>
            </div>
          ),
        },
        {
          key: 'columns',
          label: dropdownColumnList.map(
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
          ),
        },
      ],
    }),
    [
      dropdownColumnList,
      columnDropdownSelections,
      handleMoveItem,
      handleColumnItemSelect,
      handleBulkColumnAction,
    ]
  );

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

  const resolveColumnTitle = useCallback((col: ColumnType<T>): ReactNode => {
    if (typeof col.title === 'function') {
      return (col.title as (props: Record<string, unknown>) => ReactNode)({});
    }

    return col.title as ReactNode;
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className={classNames('table-container', rest.containerClassName)}
      ref={ref}>
      <Row
        className={classNames({
          'p-y-md':
            searchProps ?? rest.extraTableFilters ?? isCustomizeColumnEnable,
        })}>
        <Col span={24}>
          <Row className="p-x-md">
            {searchProps ? (
              <Col span={12}>
                <Searchbar
                  {...searchProps}
                  removeMargin
                  placeholder={searchProps?.placeholder ?? t('label.search')}
                  searchValue={searchProps?.searchValue}
                  typingInterval={searchProps?.typingInterval ?? 500}
                  onSearch={handleSearchAction}
                />
              </Col>
            ) : null}
            {(rest.extraTableFilters || isCustomizeColumnEnable) && (
              <Col
                className={classNames(
                  'd-flex justify-end items-center gap-5',
                  rest.extraTableFiltersClassName
                )}
                span={searchProps ? 12 : 24}>
                {rest.extraTableFilters}
                {isCustomizeColumnEnable && (
                  <Dropdown
                    className="custom-column-dropdown-menu"
                    menu={menu}
                    open={isDropdownVisible}
                    placement="bottomRight"
                    trigger={['click']}
                    onOpenChange={setIsDropdownVisible}>
                    <Button
                      className="remove-button-background-hover"
                      data-testid="column-dropdown"
                      icon={<ColumnIcon />}
                      size="small"
                      title={t('label.show-or-hide-column-plural')}
                      type="text">
                      {t('label.customize')}
                    </Button>
                  </Dropdown>
                )}
              </Col>
            )}
          </Row>
        </Col>
      </Row>

      <div className="tw:relative">
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

              return (
                <UntitledTable.Head
                  allowsSorting={!!colType.sorter}
                  className="tw:pl-4 tw:pr-2 tw:text-sm tw:text-tertiary"
                  id={colKey}
                  key={colKey}>
                  {resolveColumnTitle(colType)}
                </UntitledTable.Head>
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
            {((rest.dataSource ?? []) as T[]).map((record, index) => (
              <UntitledTable.Row
                className={
                  typeof rest.rowClassName === 'function'
                    ? rest.rowClassName(record, index, 0)
                    : rest.rowClassName
                }
                id={getRowKey(record, index)}
                key={getRowKey(record, index)}>
                {propsColumns.map((col, colIdx) => (
                  <UntitledTable.Cell
                    className="tw:py-2 tw:pl-4 tw:pr-2 tw:align-top"
                    key={String(
                      col.key ?? (col as ColumnType<T>).dataIndex ?? colIdx
                    )}>
                    {resolveCellValue(col as ColumnType<T>, record, index)}
                  </UntitledTable.Cell>
                ))}
              </UntitledTable.Row>
            ))}
          </UntitledTable.Body>
        </UntitledTable>
      </div>

      {customPaginationProps && customPaginationProps.showPagination ? (
        <div>
          <NextPrevious {...customPaginationProps} />
        </div>
      ) : null}
    </div>
  );
};

type TableV2WithGenerics = <T extends object>(
  props: TableV2Props<T> & RefAttributes<HTMLDivElement>
) => ReactElement | null;

export default forwardRef(TableV2) as unknown as TableV2WithGenerics;
