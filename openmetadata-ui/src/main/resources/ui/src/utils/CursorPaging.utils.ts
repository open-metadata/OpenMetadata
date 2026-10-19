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
import { Paging } from '../generated/type/paging';

interface WalkToAfterCursorOptions {
  /** The page to open. */
  target: number;
  /** Paging a loaded page returned, if it is still known. */
  pagingFor: (page: number) => Paging | undefined;
  /** Keep the paging of a page fetched while walking. */
  remember: (page: number, paging: Paging) => void;
  /** Fetch the page that starts at `after` and return its paging. */
  fetchPaging: (after: string) => Promise<Paging>;
  /** True once a newer navigation or a list restart made this walk moot. */
  isStale: () => boolean;
}

/**
 * The `after` cursor that opens page `target` of a cursor-paged list, fetching
 * any pages between the last known one and `target` so a jump (e.g. 1 -> 4)
 * lands on the right page. Undefined when the list runs out of pages or the
 * walk went stale (ADR:2026-10-16-cursor-paged-lists-jump-by-walking).
 */
export const walkToAfterCursor = async ({
  target,
  pagingFor,
  remember,
  fetchPaging,
  isStale,
}: WalkToAfterCursorOptions): Promise<string | undefined> => {
  let known = target - 1;
  while (known > 1 && !pagingFor(known)) {
    known--;
  }
  let knownPaging = pagingFor(known);
  while (known < target - 1 && knownPaging?.after) {
    const nextPaging = await fetchPaging(knownPaging.after);
    if (isStale()) {
      return undefined;
    }
    known++;
    remember(known, nextPaging);
    knownPaging = nextPaging;
  }

  return known === target - 1 ? knownPaging?.after : undefined;
};
