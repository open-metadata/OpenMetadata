/*
 *  Copyright 2022 Collate.
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

import DatasetDetails from 'components/DatasetDetails/DatasetDetails.component';
import { LeafNodes } from 'components/EntityLineage/EntityLineage.interface';
import Explore from 'components/Explore/Explore.component';
import MyData from 'components/MyData/MyData.component';
import { MyDataProps } from 'components/MyData/MyData.interface';
import NavBar from 'components/nav-bar/NavBar';
import Tour from 'components/tour/Tour';
import { noop } from 'lodash';
import { observer } from 'mobx-react';
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AppState from '../../AppState';
import { ROUTES, TOUR_SEARCH_TERM } from '../../constants/constants';
import {
  INITIAL_SORT_FIELD,
  INITIAL_SORT_ORDER,
} from '../../constants/explore.constants';
import {
  mockDatasetData,
  mockFeedData,
  mockSearchData as exploreSearchData,
} from '../../constants/mockTourData.constants';
import { SearchIndex } from '../../enums/search.enum';
import { CurrentTourPageType } from '../../enums/tour.enum';
import {
  Table,
  TableJoins,
  TableType,
  UsageDetails,
} from '../../generated/entity/data/table';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
import { useTour } from '../../hooks/useTour';
import { getSteps } from '../../utils/TourUtils';

const exploreCount = {
  [SearchIndex.TABLE]: 4,
  [SearchIndex.TOPIC]: 0,
  [SearchIndex.DASHBOARD]: 0,
  [SearchIndex.PIPELINE]: 0,
  [SearchIndex.MLMODEL]: 0,
};

const TourPage = () => {
  const location = useLocation();
  const { handleIsTourOpen } = useTour();
  const [currentPage, setCurrentPage] = useState<CurrentTourPageType>(
    AppState.currentTourPage
  );
  const [myDataSearchResult, setMyDataSearchResult] = useState(mockFeedData);
  const [datasetActiveTab, setdatasetActiveTab] = useState(
    AppState.activeTabforTourDatasetPage
  );
  const [explorePageCounts, setExplorePageCounts] = useState(exploreCount);
  const [searchValue, setSearchValue] = useState('');

  const handleCountChange = async () => {
    setExplorePageCounts(exploreCount);
  };

  const mockPromiseFunction = (): Promise<void> => {
    return new Promise<void>((resolve) => resolve());
  };

  const clearSearchTerm = () => {
    setSearchValue('');
  };

  const handleSearch = () => {
    if (location.pathname.includes(ROUTES.TOUR)) {
      if (searchValue === TOUR_SEARCH_TERM) {
        AppState.currentTourPage = CurrentTourPageType.EXPLORE_PAGE;
        clearSearchTerm();
      }

      return;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
  const handleOnClick = () => {
    handleSearch();
  };

  useEffect(() => {
    handleIsTourOpen(true);
    AppState.currentTourPage = CurrentTourPageType.MY_DATA_PAGE;
    AppState.activeTabforTourDatasetPage = 1;
  }, []);

  useEffect(() => {
    setCurrentPage(AppState.currentTourPage);
  }, [AppState.currentTourPage]);

  useEffect(() => {
    setdatasetActiveTab(AppState.activeTabforTourDatasetPage);
  }, [AppState.activeTabforTourDatasetPage]);

  const getCurrentPage = (page: CurrentTourPageType) => {
    switch (page) {
      case CurrentTourPageType.MY_DATA_PAGE:
        return (
          <MyData
            data={{
              entityCounts: {
                tableCount: 21,
                topicCount: 20,
                dashboardCount: 10,
                pipelineCount: 8,
                mlmodelCount: 2,
                servicesCount: 4,
                userCount: 100,
                teamCount: 7,
                testSuiteCount: 2,
              },
            }}
            error=""
            feedData={myDataSearchResult as MyDataProps['feedData']}
            fetchData={() => {
              setMyDataSearchResult(mockFeedData);
            }}
            fetchFeedHandler={handleOnClick}
            followedData={[]}
            followedDataCount={1}
            isFeedLoading={false}
            isLoadingOwnedData={false}
            ownedData={[]}
            ownedDataCount={1}
            paging={{} as Paging}
            pendingTaskCount={0}
            postFeedHandler={handleOnClick}
            updateThreadHandler={handleOnClick}
            userDetails={AppState.userDetails}
          />
        );

      case CurrentTourPageType.EXPLORE_PAGE:
        return (
          <Explore
            searchIndex={SearchIndex.TABLE}
            searchResults={exploreSearchData}
            showDeleted={false}
            sortOrder={INITIAL_SORT_ORDER}
            sortValue={INITIAL_SORT_FIELD}
            tabCounts={explorePageCounts}
            onChangeAdvancedSearchQueryFilter={noop}
            onChangePostFilter={noop}
            onChangeSearchIndex={noop}
            onChangeShowDeleted={noop}
            onChangeSortOder={noop}
            onChangeSortValue={noop}
          />
        );

      case CurrentTourPageType.DATASET_PAGE:
        return (
          <DatasetDetails
            activeTab={datasetActiveTab}
            addLineageHandler={mockPromiseFunction}
            columns={mockDatasetData.columns as unknown as Table['columns']}
            columnsUpdateHandler={handleCountChange}
            createThread={handleCountChange}
            datasetFQN={mockDatasetData.datasetFQN}
            deletePostHandler={handleCountChange}
            description={mockDatasetData.description}
            descriptionUpdateHandler={handleCountChange}
            entityFieldTaskCount={[]}
            entityFieldThreadCount={[]}
            entityLineage={mockDatasetData.entityLineage}
            entityLineageHandler={handleCountChange}
            entityName={mockDatasetData.entityName}
            entityThread={mockFeedData}
            feedCount={0}
            fetchFeedHandler={handleCountChange}
            followTableHandler={handleCountChange}
            followers={mockDatasetData.followers}
            handleExtensionUpdate={handleCountChange}
            isNodeLoading={{
              id: undefined,
              state: false,
            }}
            isentityThreadLoading={false}
            joins={mockDatasetData.joins as unknown as TableJoins}
            lineageLeafNodes={{} as LeafNodes}
            loadNodeHandler={handleCountChange}
            owner={undefined as unknown as EntityReference}
            paging={{} as Paging}
            postFeedHandler={handleCountChange}
            removeLineageHandler={handleCountChange}
            sampleData={mockDatasetData.sampleData}
            setActiveTabHandler={(tab) => setdatasetActiveTab(tab)}
            settingsUpdateHandler={() => Promise.resolve()}
            slashedTableName={mockDatasetData.slashedTableName}
            tableDetails={mockDatasetData.tableDetails as unknown as Table}
            tableProfile={
              mockDatasetData.tableProfile as unknown as Table['profile']
            }
            tableQueries={[]}
            tableTags={mockDatasetData.tableTags}
            tableType={mockDatasetData.tableType as TableType}
            tagUpdateHandler={handleCountChange}
            tier={'' as unknown as TagLabel}
            unfollowTableHandler={handleCountChange}
            updateThreadHandler={handleOnClick}
            usageSummary={
              mockDatasetData.usageSummary as unknown as UsageDetails
            }
            versionHandler={handleCountChange}
          />
        );

      default:
        return;
    }
  };

  return (
    <div>
      <NavBar
        isTourRoute
        handleFeatureModal={handleCountChange}
        handleKeyDown={handleKeyDown}
        handleOnClick={handleOnClick}
        handleSearchBoxOpen={handleCountChange}
        handleSearchChange={(value) => setSearchValue(value)}
        isFeatureModalOpen={false}
        isSearchBoxOpen={false}
        pathname={location.pathname}
        profileDropdown={[]}
        searchValue={searchValue}
        supportDropdown={[]}
        username="User"
      />
      <Tour steps={getSteps(TOUR_SEARCH_TERM, clearSearchTerm)} />
      {getCurrentPage(currentPage)}
    </div>
  );
};

export default observer(TourPage);
