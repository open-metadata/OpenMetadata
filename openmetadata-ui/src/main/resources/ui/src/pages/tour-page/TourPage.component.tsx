import { observer } from 'mobx-react';
import { LeafNodes, SearchResponse } from 'Models';
import React, { useEffect, useState } from 'react';
import AppState from '../../AppState';
import DatasetDetails from '../../components/DatasetDetails/DatasetDetails.component';
import { DatasetOwner } from '../../components/DatasetDetails/DatasetDetails.interface';
import Explore from '../../components/Explore/Explore.component';
import { ExploreSearchData } from '../../components/Explore/explore.interface';
import MyData from '../../components/MyData/MyData.component';
import { MyDataProps } from '../../components/MyData/MyData.interface';
import Tour from '../../components/tour/Tour';
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

  const handleCountChange = () => {
    setExplorePageCounts(exploreCount);
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
            sortValue=""
            tab=""
            tabCounts={explorePageCounts}
            updateDashboardCount={handleCountChange}
            updateDbtModelCount={handleCountChange}
            updatePipelineCount={handleCountChange}
            updateTableCount={handleCountChange}
            updateTopicCount={handleCountChange}
          />
        );

      case CurrentTourPageType.DATASET_PAGE:
        return (
          <DatasetDetails
            activeTab={datasetActiveTab}
            columns={mockDatasetData.columns as unknown as Table['columns']}
            columnsUpdateHandler={handleCountChange}
            datasetFQN={mockDatasetData.datasetFQN}
            description={mockDatasetData.description}
            descriptionUpdateHandler={handleCountChange}
            entityLineage={mockDatasetData.entityLineage}
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
      <Tour />
      {getCurrentPage(currentPage)}
    </div>
  );
};

export default observer(TourPage);
