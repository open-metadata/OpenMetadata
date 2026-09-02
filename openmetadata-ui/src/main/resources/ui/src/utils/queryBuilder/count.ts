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
import type { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import type { QueryFilterInterface } from '../../interface/queryFilter.interface';
import { searchQuery } from '../../rest/searchAPI';
import {
  addEntityTypeFilter,
  getEntityTypeAggregationFilter,
} from '../QueryBuilderPureUtils';

/**
 * Narrows a builder filter to the caller's entity type.
 *
 * Call this exactly once per emitted filter: `addEntityTypeFilter` pushes into
 * `query.bool.must` in place, so a second call on the same object appends the
 * entity-type clause twice. The Explore URL and the count request therefore
 * share one scoped filter rather than each deriving their own.
 */
export const getScopedQueryFilter = (
  queryFilter: QueryFilterInterface,
  entityType: EntityType
): QueryFilterInterface =>
  getEntityTypeAggregationFilter(
    addEntityTypeFilter(queryFilter, entityType),
    entityType
  );

/**
 * How many entities the current filter matches.
 *
 * The same fetch previously lived in both `QueryBuilderWidgetV1` and the RJSF
 * widget, with two different failure behaviours: V1 reset the count to 0, the
 * widget left the previous count on screen. Reporting 0 is the safer of the
 * two — a stale count reads as a successful narrowing that never happened.
 *
 * Debouncing belongs to the caller: this is a plain request.
 */
export const fetchQueryBuilderCount = async (
  scopedFilter: QueryFilterInterface
): Promise<number> => {
  try {
    const res = await searchQuery({
      query: '',
      pageNumber: 0,
      pageSize: 0,
      queryFilter: scopedFilter as unknown as Record<string, unknown>,
      searchIndex: SearchIndex.ALL,
      includeDeleted: false,
      trackTotalHits: true,
      fetchSource: false,
    });

    return res.hits.total.value ?? 0;
  } catch {
    return 0;
  }
};
