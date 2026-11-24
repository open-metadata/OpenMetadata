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
import { get, isString, startCase } from 'lodash';
import { useEffect, useRef, useState } from 'react';
import { EntityFields } from '../../../../enums/AdvancedSearch.enum';
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
import { getFacetQueryFilter, getPageSize } from './GlobalSearch.utils';

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
    startCase(task.type),
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
  const res = await searchQuery({
    query: params.query,
    searchIndex: SearchIndex.DATA_ASSET,
    pageNumber: 1,
    pageSize: pageSizeFor(ASSETS_CATEGORY, params.filter),
    trackTotalHits: true,
    queryFilter: getFacetQueryFilter(params.facets),
    sortField: params.sort,
    sortOrder: params.sortOrder,
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

const fetchTasks = async (params: GlobalSearchQuery) => {
  const res = await listTasks({
    q: params.query,
    status: params.taskStatus,
    type: params.taskType,
    limit: pageSizeFor(TASKS_CATEGORY, params.filter),
  });

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
const fetchEntityCategories = async (
  params: GlobalSearchQuery,
  signal: AbortSignal
): Promise<[GlobalSearchCategory, GlobalSearchSection][]> => {
  const [assetCounts, allCounts] = await Promise.all([
    searchEntityTypeCounts({
      query: params.query,
      searchIndex: [SearchIndex.DATA_ASSET],
    }),
    searchEntityTypeCounts({
      query: params.query,
      searchIndex: [SearchIndex.ALL],
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

  return settled.flatMap((result, index) =>
    result.status === 'fulfilled'
      ? [
          [keys[index], result.value] as [
            GlobalSearchCategory,
            GlobalSearchSection
          ],
        ]
      : []
  );
};

const fetchAll = async (
  params: GlobalSearchQuery,
  signal: AbortSignal
): Promise<{ results: GlobalSearchResults; failed: boolean }> => {
  const sources = params.scopedSources
    ? params.sources.filter((source) =>
        params.scopedSources?.includes(source.key)
      )
    : params.sources;
  const jobs: Promise<[GlobalSearchCategory, GlobalSearchSection][]>[] = [
    ...sources.map((source) =>
      source
        .search(params.query, signal)
        .then((section): [GlobalSearchCategory, GlobalSearchSection][] => [
          [source.key, section],
        ])
    ),
  ];
  if (!params.scopedSources) {
    jobs.push(fetchEntityCategories(params, signal));
    jobs.push(
      fetchTasks(params).then((section) => [[TASKS_CATEGORY, section]])
    );
  }
  const settled = await Promise.allSettled(jobs);
  const results: GlobalSearchResults = {};
  settled.forEach((result) => {
    if (result.status === 'fulfilled') {
      result.value.forEach(([key, section]) => {
        results[key] = section;
      });
    }
  });

  return {
    results,
    failed: settled.every((result) => result.status === 'rejected'),
  };
};

/**
 * Fetches every result type for the query, debounced. Each type settles on its
 * own so one failing source doesn't blank the others; the error state shows
 * only when all of them fail.
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

  useEffect(() => {
    if (!trimmed) {
      // With no query there is no list to keep; the next search starts fresh.
      loadedListKey.current = listKey;
      setResults({});
      setIsLoading(false);
      setHasError(false);

      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    const timer = setTimeout(async () => {
      const next = await fetchAll(
        { ...params, query: trimmed },
        controller.signal
      );
      if (controller.signal.aborted) {
        return;
      }
      loadedListKey.current = listKey;
      setResults(next.results);
      setHasError(next.failed);
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

  return {
    results,
    isLoading,
    /** Typing: show the spinner and progress line; keep the list as it is. */
    isQueryLoading: isLoading && !isListChange,
    /** Tab, filter, sort or scope changed: show skeleton rows only. */
    isListLoading: isLoading && isListChange,
    /** No counts yet for this query, so tab counts stay hidden. */
    isCounting: isLoading && Object.keys(results).length === 0,
    hasError,
  };
};
