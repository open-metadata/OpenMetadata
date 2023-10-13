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

import { useAdvanceSearch } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';

import { get, isEmpty, isString } from 'lodash';
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
import {
  ExploreProps,
  ExploreSearchIndex,
  SearchHitCounts,
  UrlParams,
} from '../../components/Explore/explore.interface';
import ExploreV1 from '../../components/ExploreV1/ExploreV1.component';
import { withAdvanceSearch } from '../../components/router/withAdvanceSearch';
import { useTourProvider } from '../../components/TourProvider/TourProvider';
import { getExplorePath, PAGE_SIZE } from '../../constants/constants';
import {
  COMMON_FILTERS_FOR_DIFFERENT_TABS,
  INITIAL_SORT_FIELD,
  tabsInfo,
} from '../../constants/explore.constants';
import {
  mockSearchData,
  MOCK_EXPLORE_PAGE_COUNT,
} from '../../constants/mockTourData.constants';
import { SORT_ORDER } from '../../enums/common.enum';
import { SearchIndex } from '../../enums/search.enum';
import { Aggregations, SearchResponse } from '../../interface/search.interface';
import { searchQuery } from '../../rest/searchAPI';
import { getCombinedQueryFilterObject } from '../../utils/ExplorePage/ExplorePageUtils';
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

  const [searchResults, setSearchResults] =
    useState<SearchResponse<ExploreSearchIndex>>();

  const [updatedAggregations, setUpdatedAggregations] =
    useState<Aggregations>();

  const [advancesSearchQuickFilters, setAdvancedSearchQuickFilters] =
    useState<QueryFilterInterface>();

  const [sortValue, setSortValue] = useState<string>(INITIAL_SORT_FIELD);

  const [sortOrder, setSortOrder] = useState<SORT_ORDER>(SORT_ORDER.DESC);

  const [searchHitCounts, setSearchHitCounts] = useState<SearchHitCounts>();

  const [isLoading, setIsLoading] = useState(true);

  const { queryFilter } = useAdvanceSearch();

  const parsedSearch = useMemo(
    () =>
      Qs.parse(
        location.search.startsWith('?')
          ? location.search.substring(1)
          : location.search
      ),
    [location.search]
  );

  const searchQueryParam = useMemo(
    () => (isString(parsedSearch.search) ? parsedSearch.search : ''),
    [location.search]
  );

  const handlePageChange: ExploreProps['onChangePage'] = (page, size) => {
    history.push({
      search: Qs.stringify({ ...parsedSearch, page, size: size ?? PAGE_SIZE }),
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
              page: '1',
              quickFilter: commonQuickFilters
                ? JSON.stringify(commonQuickFilters)
                : undefined,
            },
            isPersistFilters: false,
          })
        );
      },
      [commonQuickFilters]
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

    return (tabInfo?.[0] as ExploreSearchIndex) ?? SearchIndex.TABLE;
  }, [tab]);

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

  useEffect(() => {
    const updatedQuickFilters = getAdvancedSearchQuickFilters();

    const combinedQueryFilter = getCombinedQueryFilterObject(
      updatedQuickFilters as QueryFilterInterface,
      queryFilter as unknown as QueryFilterInterface
    );

    let newSortValue = sortValue;
    if (searchQueryParam !== '') {
      newSortValue = '_score';
      setSortValue(newSortValue);
    }

    setIsLoading(true);
    Promise.all([
      searchQuery({
        query: searchQueryParam,
        searchIndex,
        queryFilter: combinedQueryFilter,
        sortField: newSortValue,
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
      Promise.all(
        [
          SearchIndex.TABLE,
          SearchIndex.TOPIC,
          SearchIndex.DASHBOARD,
          SearchIndex.PIPELINE,
          SearchIndex.MLMODEL,
          SearchIndex.CONTAINER,
          SearchIndex.STORED_PROCEDURE,
          SearchIndex.DASHBOARD_DATA_MODEL,
          SearchIndex.GLOSSARY,
          SearchIndex.TAG,
          SearchIndex.SEARCH_INDEX,
        ].map((index) =>
          searchQuery({
            query: searchQueryParam,
            pageNumber: 0,
            pageSize: 0,
            queryFilter: combinedQueryFilter,
            searchIndex: index,
            includeDeleted: showDeleted,
            trackTotalHits: true,
            fetchSource: false,
            filters: index === SearchIndex.TAG ? 'disabled:false' : '',
          })
        )
      ).then(
        ([
          tableResponse,
          topicResponse,
          dashboardResponse,
          pipelineResponse,
          mlmodelResponse,
          containerResponse,
          storeProcedureResponse,
          dataModelResponse,
          glossaryResponse,
          tagsResponse,
          searchIndexResponse,
        ]) => {
          setSearchHitCounts({
            [SearchIndex.TABLE]: tableResponse.hits.total.value,
            [SearchIndex.TOPIC]: topicResponse.hits.total.value,
            [SearchIndex.DASHBOARD]: dashboardResponse.hits.total.value,
            [SearchIndex.PIPELINE]: pipelineResponse.hits.total.value,
            [SearchIndex.MLMODEL]: mlmodelResponse.hits.total.value,
            [SearchIndex.CONTAINER]: containerResponse.hits.total.value,
            [SearchIndex.STORED_PROCEDURE]:
              storeProcedureResponse.hits.total.value,
            [SearchIndex.DASHBOARD_DATA_MODEL]:
              dataModelResponse.hits.total.value,
            [SearchIndex.GLOSSARY]: glossaryResponse.hits.total.value,
            [SearchIndex.TAG]: tagsResponse.hits.total.value,
            [SearchIndex.SEARCH_INDEX]: searchIndexResponse.hits.total.value,
          });
        }
      ),
    ])
      .catch((err) => {
        showErrorToast(err);
      })
      .finally(() => setIsLoading(false));
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
      onChangeAdvancedSearchQuickFilters={handleAdvanceSearchQuickFiltersChange}
      onChangePage={handlePageChange}
      onChangeSearchIndex={handleSearchIndexChange}
      onChangeShowDeleted={handleShowDeletedChange}
      onChangeSortOder={(sort) => {
        handlePageChange(1);
        setSortOrder(sort);
      }}
      onChangeSortValue={(sort) => {
        handlePageChange(1);
        setSortValue(sort);
      }}
    />
  );
};

export default withAdvanceSearch(ExplorePageV1);
