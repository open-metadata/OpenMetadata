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
import { FormatedTableData, SearchResponse } from 'Models';
import React, { useEffect, useState } from 'react';
import { searchData } from '../../axiosAPIs/miscAPI';
import Error from '../../components/common/error/Error';
import Loader from '../../components/Loader/Loader';
import SearchedData from '../../components/searched-data/SearchedData';
import { ERROR404, ERROR500, PAGE_SIZE } from '../../constants/constants';
import { Ownership } from '../../enums/mydata.enum';
import useToastContext from '../../hooks/useToastContext';
import { formatDataResponse } from '../../utils/APIUtils';
import { getCurrentUserId } from '../../utils/CommonUtils';

const MyDataPage: React.FC = (): React.ReactElement => {
  const showToast = useToastContext();
  const [data, setData] = useState<Array<FormatedTableData>>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalNumberOfValue, setTotalNumberOfValues] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<number>(1);
  const [error, setError] = useState<string>('');
  const [filter, setFilter] = useState<string>('');

  const getActiveTabClass = (tab: number) => {
    return tab === currentTab ? 'active' : '';
  };

  const fetchTableData = () => {
    setIsLoading(true);
    searchData(
      `*`,
      currentPage,
      PAGE_SIZE,
      filter ? `${filter}:${getCurrentUserId()}` : ''
    )
      .then((res: SearchResponse) => {
        const hits = res.data.hits.hits;
        if (hits.length > 0) {
          setTotalNumberOfValues(res.data.hits.total.value);
          setData(formatDataResponse(hits));
          setIsLoading(false);
        } else {
          setData([]);
          setTotalNumberOfValues(0);
          setIsLoading(false);
        }
      })
      .catch((err: AxiosError) => {
        setError(ERROR404);
        showToast({
          variant: 'error',
          body: err.response?.data?.responseMessage ?? ERROR500,
        });

        setIsLoading(false);
      });
  };

  const getTabs = () => {
    return (
      <div className="tw-mb-3 tw--mt-4">
        <nav className="tw-flex tw-flex-row tw-gh-tabs-container tw-px-4">
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(1)}`}
            onClick={() => {
              setCurrentTab(1);
              setFilter('');
              setCurrentPage(1);
            }}>
            All
          </button>
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(2)}`}
            onClick={() => {
              setCurrentTab(2);
              setFilter(Ownership.OWNER);
              setCurrentPage(1);
            }}>
            Owned
          </button>
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(3)}`}
            onClick={() => {
              setCurrentTab(3);
              setFilter(Ownership.FOLLOWERS);
              setCurrentPage(1);
            }}>
            Following
          </button>
        </nav>
      </div>
    );
  };

  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  useEffect(() => {
    fetchTableData();
  }, [currentPage, filter]);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <>
          {error ? (
            <Error error={error} />
          ) : (
            <SearchedData
              showOnboardingTemplate
              currentPage={currentPage}
              data={data}
              paginate={paginate}
              searchText="*"
              showResultCount={filter && data.length > 0 ? true : false}
              totalValue={totalNumberOfValue}>
              {getTabs()}
            </SearchedData>
          )}
        </>
      )}
    </>
  );
};

export default MyDataPage;
