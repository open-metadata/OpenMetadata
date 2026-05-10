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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Tour from '../../components/AppTour/Tour';
import { TOUR_SEARCH_TERM } from '../../constants/constants';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { CurrentTourPageType } from '../../enums/tour.enum';
import { getTourSteps } from '../../utils/TourUtils';
import ExplorePageV1Component from '../ExplorePage/ExplorePageV1.component';
import MyDataPage from '../MyDataPage/MyDataPage.component';
import TableDetailsPageV1 from '../TableDetailsPageV1/TableDetailsPageV1';

const TOUR_FEED_WIDGET_SELECTOR = '#feedWidgetData';
const REQUIRED_STABLE_LAYOUT_FRAMES = 3;

type TourTargetRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

const getTourFeedWidgetRect = (): TourTargetRect | undefined => {
  const feedWidget = document.querySelector(TOUR_FEED_WIDGET_SELECTOR);
  const feedWidgetRect = feedWidget?.getBoundingClientRect();

  if (!feedWidgetRect?.width || !feedWidgetRect.height) {
    return;
  }

  return {
    height: feedWidgetRect.height,
    left: feedWidgetRect.left,
    top: feedWidgetRect.top,
    width: feedWidgetRect.width,
  };
};

const isSameWidgetRect = (
  currentRect?: TourTargetRect,
  previousRect?: TourTargetRect
) => {
  return (
    currentRect?.height === previousRect?.height &&
    currentRect?.left === previousRect?.left &&
    currentRect?.top === previousRect?.top &&
    currentRect?.width === previousRect?.width
  );
};

const waitForTourFeedWidget = (onReady: () => void) => {
  let animationFrameId = 0;
  let stableLayoutFrames = 0;
  let previousRect: TourTargetRect | undefined;

  const waitForFeedWidget = () => {
    const currentRect = getTourFeedWidgetRect();

    if (currentRect && isSameWidgetRect(currentRect, previousRect)) {
      stableLayoutFrames += 1;
    } else {
      stableLayoutFrames = 0;
    }

    previousRect = currentRect;

    if (stableLayoutFrames >= REQUIRED_STABLE_LAYOUT_FRAMES) {
      onReady();

      return;
    }

    animationFrameId = window.requestAnimationFrame(waitForFeedWidget);
  };

  waitForFeedWidget();

  return () => {
    window.cancelAnimationFrame(animationFrameId);
  };
};

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

  const clearSearchTerm = useCallback(() => {
    updateTourSearch('');
  }, [updateTourSearch]);

  useEffect(() => {
    let tourMountFrameId = 0;
    const cancelFeedWidgetWait = waitForTourFeedWidget(() => {
      updateIsTourOpen(true);
      tourMountFrameId = window.requestAnimationFrame(() => {
        setIsTourReady(true);
      });
    });

    return () => {
      cancelFeedWidgetWait();
      window.cancelAnimationFrame(tourMountFrameId);
    };
  }, [updateIsTourOpen]);

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

  const tourSteps = useMemo(
    () =>
      getTourSteps({
        searchTerm: TOUR_SEARCH_TERM,
        clearSearchTerm,
        updateActiveTab,
        updateTourPage,
      }),
    [clearSearchTerm, updateActiveTab, updateTourPage]
  );

  return (
    <>
      {currentPageComponent}
      {isTourReady && <Tour steps={tourSteps} />}
    </>
  );
};

export default TourPage;
