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

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Tour from '../../components/AppTour/Tour';
import { TOUR_SEARCH_TERM } from '../../constants/constants';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { CurrentTourPageType } from '../../enums/tour.enum';
import { getTourSteps } from '../../utils/TourUtils';
import ExplorePageV1Component from '../ExplorePage/ExplorePageV1.component';
import MyDataPage from '../MyDataPage/MyDataPage.component';
import TableDetailsPageV1 from '../TableDetailsPageV1/TableDetailsPageV1';

const TourPage = () => {
  const {
    updateIsTourOpen,
    currentTourPage,
    updateActiveTab,
    updateTourPage,
    updateTourSearch,
  } = useTourProvider();
  const { t } = useTranslation();
  const [isTourReady, setIsTourReady] = useState(false);

  const clearSearchTerm = () => {
    updateTourSearch('');
  };

  useEffect(() => {
    updateIsTourOpen(true);

    const markTourReady = () => {
      const feedWidget = document.querySelector('#feedWidgetData');
      const feedWidgetRect = feedWidget?.getBoundingClientRect();

      if (feedWidgetRect?.width && feedWidgetRect.height) {
        setIsTourReady(true);

        return true;
      }

      return false;
    };

    function scheduleTourReadyCheck() {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(() => {
        if (markTourReady()) {
          observer.disconnect();
        }
      });
    }
    let animationFrameId = 0;
    const observer = new MutationObserver(() => scheduleTourReadyCheck());

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    scheduleTourReadyCheck();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      observer.disconnect();
    };
  }, []);

  const currentPageComponent = useMemo(() => {
    switch (currentTourPage) {
      case CurrentTourPageType.MY_DATA_PAGE:
        return <MyDataPage />;

      case CurrentTourPageType.EXPLORE_PAGE:
        return <ExplorePageV1Component pageTitle={t('label.explore')} />;

      case CurrentTourPageType.DATASET_PAGE:
        return <TableDetailsPageV1 />;

      default:
        return;
    }
  }, [currentTourPage]);

  return (
    <>
      {currentPageComponent}
      {isTourReady && (
        <Tour
          steps={getTourSteps({
            searchTerm: TOUR_SEARCH_TERM,
            clearSearchTerm,
            updateActiveTab,
            updateTourPage,
          })}
        />
      )}
    </>
  );
};

export default TourPage;
