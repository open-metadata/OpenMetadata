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

import { observer } from 'mobx-react';
import React, { useEffect, useMemo } from 'react';
import Tour from '../../components/tour/Tour';
import { useTourProvider } from '../../components/TourProvider/TourProvider';
import { TOUR_SEARCH_TERM } from '../../constants/constants';
import { CurrentTourPageType } from '../../enums/tour.enum';
import ExplorePageV1Component from '../../pages/explore/ExplorePageV1.component';
import MyDataPageV1 from '../../pages/MyDataPage/MyDataPageV1.component';
import TableDetailsPageV1 from '../../pages/TableDetailsPageV1/TableDetailsPageV1';
import { getTourSteps } from '../../utils/TourUtils';

const TourPage = () => {
  const {
    updateIsTourOpen,
    currentTourPage,
    updateActiveTab,
    updateTourPage,
    updateTourSearch,
  } = useTourProvider();

  const clearSearchTerm = () => {
    updateTourSearch('');
  };

  useEffect(() => {
    updateIsTourOpen(true);
  }, []);

  const currentPageComponent = useMemo(() => {
    switch (currentTourPage) {
      case CurrentTourPageType.MY_DATA_PAGE:
        return <MyDataPageV1 />;

      case CurrentTourPageType.EXPLORE_PAGE:
        return <ExplorePageV1Component />;

      case CurrentTourPageType.DATASET_PAGE:
        return <TableDetailsPageV1 />;

      default:
        return;
    }
  }, [currentTourPage]);

  return (
    <>
      <Tour
        steps={getTourSteps({
          searchTerm: TOUR_SEARCH_TERM,
          clearSearchTerm,
          updateActiveTab,
          updateTourPage,
        })}
      />
      {currentPageComponent}
    </>
  );
};

export default observer(TourPage);
