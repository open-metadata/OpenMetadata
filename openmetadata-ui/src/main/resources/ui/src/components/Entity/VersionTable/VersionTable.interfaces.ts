/*
 *  Copyright 2022 Collate.
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

import { SearchIndexField } from '../../../generated/entity/data/searchIndex';
import {
  Column,
  ColumnJoins,
  FieldChange,
  TableConstraint,
} from '../../../generated/entity/data/table';
import { Paging } from '../../../generated/type/paging';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';

export interface VersionTableProps<T extends Column | SearchIndexField> {
  columnName: string;
  columns: T[];
  joins?: Array<ColumnJoins>;
  addedColumnConstraintDiffs?: FieldChange[];
  deletedColumnConstraintDiffs?: FieldChange[];
  addedTableConstraintDiffs?: FieldChange[];
  deletedTableConstraintDiffs?: FieldChange[];
  constraintUpdatedColumns?: string[];
  tableConstraints?: Array<TableConstraint>;
  isLoading?: boolean;
  paginationProps?: {
    currentPage: number;
    showPagination: boolean;
    isLoading: boolean;
    isNumberBased: boolean;
    pageSize: number;
    paging: Paging;
    pagingHandler: ({ currentPage }: PagingHandlerParams) => void;
    onShowSizeChange: (page: number) => void;
  };
  handelSearchCallback?: (searchValue: string) => void;
}
