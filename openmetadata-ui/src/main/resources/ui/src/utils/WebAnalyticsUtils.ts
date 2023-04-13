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

import {
  getSession,
  removeSession,
  setSession,
} from '@analytics/session-utils';
import Analytics, { AnalyticsInstance } from 'analytics';
import { AnalyticsData } from 'components/WebAnalytics/WebAnalytics.interface';
import {
  CustomEvent,
  CustomEventTypes,
} from 'generated/analytics/webAnalyticEventType/customEvent';
import { postWebAnalyticEvent } from 'rest/WebAnalyticsAPI';
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

const handlePostAnalytic = async (
  webAnalyticEventData: WebAnalyticEventData
) => {
  try {
    /**
     * extend the session expiry if user continues to interact
     * Let say expiry is at "5:45:23 PM", and user spent some time and then
     * interact with other page in 2 minutes so expiry time will be extended to "5:47:23 PM"
     */
    setSession(30, {}, true);

    // collect the event data
    await postWebAnalyticEvent(webAnalyticEventData);
  } catch (_error) {
    // silently ignore the error
  }
};

/**
 * track the page view if user id is available.
 * @param pageData PageData
 * @param userId string
 */
export const trackPageView = (pageData: AnalyticsData, userId: string) => {
  // Get the current session
  const currentSession = getSession();

  const { payload } = pageData;

  const { location, navigator, performance, document } = window;
  const { hostname } = location;

  const pageLoadTime = getPageLoadTime(performance);

  const { properties, meta } = payload;

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
      sessionId: currentSession.id,
      referrer,
      pageLoadTime,
    };

    const webAnalyticEventData: WebAnalyticEventData = {
      eventType: WebAnalyticEventType.PageView,
      eventData: pageViewEvent,
      timestamp,
    };

    handlePostAnalytic(webAnalyticEventData);
  }
};

export const trackCustomEvent = (eventData: AnalyticsData) => {
  // Get the current session
  const currentSession = getSession();

  const { payload } = eventData;

  const { meta, event: eventValue } = payload;
  const { location } = window;

  // timestamp for the current event
  const timestamp = meta.ts;

  const customEventData: CustomEvent = {
    url: location.pathname,
    fullUrl: location.href,
    hostname: location.hostname,
    eventType: CustomEventTypes.Click,
    sessionId: currentSession.id,
    eventValue,
  };

  const webAnalyticEventData: WebAnalyticEventData = {
    eventType: WebAnalyticEventType.CustomEvent,
    eventData: customEventData,
    timestamp,
  };

  handlePostAnalytic(webAnalyticEventData);
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
        page: (pageData: AnalyticsData) => {
          trackPageView(pageData, userId);
        },
        track: (trackingData: AnalyticsData) => {
          trackCustomEvent(trackingData);
        },
      },
    ],
  });
};

export const resetWebAnalyticSession = () => {
  // remove existing session first
  removeSession();

  // then set new analytics session for 30 minutes
  setSession(30);
};
