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
import {
  WebAnalyticEventData,
  WebAnalyticEventType,
} from '../generated/analytics/webAnalyticEventData';
import { PageViewEvent } from '../generated/analytics/webAnalyticEventType/pageViewEvent';
import { postWebAnalyticEvent } from '../rest/WebAnalyticsAPI';
import { AnalyticsData } from './../components/WebAnalytics/WebAnalytics.interface';

const handlePostAnalytic = async (
  webAnalyticEventData: WebAnalyticEventData
) => {
  try {
    setSession(30, {}, true);

    await postWebAnalyticEvent(webAnalyticEventData);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error tracking web analytic event:', error);
  }
};

export const trackPageView = (pageData: AnalyticsData, userId?: string) => {
  if (!userId) {
    return;
  }

  const currentSession = getSession();
  const { properties, meta } = pageData.payload;

  const pageViewEvent: PageViewEvent = {
    fullUrl: properties.url,
    url: properties.path,
    userId,
    sessionId: currentSession.id,
  };

  handlePostAnalytic({
    eventType: WebAnalyticEventType.PageView,
    eventData: pageViewEvent,
    timestamp: meta.ts,
  });
};

export const getAnalyticInstance = (userId?: string): AnalyticsInstance => {
  return Analytics({
    app: 'OpenMetadata',
    plugins: [
      {
        name: 'OM-Plugin',
        page: (pageData: AnalyticsData) => {
          trackPageView(pageData, userId);
        },
      },
    ],
  });
};

export const resetWebAnalyticSession = () => {
  removeSession();
  setSession(30);
};
