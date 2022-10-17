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

import Analytics, { AnalyticsInstance, PageData } from 'analytics';

/**
 * track the page view if user id is available.
 * @param _pageData PageData
 * @param userId string
 */
export const trackPageView = (_pageData: PageData, userId: string) => {
  if (userId) {
    // make an api call to collect the data
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
        page: (pageData: PageData) => {
          trackPageView(pageData, userId);
        },
      },
    ],
  });
};
