import React, { useEffect, useState } from 'react';
import AppState from '../../AppState';
import MyData from '../../components/MyData/MyData.component';
import Tour from '../../components/tour/Tour';
import { useTour } from '../../hooks/useTour';
// import MyDataPage from '../../components/LandingPage/MyData.component';

const TourPage = () => {
  const { handleIsTourOpen } = useTour();
  const [searchResult, setSearchResult] = useState(undefined);

  useEffect(() => {
    handleIsTourOpen(true);
  }, []);

  return (
    <div>
      <Tour />
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
          setSearchResult(undefined);
        }}
        searchResult={searchResult}
        userDetails={AppState.userDetails}
      />
    </div>
  );
};

export default TourPage;
