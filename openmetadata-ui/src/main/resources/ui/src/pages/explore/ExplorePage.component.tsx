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

import PageContainerV1 from 'components/containers/PageContainerV1';
import Explore from 'components/Explore/Explore.component';
import {
  ExploreProps,
  ExploreSearchIndex,
  SearchHitCounts,
  UrlParams,
} from 'components/Explore/explore.interface';
import { SORT_ORDER } from 'enums/common.enum';
import { isEmpty, isNil, isString } from 'lodash';
import Qs from 'qs';
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { searchQuery } from 'rest/searchAPI';
import useDeepCompareEffect from 'use-deep-compare-effect';
import AppState from '../../AppState';
import { getExplorePath, PAGE_SIZE } from '../../constants/constants';
import {
  COMMON_FILTERS_FOR_DIFFERENT_TABS,
  INITIAL_SORT_FIELD,
  tabsInfo,
} from '../../constants/explore.constants';
import { SearchIndex } from '../../enums/search.enum';
import { SearchResponse } from '../../interface/search.interface';
import {
  filterObjectToElasticsearchQuery,
  isFilterObject,
} from '../../utils/FilterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { QueryFieldInterface } from './ExplorePage.interface';

const ExplorePage: FunctionComponent = () => {
  const location = useLocation();
  const history = useHistory();

  const { tab } = useParams<UrlParams>();

  const [searchResults, setSearchResults] =
    useState<SearchResponse<ExploreSearchIndex>>();

  const [advancesSearchQueryFilter, setAdvancedSearchQueryFilter] =
    useState<Record<string, unknown>>();

  const [sortValue, setSortValue] = useState<string>(INITIAL_SORT_FIELD);

  const [sortOrder, setSortOrder] = useState<SORT_ORDER>(SORT_ORDER.DESC);

  const [searchHitCounts, setSearchHitCounts] = useState<SearchHitCounts>();

  const [isLoading, setIsLoading] = useState(true);

  const parsedSearch = useMemo(
    () =>
      Qs.parse(
        location.search.startsWith('?')
          ? location.search.substr(1)
          : location.search
      ),
    [location.search]
  );

  const searchQueryParam = useMemo(
    () => (isString(parsedSearch.search) ? parsedSearch.search : ''),
    [location.search]
  );

  const postFilter = useMemo(
    () =>
      isFilterObject(parsedSearch.postFilter)
        ? parsedSearch.postFilter
        : undefined,
    [location.search]
  );

  const elasticsearchQueryFilter = useMemo(
    () => filterObjectToElasticsearchQuery(postFilter),
    [postFilter]
  );

  const handlePageChange: ExploreProps['onChangePage'] = (page) => {
    history.push({ search: Qs.stringify({ ...parsedSearch, page }) });
  };
  const queryFilter = useMemo(() => {
    if (!isString(parsedSearch.queryFilter)) {
      setAdvancedSearchQueryFilter(undefined);

      return undefined;
    }

    try {
      const queryFilter = JSON.parse(parsedSearch.queryFilter);
      setAdvancedSearchQueryFilter(queryFilter);

      return queryFilter;
    } catch {
      setAdvancedSearchQueryFilter(undefined);

      return undefined;
    }
  }, [location.search]);

  const commonQuickFilters = useMemo(() => {
    return {
      query: {
        bool: {
          must: queryFilter?.query.bool.must.filter(
            (filterCategory: QueryFieldInterface) =>
              !isEmpty(filterCategory.bool.should) &&
              COMMON_FILTERS_FOR_DIFFERENT_TABS.find(
                (value) =>
                  value === Object.keys(filterCategory.bool.should[0].term)[0]
              )
          ),
        },
      },
    };
  }, [queryFilter]);

  const handleSearchIndexChange: (nSearchIndex: ExploreSearchIndex) => void =
    useCallback(
      (nSearchIndex) => {
        history.push(
          getExplorePath({
            tab: tabsInfo[nSearchIndex].path,
            extraParameters: {
              page: '1',
              queryFilter: queryFilter
                ? JSON.stringify(commonQuickFilters)
                : undefined,
            },
            isPersistFilters: false,
          })
        );
      },
      [queryFilter, commonQuickFilters]
    );

  const handleQueryFilterChange = useCallback(
    (queryFilter) => {
      history.push({
        search: Qs.stringify({
          ...parsedSearch,
          queryFilter: queryFilter ? JSON.stringify(queryFilter) : undefined,
          page: 1,
        }),
      });
    },
    [history, parsedSearch]
  );

  const handlePostFilterChange: ExploreProps['onChangePostFilter'] = (
    postFilter
  ) => {
    history.push({
      search: Qs.stringify({ ...parsedSearch, postFilter, page: 1 }),
    });
  };

  const handleShowDeletedChange: ExploreProps['onChangeShowDeleted'] = (
    showDeleted
  ) => {
    history.push({
      search: Qs.stringify({ ...parsedSearch, showDeleted, page: 1 }),
    });
  };

  useEffect(() => {
    handleQueryFilterChange(queryFilter);
  }, [queryFilter]);

  const searchIndex = useMemo(() => {
    const tabInfo = Object.entries(tabsInfo).find(
      ([, tabInfo]) => tabInfo.path === tab
    );
    if (isNil(tabInfo)) {
      return SearchIndex.TABLE;
    }

    return tabInfo[0] as ExploreSearchIndex;
  }, [tab]);

  useEffect(() => {
    handleSearchIndexChange(searchIndex);
  }, [searchIndex, searchQueryParam]);

  const page = useMemo(() => {
    const pageParam = parsedSearch.page;
    if (!isString(pageParam) || isNaN(Number.parseInt(pageParam))) {
      return 1;
    }

    return Number.parseInt(pageParam);
  }, [parsedSearch.page]);

  useEffect(() => {
    handlePageChange(page);
  }, [page]);

  const showDeleted = useMemo(() => {
    const showDeletedParam = parsedSearch.showDeleted;

    return showDeletedParam === 'true';
  }, [parsedSearch.showDeleted]);

  useDeepCompareEffect(() => {
    setIsLoading(true);
    Promise.all([
      searchQuery({
        query: searchQueryParam,
        searchIndex,
        queryFilter: advancesSearchQueryFilter,
        postFilter: elasticsearchQueryFilter,
        sortField: sortValue,
        sortOrder,
        pageNumber: page,
        pageSize: PAGE_SIZE,
        includeDeleted: showDeleted,
      })
        .then((res) => res)
        .then((res) => setSearchResults(res)),
      Promise.all(
        [
          SearchIndex.TABLE,
          SearchIndex.TOPIC,
          SearchIndex.DASHBOARD,
          SearchIndex.PIPELINE,
          SearchIndex.MLMODEL,
        ].map((index) =>
          searchQuery({
            query: searchQueryParam,
            pageNumber: 0,
            pageSize: 0,
            queryFilter: advancesSearchQueryFilter,
            postFilter: elasticsearchQueryFilter,
            searchIndex: index,
            includeDeleted: showDeleted,
            trackTotalHits: true,
            fetchSource: false,
          })
        )
      ).then(
        ([
          tableResponse,
          topicResponse,
          dashboardResponse,
          pipelineResponse,
          mlmodelResponse,
        ]) => {
          setSearchHitCounts({
            [SearchIndex.TABLE]: tableResponse.hits.total.value,
            [SearchIndex.TOPIC]: topicResponse.hits.total.value,
            [SearchIndex.DASHBOARD]: dashboardResponse.hits.total.value,
            [SearchIndex.PIPELINE]: pipelineResponse.hits.total.value,
            [SearchIndex.MLMODEL]: mlmodelResponse.hits.total.value,
          });
        }
      ),
    ])
      .catch((err) => showErrorToast(err))
      .finally(() => setIsLoading(false));
  }, [
    searchIndex,
    searchQueryParam,
    sortValue,
    sortOrder,
    showDeleted,
    advancesSearchQueryFilter,
    elasticsearchQueryFilter,
    page,
  ]);

  const handleAdvanceSearchQueryFilterChange = useCallback(
    (filter?: Record<string, unknown>, updateParameters?: boolean) => {
      handlePageChange(1);
      setAdvancedSearchQueryFilter(filter);
      updateParameters && handleQueryFilterChange(filter);
    },
    [setAdvancedSearchQueryFilter, history, parsedSearch]
  );

  useEffect(() => {
    AppState.updateExplorePageTab(tab);
  }, [tab]);

  return (
    <PageContainerV1>
      <Explore
        loading={isLoading}
        page={page}
        postFilter={postFilter}
        queryFilter={queryFilter}
        searchIndex={searchIndex}
        searchResults={searchResults}
        showDeleted={showDeleted}
        sortOrder={sortOrder}
        sortValue={sortValue}
        tabCounts={searchHitCounts}
        onChangeAdvancedSearchQueryFilter={handleAdvanceSearchQueryFilterChange}
        onChangePage={handlePageChange}
        onChangePostFilter={handlePostFilterChange}
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
    </PageContainerV1>
  );
};

export default ExplorePage;
