/* eslint-disable @typescript-eslint/camelcase */
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
import { SearchIndex } from '../enums/search.enum';

export const getSearchAPIQueryParams = (
  queryString: string,
  from: number,
  size: number,
  filters: string,
  sortField: string,
  sortOrder: string,
  searchIndex: SearchIndex | SearchIndex[],
  onlyDeleted = false,
  trackTotalHits = false
): Record<string, string | boolean | number | string[]> => {
  const start = (from - 1) * size;
  const query = queryString
    ? queryString.includes(':')
      ? queryString
      : `*${queryString}*`
    : WILD_CARD_CHAR;

  return {
    q: query + filters ? ` AND ${filters}` : '',
    from: start,
    size,
    deleted: onlyDeleted,
    index: searchIndex,
    sort_field: sortField ?? undefined,
    sort_order: sortOrder ?? undefined,
    track_total_hits: trackTotalHits ?? undefined,
  };
};

// will add back slash "\" before quote in string if present
export const getQueryWithSlash = (query: string): string =>
  query.replace(/["']/g, '\\$&');
