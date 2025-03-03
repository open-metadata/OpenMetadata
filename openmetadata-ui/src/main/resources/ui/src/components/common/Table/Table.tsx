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
  Dropdown,
  SpinProps,
  Table as AntdTable,
  Typography,
} from 'antd';
import { ColumnType } from 'antd/lib/table';
import { isEmpty } from 'lodash';
import React, {
  forwardRef,
  Ref,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAntdColumnResize } from 'react-antd-column-resize';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ColumnIcon } from '../../../assets/svg/ic-column.svg';
import {
  getCustomizeColumnDetails,
  getReorderedColumns,
} from '../../../utils/CustomizeColumnUtils';
import { getTableExpandableConfig } from '../../../utils/TableUtils';
import Loader from '../Loader/Loader';
import DraggableMenuItem from './DraggableMenu/DraggableMenuItem.component';
import {
  TableColumnDropdownList,
  TableComponentProps,
} from './Table.interface';
import './table.less';

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
const Table = <T extends object = any>(
  { loading, ...rest }: TableComponentProps<T>,
  ref: Ref<HTMLDivElement> | null | undefined
) => {
  const { t } = useTranslation();
  const [propsColumns, setPropsColumns] = useState<ColumnType<T>[]>([]);
  const [columnTypes, setColumnTypes] = useState<{
    staticColumns: string[];
    customizeColumns: string[];
  }>({
    staticColumns: [],
    customizeColumns: [],
  });
  const [isDropdownVisible, setIsDropdownVisible] = useState<boolean>(false);
  const [dropdownColumnList, setDropdownColumnList] = useState<
    TableColumnDropdownList[]
  >([]);
  const [columnDropdownSelections, setColumnDropdownSelections] = useState<
    string[]
  >([]);
  const { resizableColumns, components, tableWidth } = useAntdColumnResize(
    () => ({ columns: propsColumns, minWidth: 150 }),
    [propsColumns]
  );

  const isLoading = useMemo(
    () => (loading as SpinProps)?.spinning ?? (loading as boolean) ?? false,
    [loading]
  );

  const handleMoveItem = useCallback(
    (updatedList: TableColumnDropdownList[]) => {
      setDropdownColumnList(updatedList);
      const reorderedColumns = getReorderedColumns(updatedList, [
        ...propsColumns, // creating a new reference for propsColumns, so that the useAntdColumnResize hook is triggered
      ]);
      setPropsColumns(reorderedColumns);
    },
    [propsColumns]
  );

  const handleColumnItemSelect = useCallback(
    (key: string, checked: boolean) => {
      setColumnDropdownSelections((prev: string[]) => {
        return checked ? [...prev, key] : prev.filter((item) => item !== key);
      });
    },
    [setColumnDropdownSelections]
  );

  const handleBulkColumnAction = useCallback(() => {
    if (dropdownColumnList.length === columnDropdownSelections.length) {
      setColumnDropdownSelections([]);
    } else {
      setColumnDropdownSelections(
        dropdownColumnList.map((option) => option.value)
      );
    }
  }, [dropdownColumnList, columnDropdownSelections]);

  const menu = useMemo(
    () => ({
      items: [
        {
          key: 'header',
          label: (
            <div className="d-flex justify-between items-center w-52 p-x-md p-b-xss border-bottom">
              <Typography.Text className="text-sm text-grey-muted font-medium">
                {t('label.column')}
              </Typography.Text>
              <Button
                className="text-primary text-sm p-0"
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

  useEffect(() => {
    const {
      staticColumns,
      customizeColumns,
      dropdownColumnList,
      columnDropdownSelections,
    } = getCustomizeColumnDetails<T>(rest.columns ?? []);
    setColumnTypes({ staticColumns, customizeColumns });
    setDropdownColumnList(dropdownColumnList);
    setColumnDropdownSelections(columnDropdownSelections);
  }, [rest.columns]);

  useEffect(() => {
    setPropsColumns(
      (rest.columns ?? []).filter((item) => {
        return (
          columnDropdownSelections.includes(item.key as string) ||
          columnTypes.staticColumns.includes(item.key as string)
        );
      })
    );
  }, [rest.columns, columnDropdownSelections, columnTypes.staticColumns]);

  return (
    <div className="table-container">
      {!isEmpty(dropdownColumnList) && (
        <div className="d-flex justify-end items-center gap-5 mb-4">
          {rest.tableFilters}

          <DndProvider backend={HTML5Backend}>
            <Dropdown
              className="custom-column-dropdown-menu"
              getPopupContainer={(trigger) => {
                const customContainer = trigger.closest(
                  '.custom-column-dropdown-menu'
                );

                return customContainer as HTMLElement;
              }}
              menu={menu}
              open={isDropdownVisible}
              trigger={['click']}
              onOpenChange={setIsDropdownVisible}>
              <Button
                data-testid="column-dropdown"
                icon={<Icon component={ColumnIcon} />}>
                {t('label.column-plural')}
              </Button>
            </Dropdown>
          </DndProvider>
        </div>
      )}

      <AntdTable
        {...rest}
        columns={propsColumns}
        expandable={{ ...getTableExpandableConfig<T>(), ...rest.expandable }}
        loading={{
          spinning: isLoading,
          indicator: <Loader />,
        }}
        locale={{
          ...rest.locale,
          emptyText: isLoading ? null : rest.locale?.emptyText,
        }}
        ref={ref}
        {...resizingTableProps}
      />
    </div>
  );
};

export default forwardRef<HTMLDivElement, TableComponentProps<any>>(Table);
