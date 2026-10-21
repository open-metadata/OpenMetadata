/*
 *  Copyright 2026 Collate.
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
import { PagingResponse } from 'Models';

/** Follows `after` cursors to the last page, failing instead of looping on a repeated cursor or past `maxPages`. */
export const listAllPages = async <T>(
  loadPage: (after?: string) => Promise<PagingResponse<T[]>>,
  maxPages: number
): Promise<T[]> => {
  const items: T[] = [];
  const cursors = new Set<string>();
  let after: string | undefined;

  for (let pageNumber = 0; pageNumber < maxPages; pageNumber++) {
    const page = await loadPage(after);
    items.push(...page.data);

    const next = page.paging.after;
    if (!next) {
      return items;
    }
    if (cursors.has(next)) {
      throw new Error('Pagination returned a repeated cursor');
    }
    cursors.add(next);
    after = next;
  }

  throw new Error(`Pagination exceeded ${maxPages} pages`);
};
