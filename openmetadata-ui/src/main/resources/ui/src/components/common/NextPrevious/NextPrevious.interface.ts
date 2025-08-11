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

import { CursorType } from '../../../enums/pagination.enum';
import { Paging } from '../../../generated/type/paging';

export interface NextPreviousProps extends BasicProps, Partial<PagingProps> {
  className?: string;
}

export interface PagingHandlerParams {
  currentPage: number;
  cursorType?: CursorType;
}

interface BasicProps {
  paging: Paging;
  pagingHandler: (data: PagingHandlerParams) => void;
  pageSize: number;
  currentPage: number;
  isNumberBased?: boolean;
  isLoading?: boolean;
}

export interface PagingProps {
  pageSizeOptions?: number[];
  onShowSizeChange: (page: number) => void;
}
