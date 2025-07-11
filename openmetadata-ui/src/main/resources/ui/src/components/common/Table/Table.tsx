/*
 *  Copyright 2023 Collate.
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
import Icon from '@ant-design/icons';
import {
  Button,
  Col,
  Dropdown,
  Row,
  SpinProps,
  Table as AntdTable,
  Typography,
} from 'antd';
import { ColumnsType, ColumnType } from 'antd/es/table';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import {
  forwardRef,
  Ref,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAntdColumnResize } from 'react-antd-column-resize';
import { Column } from 'react-antd-column-resize/dist/useAntdColumnResize/types';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ColumnIcon } from '../../../assets/svg/ic-column.svg';
import { useCurrentUserPreferences } from '../../../hooks/currentUserStore/useCurrentUserStore';
import {
  getCustomizeColumnDetails,
  getReorderedColumns,
} from '../../../utils/CustomizeColumnUtils';
import { getTableExpandableConfig } from '../../../utils/TableUtils';
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

type TableProps<T extends Record<string, unknown>> = TableComponentProps<T>;

const Table = <T extends Record<string, unknown>>(
  {
    loading,
    searchProps,
    customPaginationProps,
    entityType,
    defaultVisibleColumns,
    ...rest
  }: TableProps<T>,
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
  const { resizableColumns, components, tableWidth } = useAntdColumnResize(
    () => ({ columns: propsColumns as Column[], minWidth: 80 }),
    [propsColumns]
  );
  const {
    preferences: { selectedEntityTableColumns },
    setPreference,
  } = useCurrentUserPreferences();

  const isLoading = useMemo(
    () => (loading as SpinProps)?.spinning ?? (loading as boolean) ?? false,
    [loading]
  );

  const entityKey = useMemo(() => entityType ?? type, [type, entityType]);

  // Check if the table is customizable, if so, the dropdown and Customize Column feature is available
  const isCustomizeColumnEnable = useMemo(
    () =>
      !isEmpty(rest.staticVisibleColumns) && !isEmpty(defaultVisibleColumns),
    [rest.staticVisibleColumns, defaultVisibleColumns]
  );

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

  const resizingTableProps = rest.resizableColumns
    ? {
        columns: resizableColumns,
        components: {
          ...rest.components,
          header: {
            row: rest.components?.header?.row,
            cell: components.header.cell,
          },
        },
        scroll: { x: tableWidth },
      }
    : {};

  const handleSearchAction = (value: string) => {
    searchProps?.onSearch?.(value);
  };

  useEffect(() => {
    if (isCustomizeColumnEnable) {
      setDropdownColumnList(
        getCustomizeColumnDetails<T>(rest.columns, rest.staticVisibleColumns)
      );
    }
  }, [isCustomizeColumnEnable, rest.columns, rest.staticVisibleColumns]);

  useEffect(() => {
    if (!isCustomizeColumnEnable) {
      setPropsColumns(rest.columns ?? []);
    } else {
      const filteredColumns = (rest.columns ?? []).filter(
        (item) =>
          columnDropdownSelections.includes(item.key as string) ||
          (rest.staticVisibleColumns ?? []).includes(item.key as string)
      );

      setPropsColumns(getReorderedColumns(dropdownColumnList, filteredColumns));
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

  return (
    <Row className={classNames('table-container', rest.containerClassName)}>
      <Col
        className={classNames({
          'p-y-md':
            searchProps ?? rest.extraTableFilters ?? isCustomizeColumnEnable,
        })}
        span={24}>
        <Row className="p-x-md">
          {searchProps ? (
            <Col span={12}>
              <Searchbar
                {...searchProps}
                removeMargin
                placeholder={searchProps?.placeholder ?? t('label.search')}
                searchValue={searchProps?.value}
                typingInterval={searchProps?.searchDebounceTime ?? 500}
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
                <DndProvider backend={HTML5Backend}>
                  <Dropdown
                    className="custom-column-dropdown-menu text-primary"
                    menu={menu}
                    open={isDropdownVisible}
                    placement="bottomRight"
                    trigger={['click']}
                    onOpenChange={setIsDropdownVisible}>
                    <Button
                      className="remove-button-background-hover"
                      data-testid="column-dropdown"
                      icon={<Icon component={ColumnIcon} />}
                      size="small"
                      type="text">
                      {t('label.column-plural')}
                    </Button>
                  </Dropdown>
                </DndProvider>
              )}
            </Col>
          )}
        </Row>
      </Col>

      <Col span={24}>
        <AntdTable
          {...rest}
          columns={propsColumns as unknown as ColumnType<T>[]}
          expandable={{
            ...getTableExpandableConfig<T>(),
            ...rest.expandable,
          }}
          loading={{
            spinning: isLoading,
            indicator: <Loader />,
          }}
          locale={{
            ...rest.locale,
            emptyText: isLoading ? null : rest.locale?.emptyText,
          }}
          ref={ref}
          tableLayout="fixed"
          {...resizingTableProps}
        />
      </Col>
      {customPaginationProps && customPaginationProps.showPagination ? (
        <Col span={24}>
          <NextPrevious {...customPaginationProps} />
        </Col>
      ) : null}
    </Row>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default forwardRef<HTMLDivElement, TableProps<any>>(Table);
