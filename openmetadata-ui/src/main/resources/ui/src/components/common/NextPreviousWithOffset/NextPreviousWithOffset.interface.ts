/*
 *  Copyright 2024 Collate.
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

import { Paging } from '../../../generated/type/paging';

export type NextPreviousWithOffsetProps =
  | BasicProps
  | (BasicProps & PagingProps);

export interface PagingHandlerParams {
  offset: number;
  page: number;
}

interface BasicProps {
  paging: Paging;
  pagingHandler: (data: PagingHandlerParams) => void;
  pageSize: number;
  currentPage: number;
  isLoading?: boolean;
}

export interface PagingProps {
  pageSizeOptions?: number[];
  onShowSizeChange: (page: number) => void;
}
