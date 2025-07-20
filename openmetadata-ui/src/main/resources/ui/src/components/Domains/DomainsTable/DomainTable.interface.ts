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

import { TableProps } from 'antd/lib/table';
import { Domain } from '../../../generated/entity/domains/domain';

export interface DomainTableColumn {
  key: string;
  title: string;
  dataIndex?: string;
  render?: (value: any, record: Domain, index: number) => React.ReactNode;
  sorter?: boolean | ((a: Domain, b: Domain) => number);
  width?: number | string;
  fixed?: 'left' | 'right' | boolean;
  ellipsis?: boolean;
}

export interface DomainTableProps
  extends Omit<TableProps<Domain>, 'columns' | 'dataSource'> {
  columns: DomainTableColumn[];
  data: Domain[];
  loading?: boolean;
  onRowClick?: (record: Domain) => void;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  searchValue?: string;
  showPagination?: boolean;
  total?: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  entityType?: string;
  // Selection related props
  showSelection?: boolean;
  selectedRows?: Domain[];
  onSelectionChange?: (
    selectedRows: Domain[],
    selectedRowKeys: string[]
  ) => void;
  selectionType?: 'checkbox' | 'radio';
  disableSelection?: (record: Domain) => boolean;
  selectAllLabel?: string;
  selectAllChecked?: boolean;
  selectAllIndeterminate?: boolean;
  onSelectAll?: (selected: boolean) => void;
}
