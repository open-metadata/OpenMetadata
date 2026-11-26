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
import { FeaturedIcon } from '@openmetadata/ui-core-components';
import { ClipboardCheck } from '@openmetadata/ui-core-components/icons';
import { get, isString } from 'lodash';
import { useEffect, useRef, useState } from 'react';
import { EntityFields } from '../../../../enums/AdvancedSearch.enum';
import { SORT_ORDER } from '../../../../enums/common.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { TaskStatus, TaskType } from '../../../../generated/entity/tasks/task';
import { SearchSourceAlias } from '../../../../interface/search.interface';
import {
  searchEntityTypeCounts,
  searchQuery,
} from '../../../../rest/searchAPI';
import { listTasks, Task } from '../../../../rest/tasksAPI';
import { getRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { EntityIconSize } from '../../../../utils/EntityIconUtils';
import { getEntityNameLabel } from '../../../../utils/EntityNameUtils';
import Fqn from '../../../../utils/Fqn';
import { t } from '../../../../utils/i18next/LocalUtil';
import searchClassBase from '../../../../utils/SearchClassBase';
import { getTaskTypeLabelKey } from '../../../discovery/personal-space/InboxPage/taskLabel.utils';
import {
  INBOX_TASK_ID_PARAM,
  PERSONAL_SPACE_ROUTES,
} from '../../../discovery/personal-space/personalSpace.constants';
import {
  ACTIVE_TAB_PAGE_SIZE,
  ALL_TAB_ASSET_ROWS,
  ALL_TAB_OTHER_ROWS,
  ASSETS_CATEGORY,
  BREADCRUMB_SEPARATOR,
  DEFAULT_ASSET_SORT,
  GLOBAL_SEARCH_DEBOUNCE_MS,
  TASKS_CATEGORY,
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
import {
  getFacetQueryFilter,
  getPageSize,
  hasFacetSelection,
} from './GlobalSearch.utils';

interface EntityTypeBucket {
  key: string;
  doc_count: number;
}

/**
 * Second line of an entity row, as in the prototype: `Table · svc › db › schema`,
 * or `Column in orders · svc › db › schema` for a column.
 */
export const getEntityRowMeta = (entityType: string, parents: string[]) => {
  if (entityType === EntityType.TABLE_COLUMN && parents.length > 0) {
    return [
      t('label.column-in-entity', { entity: parents[parents.length - 1] }),
      parents.slice(0, -1).join(BREADCRUMB_SEPARATOR),
    ]
      .filter(Boolean)
      .join(' · ');
  }

  return [getEntityNameLabel(entityType), parents.join(BREADCRUMB_SEPARATOR)]
    .filter(Boolean)
    .join(' · ');
};

/** Parent names from an FQN, for rows that carry no search source. */
export const getFqnParents = (fqn: string) =>
  fqn ? Fqn.split(fqn).slice(0, -1) : [];

const lastSegment = (fqn?: string) => fqn?.split('.').pop() ?? '';

export const toSearchRow = (source: SearchSourceAlias): GlobalSearchRow => {
  const fqn = source.fullyQualifiedName ?? '';
  const entityType = source.entityType ?? '';
  const breadcrumbs = searchClassBase
    .getEntityBreadcrumbs(source, entityType as EntityType)
    .map((crumb) => crumb.name);
  const parents = breadcrumbs.length > 0 ? breadcrumbs : getFqnParents(fqn);
  const link = searchClassBase.getEntityLink(source);
  const tier = lastSegment(get(source, 'tier.tagFQN'));
  const certification = lastSegment(
    get(source, 'certification.tagLabel.tagFQN')
  );

  return {
    id: source.id ?? fqn,
    title: searchClassBase.getEntityName(source),
    meta: getEntityRowMeta(entityType, parents),
    path: parents.join(BREADCRUMB_SEPARATOR),
    icon: searchClassBase.getEntityIconWithBg(
      entityType,
      EntityIconSize.Size18
    ),
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
    t(getTaskTypeLabelKey(task.type)),
    task.createdAt ? getRelativeTime(task.createdAt) : '',
  ]
    .filter(Boolean)
    .join(' · '),
  icon: <FeaturedIcon color="gray" icon={ClipboardCheck} size="sm" />,
  href: `${PERSONAL_SPACE_ROUTES.INBOX_TASKS}?${INBOX_TASK_ID_PARAM}=${task.id}`,
});

/** Narrows the `all` index to one entity type, plus that tab's own filters. */
const entityTypeFilter = (
  entityType: string,
  facets: GlobalSearchFacetSelection
) => ({
  query: {
    bool: {
      must: [
        { term: { [EntityFields.ENTITY_TYPE_KEYWORD]: entityType } },
        ...(getFacetQueryFilter(facets)?.query.bool.must ?? []),
      ],
    },
  },
});

/**
 * Whether the UI has a page for an entity type. A type the link resolver can't
 * place (e.g. an internal type, or a plugin type with no page) is left out of
 * search rather than listed with rows that go nowhere.
 */
export const canOpenEntityType = (entityType: string) => {
  const link = searchClassBase.getEntityLink({
    entityType,
    id: entityType,
    name: entityType,
    fullyQualifiedName: entityType,
  } as SearchSourceAlias);

  return Boolean(isString(link) ? link : link.pathname);
};

const getBuckets = (response: { aggregations?: unknown }) =>
  get(
    response,
    ['aggregations', 'entityType', 'buckets'],
    []
  ) as EntityTypeBucket[];

export interface GlobalSearchQuery {
  query: string;
  filter: GlobalSearchFilter;
  /** Opened from Recent Chat: search only these plugin sources. */
  scopedSources?: GlobalSearchCategory[];
  facets: GlobalSearchFacetSelection;
  sort: string;
  sortOrder: string;
  taskStatus?: TaskStatus;
  taskType?: TaskType;
  sources: GlobalSearchSourceContribution[];
  /** Bumped by "Try again" to refetch the same query. */
  retryKey: number;
}

const pageSizeFor = (
  category: GlobalSearchCategory,
  filter: GlobalSearchFilter
) =>
  getPageSize(category, filter === category, {
    active: ACTIVE_TAB_PAGE_SIZE,
    assets: ALL_TAB_ASSET_ROWS,
    other: ALL_TAB_OTHER_ROWS,
  });

const fetchAssets = async (params: GlobalSearchQuery, signal: AbortSignal) => {
  const isAssetsTab = params.filter === ASSETS_CATEGORY;
  const res = await searchQuery({
    query: params.query,
    searchIndex: SearchIndex.DATA_ASSET,
    pageNumber: 1,
    pageSize: pageSizeFor(ASSETS_CATEGORY, params.filter),
    trackTotalHits: true,
    // Facets belong to the active tab; another type's filters must not
    // narrow the asset count.
    queryFilter: getFacetQueryFilter(isAssetsTab ? params.facets : {}),
    // The sort control lives on the Data assets tab only.
    sortField: isAssetsTab ? params.sort : DEFAULT_ASSET_SORT,
    sortOrder: isAssetsTab ? params.sortOrder : SORT_ORDER.DESC,
    signal,
  });

  return {
    count: res.hits.total.value,
    rows: res.hits.hits.map((hit) =>
      toSearchRow(hit._source as SearchSourceAlias)
    ),
  };
};

const fetchEntityType = async (
  entityType: string,
  params: GlobalSearchQuery,
  signal: AbortSignal
): Promise<GlobalSearchSection> => {
  const res = await searchQuery({
    query: params.query,
    searchIndex: SearchIndex.ALL,
    pageNumber: 1,
    pageSize: pageSizeFor(entityType, params.filter),
    trackTotalHits: true,
    queryFilter: entityTypeFilter(
      entityType,
      params.filter === entityType ? params.facets : {}
    ),
    signal,
  });

  return {
    count: res.hits.total.value,
    label: getEntityNameLabel(entityType),
    rows: res.hits.hits.map((hit) =>
      toSearchRow(hit._source as SearchSourceAlias)
    ),
  };
};

const fetchTasks = async (params: GlobalSearchQuery, signal: AbortSignal) => {
  // The task filters live on the Tasks tab only.
  const isTasksTab = params.filter === TASKS_CATEGORY;
  const res = await listTasks(
    {
      q: params.query,
      status: isTasksTab ? params.taskStatus : undefined,
      type: isTasksTab ? params.taskType : undefined,
      limit: pageSizeFor(TASKS_CATEGORY, params.filter),
    },
    signal
  );

  return {
    count: res.paging?.total ?? res.data.length,
    rows: res.data.map(toTaskRow),
  };
};

/**
 * The categories come from the search API, not a fixed list: data assets are
 * whatever the server's `dataAsset` alias holds; every other entity type the
 * `all` alias returns for the query becomes its own category.
 */
type CategoryEntries = [GlobalSearchCategory, GlobalSearchSection][];

interface CategoryJob {
  entries: CategoryEntries;
  /** Some of the job's searches failed; the entries are what succeeded. */
  failed?: boolean;
}

const fetchEntityCategories = async (
  params: GlobalSearchQuery,
  signal: AbortSignal
): Promise<CategoryJob> => {
  const [assetCounts, allCounts] = await Promise.all([
    searchEntityTypeCounts({
      query: params.query,
      searchIndex: [SearchIndex.DATA_ASSET],
      signal,
    }),
    searchEntityTypeCounts({
      query: params.query,
      searchIndex: [SearchIndex.ALL],
      signal,
    }),
  ]);
  const assetTypes = new Set(
    getBuckets(assetCounts).map((bucket) => bucket.key)
  );
  const otherTypes = getBuckets(allCounts)
    .filter(
      (bucket) =>
        bucket.doc_count > 0 &&
        !assetTypes.has(bucket.key) &&
        canOpenEntityType(bucket.key)
    )
    .map((bucket) => bucket.key);

  const settled = await Promise.allSettled([
    assetTypes.size > 0
      ? fetchAssets(params, signal)
      : Promise.resolve({ count: 0, rows: [] }),
    ...otherTypes.map((type) => fetchEntityType(type, params, signal)),
  ]);
  const keys = [ASSETS_CATEGORY, ...otherTypes];

  return {
    entries: settled.flatMap(
      (result, index): CategoryEntries =>
        result.status === 'fulfilled' ? [[keys[index], result.value]] : []
    ),
    failed: settled.some((result) => result.status === 'rejected'),
  };
};

// A plugin's search runs inside a promise, so one that throws synchronously
// counts as a failed source instead of breaking the whole fetch.
const searchSource = (
  source: GlobalSearchSourceContribution,
  query: string,
  signal: AbortSignal
) => Promise.resolve().then(() => source.search(query, signal));

interface FetchOutcome {
  results: GlobalSearchResults;
  /** At least one request failed. */
  failed: boolean;
}

const getSearchedSources = (params: GlobalSearchQuery) =>
  params.scopedSources
    ? params.sources.filter((source) =>
        params.scopedSources?.includes(source.key)
      )
    : params.sources;

/** Refetches only the open tab's type, e.g. after a filter or sort change. */
const fetchActiveCategory = async (
  params: GlobalSearchQuery,
  signal: AbortSignal
): Promise<FetchOutcome> => {
  const { filter } = params;
  const source = params.sources.find((item) => item.key === filter);
  const fetchers: Record<string, () => Promise<GlobalSearchSection>> = {
    [ASSETS_CATEGORY]: () => fetchAssets(params, signal),
    [TASKS_CATEGORY]: () => fetchTasks(params, signal),
  };
  const fetchSection =
    fetchers[filter] ??
    (source
      ? () => searchSource(source, params.query, signal)
      : () => fetchEntityType(filter, params, signal));

  try {
    return { results: { [filter]: await fetchSection() }, failed: false };
  } catch {
    return { results: {}, failed: true };
  }
};

const fetchAll = async (
  params: GlobalSearchQuery,
  signal: AbortSignal
): Promise<FetchOutcome> => {
  const sources = getSearchedSources(params);
  const jobs: Promise<CategoryJob>[] = sources.map((source) =>
    searchSource(source, params.query, signal).then((section) => ({
      entries: [[source.key, section]],
    }))
  );
  if (!params.scopedSources) {
    jobs.push(fetchEntityCategories(params, signal));
    jobs.push(
      fetchTasks(params, signal).then((section) => ({
        entries: [[TASKS_CATEGORY, section]],
      }))
    );
  }
  const settled = await Promise.allSettled(jobs);
  const results: GlobalSearchResults = {};
  settled.forEach((result) => {
    if (result.status === 'fulfilled') {
      result.value.entries.forEach(([key, section]) => {
        results[key] = section;
      });
    }
  });

  return {
    results,
    failed: settled.some(
      (result) => result.status === 'rejected' || result.value.failed
    ),
  };
};

/** The open tab's own filters narrowed its results (sort does not change counts). */
const hasOwnFilters = (params: GlobalSearchQuery) =>
  hasFacetSelection(params.facets) ||
  Boolean(params.taskStatus || params.taskType);

/**
 * A failed load shows the error, not an empty state: whenever something failed
 * and what the user is looking at came back empty.
 */
export const isFailedView = (
  outcome: FetchOutcome,
  filter: GlobalSearchFilter
) => {
  const visible =
    filter === 'all'
      ? Object.values(outcome.results)
      : [outcome.results[filter]].filter(Boolean);

  return (
    outcome.failed &&
    visible.every((section) => !section || section.count === 0)
  );
};

/**
 * Fetches every result type for the query, debounced. Each type settles on its
 * own so one failing source doesn't blank the others. Once a query has loaded,
 * a tab, filter or sort change on a type tab refetches only that type.
 */
export const useGlobalSearchResults = (params: GlobalSearchQuery) => {
  const [results, setResults] = useState<GlobalSearchResults>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const trimmed = params.query.trim();
  const scopeKey = params.scopedSources?.join() ?? '';
  const facetKey = JSON.stringify(params.facets);
  const sourceKey = params.sources.map((source) => source.key).join();
  // Everything that reshapes the list rather than refining it: a change here
  // shows skeletons instead of leaving the previous list on screen.
  const listKey = [
    params.filter,
    scopeKey,
    facetKey,
    params.sort,
    params.sortOrder,
    params.taskStatus,
    params.taskType,
  ].join('|');
  // The list shape the current results were loaded for.
  const loadedListKey = useRef(listKey);
  // The query (and scope) every type's counts were last loaded for.
  const queryKey = [trimmed, scopeKey, sourceKey, params.retryKey].join('|');
  const loadedQueryKey = useRef('');
  // The tab the current results were loaded for, and whether its own filters
  // narrowed them: leaving such a tab must restore its unfiltered count.
  const loadedFilter = useRef<GlobalSearchFilter>('all');
  const loadedWithOwnFilters = useRef(false);

  useEffect(() => {
    if (!trimmed) {
      // With no query there is no list to keep; the next search starts fresh.
      loadedListKey.current = listKey;
      loadedQueryKey.current = '';
      setResults({});
      setIsLoading(false);
      setHasError(false);

      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    // Back on All, every type is listed again with its All-tab page size.
    const leavesFilteredTab =
      loadedFilter.current !== params.filter && loadedWithOwnFilters.current;
    const isRefine =
      loadedQueryKey.current === queryKey &&
      params.filter !== 'all' &&
      !leavesFilteredTab;
    const timer = setTimeout(async () => {
      const request = { ...params, query: trimmed };
      const next = isRefine
        ? await fetchActiveCategory(request, controller.signal)
        : await fetchAll(request, controller.signal);
      if (controller.signal.aborted) {
        return;
      }
      loadedListKey.current = listKey;
      loadedQueryKey.current = queryKey;
      loadedFilter.current = params.filter;
      loadedWithOwnFilters.current = hasOwnFilters(params);
      setResults((previous) =>
        isRefine ? { ...previous, ...next.results } : next.results
      );
      setHasError(isFailedView(next, params.filter));
      setIsLoading(false);
    }, GLOBAL_SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `params` is spread into the fetch; these are its real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    trimmed,
    params.filter,
    scopeKey,
    facetKey,
    params.sort,
    params.sortOrder,
    params.taskStatus,
    params.taskType,
    sourceKey,
    params.retryKey,
  ]);

  const isListChange = loadedListKey.current !== listKey;
  // The effect that starts a fetch runs after this render, so a query or filter
  // change is already pending here even though `isLoading` is still false.
  const isPending =
    Boolean(trimmed) && (isListChange || loadedQueryKey.current !== queryKey);
  const isBusy = isLoading || isPending;

  return {
    results,
    isLoading: isBusy,
    /** Typing: show the spinner and progress line; keep the list as it is. */
    isQueryLoading: isBusy && !isListChange,
    /** Tab, filter, sort or scope changed: show skeleton rows only. */
    isListLoading: isBusy && isListChange,
    /** No counts yet for this query, so tab counts stay hidden. */
    isCounting: isBusy && Object.keys(results).length === 0,
    hasError,
  };
};
