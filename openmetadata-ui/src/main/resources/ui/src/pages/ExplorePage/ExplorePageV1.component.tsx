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

import { get, isEmpty, isNil, isString, omit } from 'lodash';
import Qs from 'qs';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { withAdvanceSearch } from '../../components/AppRouter/withAdvanceSearch';
import { useAdvanceSearch } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import {
  ExploreProps,
  ExploreSearchIndex,
  SearchHitCounts,
  UrlParams,
} from '../../components/Explore/ExplorePage.interface';
import ExploreV1 from '../../components/ExploreV1/ExploreV1.component';
import { ROUTES } from '../../constants/constants';
import { COMMON_FILTERS_FOR_DIFFERENT_TABS } from '../../constants/explore.constants';
import {
  mockSearchData,
  MOCK_EXPLORE_PAGE_COUNT,
} from '../../constants/mockTourData.constants';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { SORT_ORDER } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useCurrentUserPreferences } from '../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useSearchStore } from '../../hooks/useSearchStore';
import { Aggregations, SearchResponse } from '../../interface/search.interface';
import {
  extractTermKeys,
  findActiveSearchIndex,
  parseSearchParams,
} from '../../utils/ExplorePureUtils';
import { fetchEntityData, generateTabItems } from '../../utils/ExploreUtils';
import { getExplorePath, getExploreTabPath } from '../../utils/RouterUtils';
import searchClassBase from '../../utils/SearchClassBase';
import { useRequiredParams } from '../../utils/useRequiredParams';
import {
  QueryFieldInterface,
  QueryFilterInterface,
} from './ExplorePage.interface';

