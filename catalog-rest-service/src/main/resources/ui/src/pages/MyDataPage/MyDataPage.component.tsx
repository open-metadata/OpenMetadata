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
import { isUndefined } from 'lodash';
import { observer } from 'mobx-react';
import { EntityCounts, SearchDataFunctionType, SearchResponse } from 'Models';
import React, { useEffect, useState } from 'react';
import AppState from '../../AppState';
import { getIngestionWorkflows } from '../../axiosAPIs/ingestionWorkflowAPI';
import { searchData } from '../../axiosAPIs/miscAPI';
import Loader from '../../components/Loader/Loader';
import MyData from '../../components/MyData/MyData.component';
import { PAGE_SIZE } from '../../constants/constants';
import {
  myDataEntityCounts,
  myDataSearchIndex,
} from '../../constants/Mydata.constants';
import {
  getAllServices,
  getEntityCountByService,
} from '../../utils/ServiceUtils';

const MyDataPage = () => {
  const [error, setError] = useState<string>('');
  const [countServices, setCountServices] = useState<number>();
  const [ingestionCount, setIngestionCount] = useState<number>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchResult, setSearchResult] = useState<SearchResponse>();
  const [entityCounts, setEntityCounts] = useState<EntityCounts>();

  const fetchData = (value: SearchDataFunctionType, fetchService = false) => {
    setError('');

    searchData(
      value.queryString,
      value.from,
      PAGE_SIZE,
      value.filters,
      value.sortField,
      value.sortOrder,
      myDataSearchIndex
    )
      .then((res: SearchResponse) => {
        setSearchResult(res);
        if (isUndefined(entityCounts)) {
          setEntityCounts(
            getEntityCountByService(
              res.data.aggregations?.['sterms#Service']?.buckets
            )
          );
        }
      })
      .catch((err: AxiosError) => {
        setError(err.response?.data?.responseMessage);
        setEntityCounts(myDataEntityCounts);
      });

    if (fetchService) {
      getAllServices()
        .then((res) => setCountServices(res.length))
        .catch(() => setCountServices(0));
      getIngestionWorkflows(['owner, service, tags, status'])
        .then((res) => setIngestionCount(res.data.data.length))
        .catch(() => setIngestionCount(0));
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
      !isUndefined(ingestionCount) &&
      !isLoading ? (
        <MyData
          countServices={countServices}
          entityCounts={entityCounts}
          error={error}
          fetchData={fetchData}
          ingestionCount={ingestionCount}
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
