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

import { Space, Typography } from 'antd';
import { get, isEmpty, isNil, isString, lowerCase } from 'lodash';
import Qs from 'qs';
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { withAdvanceSearch } from '../../components/AppRouter/withAdvanceSearch';
import { useAdvanceSearch } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import {
  ExploreProps,
  ExploreSearchIndex,
  SearchHitCounts,
  UrlParams,
} from '../../components/Explore/ExplorePage.interface';
import ExploreV1 from '../../components/ExploreV1/ExploreV1.component';
import { useGlobalSearchProvider } from '../../components/GlobalSearchProvider/GlobalSearchProvider';
import { useTourProvider } from '../../components/TourProvider/TourProvider';
import { getExplorePath, PAGE_SIZE } from '../../constants/constants';
import {
  COMMON_FILTERS_FOR_DIFFERENT_TABS,
  INITIAL_SORT_FIELD,
  tabsInfo,
  TABS_SEARCH_INDEXES,
} from '../../constants/explore.constants';
import {
  mockSearchData,
  MOCK_EXPLORE_PAGE_COUNT,
} from '../../constants/mockTourData.constants';
import { SORT_ORDER } from '../../enums/common.enum';
import { SearchIndex } from '../../enums/search.enum';
import { Aggregations, SearchResponse } from '../../interface/search.interface';
import { searchQuery } from '../../rest/searchAPI';
import { getCountBadge } from '../../utils/CommonUtils';
import { findActiveSearchIndex } from '../../utils/Explore.utils';
import { getCombinedQueryFilterObject } from '../../utils/ExplorePage/ExplorePageUtils';
import { escapeESReservedCharacters } from '../../utils/StringsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  QueryFieldInterface,
  QueryFieldValueInterface,
  QueryFilterInterface,
} from './ExplorePage.interface';

