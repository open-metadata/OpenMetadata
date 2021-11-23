import { SearchResponse } from 'Models';
import React, { useEffect, useState } from 'react';
import AppState from '../../AppState';
import MyData from '../../components/MyData/MyData.component';
import Tour from '../../components/tour/Tour';
import { useTour } from '../../hooks/useTour';

const mockData = {
  data: { hits: { hits: [] } },
};

const TourPage = () => {
  const { handleIsTourOpen } = useTour();
  const [searchResult, setSearchResult] = useState(mockData);
  const [showExplore, setShowExplore] = useState(AppState.toggleExplore);

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
            setSearchResult(mockData);
          }}
          ingestionCount={0}
          searchResult={searchResult as unknown as SearchResponse}
          userDetails={AppState.userDetails}
        />
      ) : (
        <p>explore</p>
      )}
    </div>
  );
};

export default TourPage;
