/*
 *  Copyright 2021 Collate
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

import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import {
  Bucket,
  FilterObject,
  SearchDataFunctionType,
  SearchResponse,
} from 'Models';
import React, {
  Fragment,
  FunctionComponent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { searchData } from '../../axiosAPIs/miscAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import Explore from '../../components/Explore/Explore.component';
import {
  ExploreSearchData,
  UrlParams,
} from '../../components/Explore/explore.interface';
import Loader from '../../components/Loader/Loader';
import { getExplorePathWithSearch, PAGE_SIZE } from '../../constants/constants';
import {
  emptyValue,
  getCurrentIndex,
  getCurrentTab,
  getInitialFilter,
  getQueryParam,
  getSearchFilter,
  INITIAL_FROM,
  INITIAL_SORT_ORDER,
  tabsInfo,
  ZERO_SIZE,
} from '../../constants/explore.constants';
import { SearchIndex } from '../../enums/search.enum';
import jsonData from '../../jsons/en';
import { getTotalEntityCountByType } from '../../utils/EntityUtils';
import { getFilterString, prepareQueryParams } from '../../utils/FilterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const ExplorePage: FunctionComponent = () => {
  const location = useLocation();
  const history = useHistory();
  const initialFilter = useMemo(
    () => getQueryParam(getInitialFilter(location.search)),
    [location.search]
  );
  const searchFilter = useMemo(
    () => getQueryParam(getSearchFilter(location.search)),
    [location.search]
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingForData, setIsLoadingForData] = useState(true);
  const [error, setError] = useState<string>('');
  const { searchQuery, tab } = useParams<UrlParams>();
  const [searchText, setSearchText] = useState<string>(searchQuery || '');
  const [tableCount, setTableCount] = useState<number>(0);
  const [topicCount, setTopicCount] = useState<number>(0);
  const [dashboardCount, setDashboardCount] = useState<number>(0);
  const [pipelineCount, setPipelineCount] = useState<number>(0);
  const [dbtModelCount, setDbtModelCount] = useState<number>(0);
  const [mlModelCount, setMlModelCount] = useState<number>(0);
  const [searchResult, setSearchResult] = useState<ExploreSearchData>();
  const [showDeleted, setShowDeleted] = useState(false);
  const [initialSortField] = useState<string>(
    tabsInfo[getCurrentTab(tab) - 1].sortField
  );

  const handleSearchText = (text: string) => {
    setSearchText(text);
  };

  const handleTableCount = (count: number) => {
    setTableCount(count);
  };

  const handleTopicCount = (count: number) => {
    setTopicCount(count);
  };

  const handleDashboardCount = (count: number) => {
    setDashboardCount(count);
  };

  const handlePipelineCount = (count: number) => {
    setPipelineCount(count);
  };

  const handleDbtModelCount = (count: number) => {
    setDbtModelCount(count);
  };

  const handleMlModelCount = (count: number) => {
    setMlModelCount(count);
  };

  const handlePathChange = (path: string) => {
    AppState.updateExplorePageTab(path);
  };

  /**
   * on filter change , change the route
   * @param filterData - filter object
   */
  const handleFilterChange = (filterData: FilterObject) => {
    const params = prepareQueryParams(filterData, initialFilter);

    const explorePath = getExplorePathWithSearch(searchQuery, tab);

    history.push({
      pathname: explorePath,
      search: params,
    });
  };

  const fetchCounts = () => {
    const entities = [
      SearchIndex.TABLE,
      SearchIndex.TOPIC,
      SearchIndex.DASHBOARD,
      SearchIndex.PIPELINE,
      SearchIndex.MLMODEL,
    ];

    const entityCounts = entities.map((entity) =>
      searchData(
        searchText,
        0,
        0,
        getFilterString(initialFilter),
        emptyValue,
        emptyValue,
        entity,
        showDeleted,
        true
      )
    );

    Promise.allSettled(entityCounts)
      .then(
        ([
          table,
          topic,
          dashboard,
          pipeline,
          mlmodel,
        ]: PromiseSettledResult<SearchResponse>[]) => {
          setTableCount(
            table.status === 'fulfilled'
              ? getTotalEntityCountByType(
                  table.value.data.aggregations?.['sterms#EntityType']
                    ?.buckets as Bucket[]
                )
              : 0
          );
          setTopicCount(
            topic.status === 'fulfilled'
              ? getTotalEntityCountByType(
                  topic.value.data.aggregations?.['sterms#EntityType']
                    ?.buckets as Bucket[]
                )
              : 0
          );
          setDashboardCount(
            dashboard.status === 'fulfilled'
              ? getTotalEntityCountByType(
                  dashboard.value.data.aggregations?.['sterms#EntityType']
                    ?.buckets as Bucket[]
                )
              : 0
          );
          setPipelineCount(
            pipeline.status === 'fulfilled'
              ? getTotalEntityCountByType(
                  pipeline.value.data.aggregations?.['sterms#EntityType']
                    ?.buckets as Bucket[]
                )
              : 0
          );
          setMlModelCount(
            mlmodel.status === 'fulfilled'
              ? getTotalEntityCountByType(
                  mlmodel.value.data.aggregations?.['sterms#EntityType']
                    ?.buckets as Bucket[]
                )
              : 0
          );
        }
      )
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-entity-count-error']
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const fetchData = (value: SearchDataFunctionType[]) => {
    const promiseValue = value.map((d) => {
      return searchData(
        d.queryString,
        d.from,
        d.size,
        d.filters,
        d.sortField,
        d.sortOrder,
        d.searchIndex,
        showDeleted
      );
    });

    Promise.all(promiseValue)
      .then(
        ([
          resSearchResults,
          resAggServiceType,
          resAggTier,
          resAggTag,
          resAggDatabase,
          resAggDatabaseSchema,
          resAggServiceName,
        ]: Array<SearchResponse>) => {
          setError('');
          setSearchResult({
            resSearchResults,
            resAggServiceType,
            resAggTier,
            resAggTag,
            resAggDatabase,
            resAggDatabaseSchema,
            resAggServiceName,
          });
          setIsLoadingForData(false);
        }
      )
      .catch((err: AxiosError) => {
        setError(err.response?.data?.responseMessage);
        setIsLoadingForData(false);
      });
  };

  useEffect(() => {
    fetchCounts();
  }, [searchText, showDeleted, initialFilter]);

  useEffect(() => {
    AppState.updateExplorePageTab(tab);
  }, [tab]);

  useEffect(() => {
    setSearchResult(undefined);
    setIsLoadingForData(true);
    fetchData([
      {
        queryString: searchText,
        from: INITIAL_FROM,
        size: PAGE_SIZE,
        filters: getFilterString(initialFilter),
        sortField: initialSortField,
        sortOrder: INITIAL_SORT_ORDER,
        searchIndex: getCurrentIndex(tab),
      },
      {
        queryString: searchText,
        from: INITIAL_FROM,
        size: ZERO_SIZE,
        filters: getFilterString(initialFilter),
        sortField: initialSortField,
        sortOrder: INITIAL_SORT_ORDER,
        searchIndex: getCurrentIndex(tab),
      },
      {
        queryString: searchText,
        from: INITIAL_FROM,
        size: ZERO_SIZE,
        filters: getFilterString(initialFilter),
        sortField: initialSortField,
        sortOrder: INITIAL_SORT_ORDER,
        searchIndex: getCurrentIndex(tab),
      },
      {
        queryString: searchText,
        from: INITIAL_FROM,
        size: ZERO_SIZE,
        filters: getFilterString(initialFilter),
        sortField: initialSortField,
        sortOrder: INITIAL_SORT_ORDER,
        searchIndex: getCurrentIndex(tab),
      },
    ]);
  }, []);

  return (
    <Fragment>
      {isLoading || isLoadingForData ? (
        <Loader />
      ) : (
        <PageContainerV1>
          <Explore
            error={error}
            fetchCount={fetchCounts}
            fetchData={fetchData}
            handleFilterChange={handleFilterChange}
            handlePathChange={handlePathChange}
            handleSearchText={handleSearchText}
            initialFilter={initialFilter}
            isFilterSelected={!isEmpty(searchFilter) || !isEmpty(initialFilter)}
            searchFilter={searchFilter}
            searchQuery={searchQuery}
            searchResult={searchResult}
            searchText={searchText}
            showDeleted={showDeleted}
            sortValue={initialSortField}
            tab={tab}
            tabCounts={{
              table: tableCount,
              topic: topicCount,
              dashboard: dashboardCount,
              pipeline: pipelineCount,
              dbtModel: dbtModelCount,
              mlModel: mlModelCount,
            }}
            updateDashboardCount={handleDashboardCount}
            updateDbtModelCount={handleDbtModelCount}
            updateMlModelCount={handleMlModelCount}
            updatePipelineCount={handlePipelineCount}
            updateTableCount={handleTableCount}
            updateTopicCount={handleTopicCount}
            onShowDeleted={(checked) => setShowDeleted(checked)}
          />
        </PageContainerV1>
      )}
    </Fragment>
  );
};

export default ExplorePage;
