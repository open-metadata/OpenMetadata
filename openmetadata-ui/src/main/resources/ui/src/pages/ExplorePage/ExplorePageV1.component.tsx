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

import { get, isEmpty, isNil, isString } from 'lodash';
import Qs from 'qs';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { withAdvanceSearch } from '../../components/AppRouter/withAdvanceSearch';
import { useAdvanceSearch } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import {
  ExploreProps,
  ExploreQuickFilterField,
  ExploreSearchIndex,
  SearchHitCounts,
  UrlParams,
} from '../../components/Explore/ExplorePage.interface';
import ExploreV1 from '../../components/ExploreV1/ExploreV1.component';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../constants/constants';
import { COMMON_FILTERS_FOR_DIFFERENT_TABS } from '../../constants/explore.constants';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { SORT_ORDER } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useCurrentUserPreferences } from '../../hooks/currentUserStore/useCurrentUserStore';
import { usePaging } from '../../hooks/paging/usePaging';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useExploreCache } from '../../hooks/useExploreCache';
import { useSearchStore } from '../../hooks/useSearchStore';
import { Aggregations, SearchResponse } from '../../interface/search.interface';
import { getCombinedQueryFilterObject } from '../../utils/ExplorePage/ExplorePageUtils';
import {
  extractTermKeys,
  findActiveSearchIndex,
  getBrowsePathQueryFilter,
  parseSearchParams,
} from '../../utils/ExplorePureUtils';
import { fetchEntityData, generateTabItems } from '../../utils/ExploreUtils';
import { getExplorePath } from '../../utils/RouterUtils';
import searchClassBase from '../../utils/SearchClassBase';
import { useRequiredParams } from '../../utils/useRequiredParams';
import {
  QueryFieldInterface,
  QueryFilterInterface,
} from './ExplorePage.interface';

const EXPLORE_PAGE_SIZE_OPTIONS = [
  PAGE_SIZE_BASE,
  PAGE_SIZE_MEDIUM,
  PAGE_SIZE_LARGE,
];

