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

import { ReactNode } from 'react';
import { SearchIndex } from '../../../enums/search.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../generated/entity/domains/domain';

export type EntityTableType = 'domains' | 'data-products' | 'sub-domains';

export type EntityData = Domain | DataProduct;

export interface EntityTableFilters {
  owners: string[];
  glossaryTerms: string[];
  domainTypes: string[];
  tags: string[];
}

export interface EntityTableColumn {
  key: string;
  title: string | ReactNode;
  dataIndex?: string;
  render?: (value: unknown, record: EntityData) => ReactNode;
  sorter?: boolean | ((a: EntityData, b: EntityData) => number);
  width?: number;
  fixed?: 'left' | 'right';
  ellipsis?: boolean;
}

export interface EntityTableProps {
  type: EntityTableType;
  data: EntityData[];
  loading?: boolean;
  total?: number;
  searchTerm?: string;
  filters?: EntityTableFilters;
  searchIndex?: SearchIndex;
  baseQueryFilter?: Record<string, unknown>;
  onSearchChange?: (searchTerm: string) => void;
  onFiltersUpdate?: (filters: EntityTableFilters) => void;
  onDelete?: (id: string) => Promise<void>;
  onBulkDelete?: (ids: string[]) => Promise<void>;
  onRowClick?: (record: EntityData) => void;
  onDomainTypeChange?: (recordId: string, newDomainType: string) => void;
  rowKey?: string;
  showPagination?: boolean;
  [key: string]: unknown;
}

export enum EntityListViewOptions {
  GRID = 1,
  LIST = 2,
}
