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
import {
  ExploreSearchIndex,
  SearchHitCounts,
} from '../../components/Explore/ExplorePage.interface';
import { TOUR_SEARCH_TERM } from '../../constants/constants';
import {
  mockDatasetData,
  mockSearchData,
  MOCK_EXPLORE_PAGE_COUNT,
} from '../../constants/mockTourData.constants';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { EntityTabs } from '../../enums/entity.enum';
import { CurrentTourPageType } from '../../enums/tour.enum';
import { SearchResponse } from '../../interface/search.interface';
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
    updateTourMockData,
  } = useTourProvider();
  const { t } = useTranslation();
  const [isTourReady, setIsTourReady] = useState(false);

  const clearSearchTerm = useCallback(() => {
    updateTourSearch('');
  }, [updateTourSearch]);

  // Seed mock data on mount so tour-aware pages read it from the provider
  // instead of each one fetching the chunk via a dynamic import that races
  // react-tour's stepWaitTimer.
  useEffect(() => {
    updateTourMockData?.({
      searchResults:
        mockSearchData as unknown as SearchResponse<ExploreSearchIndex>,
      searchHitCounts: MOCK_EXPLORE_PAGE_COUNT as SearchHitCounts,
      datasetData: mockDatasetData,
    });
  }, [updateTourMockData]);

  // Reset on /tour entry — react-tour's stepIndex resets on remount but
  // TourProvider state persists across the SPA session; keep them in sync.
  useEffect(() => {
    updateTourPage(CurrentTourPageType.MY_DATA_PAGE);
    updateActiveTab(EntityTabs.SCHEMA);
  }, [updateTourPage, updateActiveTab]);

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

  const isExplorePage = currentTourPage === CurrentTourPageType.EXPLORE_PAGE;
  // Pre-mount Explore (hidden) during the MyData phase so it stays mounted into
  // the Explore step — react-tour closes a step whose target is missing on
  // activation, and the redesigned Explore can't mount within its stepWaitTimer.
  const shouldRenderExplore =
    currentTourPage === CurrentTourPageType.MY_DATA_PAGE || isExplorePage;
  const exploreStyle = useMemo(
    () => ({ display: isExplorePage ? undefined : 'none' }),
    [isExplorePage]
  );

  const currentPageComponent = useMemo(() => {
    return (
      <>
        {currentTourPage === CurrentTourPageType.MY_DATA_PAGE && <MyDataPage />}
        {shouldRenderExplore && (
          <div style={exploreStyle}>
            <ExplorePageV1Component pageTitle={t('label.explore')} />
          </div>
        )}
        {currentTourPage === CurrentTourPageType.DATASET_PAGE && (
          <TableDetailsPageV1 />
        )}
      </>
    );
  }, [currentTourPage, shouldRenderExplore, exploreStyle, t]);

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
