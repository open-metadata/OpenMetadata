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

import { Checkbox } from 'antd';
import { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Domain } from '../../../generated/entity/domains/domain';
import { getDomainsDetailsPath } from '../../../utils/RouterUtils';
import Table from '../../common/Table/Table';
import { DomainTableColumn, DomainTableProps } from './DomainTable.interface';

const DomainTable = ({
  columns,
  data,
  loading = false,
  onRowClick,
  onSearch,
  searchPlaceholder,
  searchValue,
  showPagination = true,
  total,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
  entityType = 'domain',
  // Selection related props
  showSelection = false,
  selectedRows = [],
  onSelectionChange,
  selectionType = 'checkbox',
  disableSelection,
  selectAllLabel,
  selectAllChecked = false,
  selectAllIndeterminate = false,
  onSelectAll,
  ...rest
}: DomainTableProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Convert DomainTableColumn to Ant Design ColumnsType
  const antdColumns: ColumnsType<Domain> = useMemo(() => {
    const baseColumns = columns.map((column: DomainTableColumn) => ({
      key: column.key,
      title: column.title,
      dataIndex: column.dataIndex || column.key,
      render: column.render,
      sorter: column.sorter,
      width: column.width,
      fixed: column.fixed,
      ellipsis: column.ellipsis,
    }));

    // Add selection column if showSelection is true
    if (showSelection) {
      const selectionColumn = {
        key: 'entitySelection',
        title: (
          <div className="d-flex align-items-center gap-2">
            {selectionType === 'checkbox' && (
              <Checkbox
                checked={selectAllChecked}
                data-testid="select-all-checkbox"
                indeterminate={selectAllIndeterminate}
                onChange={(e) => onSelectAll?.(e.target.checked)}
              />
            )}
            {selectAllLabel || t('label.select-all')}
          </div>
        ),
        dataIndex: 'entitySelection',
        width: 120,
        render: (_: any, record: Domain) => (
          <Checkbox
            checked={selectedRows.some((row: Domain) => row.id === record.id)}
            data-testid={`${record.name}-checkbox`}
            disabled={disableSelection?.(record)}
            onChange={(e) => handleRowSelection(record, e.target.checked)}
          />
        ),
      };

      return [selectionColumn, ...baseColumns];
    }

    return baseColumns;
  }, [
    columns,
    showSelection,
    selectedRows,
    selectAllChecked,
    selectAllIndeterminate,
    selectAllLabel,
    selectionType,
    disableSelection,
    t,
  ]);

  // Handle individual row selection
  const handleRowSelection = useCallback(
    (record: Domain, checked: boolean) => {
      if (!onSelectionChange) {
        return;
      }

      const newSelectedRows = checked
        ? [...selectedRows, record]
        : selectedRows.filter((row: Domain) => row.id !== record.id);

      const newSelectedRowKeys = newSelectedRows.map(
        (row: Domain) => row.id || ''
      );
      onSelectionChange(newSelectedRows, newSelectedRowKeys);
    },
    [selectedRows, onSelectionChange]
  );

  // Handle row click
  const handleRowClick = useCallback(
    (record: Domain) => {
      if (onRowClick) {
        onRowClick(record);
      } else {
        // Default navigation to domain details page
        navigate(
          getDomainsDetailsPath(
            record.fullyQualifiedName || record.name,
            'overview'
          )
        );
      }
    },
    [onRowClick, navigate]
  );

  // Search props for the table
  const searchProps = useMemo(() => {
    if (!onSearch) {
      return undefined;
    }

    return {
      placeholder:
        searchPlaceholder ||
        t('label.search-entity', { entity: t('label.domain') }),
      onSearch,
      value: searchValue,
    };
  }, [onSearch, searchPlaceholder, searchValue, t]);

  // Pagination props for the table
  const paginationProps = useMemo(() => {
    if (!showPagination || !onPageChange) {
      return undefined;
    }

    return {
      showPagination: true,
      paging: {
        total: total || 0,
        pageSize,
        currentPage,
      },
      pagingHandler: ({ currentPage: page }: { currentPage: number }) => {
        onPageChange(page, pageSize);
      },
      pageSize,
      currentPage,
    };
  }, [showPagination, currentPage, pageSize, total, onPageChange]);

  return (
    <Table
      {...rest}
      resizableColumns
      columns={antdColumns}
      customPaginationProps={paginationProps}
      dataSource={data}
      entityType={entityType}
      loading={loading}
      rowKey="id"
      searchProps={searchProps}
      onRow={(record) => ({
        onClick: () => handleRowClick(record),
        style: { cursor: 'pointer' },
      })}
    />
  );
};

export default DomainTable;
