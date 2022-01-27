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

import { observer } from 'mobx-react';
import { LeafNodes, SearchResponse } from 'Models';
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AppState from '../../AppState';
import DatasetDetails from '../../components/DatasetDetails/DatasetDetails.component';
import { DatasetOwner } from '../../components/DatasetDetails/DatasetDetails.interface';
import Explore from '../../components/Explore/Explore.component';
import { ExploreSearchData } from '../../components/Explore/explore.interface';
import MyData from '../../components/MyData/MyData.component';
import { MyDataProps } from '../../components/MyData/MyData.interface';
import NavBar from '../../components/nav-bar/NavBar';
import Tour from '../../components/tour/Tour';
import { ROUTES, TOUR_SEARCH_TERM } from '../../constants/constants';
import {
  mockDatasetData,
  mockFeedData,
  mockSearchData as exploreSearchData,
} from '../../constants/mockTourData.constants';
import { CurrentTourPageType } from '../../enums/tour.enum';
import {
  Table,
  TableJoins,
  TypeUsedToReturnUsageDetailsOfAnEntity,
} from '../../generated/entity/data/table';
import { TagLabel } from '../../generated/type/tagLabel';
import { useTour } from '../../hooks/useTour';
import { getSteps } from '../../utils/TourUtils';

const mockData = {
  data: { hits: { hits: [] } },
};

const exploreCount = {
  table: 4,
  topic: 0,
  dashboard: 0,
  pipeline: 0,
  dbtModel: 0,
};

const TourPage = () => {
  const location = useLocation();
  const { handleIsTourOpen } = useTour();
  const [currentPage, setCurrentPage] = useState<CurrentTourPageType>(
    AppState.currentTourPage
  );
  const [myDataSearchResult, setMyDataSearchResult] = useState(mockData);
  const [exploreSearchResult, setExploreSearchResult] =
    useState(exploreSearchData);
  const [datasetActiveTab, setdatasetActiveTab] = useState(
    AppState.activeTabforTourDatasetPage
  );
  const [explorePageCounts, setExplorePageCounts] = useState(exploreCount);
  const [searchValue, setSearchValue] = useState('');

  const handleCountChange = () => {
    setExplorePageCounts(exploreCount);
  };

  const mockPromiseFunction = (): Promise<void> => {
    return new Promise<void>((resolve) => resolve());
  };

  const clearSearchTerm = () => {
    setSearchValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (location.pathname.includes(ROUTES.TOUR)) {
        if (searchValue === TOUR_SEARCH_TERM) {
          AppState.currentTourPage = CurrentTourPageType.EXPLORE_PAGE;
          clearSearchTerm();
        }

        return;
      }
    }
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
            countServices={4}
            entityCounts={{
              tableCount: 21,
              topicCount: 20,
              dashboardCount: 10,
              pipelineCount: 8,
            }}
            error=""
            feedData={mockFeedData as unknown as MyDataProps['feedData']}
            feedFilter="all"
            feedFilterHandler={() => {
              setMyDataSearchResult(mockData);
            }}
            fetchData={() => {
              setMyDataSearchResult(mockData);
            }}
            followedData={[]}
            ingestionCount={0}
            ownedData={[]}
            searchResult={myDataSearchResult as unknown as SearchResponse}
            userDetails={AppState.userDetails}
          />
        );

      case CurrentTourPageType.EXPLORE_PAGE:
        return (
          <Explore
            error=""
            fetchCount={handleCountChange}
            fetchData={() => setExploreSearchResult(exploreSearchData)}
            handlePathChange={handleCountChange}
            handleSearchText={() => setExploreSearchResult(exploreSearchData)}
            searchQuery=""
            searchResult={exploreSearchResult as unknown as ExploreSearchData}
            searchText=""
            showDeleted={false}
            sortValue=""
            tab=""
            tabCounts={explorePageCounts}
            updateDashboardCount={handleCountChange}
            updateDbtModelCount={handleCountChange}
            updatePipelineCount={handleCountChange}
            updateTableCount={handleCountChange}
            updateTopicCount={handleCountChange}
            onShowDeleted={() => {
              return;
            }}
          />
        );

      case CurrentTourPageType.DATASET_PAGE:
        return (
          <DatasetDetails
            activeTab={datasetActiveTab}
            addLineageHandler={mockPromiseFunction}
            columns={mockDatasetData.columns as unknown as Table['columns']}
            columnsUpdateHandler={handleCountChange}
            datasetFQN={mockDatasetData.datasetFQN}
            description={mockDatasetData.description}
            descriptionUpdateHandler={handleCountChange}
            entityLineage={mockDatasetData.entityLineage}
            entityLineageHandler={handleCountChange}
            entityName={mockDatasetData.entityName}
            followTableHandler={handleCountChange}
            followers={mockDatasetData.followers}
            isNodeLoading={{
              id: undefined,
              state: false,
            }}
            joins={mockDatasetData.joins as unknown as TableJoins}
            lineageLeafNodes={{} as LeafNodes}
            loadNodeHandler={handleCountChange}
            owner={undefined as unknown as DatasetOwner}
            removeLineageHandler={handleCountChange}
            sampleData={mockDatasetData.sampleData}
            setActiveTabHandler={(tab) => setdatasetActiveTab(tab)}
            settingsUpdateHandler={() => Promise.resolve()}
            slashedTableName={mockDatasetData.slashedTableName}
            tableDetails={mockDatasetData.tableDetails as unknown as Table}
            tableProfile={
              mockDatasetData.tableProfile as unknown as Table['tableProfile']
            }
            tableTags={mockDatasetData.tableTags}
            tier={'' as unknown as TagLabel}
            unfollowTableHandler={handleCountChange}
            usageSummary={
              mockDatasetData.usageSummary as unknown as TypeUsedToReturnUsageDetailsOfAnEntity
            }
            users={[]}
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
        handleSearchBoxOpen={handleCountChange}
        handleSearchChange={(value) => setSearchValue(value)}
        isFeatureModalOpen={false}
        isSearchBoxOpen={false}
        pathname={location.pathname}
        profileDropdown={[]}
        searchValue={searchValue}
        settingDropdown={[]}
        supportDropdown={[]}
      />
      <Tour steps={getSteps(TOUR_SEARCH_TERM, clearSearchTerm)} />
      {getCurrentPage(currentPage)}
    </div>
  );
};

export default observer(TourPage);
