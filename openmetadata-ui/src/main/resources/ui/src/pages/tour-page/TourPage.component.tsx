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

import Tour from 'components/tour/Tour';
import { EntityTabs } from 'enums/entity.enum';
import { observer } from 'mobx-react';
import ExplorePageV1Component from 'pages/explore/ExplorePageV1.component';
import MyDataPageV1 from 'pages/MyDataPage/MyDataPageV1.component';
import TableDetailsPageV1 from 'pages/TableDetailsPageV1/TableDetailsPageV1';
import React, { useEffect, useState } from 'react';
import AppState from '../../AppState';
import { TOUR_SEARCH_TERM } from '../../constants/constants';
import { CurrentTourPageType } from '../../enums/tour.enum';
import { useTour } from '../../hooks/useTour';
import { getSteps } from '../../utils/TourUtils';

const TourPage = () => {
  const { handleIsTourOpen } = useTour();
  const [currentPage, setCurrentPage] = useState<CurrentTourPageType>(
    AppState.currentTourPage
  );
  const [, setSearchValue] = useState('');

  const clearSearchTerm = () => {
    setSearchValue('');
  };

  useEffect(() => {
    handleIsTourOpen(true);
    AppState.currentTourPage = CurrentTourPageType.MY_DATA_PAGE;
    AppState.activeTabforTourDatasetPage = EntityTabs.SCHEMA;
  }, []);

  useEffect(() => {
    setCurrentPage(AppState.currentTourPage);
  }, [AppState.currentTourPage]);

  const getCurrentPage = (page: CurrentTourPageType) => {
    switch (page) {
      case CurrentTourPageType.MY_DATA_PAGE:
        return <MyDataPageV1 />;

      case CurrentTourPageType.EXPLORE_PAGE:
        return <ExplorePageV1Component />;

      case CurrentTourPageType.DATASET_PAGE:
        return <TableDetailsPageV1 />;

      default:
        return;
    }
  };

  return (
    <>
      <Tour steps={getSteps(TOUR_SEARCH_TERM, clearSearchTerm)} />
      {getCurrentPage(currentPage)}
    </>
  );
};

export default observer(TourPage);
