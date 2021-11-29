import { observer } from 'mobx-react';
import { SearchResponse } from 'Models';
import React, { useEffect, useState } from 'react';
import AppState from '../../AppState';
import Explore from '../../components/Explore/Explore.component';
import { ExploreSearchData } from '../../components/Explore/explore.interface';
import MyData from '../../components/MyData/MyData.component';
import Tour from '../../components/tour/Tour';
import { useTour } from '../../hooks/useTour';
import data from './mockData.json';

const mockData = {
  data: { hits: { hits: [] } },
};

const exploreSearchData = data as unknown as ExploreSearchData;

const exploreCount = {
  table: 4,
  topic: 0,
  dashboard: 0,
  pipeline: 0,
  dbtModel: 0,
};

const TourPage = () => {
  const { handleIsTourOpen } = useTour();
  const [myDataSearchResult, setMyDataSearchResult] = useState(mockData);
  const [exploreSearchResult, setExploreSearchResult] =
    useState(exploreSearchData);
  const [showExplore, setShowExplore] = useState(AppState.toggleExplore);
  const [explorePageCounts, setExplorePageCounts] = useState(exploreCount);

  const handleCountChange = () => {
    setExplorePageCounts(exploreCount);
  };

  useEffect(() => {
    handleIsTourOpen(true);
  }, []);

  useEffect(() => {
    setShowExplore(AppState.toggleExplore);
  }, [AppState.toggleExplore]);

  return (
    <div>
      <Tour />
      {!showExplore ? (
        <MyData
          countServices={4}
          entityCounts={{
            tableCount: 21,
            topicCount: 20,
            dashboardCount: 10,
            pipelineCount: 8,
          }}
          error=""
          fetchData={() => {
            setMyDataSearchResult(mockData);
          }}
          ingestionCount={0}
          searchResult={myDataSearchResult as unknown as SearchResponse}
          userDetails={AppState.userDetails}
        />
      ) : (
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
      )}
    </div>
  );
};

export default observer(TourPage);
