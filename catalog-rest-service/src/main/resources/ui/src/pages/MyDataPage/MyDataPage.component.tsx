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
import { observer } from 'mobx-react';
import { SearchDataFunctionType, SearchResponse } from 'Models';
import React, { useEffect, useState } from 'react';
import AppState from '../../AppState';
import { searchData } from '../../axiosAPIs/miscAPI';
import Loader from '../../components/Loader/Loader';
import MyData from '../../components/MyData/MyData.component';
import { ERROR500, PAGE_SIZE } from '../../constants/constants';
import useToastContext from '../../hooks/useToastContext';
import { getAllServices } from '../../utils/ServiceUtils';

const MyDataPage = () => {
  const showToast = useToastContext();
  const [error, setError] = useState<string>('');
  const [countServices, setCountServices] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchResult, setSearchResult] = useState<SearchResponse>();

  const fetchData = (value: SearchDataFunctionType) => {
    searchData(
      value.queryString,
      value.from,
      PAGE_SIZE,
      value.filters,
      value.sortField,
      value.sortOrder,
      value.searchIndex
    )
      .then((res: SearchResponse) => {
        setSearchResult(res);
      })
      .catch((err: AxiosError) => {
        setError(err.response?.data?.responseMessage);
        showToast({
          variant: 'error',
          body: err.response?.data?.responseMessage ?? ERROR500,
        });
      });
  };

  useEffect(() => {
    getAllServices()
      .then((res) => setCountServices(res.length))
      .catch(() => setCountServices(0));
    setIsLoading(false);
  }, []);

  return (
    <div data-testid="my-data-page-conatiner">
      {isLoading ? (
        <Loader />
      ) : (
        <MyData
          countServices={countServices}
          error={error}
          fetchData={fetchData}
          searchResult={searchResult}
          userDetails={AppState.userDetails}
        />
      )}
    </div>
  );
};

export default observer(MyDataPage);