const ExplorePageV1: FC<unknown> = () => {
  const tabsInfo = searchClassBase.getTabsInfo();
  const EntityTypeSearchIndexMapping =
    searchClassBase.getEntityTypeSearchIndexMapping();
  const location = useCustomLocation();
  const navigate = useNavigate();
  const { isTourOpen } = useTourProvider();
  const TABS_SEARCH_INDEXES = Object.keys(tabsInfo) as ExploreSearchIndex[];
  const { isNLPActive, isNLPEnabled } = useSearchStore();
  const isNLPRequestEnabled = isNLPEnabled && isNLPActive;
  const {
    preferences: { globalPageSize },
    setPreference,
  } = useCurrentUserPreferences();

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
    sortValue,
    sortOrder,
    page,
    size,
    showDeleted,
  } = useMemo(() => {
    return parseSearchParams(location.search, globalPageSize, queryFilter);
  }, [location.search, queryFilter]);

  const handlePageChange: ExploreProps['onChangePage'] = (page, size) => {
    setPreference({ globalPageSize: size ?? globalPageSize });
    navigate({
      // When tab is present, build the pathname from the route param rather
      // than the router's current location: a search-only navigate is *relative*
      // and can resolve against a stale route-match context if another component
      // fired a pushState moments earlier.  When tab is absent (bare /explore
      // route) fall back to the static ROUTES.EXPLORE constant so the pathname
      // is never derived from any router state.
      pathname: tab ? getExploreTabPath(tab) : ROUTES.EXPLORE,
      search: Qs.stringify({
        ...parsedSearch,
        page,
        size: size ?? globalPageSize,
      }),
    });
  };

  const handleSortValueChange = (page: number, sortVal: string) => {
    navigate({
      pathname: tab ? getExploreTabPath(tab) : ROUTES.EXPLORE,
      search: Qs.stringify({
        ...parsedSearch,
        page,
        size,
        sort: sortVal,
      }),
    });
  };

  const handleSortOrderChange = (page: number, sortOrderVal: string) => {
    navigate({
      pathname: tab ? getExploreTabPath(tab) : ROUTES.EXPLORE,
      search: Qs.stringify({
        ...parsedSearch,
        page,
        size,
        sortOrder: sortOrderVal,
      }),
    });
  };

  // Filters that can be common for all the Entities Ex. Tables, Topics, etc.
  const commonQuickFilters = useMemo(() => {
    const mustField: QueryFieldInterface[] = get(
      advancedSearchQuickFilters,
      'query.bool.must',
      []
    );

    // Getting the filters that can be common for all the Entities
    const must = mustField.filter((filterCategory: QueryFieldInterface) => {
      const rawShouldField = get(filterCategory, 'bool.should', []);
      const shouldField: QueryFieldInterface[] = Array.isArray(rawShouldField)
        ? rawShouldField
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
              page: '1',
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
        pathname: tab ? getExploreTabPath(tab) : ROUTES.EXPLORE,
        search: Qs.stringify({
          ...parsedSearch,
          quickFilter: quickFilter ? JSON.stringify(quickFilter) : undefined,
          page: 1,
        }),
      });
    },
    [parsedSearch, tab]
  );

  const handleShowDeletedChange: ExploreProps['onChangeShowDeleted'] = (
    showDeleted
  ) => {
    // Removed existing showDeleted from the parsedSearch object
    const filteredParsedSearch = omit(parsedSearch, 'showDeleted');

    // Set the default search object with page as 1
    const defaultSearchObject = {
      ...filteredParsedSearch,
      page: 1,
    };

    // If showDeleted is true, add it to the search object
    const searchObject = showDeleted
      ? { ...defaultSearchObject, showDeleted: true }
      : defaultSearchObject;

    navigate({
      pathname: tab ? getExploreTabPath(tab) : ROUTES.EXPLORE,
      search: Qs.stringify(searchObject),
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

  // Key this URL-normalizing navigate on location.search, NOT on the
  // parsedSearch memo: parsedSearch also recomputes when the provider's
  // queryFilter state lands, and react-router applies the submit's own
  // navigate in a transition *after* that state update — firing here at
  // that moment re-pushes the stale pre-submit URL over the new filter.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  useEffect(() => {
    if (!isEmpty(parsedSearch)) {
      handlePageChange(page, size);
    }
  }, [page, size, location.search]);

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

  const performFetch = async () => {
    setIsLoading(true);

    try {
      await fetchEntityData({
        searchQueryParam,
        tabsInfo,
        updatedQuickFilters: getAdvancedSearchQuickFilters(),
        queryFilter,
        searchIndex,
        showDeleted,
        sortValue,
        sortOrder,
        page,
        size,
        isNLPRequestEnabled,
        tab,
        TABS_SEARCH_INDEXES,
        EntityTypeSearchIndexMapping: EntityTypeSearchIndexMapping as Record<
          EntityType,
          ExploreSearchIndex
        >,
        setSearchHitCounts,
        setSearchResults,
        setUpdatedAggregations,
        setShowIndexNotFoundAlert,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Effect for handling tour
  useEffect(() => {
    if (isTourOpen) {
      setSearchHitCounts(MOCK_EXPLORE_PAGE_COUNT);
    }
  }, [isTourOpen]);

  // Create a dependency string to trigger fetch only when dependencies actually change
  const fetchDependencies = useMemo(() => {
    return JSON.stringify({
      quickFilter: parsedSearch.quickFilter,
      queryFilter,
      searchQueryParam,
      sortValue,
      sortOrder,
      showDeleted,
      page,
      size,
      searchIndex,
    });
  }, [
    parsedSearch.quickFilter,
    queryFilter,
    searchQueryParam,
    sortValue,
    sortOrder,
    showDeleted,
    page,
    size,
    searchIndex,
  ]);

  useEffect(() => {
    if (!isTourOpen) {
      performFetch();
    }
  }, [isTourOpen, fetchDependencies]);

  // handleQuickFilterChange already resets page to 1 in the same navigate —
  // a separate handlePageChange(1) call here would push a second history
  // entry against the same memoized parsedSearch and clobber the first.
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
      isElasticSearchIssue={showIndexNotFoundAlert}
      loading={isLoading && !isTourOpen}
      quickFilters={advancedSearchQuickFilters}
      searchIndex={searchIndex}
      searchResults={
        isTourOpen
          ? (mockSearchData as unknown as SearchResponse<ExploreSearchIndex>)
          : searchResults
      }
      showDeleted={showDeleted}
      sortOrder={sortOrder}
      sortValue={sortValue}
      tabItems={tabItems}
      onChangeAdvancedSearchQuickFilters={handleAdvanceSearchQuickFiltersChange}
      onChangePage={handlePageChange}
      onChangeSearchIndex={handleSearchIndexChange}
      onChangeShowDeleted={handleShowDeletedChange}
      onChangeSortOder={(sortOrderVal) => {
        handleSortOrderChange(1, sortOrderVal);
      }}
      onChangeSortValue={(sortVal) => {
        handleSortValueChange(1, sortVal);
      }}
    />
  );
};

export default withPageLayout(withAdvanceSearch(ExplorePageV1));
