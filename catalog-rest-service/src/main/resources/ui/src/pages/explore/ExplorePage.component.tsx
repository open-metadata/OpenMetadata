/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { AxiosError } from 'axios';
import { Bucket, SearchDataFunctionType, SearchResponse } from 'Models';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { searchData } from '../../axiosAPIs/miscAPI';
import Explore from '../../components/Explore/Explore.component';
import {
  ExploreSearchData,
  UrlParams,
} from '../../components/Explore/explore.interface';
import Loader from '../../components/Loader/Loader';
import { ERROR500, PAGE_SIZE } from '../../constants/constants';
import {
  emptyValue,
  getCurrentIndex,
  getCurrentTab,
  INITIAL_FROM,
  INITIAL_SORT_FIELD,
  INITIAL_SORT_ORDER,
  tabsInfo,
  ZERO_SIZE,
} from '../../constants/explore.constants';
import { SearchIndex } from '../../enums/search.enum';
import useToastContext from '../../hooks/useToastContext';
import { getTotalEntityCountByService } from '../../utils/ServiceUtils';

const ExplorePage: FunctionComponent = () => {
  const showToast = useToastContext();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingForData, setIsLoadingForData] = useState(true);
  const [error, setError] = useState<string>('');
  const { searchQuery, tab } = useParams<UrlParams>();
  const [searchText, setSearchText] = useState<string>(searchQuery || '');
  const [tableCount, setTableCount] = useState<number>(0);
  const [topicCount, setTopicCount] = useState<number>(0);
  const [dashboardCount, setDashboardCount] = useState<number>(0);
  const [pipelineCount, setPipelineCount] = useState<number>(0);
  const [searchResult, setSearchResult] = useState<ExploreSearchData>();
  const [initialSortField] = useState<string>(
    searchQuery
      ? tabsInfo[getCurrentTab(tab) - 1].sortField
      : INITIAL_SORT_FIELD
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

  const handlePathChange = (path: string) => {
    AppState.explorePageTab = path;
  };

  const fetchCounts = () => {
    const entities = [
      SearchIndex.TABLE,
      SearchIndex.TOPIC,
      SearchIndex.DASHBOARD,
      SearchIndex.PIPELINE,
    ];

    const entityCounts = entities.map((entity) =>
      searchData(searchText, 0, 0, emptyValue, emptyValue, emptyValue, entity)
    );

    Promise.allSettled(entityCounts)
      .then(
        ([
          table,
          topic,
          dashboard,
          pipeline,
        ]: PromiseSettledResult<SearchResponse>[]) => {
          setTableCount(
            table.status === 'fulfilled'
              ? getTotalEntityCountByService(
                  table.value.data.aggregations?.['sterms#Service']
                    ?.buckets as Bucket[]
                )
              : 0
          );
          setTopicCount(
            topic.status === 'fulfilled'
              ? getTotalEntityCountByService(
                  topic.value.data.aggregations?.['sterms#Service']
                    ?.buckets as Bucket[]
                )
              : 0
          );
          setDashboardCount(
            dashboard.status === 'fulfilled'
              ? getTotalEntityCountByService(
                  dashboard.value.data.aggregations?.['sterms#Service']
                    ?.buckets as Bucket[]
                )
              : 0
          );
          setPipelineCount(
            pipeline.status === 'fulfilled'
              ? getTotalEntityCountByService(
                  pipeline.value.data.aggregations?.['sterms#Service']
                    ?.buckets as Bucket[]
                )
              : 0
          );
          setIsLoading(false);
        }
      )
      .catch(() => setIsLoading(false));
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
        d.searchIndex
      );
    });

    Promise.all(promiseValue)
      .then(
        ([
          resSearchResults,
          resAggServiceType,
          resAggTier,
          resAggTag,
        ]: Array<SearchResponse>) => {
          setError('');
          setSearchResult({
            resSearchResults,
            resAggServiceType,
            resAggTier,
            resAggTag,
          });
          setIsLoadingForData(false);
        }
      )
      .catch((err: AxiosError) => {
        setError(err.response?.data?.responseMessage);
        showToast({
          variant: 'error',
          body: err.response?.data?.responseMessage ?? ERROR500,
        });
        setIsLoadingForData(false);
      });
  };

  useEffect(() => {
    fetchCounts();
  }, [searchText]);

  useEffect(() => {
    fetchData([
      {
        queryString: searchText,
        from: INITIAL_FROM,
        size: PAGE_SIZE,
        filters: emptyValue,
        sortField: initialSortField,
        sortOrder: INITIAL_SORT_ORDER,
        searchIndex: getCurrentIndex(tab),
      },
      {
        queryString: searchText,
        from: INITIAL_FROM,
        size: ZERO_SIZE,
        filters: emptyValue,
        sortField: initialSortField,
        sortOrder: INITIAL_SORT_ORDER,
        searchIndex: getCurrentIndex(tab),
      },
      {
        queryString: searchText,
        from: INITIAL_FROM,
        size: ZERO_SIZE,
        filters: emptyValue,
        sortField: initialSortField,
        sortOrder: INITIAL_SORT_ORDER,
        searchIndex: getCurrentIndex(tab),
      },
      {
        queryString: searchText,
        from: INITIAL_FROM,
        size: ZERO_SIZE,
        filters: emptyValue,
        sortField: initialSortField,
        sortOrder: INITIAL_SORT_ORDER,
        searchIndex: getCurrentIndex(tab),
      },
    ]);
  }, []);

  return (
    <>
      {isLoading || isLoadingForData ? (
        <Loader />
      ) : (
        <Explore
          error={error}
          fetchData={fetchData}
          handlePathChange={handlePathChange}
          handleSearchText={handleSearchText}
          searchQuery={searchQuery}
          searchResult={searchResult}
          searchText={searchText}
          sortValue={initialSortField}
          tab={tab}
          tabCounts={{
            table: tableCount,
            topic: topicCount,
            dashboard: dashboardCount,
            pipeline: pipelineCount,
          }}
          updateDashboardCount={handleDashboardCount}
          updatePipelineCount={handlePipelineCount}
          updateTableCount={handleTableCount}
          updateTopicCount={handleTopicCount}
        />
      )}
    </>
  );
};

export default ExplorePage;
