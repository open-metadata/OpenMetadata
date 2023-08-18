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

import { AnalyticsData } from 'components/WebAnalytics/WebAnalytics.interface';
import { postWebAnalyticEvent } from 'rest/WebAnalyticsAPI';
import {
  getAnalyticInstance,
  getReferrerPath,
  trackCustomEvent,
} from './WebAnalyticsUtils';

const userId = 'userId';

jest.mock('rest/WebAnalyticsAPI', () => ({
  postWebAnalyticEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('@analytics/session-utils', () => ({
  ...jest.requireActual('@analytics/session-utils'),
  getSession: jest
    .fn()
    .mockReturnValue({ id: '19c85e4f-7679-4fba-813f-e72108d914c4' }),
}));

const MOCK_ANALYTICS_DATA: AnalyticsData = {
  payload: {
    type: 'page',
    properties: {
      title: 'OpenMetadata',
      url: 'http://localhost/',
      path: '/',
      hash: '',
      search: '?page=1',
      width: 1440,
      height: 284,
      referrer: 'http://localhost:3000/explore/tables?page=1',
    },
    event: 'Explore',
    meta: {
      rid: '7a14e508-5cbc-4bf9-b922-0607a2ff2aa5',
      ts: 1680246874535,
      hasCallback: true,
    },
    anonymousId: '7a14e508-5cbc-4bf9-b922-0607a2ff2aa5',
  },
};

const CUSTOM_EVENT_PAYLOAD = {
  eventType: 'CustomEvent',
  eventData: {
    url: '/',
    fullUrl: 'http://localhost/',
    hostname: 'localhost',
    eventType: 'CLICK',
    sessionId: '19c85e4f-7679-4fba-813f-e72108d914c4',
    eventValue: 'Explore',
  },
  timestamp: 1680246874535,
};

const mockReferrer =
  'http://localhost:3000/settings/members/teams/Organization';

describe('Web Analytics utils', () => {
  it('getAnalyticInstance Should return the analytic instance and must have plugins, storage, page and setAnonymousId property', () => {
    const instance = getAnalyticInstance(userId);

    expect(instance).toHaveProperty('plugins');

    expect(instance).toHaveProperty('storage');

    expect(instance).toHaveProperty('page');

    expect(instance).toHaveProperty('setAnonymousId');
  });

  it('getReferrerPath should return pathname if url is correct', () => {
    const pathname = getReferrerPath(mockReferrer);

    expect(pathname).toBe('/settings/members/teams/Organization');
  });

  it('getReferrerPath should return empty string if url is incorrect', () => {
    const pathname = getReferrerPath('incorrectURL');

    expect(pathname).toBe('');
  });

  it('trackCustomEvent should call postWebAnalyticEvent', () => {
    trackCustomEvent(MOCK_ANALYTICS_DATA);

    expect(postWebAnalyticEvent).toHaveBeenCalledWith(CUSTOM_EVENT_PAYLOAD);
  });
});
