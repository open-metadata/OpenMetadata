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

import Analytics, { AnalyticsInstance } from 'analytics';
import { postPageView } from '../axiosAPIs/WebAnalyticsAPI';
import { WebPageData } from '../components/WebAnalytics/WebAnalytics.interface';
import {
  WebAnalyticEventData,
  WebAnalyticEventType,
} from '../generated/analytics/webAnalyticEventData';
import { PageViewEvent } from '../generated/analytics/webAnalyticEventType/pageViewEvent';

/**
 * Check if url is valid or not and return the pathname
 * @param referrerURL referrer URL
 * @returns pathname
 */
export const getReferrerPath = (referrerURL: string) => {
  try {
    const referrerURLObj = new URL(referrerURL);

    return referrerURLObj.pathname;
  } catch {
    return '';
  }
};

/**
 * Calculate the page load time and then convert it into seconds
 * @param performance
 * @returns pageLoadTime (in S)
 */
export const getPageLoadTime = (performance: Performance) => {
  // get the performance navigation timing
  const performanceNavigationTiming = performance.getEntriesByType(
    'navigation'
  )[0] as PerformanceNavigationTiming;

  return (
    (performanceNavigationTiming.loadEventEnd -
      performanceNavigationTiming.loadEventStart) /
    1000
  );
};

/**
 * track the page view if user id is available.
 * @param pageData PageData
 * @param userId string
 */
export const trackPageView = async (pageData: WebPageData, userId: string) => {
  const { payload } = pageData;

  const { location, navigator, performance, document } = window;
  const { hostname } = location;

  const pageLoadTime = getPageLoadTime(performance);

  const { anonymousId, properties, meta } = payload;

  const referrer = properties.referrer ?? document.referrer;

  // timestamp for the current event
  const timestamp = meta.ts;

  if (userId) {
    const pageViewEvent: PageViewEvent = {
      fullUrl: properties.url,
      url: properties.path,
      hostname,
      language: navigator.language,
      screenSize: `${properties.width}x${properties.height}`,
      userId,
      sessionId: anonymousId,
      referrer,
      pageLoadTime,
    };

    const webAnalyticEventData: WebAnalyticEventData = {
      eventType: WebAnalyticEventType.PageView,
      eventData: pageViewEvent,
      timestamp,
    };

    try {
      // collect the page event
      await postPageView(webAnalyticEventData);
    } catch (_error) {
      // handle page view error
    }
  }
};

/**
 *
 * @param userId string
 * @returns AnalyticsInstance
 */
export const getAnalyticInstance = (userId: string): AnalyticsInstance => {
  return Analytics({
    app: 'OpenMetadata',
    plugins: [
      {
        name: 'OM-Plugin',
        page: (pageData: WebPageData) => {
          trackPageView(pageData, userId);
        },
      },
    ],
  });
};
