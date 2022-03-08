/*
 *  Copyright 2021 Collate
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

import { WILD_CARD_CHAR } from '../constants/char.constants';

export const getSearchAPIQuery = (
  queryString: string,
  from: number,
  size: number,
  filters: string,
  sortField: string,
  sortOrder: string,
  searchIndex: string,
  onlyDeleted = false
): string => {
  const start = (from - 1) * size;
  const query = queryString
    ? queryString.includes(':')
      ? queryString
      : `*${queryString}*`
    : WILD_CARD_CHAR;

  return `q=${query}${
    filters ? ` AND ${filters}` : ''
  }&from=${start}&size=${size}${onlyDeleted ? '&deleted=true' : ''}${
    sortField ? `&sort_field=${sortField}` : ''
  }${sortOrder ? `&sort_order=${sortOrder}` : ''}${
    searchIndex ? `&index=${searchIndex}` : ''
  }`;
};
