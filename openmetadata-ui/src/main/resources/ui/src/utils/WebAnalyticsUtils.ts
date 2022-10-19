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
import { WebPageData } from '../components/WebAnalytics/WebAnalytics.interface';

/**
 * track the page view if user id is available.
 * @param _pageData PageData
 * @param userId string
 */
export const trackPageView = (pageData: WebPageData, userId: string) => {
  const { location, navigator } = window;
  const { hostname, pathname } = location;

  // store the current path
  let currentPathRef = pathname;

  if (userId) {
    const { payload } = pageData;

    const { anonymousId, properties } = payload;

    // get the previous page url
    const previousURL = new URL(properties.referrer);

    /**
     *  Check if the previous path and current path is not matching
     *  then only collect the data
     */
    if (currentPathRef !== previousURL.pathname) {
      currentPathRef = properties.path;

      const eventData = {
        fullUrl: properties.url,
        url: properties.path,
        hostname,
        language: navigator.language,
        screenSize: `${properties.width}x${properties.height}`,
        userId,
        sessionId: anonymousId,
        referrer: properties.referrer,
      };

      // TODO: make an api call to collect the data once backend API is ready and remove the console log
      // eslint-disable-next-line
      console.log(eventData);
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
