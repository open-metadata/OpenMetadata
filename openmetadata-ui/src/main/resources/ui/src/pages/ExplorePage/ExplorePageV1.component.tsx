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
import { PAGE_SIZE } from '../../constants/constants';
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
import { useApplicationStore } from '../../hooks/useApplicationStore';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useSearchStore } from '../../hooks/useSearchStore';
import { Aggregations, SearchResponse } from '../../interface/search.interface';
import {
  extractTermKeys,
  fetchEntityData,
  findActiveSearchIndex,
  generateTabItems,
  parseSearchParams,
} from '../../utils/ExploreUtils';
import { getExplorePath } from '../../utils/RouterUtils';
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
    return parseSearchParams(location.search);
  }, [location.search]);

  const handlePageChange: ExploreProps['onChangePage'] = (page, size) => {
    navigate({
      search: Qs.stringify({ ...parsedSearch, page, size: size ?? PAGE_SIZE }),
    });
  };

  const handleSortValueChange = (page: number, sortVal: string) => {
    navigate({
      search: Qs.stringify({
        ...parsedSearch,
        page,
        size: size ?? PAGE_SIZE,
        sort: sortVal,
      }),
    });
  };

  const handleSortOrderChange = (page: number, sortOrderVal: string) => {
    navigate({
      search: Qs.stringify({
        ...parsedSearch,
        page,
        size: size ?? PAGE_SIZE,
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
      const shouldField: QueryFieldInterface[] = get(
        filterCategory,
        'bool.should',
        []
      );

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
        search: Qs.stringify({
          ...parsedSearch,
          quickFilter: quickFilter ? JSON.stringify(quickFilter) : undefined,
          page: 1,
        }),
      });
    },
    [history, parsedSearch]
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

  useEffect(() => {
    if (!isEmpty(parsedSearch)) {
      handlePageChange(page, size);
    }
  }, [page, size, parsedSearch]);

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

  const handleAdvanceSearchQuickFiltersChange = useCallback(
    (filter?: QueryFilterInterface) => {
      handlePageChange(1);
      setAdvancedSearchQuickFilters(filter);
      handleQuickFilterChange(filter);
    },
    [setAdvancedSearchQuickFilters, history, parsedSearch]
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
