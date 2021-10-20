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
import { isEmpty } from 'lodash';
import { observer } from 'mobx-react';
import { Bucket, FormatedTableData, SearchResponse, Sterm } from 'Models';
import React, { useEffect, useRef, useState } from 'react';
import AppState from '../../AppState';
import { searchData } from '../../axiosAPIs/miscAPI';
import ErrorPlaceHolderES from '../../components/common/error-with-placeholder/ErrorPlaceHolderES';
import PageContainer from '../../components/containers/PageContainer';
import Loader from '../../components/Loader/Loader';
import MyDataHeader from '../../components/my-data/MyDataHeader';
import RecentlyViewed from '../../components/recently-viewed/RecentlyViewed';
import SearchedData from '../../components/searched-data/SearchedData';
import { ERROR500, PAGE_SIZE } from '../../constants/constants';
import { Ownership } from '../../enums/mydata.enum';
import useToastContext from '../../hooks/useToastContext';
import { formatDataResponse } from '../../utils/APIUtils';
import { getCurrentUserId } from '../../utils/CommonUtils';
import {
  getAllServices,
  getEntityCountByService,
  getTotalEntityCountByService,
} from '../../utils/ServiceUtils';

const MyDataPage: React.FC = (): React.ReactElement => {
  const showToast = useToastContext();
  const [data, setData] = useState<Array<FormatedTableData>>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalNumberOfValue, setTotalNumberOfValues] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEntityLoading, setIsEntityLoading] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<number>(1);
  const [error, setError] = useState<string>('');
  const [filter, setFilter] = useState<string>('');
  const [aggregations, setAggregations] = useState<Record<string, Sterm>>();
  const [searchIndex] = useState<string>(
    'dashboard_search_index,topic_search_index,table_search_index,pipeline_search_index'
  );
  const [countServices, setCountServices] = useState<number>(0);
  const isMounted = useRef<boolean>(false);

  const getActiveTabClass = (tab: number) => {
    return tab === currentTab ? 'active' : '';
  };

  const getFilters = (): string => {
    if (filter === 'owner' && AppState.userDetails.teams) {
      const userTeams = !isEmpty(AppState.userDetails)
        ? AppState.userDetails.teams.map((team) => `${filter}:${team.id}`)
        : [];
      const ownerIds = [...userTeams, `${filter}:${getCurrentUserId()}`];

      return `(${ownerIds.join(' OR ')})`;
    }

    return `${filter}:${getCurrentUserId()}`;
  };

  const fetchTableData = (setAssetCount = false) => {
    if (!isEntityLoading) {
      setIsLoading(true);
    }
    searchData(
      '',
      currentPage,
      PAGE_SIZE,
      filter ? getFilters() : '',
      '',
      '',
      searchIndex
    )
      .then((res: SearchResponse) => {
        const hits = res.data.hits.hits;
        if (hits.length > 0) {
          setTotalNumberOfValues(res.data.hits.total.value);
          setData(formatDataResponse(hits));
          if (setAssetCount) {
            setAggregations(res.data.aggregations);
          }
          setIsLoading(false);
          setIsEntityLoading(false);
        } else {
          setData([]);
          setTotalNumberOfValues(0);
          setIsLoading(false);
          setIsEntityLoading(false);
        }
      })
      .catch((err: AxiosError) => {
        setError(err.response?.data?.responseMessage);
        showToast({
          variant: 'error',
          body: err.response?.data?.responseMessage ?? ERROR500,
        });
        setIsLoading(false);
        setIsEntityLoading(false);
      });
  };

  const getTabs = () => {
    return (
      <div className="tw-mb-3 tw--mt-4" data-testid="tabs">
        <nav className="tw-flex tw-flex-row tw-gh-tabs-container tw-px-4">
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(1)}`}
            data-testid="tab"
            id="recentlyViewedTab"
            onClick={() => {
              setIsEntityLoading(true);
              setCurrentTab(1);
              setFilter('');
              setCurrentPage(1);
            }}>
            Recently Viewed
          </button>
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(2)}`}
            data-testid="tab"
            id="myDataTab"
            onClick={() => {
              setIsEntityLoading(true);
              setCurrentTab(2);
              setFilter(Ownership.OWNER);
              setCurrentPage(1);
            }}>
            My Data
          </button>
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(3)}`}
            data-testid="tab"
            id="followingTab"
            onClick={() => {
              setIsEntityLoading(true);
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
    fetchTableData(!isMounted.current);
  }, [currentPage, filter]);

  useEffect(() => {
    isMounted.current = true;
    getAllServices()
      .then((res) => setCountServices(res.length))
      .catch(() => setCountServices(0));
  }, []);

  return (
    <>
      {error ? (
        <ErrorPlaceHolderES errorMessage={error} type="error" />
      ) : (
        <>
          {isLoading ? (
            <Loader />
          ) : (
            <PageContainer>
              <div className="container-fluid" data-testid="fluid-container">
                <MyDataHeader
                  countAssets={getTotalEntityCountByService(
                    aggregations?.['sterms#Service']?.buckets as Bucket[]
                  )}
                  countServices={countServices}
                  entityCounts={getEntityCountByService(
                    aggregations?.['sterms#Service']?.buckets as Bucket[]
                  )}
                />
                {getTabs()}
                <SearchedData
                  showOnboardingTemplate
                  currentPage={currentPage}
                  data={data}
                  isLoading={isEntityLoading}
                  paginate={paginate}
                  searchText="*"
                  showOnlyChildren={currentTab === 1}
                  showResultCount={filter && data.length > 0 ? true : false}
                  totalValue={totalNumberOfValue}>
                  {currentTab === 1 ? <RecentlyViewed /> : null}
                </SearchedData>
              </div>
            </PageContainer>
          )}
        </>
      )}
    </>
  );
};

export default observer(MyDataPage);
