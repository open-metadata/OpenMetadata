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
import { ClipboardCheck } from '@openmetadata/ui-core-components/icons';
import { get, isString, startCase } from 'lodash';
import { useEffect, useState } from 'react';
import { SearchIndex } from '../../../../enums/search.enum';
import { TaskStatus, TaskType } from '../../../../generated/entity/tasks/task';
import { SearchSourceAlias } from '../../../../interface/search.interface';
import { searchQuery } from '../../../../rest/searchAPI';
import { listTasks, Task } from '../../../../rest/tasksAPI';
import { getRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import Fqn from '../../../../utils/Fqn';
import searchClassBase from '../../../../utils/SearchClassBase';
import {
  INBOX_TASK_ID_PARAM,
  PERSONAL_SPACE_ROUTES,
} from '../../../discovery/personal-space/personalSpace.constants';
import {
  ACTIVE_TAB_PAGE_SIZE,
  ALL_TAB_ASSET_ROWS,
  ALL_TAB_OTHER_ROWS,
  GLOBAL_SEARCH_DEBOUNCE_MS,
  INDEX_CATEGORIES,
} from './GlobalSearch.constants';
import {
  GlobalSearchCategory,
  GlobalSearchFacetSelection,
  GlobalSearchFilter,
  GlobalSearchResults,
  GlobalSearchRow,
  GlobalSearchSection,
  GlobalSearchSourceContribution,
} from './GlobalSearch.types';
import { getFacetQueryFilter, getPageSize } from './GlobalSearch.utils';

const NON_ASSET_INDEXES = new Set<string>(
  Object.values(INDEX_CATEGORIES).flat()
);

export const getAssetSearchIndexes = () =>
  Object.keys(searchClassBase.getTabsInfo()).filter(
    (index) => !NON_ASSET_INDEXES.has(index)
  ) as SearchIndex[];

const lastSegment = (fqn?: string) => fqn?.split('.').pop() ?? '';

export const toSearchRow = (source: SearchSourceAlias): GlobalSearchRow => {
  const fqn = source.fullyQualifiedName ?? '';
  const parents = fqn ? Fqn.split(fqn).slice(0, -1).join(' › ') : '';
  const link = searchClassBase.getEntityLink(source);
  const tier = lastSegment(get(source, 'tier.tagFQN'));
  const certification = lastSegment(
    get(source, 'certification.tagLabel.tagFQN')
  );

  return {
    id: source.id ?? fqn,
    title: searchClassBase.getEntityName(source),
    meta: [startCase(source.entityType), parents].filter(Boolean).join(' · '),
    icon: searchClassBase.getEntityIcon(source.entityType ?? ''),
    badges: [tier, certification].filter(Boolean),
    href: isString(link) ? link : link.pathname,
    source,
  };
};

const toTaskRow = (task: Task): GlobalSearchRow => ({
  id: task.id,
  title: task.displayName ?? task.name,
  meta: [
    task.taskId,
    task.createdBy?.displayName ?? task.createdBy?.name,
    startCase(task.type),
    task.createdAt ? getRelativeTime(task.createdAt) : '',
  ]
    .filter(Boolean)
    .join(' · '),
  icon: <ClipboardCheck size={20} />,
  href: `${PERSONAL_SPACE_ROUTES.INBOX_TASKS}?${INBOX_TASK_ID_PARAM}=${task.id}`,
});

export interface GlobalSearchQuery {
  query: string;
  filter: GlobalSearchFilter;
  categories: GlobalSearchCategory[];
  facets: GlobalSearchFacetSelection;
  sort: string;
  sortOrder: string;
  taskStatus?: TaskStatus;
  taskType?: TaskType;
  sources: GlobalSearchSourceContribution[];
  /** Bumped by "Try again" to refetch the same query. */
  retryKey: number;
}

const fetchCategory = async (
  category: GlobalSearchCategory,
  params: GlobalSearchQuery,
  signal: AbortSignal
): Promise<GlobalSearchSection> => {
  const { query, filter, facets, sort, sortOrder, taskStatus, taskType } =
    params;
  const isActive = filter === category;
  const pageSize = getPageSize(category, isActive, {
    active: ACTIVE_TAB_PAGE_SIZE,
    assets: ALL_TAB_ASSET_ROWS,
    other: ALL_TAB_OTHER_ROWS,
  });

  const source = params.sources.find((item) => item.key === category);
  if (source) {
    return source.search(query, signal);
  }

  if (category === 'tasks') {
    const res = await listTasks({
      q: query,
      status: taskStatus,
      type: taskType,
      limit: pageSize,
    });

    return {
      count: res.paging?.total ?? res.data.length,
      rows: res.data.map(toTaskRow),
    };
  }

  const isAssets = category === 'assets';
  const res = await searchQuery({
    query,
    searchIndex: isAssets
      ? getAssetSearchIndexes()
      : INDEX_CATEGORIES[category] ?? [],
    pageNumber: 1,
    pageSize,
    trackTotalHits: true,
    signal,
    ...(isAssets
      ? {
          queryFilter: getFacetQueryFilter(facets),
          sortField: sort,
          sortOrder,
        }
      : {}),
  });

  return {
    count: res.hits.total.value,
    rows: res.hits.hits.map((hit) =>
      toSearchRow(hit._source as SearchSourceAlias)
    ),
  };
};

/**
 * Fetches every result type for the query in parallel, debounced. Each type
 * settles on its own so one failing source doesn't blank the others; the
 * error state shows only when all of them fail.
 */
export const useGlobalSearchResults = (params: GlobalSearchQuery) => {
  const [results, setResults] = useState<GlobalSearchResults>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const {
    query,
    filter,
    categories,
    facets,
    sort,
    sortOrder,
    taskStatus,
    taskType,
    sources,
    retryKey,
  } = params;
  const trimmed = query.trim();
  const categoryKey = categories.join();
  const facetKey = JSON.stringify(facets);
  const sourceKey = sources.map((source) => source.key).join();

  useEffect(() => {
    if (!trimmed) {
      setResults({});
      setIsLoading(false);
      setHasError(false);

      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    const timer = setTimeout(async () => {
      const settled = await Promise.allSettled(
        categories.map((category) =>
          fetchCategory(
            category,
            { ...params, query: trimmed },
            controller.signal
          )
        )
      );
      if (controller.signal.aborted) {
        return;
      }
      const next: GlobalSearchResults = {};
      settled.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          next[categories[index]] = result.value;
        }
      });
      setResults(next);
      setHasError(settled.every((result) => result.status === 'rejected'));
      setIsLoading(false);
    }, GLOBAL_SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `params` is spread into the fetch; its fields are the real deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    trimmed,
    filter,
    categoryKey,
    facetKey,
    sort,
    sortOrder,
    taskStatus,
    taskType,
    sourceKey,
    retryKey,
  ]);

  return {
    results,
    isLoading,
    /** Nothing to show yet for this query — render skeleton rows. */
    isFirstLoad: isLoading && Object.keys(results).length === 0,
    hasError,
  };
};
