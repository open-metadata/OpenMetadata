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

import { isEmpty } from 'lodash';
import { Bucket, FormatedTableData, Sterm } from 'Models';
import React, { useEffect, useRef, useState } from 'react';
import { Ownership } from '../../enums/mydata.enum';
import { formatDataResponse } from '../../utils/APIUtils';
import { getCurrentUserId } from '../../utils/CommonUtils';
import { getEntityCountByService } from '../../utils/ServiceUtils';
import ErrorPlaceHolderES from '../common/error-with-placeholder/ErrorPlaceHolderES';
import PageContainer from '../containers/PageContainer';
import Loader from '../Loader/Loader';
import MyDataHeader from '../my-data/MyDataHeader';
import RecentlyViewed from '../recently-viewed/RecentlyViewed';
import SearchedData from '../searched-data/SearchedData';
import { MyDataProps } from './MyData.interface';

const MyData: React.FC<MyDataProps> = ({
  countServices,
  userDetails,
  searchResult,
  fetchData,
  error,
}: MyDataProps): React.ReactElement => {
  const [data, setData] = useState<Array<FormatedTableData>>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalNumberOfValue, setTotalNumberOfValues] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEntityLoading, setIsEntityLoading] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<number>(1);
  const [filter, setFilter] = useState<string>('');
  const [aggregations, setAggregations] = useState<Record<string, Sterm>>();
  const [searchIndex] = useState<string>(
    'dashboard_search_index,topic_search_index,table_search_index,pipeline_search_index'
  );
  const isMounted = useRef<boolean>(false);
  const setAssetCount = useRef<boolean>(true);

  const getActiveTabClass = (tab: number) => {
    return tab === currentTab ? 'active' : '';
  };

  const getFilters = (): string => {
    if (filter === 'owner' && userDetails.teams) {
      const userTeams = !isEmpty(userDetails)
        ? userDetails.teams.map((team) => `${filter}:${team.id}`)
        : [];
      const ownerIds = [...userTeams, `${filter}:${getCurrentUserId()}`];

      return `(${ownerIds.join(' OR ')})`;
    }

    return `${filter}:${getCurrentUserId()}`;
  };

  const fetchTableData = () => {
    if (!isEntityLoading) {
      setIsLoading(true);
    }

    fetchData({
      queryString: '',
      from: currentPage,
      filters: filter ? getFilters() : '',
      sortField: '',
      sortOrder: '',
      searchIndex: searchIndex,
    });
  };

  const handleTabChange = (tab: number, filter: string) => {
    if (currentTab !== tab) {
      setIsEntityLoading(true);
      setCurrentTab(tab);
      setFilter(filter);
      setCurrentPage(1);
    }
  };

  const getTabs = () => {
    return (
      <div className="tw-mb-3 tw--mt-4" data-testid="tabs">
        <nav className="tw-flex tw-flex-row tw-gh-tabs-container tw-px-4">
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(1)}`}
            data-testid="tab"
            id="recentlyViewedTab"
            onClick={() => handleTabChange(1, '')}>
            Recently Viewed
          </button>
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(2)}`}
            data-testid="tab"
            id="myDataTab"
            onClick={() => handleTabChange(2, Ownership.OWNER)}>
            My Data
          </button>
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(3)}`}
            data-testid="tab"
            id="followingTab"
            onClick={() => handleTabChange(3, Ownership.FOLLOWERS)}>
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
    setAssetCount.current = !isMounted.current;
    fetchTableData();
  }, [currentPage, filter]);

  useEffect(() => {
    if (searchResult) {
      const hits = searchResult.data.hits.hits;
      if (hits.length > 0) {
        setTotalNumberOfValues(searchResult.data.hits.total.value);
        setData(formatDataResponse(hits));
        if (setAssetCount.current) {
          setAggregations(searchResult.data.aggregations);
          setAssetCount.current = false;
        }
        setIsLoading(false);
        setIsEntityLoading(false);
      } else {
        setData([]);
        setTotalNumberOfValues(0);
        setIsLoading(false);
        setIsEntityLoading(false);
      }
    } else {
      setIsLoading(false);
      setIsEntityLoading(false);
    }
  }, [searchResult]);

  useEffect(() => {
    isMounted.current = true;
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

export default MyData;
