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

import { FormatedTableData } from 'Models';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Ownership } from '../../enums/mydata.enum';
import { formatDataResponse } from '../../utils/APIUtils';
import ErrorPlaceHolderES from '../common/error-with-placeholder/ErrorPlaceHolderES';
import PageLayout from '../containers/PageLayout';
import EntityList from '../EntityList/EntityList';
import MyAssetStats from '../MyAssetStats/MyAssetStats.component';
import RecentlyViewed from '../recently-viewed/RecentlyViewed';
import RecentSearchedTerms from '../RecentSearchedTerms/RecentSearchedTerms';
import SearchedData from '../searched-data/SearchedData';
import { MyDataProps } from './MyData.interface';

const MyData: React.FC<MyDataProps> = ({
  error,
  countServices,
  ingestionCount,
  searchResult,
  ownedData,
  followedData,
  entityCounts,
}: MyDataProps): React.ReactElement => {
  const [data, setData] = useState<Array<FormatedTableData>>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalNumberOfValue, setTotalNumberOfValues] = useState<number>(0);
  const [isEntityLoading, setIsEntityLoading] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<number>(1);
  const [filter, setFilter] = useState<string>('');

  const isMounted = useRef(false);

  const getActiveTabClass = (tab: number) => {
    return tab === currentTab ? 'active' : '';
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
      <div className="tw-mb-3" data-testid="tabs">
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

  const getLeftPanel = () => {
    return (
      <div className="tw-mt-5">
        <MyAssetStats
          countServices={countServices}
          entityCounts={entityCounts}
          ingestionCount={ingestionCount}
        />
        <div className="tw-filter-seperator" />
        <RecentlyViewed />
        <div className="tw-filter-seperator tw-mt-3" />
        <RecentSearchedTerms />
        <div className="tw-filter-seperator tw-mt-3" />
      </div>
    );
  };

  const getRightPanel = useCallback(() => {
    return (
      <div className="tw-mt-5">
        <EntityList
          entityList={ownedData}
          headerText={
            <div className="tw-flex tw-justify-between">
              My Data
              {ownedData.length ? (
                <span className="link-text tw-font-light tw-text-xs">
                  View All
                </span>
              ) : null}
            </div>
          }
          noDataPlaceholder={<>You have not owned anything yet!</>}
        />
        <div className="tw-filter-seperator tw-mt-3" />
        <EntityList
          entityList={followedData}
          headerText={
            <div className="tw-flex tw-justify-between">
              Following
              {followedData.length ? (
                <span className="link-text tw-font-light tw-text-xs">
                  View All
                </span>
              ) : null}
            </div>
          }
          noDataPlaceholder={<>You have not followed anything yet!</>}
        />
        <div className="tw-filter-seperator tw-mt-3" />
      </div>
    );
  }, [ownedData, followedData]);

  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  useEffect(() => {
    if (searchResult) {
      const hits = searchResult.data.hits.hits;
      if (hits.length > 0) {
        setTotalNumberOfValues(searchResult.data.hits.total.value);
        setData(formatDataResponse(hits));
      } else {
        setData([]);
        setTotalNumberOfValues(0);
      }
    }

    setIsEntityLoading(false);
  }, [searchResult]);

  useEffect(() => {
    isMounted.current = true;
  }, []);

  return (
    <PageLayout leftPanel={getLeftPanel()} rightPanel={getRightPanel()}>
      {getTabs()}
      {error && Boolean(currentTab === 2 || currentTab === 3) ? (
        <ErrorPlaceHolderES errorMessage={error} type="error" />
      ) : (
        <SearchedData
          showOnboardingTemplate
          currentPage={currentPage}
          data={data}
          isLoading={currentTab === 1 ? false : isEntityLoading}
          paginate={paginate}
          searchText="*"
          showOnlyChildren={currentTab === 1}
          showResultCount={filter && data.length > 0 ? true : false}
          totalValue={totalNumberOfValue}
        />
      )}
    </PageLayout>
  );
};

export default MyData;