const ExplorePageV1: FC<unknown> = () => {
  const tabsInfo = searchClassBase.getTabsInfo();
  const EntityTypeSearchIndexMapping =
    searchClassBase.getEntityTypeSearchIndexMapping();
  const location = useCustomLocation();
  const navigate = useNavigate();
  const { isTourOpen, tourMockSearchResults, tourMockSearchHitCounts } =
    useTourProvider();
  const TABS_SEARCH_INDEXES = Object.keys(tabsInfo) as ExploreSearchIndex[];
  const { isNLPActive, isNLPEnabled } = useSearchStore();
  const isNLPRequestEnabled = isNLPEnabled && isNLPActive;
  const {
    preferences: { globalPageSize },
  } = useCurrentUserPreferences();
  const defaultPageSize = EXPLORE_PAGE_SIZE_OPTIONS.includes(globalPageSize)
    ? globalPageSize
    : PAGE_SIZE_BASE;
  const { currentPage, handlePageChange, handlePageSizeChange, pageSize } =
    usePaging(defaultPageSize);
  const currentPageSize = EXPLORE_PAGE_SIZE_OPTIONS.includes(pageSize)
    ? pageSize
    : defaultPageSize;

  useEffect(() => {
    if (!EXPLORE_PAGE_SIZE_OPTIONS.includes(pageSize)) {
      handlePageSizeChange(defaultPageSize);
    }
  }, [defaultPageSize, handlePageSizeChange, pageSize]);

  const { tab } = useRequiredParams<UrlParams>();

  const { searchCriteria } = useApplicationStore();

  const [searchResults, setSearchResults] =
    useState<SearchResponse<ExploreSearchIndex>>();

  const [showIndexNotFoundAlert, setShowIndexNotFoundAlert] =
    useState<boolean>(false);

  useEffect(() => {
    setShowIndexNotFoundAlert(false);
    setSearchResults(undefined);
  }, [tab]);

  const [updatedAggregations, setUpdatedAggregations] =
    useState<Aggregations>();

  const [advancedSearchQuickFilters, setAdvancedSearchQuickFilters] =
    useState<QueryFilterInterface>();

  const [searchHitCounts, setSearchHitCounts] = useState<SearchHitCounts>();

  const [isLoading, setIsLoading] = useState(true);

  const { queryFilter } = useAdvanceSearch();

  // Use the utility function to parse search parameters
  const {
    parsedSearch,
    searchQueryParam,
    browseFields,
    sortValue,
    sortOrder,
    showDeleted,
  } = useMemo(() => {
    return parseSearchParams(location.search, queryFilter);
  }, [location.search, queryFilter]);

  // ES filter contributed by the browse-tree location. It ANDs with the
  // dropdown quickFilter so browsing never clears filters and vice versa.
  const browseQueryFilter = useMemo(
    () => getBrowsePathQueryFilter(browseFields),
    [browseFields]
  );

  const handleSortValueChange = (sortVal: string) => {
    navigate({
      search: Qs.stringify({
        ...parsedSearch,
        currentPage: 1,
        sort: sortVal,
      }),
    });
  };

  const handleSortOrderChange = (sortOrderVal: string) => {
    navigate({
      search: Qs.stringify({
        ...parsedSearch,
        currentPage: 1,
        sortOrder: sortOrderVal,
      }),
    });
  };

  // Filters that can be common for all the Entities Ex. Tables, Topics, etc.
  const commonQuickFilters = useMemo(() => {
    const rawMustField = get(advancedSearchQuickFilters, 'query.bool.must', []);
    const mustField: QueryFieldInterface[] = Array.isArray(rawMustField)
      ? (rawMustField as QueryFieldInterface[])
      : [];

    // Getting the filters that can be common for all the Entities
    const must = mustField.filter((filterCategory: QueryFieldInterface) => {
      const rawShouldField = get(filterCategory, 'bool.should', []);
      const shouldField: QueryFieldInterface[] = Array.isArray(rawShouldField)
        ? (rawShouldField as QueryFieldInterface[])
        : [];

      const terms = extractTermKeys(shouldField);

      // check if the filter category is present in the common filters array
      const isCommonFieldPresent =
        !isEmpty(shouldField) &&
        COMMON_FILTERS_FOR_DIFFERENT_TABS.find((value) =>
          terms.includes(value)
        );

      return isCommonFieldPresent;
    });

    return isEmpty(must)
      ? undefined
      : {
          query: {
            bool: {
              must,
            },
          },
        };
  }, [advancedSearchQuickFilters]);

  const handleSearchIndexChange: (nSearchIndex: ExploreSearchIndex) => void =
    useCallback(
      (nSearchIndex) => {
        navigate(
          getExplorePath({
            tab: tabsInfo[nSearchIndex].path,
            extraParameters: {
              sort: searchQueryParam
                ? '_score'
                : tabsInfo[nSearchIndex].sortField,
              currentPage: '1',
              quickFilter: commonQuickFilters
                ? JSON.stringify(commonQuickFilters)
                : undefined,
              sortOrder: tabsInfo[nSearchIndex]?.sortOrder ?? SORT_ORDER.DESC,
            },
            isPersistFilters: true,
          })
        );
      },
      [commonQuickFilters, searchQueryParam]
    );

  const handleQuickFilterChange = useCallback(
    (quickFilter?: QueryFilterInterface) => {
      navigate({
        search: Qs.stringify({
          ...parsedSearch,
          quickFilter: quickFilter ? JSON.stringify(quickFilter) : undefined,
        }),
      });
    },
    [parsedSearch]
  );

  // A tree click may update the browse location AND the Type quick filter
  // (leaf rows). Both params must land in one navigate — two sequential
  // navigates against the same memoized parsedSearch clobber each other.
  const handleTreeSelect = useCallback(
    (payload: {
      browseFields: ExploreQuickFilterField[];
      quickFilter?: QueryFilterInterface;
    }) => {
      const { browseFields: updatedBrowseFields, quickFilter } = payload;
      if (quickFilter) {
        setAdvancedSearchQuickFilters(quickFilter);
      }
      navigate({
        search: Qs.stringify({
          ...parsedSearch,
          browsePath: isEmpty(updatedBrowseFields)
            ? undefined
            : JSON.stringify(updatedBrowseFields),
          ...(quickFilter ? { quickFilter: JSON.stringify(quickFilter) } : {}),
        }),
      });
    },
    [parsedSearch]
  );

  const handleShowDeletedChange: ExploreProps['onChangeShowDeleted'] = (
    showDeleted
  ) => {
    navigate({
      search: Qs.stringify({
        ...parsedSearch,
        showDeleted: showDeleted ? true : undefined,
      }),
    });
  };

  const searchIndex = useMemo(() => {
    if (!searchQueryParam) {
      return SearchIndex.DATA_ASSET as unknown as ExploreSearchIndex;
    }

    const tabInfo = Object.entries(tabsInfo).find(
      ([, tabInfo]) => tabInfo.path === tab
    );
    if (searchHitCounts && isNil(tabInfo)) {
      const activeKey = findActiveSearchIndex(searchHitCounts, tabsInfo);

      return (
        activeKey ?? (SearchIndex.DATA_ASSET as unknown as ExploreSearchIndex)
      );
    }

    return !isNil(tabInfo)
      ? (tabInfo[0] as ExploreSearchIndex)
      : (SearchIndex.DATA_ASSET as unknown as ExploreSearchIndex);
  }, [tab, searchHitCounts, searchQueryParam]);

  // Use the utility function to generate tab items
  const tabItems = useMemo(() => {
    const items = generateTabItems(tabsInfo, searchHitCounts, searchIndex);

    return searchQueryParam
      ? items.filter((tabItem) => {
          return tabItem.count > 0 || tabItem.key === searchCriteria;
        })
      : items;
  }, [
    tabsInfo,
    searchHitCounts,
    searchIndex,
    searchQueryParam,
    searchCriteria,
  ]);

  const getAdvancedSearchQuickFilters = useCallback(() => {
    if (!isString(parsedSearch.quickFilter)) {
      setAdvancedSearchQuickFilters(undefined);

      return undefined;
    } else {
      try {
        const parsedQueryFilter = JSON.parse(parsedSearch.quickFilter);
        setAdvancedSearchQuickFilters(parsedQueryFilter);

        return parsedQueryFilter;
      } catch {
        setAdvancedSearchQuickFilters(undefined);

        return undefined;
      }
    }
  }, [parsedSearch]);

  // Per-function selectors — without these, every cache write (including the SWR background
  // refresh on tab switch) would re-render ExplorePageV1 even though the cache is not part of
  // its render output. The function refs are stable, so the selectors never trigger re-renders.
  const getCached = useExploreCache((s) => s.getCached);
  const setCached = useExploreCache((s) => s.setCached);

  useEffect(() => {
    if (isTourOpen && tourMockSearchHitCounts) {
      setSearchHitCounts(tourMockSearchHitCounts);
    }
  }, [isTourOpen, tourMockSearchHitCounts]);

  // Create a dependency string to trigger fetch only when dependencies actually change. Also
  // doubles as the SWR cache key for {@link useExploreCache}.
  const fetchDependencies = useMemo(() => {
    return JSON.stringify({
      quickFilter: parsedSearch.quickFilter,
      browsePath: parsedSearch.browsePath,
      queryFilter,
      searchQueryParam,
      sortValue,
      sortOrder,
      showDeleted,
      page: currentPage,
      size: currentPageSize,
      searchIndex,
    });
  }, [
    parsedSearch.quickFilter,
    parsedSearch.browsePath,
    queryFilter,
    searchQueryParam,
    sortValue,
    sortOrder,
    showDeleted,
    currentPage,
    currentPageSize,
    searchIndex,
  ]);

  // Latest-key ref drives the stale-response guard below. The cache-hit path fires a
  // background `fetchEntityData` that resolves asynchronously; if the user changes any of the
  // search dependencies (tab, query, filters, page) before it resolves, the in-flight response
  // is for the OLD query and must not overwrite the new state. We compare each setter callback
  // against this ref at fire time and drop the write if it no longer matches.
  const latestFetchDepsRef = useRef(fetchDependencies);
  useEffect(() => {
    latestFetchDepsRef.current = fetchDependencies;
  }, [fetchDependencies]);

  const performFetch = async () => {
    // Tab-switch on Explore (Tables → Dashboards → …) re-runs the same shape of search-fetch
    // with a different `searchIndex`. Within a session most users flip back and forth without
    // changing the underlying query; keying a 30s SWR cache by the same dependency string the
    // page already uses to detect "should I refetch?" lets the second visit render synchronously.
    type CachedSearchState = {
      searchResults: SearchResponse<ExploreSearchIndex> | undefined;
      aggregations: Aggregations | undefined;
      hitCounts: SearchHitCounts | undefined;
      indexNotFound: boolean;
    };
    const cacheKey = fetchDependencies;
    const cached = getCached<CachedSearchState>(cacheKey);

    // Single injection point for the browse-tree location: pre-combining here
    // scopes the tab counts, search and NLQ queries inside fetchEntityData
    // without leaking browse terms into the dropdown chip state.
    const updatedQuickFilters = getCombinedQueryFilterObject(
      getAdvancedSearchQuickFilters(),
      browseQueryFilter
    );

    // Setters wrapped to (a) capture the resolved values for the eventual cache write and
    // (b) drop the update entirely if the user has navigated to a different search since the
    // request was issued. Without (b) a slow in-flight response can overwrite freshly-set
    // state for a different searchIndex/filters, presenting stale data to the user.
    const captured: {
      searchResults?: typeof searchResults;
      aggregations?: Aggregations;
      hitCounts?: SearchHitCounts;
      indexNotFound?: boolean;
    } = {};
    const isStale = () => latestFetchDepsRef.current !== cacheKey;
    const handleNlqAppliedFilters = (
      appliedQuickFilters?: QueryFilterInterface
    ) => {
      if (isStale()) {
        return;
      }
      setAdvancedSearchQuickFilters(
        getCombinedQueryFilterObject(
          getAdvancedSearchQuickFilters(),
          appliedQuickFilters
        )
      );
    };
    const captureSetSearchResults: typeof setSearchResults = (value) => {
      if (isStale()) {
        return;
      }
      captured.searchResults =
        typeof value === 'function' ? value(captured.searchResults) : value;
      setSearchResults(value);
    };
    const captureSetUpdatedAggregations: typeof setUpdatedAggregations = (
      value
    ) => {
      if (isStale()) {
        return;
      }
      captured.aggregations =
        typeof value === 'function' ? value(captured.aggregations) : value;
      setUpdatedAggregations(value);
    };
    const captureSetSearchHitCounts: typeof setSearchHitCounts = (value) => {
      if (isStale()) {
        return;
      }
      captured.hitCounts =
        typeof value === 'function' ? value(captured.hitCounts) : value;
      setSearchHitCounts(value);
    };
    const captureSetShowIndexNotFoundAlert: typeof setShowIndexNotFoundAlert = (
      value
    ) => {
      if (isStale()) {
        return;
      }
      captured.indexNotFound =
        typeof value === 'function'
          ? value(captured.indexNotFound ?? false)
          : value;
      setShowIndexNotFoundAlert(value);
    };

    // Commit `captured` to the cache only if the fetch actually produced results AND the
    // key is still current. Skipping when `searchResults` is undefined avoids overwriting a
    // previously-good cache entry with empty data from an error path inside fetchEntityData
    // (where some setters may not get called).
    const commitCacheIfFresh = () => {
      if (isStale() || captured.searchResults === undefined) {
        return;
      }
      setCached<CachedSearchState>(cacheKey, {
        searchResults: captured.searchResults,
        aggregations: captured.aggregations,
        hitCounts: captured.hitCounts,
        indexNotFound: captured.indexNotFound ?? false,
      });
    };

    if (cached) {
      // Synchronous render from cache, then silently revalidate. We do NOT toggle isLoading on a
      // cache hit — the user sees no spinner.
      setSearchResults(cached.data.searchResults);
      setUpdatedAggregations(cached.data.aggregations);
      setSearchHitCounts(cached.data.hitCounts);
      setShowIndexNotFoundAlert(cached.data.indexNotFound);
      setIsLoading(false);
      // Background refresh — fire-and-forget. Errors fall through to the existing toast layer
      // inside fetchEntityData, same as the foreground path. The captured setters above drop
      // writes if the user has moved on by the time the response resolves.
      void fetchEntityData({
        searchQueryParam,
        tabsInfo,
        updatedQuickFilters,
        queryFilter,
        searchIndex,
        showDeleted,
        sortValue,
        sortOrder,
        page: currentPage,
        size: currentPageSize,
        isNLPRequestEnabled,
        tab,
        TABS_SEARCH_INDEXES,
        EntityTypeSearchIndexMapping: EntityTypeSearchIndexMapping as Record<
          EntityType,
          ExploreSearchIndex
        >,
        setSearchHitCounts: captureSetSearchHitCounts,
        setSearchResults: captureSetSearchResults,
        setUpdatedAggregations: captureSetUpdatedAggregations,
        setShowIndexNotFoundAlert: captureSetShowIndexNotFoundAlert,
        onNlqAppliedFilters: handleNlqAppliedFilters,
      }).then(commitCacheIfFresh);

      return;
    }

    setIsLoading(true);
    try {
      await fetchEntityData({
        searchQueryParam,
        tabsInfo,
        updatedQuickFilters,
        queryFilter,
        searchIndex,
        showDeleted,
        sortValue,
        sortOrder,
        page: currentPage,
        size: currentPageSize,
        isNLPRequestEnabled,
        tab,
        TABS_SEARCH_INDEXES,
        EntityTypeSearchIndexMapping: EntityTypeSearchIndexMapping as Record<
          EntityType,
          ExploreSearchIndex
        >,
        setSearchHitCounts: captureSetSearchHitCounts,
        setSearchResults: captureSetSearchResults,
        setUpdatedAggregations: captureSetUpdatedAggregations,
        setShowIndexNotFoundAlert: captureSetShowIndexNotFoundAlert,
        onNlqAppliedFilters: handleNlqAppliedFilters,
      });
      commitCacheIfFresh();
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!isTourOpen) {
      performFetch();
    }
  }, [isTourOpen, fetchDependencies]);

  const handleAdvanceSearchQuickFiltersChange = useCallback(
    (filter?: QueryFilterInterface) => {
      setAdvancedSearchQuickFilters(filter);
      handleQuickFilterChange(filter);
    },
    [setAdvancedSearchQuickFilters, handleQuickFilterChange]
  );

  return (
    <ExploreV1
      activeTabKey={searchIndex}
      aggregations={updatedAggregations}
      browseFields={browseFields}
      browseQueryFilter={browseQueryFilter}
      currentPage={currentPage}
      isElasticSearchIssue={showIndexNotFoundAlert}
      loading={isLoading && !isTourOpen}
      pageSize={currentPageSize}
      quickFilters={advancedSearchQuickFilters}
      searchIndex={searchIndex}
      searchResults={isTourOpen ? tourMockSearchResults : searchResults}
      showDeleted={showDeleted}
      sortOrder={sortOrder}
      sortValue={sortValue}
      tabItems={tabItems}
      onChangeAdvancedSearchQuickFilters={handleAdvanceSearchQuickFiltersChange}
      onChangePage={handlePageChange}
      onChangePageSize={handlePageSizeChange}
      onChangeSearchIndex={handleSearchIndexChange}
      onChangeShowDeleted={handleShowDeletedChange}
      onChangeSortOder={(sortOrderVal) => {
        handleSortOrderChange(sortOrderVal);
      }}
      onChangeSortValue={(sortVal) => {
        handleSortValueChange(sortVal);
      }}
      onTreeSelect={handleTreeSelect}
    />
  );
};

export default withPageLayout(withAdvanceSearch(ExplorePageV1));
