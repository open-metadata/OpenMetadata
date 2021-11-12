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

import { isUndefined } from 'lodash';
import { observer } from 'mobx-react';
import {
  Bucket,
  EntityCounts,
  SearchDataFunctionType,
  SearchResponse,
} from 'Models';
import React, { useEffect, useState } from 'react';
import AppState from '../../AppState';
import { searchData } from '../../axiosAPIs/miscAPI';
import Loader from '../../components/Loader/Loader';
import MyData from '../../components/MyData/MyData.component';
import { PAGE_SIZE } from '../../constants/constants';
import {
  getAllServices,
  getEntityCountByService,
} from '../../utils/ServiceUtils';

const MyDataPage = () => {
  const [error, setError] = useState<string>('');
  const [countServices, setCountServices] = useState<number>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchResult, setSearchResult] = useState<SearchResponse[]>();
  const [rejectedResult, setRejectedResult] = useState<
    PromiseRejectedResult['reason'][]
  >([]);
  const [entityCounts, setEntityCounts] = useState<EntityCounts>();

  const errorHandler = (error: string) => {
    setError(error);
  };

  const fetchData = (value: SearchDataFunctionType, fetchService = false) => {
    setError('');

    const entityIndexList = [
      'table_search_index',
      'topic_search_index',
      'dashboard_search_index',
      'pipeline_search_index',
    ];

    const entityResponse = entityIndexList.map((entity) =>
      searchData(
        value.queryString,
        value.from,
        PAGE_SIZE,
        value.filters,
        value.sortField,
        value.sortOrder,
        entity
      )
    );

    Promise.allSettled(entityResponse).then((response) => {
      const fulfilledRes: SearchResponse[] = [];
      const aggregations: Bucket[] = [];
      const rejectedRes: PromiseRejectedResult['reason'][] = [];

      response.forEach((entity) => {
        if (entity.status === 'fulfilled') {
          fulfilledRes.push(entity.value);
          aggregations.push(
            ...entity.value.data.aggregations?.['sterms#Service']?.buckets
          );
        } else {
          rejectedRes.push(entity.reason);
        }
      });

      if (fulfilledRes.length === 0 && response[0].status === 'rejected') {
        setError(response[0].reason.response?.data?.responseMessage);
      }
      setRejectedResult(rejectedRes);
      setEntityCounts(getEntityCountByService(aggregations));
      setSearchResult(fulfilledRes as unknown as SearchResponse[]);
    });

    if (fetchService) {
      getAllServices()
        .then((res) => setCountServices(res.length))
        .catch(() => setCountServices(0));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData(
      {
        queryString: '',
        from: 1,
        filters: '',
        sortField: '',
        sortOrder: '',
      },
      isUndefined(countServices)
    );
  }, []);

  return (
    <>
      {!isUndefined(countServices) &&
      !isUndefined(entityCounts) &&
      !isLoading ? (
        <MyData
          countServices={countServices}
          entityCounts={entityCounts}
          error={error}
          errorHandler={errorHandler}
          fetchData={fetchData}
          rejectedResult={rejectedResult}
          searchResult={searchResult}
          userDetails={AppState.userDetails}
        />
      ) : (
        <Loader />
      )}
    </>
  );
};

export default observer(MyDataPage);
