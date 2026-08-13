/*
 *  Copyright 2025 Collate.
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

import axiosClient from '.';
import {
  getActivityEvents,
  getFollowingActivityFeed,
  getMyActivityFeed,
} from './feedsAPI';

jest.mock('.');

const mockedGet = axiosClient.get as jest.MockedFunction<
  typeof axiosClient.get
>;

const mockActivityResponse = {
  data: {
    data: [{ id: 'activity-1', summary: 'Updated tags' }],
    paging: { total: 1 },
  },
};

describe('feedsAPI activity endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue(mockActivityResponse as never);
  });

  // Each home Activity Feed widget filter maps to a distinct endpoint. Asserting
  // the exact paths here is what stops a filter silently reusing another's feed.
  // Domain scoping is not passed by any caller — the withDomainFilter
  // interceptor appends it to every GET.
  it('should request the unscoped activity feed for the All filter', async () => {
    const result = await getActivityEvents({ limit: 10 });

    expect(mockedGet).toHaveBeenCalledWith('/activity', {
      params: { limit: 10 },
    });
    expect(result).toEqual(mockActivityResponse.data);
  });

  it('should request the my-feed endpoint for the Owner filter', async () => {
    const result = await getMyActivityFeed({ limit: 10 });

    expect(mockedGet).toHaveBeenCalledWith('/activity/my-feed', {
      params: { limit: 10 },
    });
    expect(result).toEqual(mockActivityResponse.data);
  });

  it('should request the following endpoint for the Follows filter', async () => {
    const result = await getFollowingActivityFeed({
      days: 7,
      limit: 10,
    });

    expect(mockedGet).toHaveBeenCalledWith('/activity/following', {
      params: { days: 7, limit: 10 },
    });
    expect(result).toEqual(mockActivityResponse.data);
  });

  it('should request the following endpoint without params when none are given', async () => {
    await getFollowingActivityFeed();

    expect(mockedGet).toHaveBeenCalledWith('/activity/following', {
      params: undefined,
    });
  });
});
