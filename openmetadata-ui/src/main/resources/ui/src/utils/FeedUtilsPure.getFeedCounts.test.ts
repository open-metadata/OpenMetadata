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
import { FeedCounts } from '../interface/feed.interface';
import { getEntityActivityByFqn, getFeedCount } from '../rest/feedsAPI';
import { getTaskCounts } from '../rest/tasksAPI';
import {
  aggregateFeedCountResponse,
  getFeedCounts,
  getFeedTotalCount,
} from './FeedUtilsPure';

jest.mock('../rest/feedsAPI', () => ({
  getFeedCount: jest.fn(),
  getEntityActivityByFqn: jest.fn(),
}));

jest.mock('../rest/tasksAPI', () => ({
  getTaskCounts: jest.fn(),
}));

jest.mock('./ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('aggregateFeedCountResponse', () => {
  it('returns zeroes for an undefined or empty response', () => {
    expect(aggregateFeedCountResponse(undefined)).toEqual({
      conversationCount: 0,
      mentionCount: 0,
    });
    expect(aggregateFeedCountResponse([])).toEqual({
      conversationCount: 0,
      mentionCount: 0,
    });
  });

  it('sums every entry instead of reading only the first one', () => {
    expect(
      aggregateFeedCountResponse([
        {
          entityLink: '<#E::table::db.schema.t::description>',
          conversationCount: 2,
          mentionCount: 1,
          totalTaskCount: 0,
        },
        {
          entityLink: '<#E::table::db.schema.t::columns>',
          conversationCount: 3,
          mentionCount: 4,
          totalTaskCount: 0,
        },
      ])
    ).toEqual({ conversationCount: 5, mentionCount: 5 });
  });

  it('treats an omitted conversationCount as zero', () => {
    expect(
      aggregateFeedCountResponse([
        {
          entityLink: '<#E::table::db.schema.t::description>',
          mentionCount: 0,
          totalTaskCount: 0,
        },
        {
          entityLink: '<#E::table::db.schema.t::columns>',
          conversationCount: 7,
          mentionCount: 0,
          totalTaskCount: 0,
        },
      ])
    ).toEqual({ conversationCount: 7, mentionCount: 0 });
  });
});

describe('getFeedCounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('counts real conversations and activity separately (no double-count / no conflation)', async () => {
    // 1 real conversation thread, 2 activity change-events, 0 tasks.
    (getFeedCount as jest.Mock).mockResolvedValue([
      { conversationCount: 1, mentionCount: 0 },
    ]);
    (getEntityActivityByFqn as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 2 },
    });
    (getTaskCounts as jest.Mock).mockResolvedValue({
      total: 0,
      open: 0,
      completed: 0,
    });

    const received = await new Promise<FeedCounts>((resolve) => {
      getFeedCounts('dashboard', 'sample_superset.10', resolve);
    });

    // conversationCount must be the REAL conversation count (1), not the
    // activity total; activity is tracked separately.
    expect(received.conversationCount).toBe(1);
    expect(received.activityCount).toBe(2);
    // totalCount = conversations + activity + tasks = 1 + 2 + 0 = 3.
    expect(received.totalCount).toBe(3);
  });

  it('sums conversation counts across multiple field threads', async () => {
    (getFeedCount as jest.Mock).mockResolvedValue([
      { conversationCount: 2, mentionCount: 1 },
      { conversationCount: 3, mentionCount: 0 },
    ]);
    (getEntityActivityByFqn as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 4 },
    });
    (getTaskCounts as jest.Mock).mockResolvedValue({
      total: 5,
      open: 5,
      completed: 0,
    });

    const received = await new Promise<FeedCounts>((resolve) => {
      getFeedCounts('table', 'db.schema.t', resolve);
    });

    expect(received.conversationCount).toBe(5);
    expect(received.mentionCount).toBe(1);
    expect(received.activityCount).toBe(4);
    expect(received.totalCount).toBe(14);
  });

  it('counts only OPEN tasks in totalCount, so the tab header matches its sub-tabs', async () => {
    // The entity tab header renders totalCount, while the left panel shows
    // All (conversations + activity) and Tasks (the open count, its default
    // filter). Counting closed tasks in the header made it exceed the sum of
    // the two badges by the number of resolved tasks.
    (getFeedCount as jest.Mock).mockResolvedValue([
      { conversationCount: 1, mentionCount: 0 },
    ]);
    (getEntityActivityByFqn as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 2 },
    });
    (getTaskCounts as jest.Mock).mockResolvedValue({
      total: 5,
      open: 2,
      completed: 3,
    });

    const received = await new Promise<FeedCounts>((resolve) => {
      getFeedCounts('table', 'db.schema.closed', resolve);
    });

    // 1 conversation + 2 activity + 2 OPEN tasks = 5, not 8.
    expect(received.totalCount).toBe(5);
    // totalTasksCount keeps its own meaning — every task, open or not.
    expect(received.totalTasksCount).toBe(5);
    expect(received.openTaskCount).toBe(2);
    expect(received.closedTaskCount).toBe(3);
  });
});

describe('getFeedTotalCount', () => {
  it('sums conversations, activity and open tasks only', () => {
    expect(
      getFeedTotalCount({
        conversationCount: 1,
        activityCount: 2,
        openTaskCount: 2,
      })
    ).toBe(5);
  });

  it('is unaffected by closed tasks', () => {
    expect(
      getFeedTotalCount({
        conversationCount: 0,
        activityCount: 0,
        openTaskCount: 0,
      })
    ).toBe(0);
  });
});
