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
import { searchData } from '../../axiosAPIs/miscAPI';
import Explore from '../../components/Explore/Explore.component';
import {
  ExploreSearchData,
  UrlParams,
} from '../../components/Explore/explore.interface';
import Loader from '../../components/Loader/Loader';
import { ERROR500 } from '../../constants/constants';
import { SearchIndex } from '../../enums/search.enum';
import useToastContext from '../../hooks/useToastContext';
import { getTotalEntityCountByService } from '../../utils/ServiceUtils';

const ExplorePage: FunctionComponent = () => {
  const showToast = useToastContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const { searchQuery, tab } = useParams<UrlParams>();
  const [searchText, setSearchText] = useState<string>(searchQuery || '');
  const [tableCount, setTableCount] = useState<number>(0);
  const [topicCount, setTopicCount] = useState<number>(0);
  const [dashboardCount, setDashboardCount] = useState<number>(0);
  const [pipelineCount, setPipelineCount] = useState<number>(0);
  const [searchResult, setSearchResult] = useState<ExploreSearchData>();

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

  const fetchCounts = () => {
    const emptyValue = '';
    const tableCount = searchData(
      searchText,
      0,
      0,
      emptyValue,
      emptyValue,
      emptyValue,
      SearchIndex.TABLE
    );
    const topicCount = searchData(
      searchText,
      0,
      0,
      emptyValue,
      emptyValue,
      emptyValue,
      SearchIndex.TOPIC
    );
    const dashboardCount = searchData(
      searchText,
      0,
      0,
      emptyValue,
      emptyValue,
      emptyValue,
      SearchIndex.DASHBOARD
    );
    const pipelineCount = searchData(
      searchText,
      0,
      0,
      emptyValue,
      emptyValue,
      emptyValue,
      SearchIndex.PIPELINE
    );

    Promise.allSettled([
      tableCount,
      topicCount,
      dashboardCount,
      pipelineCount,
    ]).then(
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
      }
    );
  };

  const fetchData = (value: SearchDataFunctionType[]) => {
    setIsLoading(true);
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
          setSearchResult({
            resSearchResults,
            resAggServiceType,
            resAggTier,
            resAggTag,
          });
        }
      )
      .catch((err: AxiosError) => {
        setError(err.response?.data?.responseMessage);
        showToast({
          variant: 'error',
          body: err.response?.data?.responseMessage ?? ERROR500,
        });
      });
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCounts();
  }, [searchText]);

  return (
    <div data-testid="explore-page">
      {isLoading ? (
        <Loader />
      ) : (
        <Explore
          error={error}
          fetchData={fetchData}
          handleSearchText={handleSearchText}
          isLoading={isLoading}
          searchQuery={searchQuery}
          searchResult={searchResult}
          searchText={searchText}
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
    </div>
  );
};

export default ExplorePage;