const ExplorePageV1: FunctionComponent = () => {
  const location = useLocation();
  const history = useHistory();
  const { isTourOpen } = useTourProvider();

  const { tab } = useParams<UrlParams>();

  const { searchCriteria } = useGlobalSearchProvider();

  const [searchResults, setSearchResults] =
    useState<SearchResponse<ExploreSearchIndex>>();

  const [updatedAggregations, setUpdatedAggregations] =
    useState<Aggregations>();

  const [advancesSearchQuickFilters, setAdvancedSearchQuickFilters] =
    useState<QueryFilterInterface>();

  const [sortOrder, setSortOrder] = useState<SORT_ORDER>(SORT_ORDER.DESC);

  const [searchHitCounts, setSearchHitCounts] = useState<SearchHitCounts>();

  const [isLoading, setIsLoading] = useState(true);

  const { queryFilter } = useAdvanceSearch();

  const [parsedSearch, searchQueryParam, sortValue] = useMemo(() => {
    const parsedSearch = Qs.parse(
      location.search.startsWith('?')
        ? location.search.substring(1)
        : location.search
    );

    const searchQueryParam = isString(parsedSearch.search)
      ? parsedSearch.search
      : '';

    const sortValue = isString(parsedSearch.sort)
      ? parsedSearch.sort
      : INITIAL_SORT_FIELD;

    return [parsedSearch, searchQueryParam, sortValue];
  }, [location.search]);

  const handlePageChange: ExploreProps['onChangePage'] = (page, size) => {
    history.push({
      search: Qs.stringify({ ...parsedSearch, page, size: size ?? PAGE_SIZE }),
    });
  };

  const handleSortValueChange = (page: number, sortVal: string) => {
    history.push({
      search: Qs.stringify({
        ...parsedSearch,
        page,
        size: size ?? PAGE_SIZE,
        sort: sortVal,
      }),
    });
  };

  // Filters that can be common for all the Entities Ex. Tables, Topics, etc.
  const commonQuickFilters = useMemo(() => {
    const mustField: QueryFieldInterface[] = get(
      advancesSearchQuickFilters,
      'query.bool.must',
      []
    );

    // Getting the filters that can be common for all the Entities
    const must = mustField.filter((filterCategory: QueryFieldInterface) => {
      const shouldField: QueryFieldValueInterface[] = get(
        filterCategory,
        'bool.should',
        []
      );

      // check if the filter category is present in the common filters array
      const isCommonFieldPresent =
        !isEmpty(shouldField) &&
        COMMON_FILTERS_FOR_DIFFERENT_TABS.find(
          (value) => value === Object.keys(shouldField[0].term)[0]
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
  }, [advancesSearchQuickFilters]);

  const handleSearchIndexChange: (nSearchIndex: ExploreSearchIndex) => void =
    useCallback(
      (nSearchIndex) => {
        history.push(
          getExplorePath({
            tab: tabsInfo[nSearchIndex].path,
            extraParameters: {
              sort: searchQueryParam ? '_score' : INITIAL_SORT_FIELD,
              page: '1',
              quickFilter: commonQuickFilters
                ? JSON.stringify(commonQuickFilters)
                : undefined,
            },
            isPersistFilters: false,
          })
        );
      },
      [commonQuickFilters, searchQueryParam]
    );

  const handleQuickFilterChange = useCallback(
    (quickFilter) => {
      history.push({
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
    history.push({
      search: Qs.stringify({ ...parsedSearch, showDeleted, page: 1 }),
    });
  };

  const searchIndex = useMemo(() => {
    const tabInfo = Object.entries(tabsInfo).find(
      ([, tabInfo]) => tabInfo.path === tab
    );
    if (searchHitCounts && isNil(tabInfo)) {
      const activeKey = findActiveSearchIndex(searchHitCounts);

      return activeKey ?? SearchIndex.TABLE;
    }

    return !isNil(tabInfo)
      ? (tabInfo[0] as ExploreSearchIndex)
      : SearchIndex.TABLE;
  }, [tab, searchHitCounts]);

  const tabItems = useMemo(() => {
    const items = Object.entries(tabsInfo).map(
      ([tabSearchIndex, tabDetail]) => ({
        key: tabSearchIndex,
        label: (
          <div data-testid={`${lowerCase(tabDetail.label)}-tab`}>
            <Space className="w-full justify-between">
              <Typography.Text
                className={
                  tabSearchIndex === searchIndex ? 'text-primary' : ''
                }>
                {tabDetail.label}
              </Typography.Text>
              <span>
                {!isNil(searchHitCounts)
                  ? getCountBadge(
                      searchHitCounts[tabSearchIndex as ExploreSearchIndex],
                      '',
                      tabSearchIndex === searchIndex
                    )
                  : getCountBadge()}
              </span>
            </Space>
          </div>
        ),
        count: searchHitCounts
          ? searchHitCounts[tabSearchIndex as ExploreSearchIndex]
          : 0,
      })
    );

    return searchQueryParam
      ? items.filter((tabItem) => {
          return tabItem.count > 0 || tabItem.key === searchCriteria;
        })
      : items;
  }, [tabsInfo, searchHitCounts, searchIndex]);

  const page = useMemo(() => {
    const pageParam = parsedSearch.page;
    if (!isString(pageParam) || isNaN(Number.parseInt(pageParam))) {
      return 1;
    }

    return Number.parseInt(pageParam);
  }, [parsedSearch.page]);

  const size = useMemo(() => {
    const sizeParam = parsedSearch.size;
    if (!isString(sizeParam) || isNaN(Number.parseInt(sizeParam))) {
      return PAGE_SIZE;
    }

    return Number.parseInt(sizeParam);
  }, [parsedSearch.size]);

  useEffect(() => {
    if (!isEmpty(parsedSearch)) {
      handlePageChange(page, size);
    }
  }, [page, size, parsedSearch]);

  const showDeleted = useMemo(() => {
    const showDeletedParam = parsedSearch.showDeleted;

    return showDeletedParam === 'true';
  }, [parsedSearch.showDeleted]);

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

  const fetchEntityCount = () => {
    const updatedQuickFilters = getAdvancedSearchQuickFilters();

    const combinedQueryFilter = getCombinedQueryFilterObject(
      updatedQuickFilters as QueryFilterInterface,
      queryFilter as unknown as QueryFilterInterface
    );

    setIsLoading(true);
    Promise.all([
      searchQuery({
        query: !isEmpty(searchQueryParam)
          ? `*${escapeESReservedCharacters(searchQueryParam)}*`
          : '',
        searchIndex,
        queryFilter: combinedQueryFilter,
        sortField: sortValue,
        sortOrder,
        pageNumber: page,
        pageSize: size,
        includeDeleted: showDeleted,
      })
        .then((res) => res)
        .then((res) => {
          setSearchResults(res);
          setUpdatedAggregations(res.aggregations);
        }),
      searchQuery({
        query: `*${escapeESReservedCharacters(searchQueryParam)}*`,
        pageNumber: 0,
        pageSize: 0,
        queryFilter: combinedQueryFilter,
        searchIndex: SearchIndex.ALL,
        includeDeleted: showDeleted,
        trackTotalHits: true,
        fetchSource: false,
        filters: '',
      }).then((res) => {
        const buckets = res.aggregations[`index_count`].buckets;
        const counts: Record<string, number> = {};

        buckets.forEach((item) => {
          if (item && TABS_SEARCH_INDEXES.includes(item.key as SearchIndex)) {
            counts[item.key ?? ''] = item.doc_count;
          }
        });
        setSearchHitCounts(counts as SearchHitCounts);
      }),
    ])
      .catch((err) => {
        showErrorToast(err);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (isTourOpen) {
      setSearchHitCounts(MOCK_EXPLORE_PAGE_COUNT);
    } else {
      fetchEntityCount();
    }
  }, [
    parsedSearch.quickFilter,
    queryFilter,
    searchQueryParam,
    sortValue,
    sortOrder,
    showDeleted,
    searchIndex,
    page,
    size,
  ]);

  const handleAdvanceSearchQuickFiltersChange = useCallback(
    (filter?: QueryFilterInterface) => {
      handlePageChange(1);
      setAdvancedSearchQuickFilters(filter);
      handleQuickFilterChange(filter);
    },
    [setAdvancedSearchQuickFilters, history, parsedSearch]
  );

  useEffect(() => {
    AppState.updateExplorePageTab(tab);
  }, [tab]);

  return (
    <ExploreV1
      activeTabKey={searchIndex}
      aggregations={updatedAggregations}
      loading={isLoading && !isTourOpen}
      quickFilters={advancesSearchQuickFilters}
      searchIndex={searchIndex}
      searchResults={
        isTourOpen
          ? (mockSearchData as unknown as SearchResponse<ExploreSearchIndex>)
          : searchResults
      }
      showDeleted={showDeleted}
      sortOrder={sortOrder}
      sortValue={sortValue}
      tabCounts={isTourOpen ? MOCK_EXPLORE_PAGE_COUNT : searchHitCounts}
      tabItems={tabItems}
      onChangeAdvancedSearchQuickFilters={handleAdvanceSearchQuickFiltersChange}
      onChangePage={handlePageChange}
      onChangeSearchIndex={handleSearchIndexChange}
      onChangeShowDeleted={handleShowDeletedChange}
      onChangeSortOder={(sort) => {
        handlePageChange(1);
        setSortOrder(sort);
      }}
      onChangeSortValue={(sortVal) => {
        handleSortValueChange(1, sortVal);
      }}
    />
  );
};

export default withAdvanceSearch(ExplorePageV1);
