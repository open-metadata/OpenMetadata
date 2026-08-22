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
import { getEntityActivityByFqn } from '../rest/activityAPI';
import { listConversations } from '../rest/conversationsAPI';
import { getTaskCounts } from '../rest/tasksAPI';
import { getFeedCounts, getFeedTotalCount } from './FeedUtilsPure';

jest.mock('../rest/activityAPI', () => ({
  getEntityActivityByFqn: jest.fn(),
}));

jest.mock('../rest/conversationsAPI', () => ({
  listConversations: jest.fn(),
}));

jest.mock('../rest/tasksAPI', () => ({
  getTaskCounts: jest.fn(),
}));

jest.mock('./ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('getFeedCounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('counts conversations and activity separately', async () => {
    (listConversations as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 1 },
    });
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

    expect(received.conversationCount).toBe(1);
    expect(received.activityCount).toBe(2);
    expect(received.totalCount).toBe(3);
  });

  it('uses the server conversation total instead of the loaded page length', async () => {
    (listConversations as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 5 },
    });
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
    expect(received.mentionCount).toBe(0);
    expect(received.activityCount).toBe(4);
    expect(received.totalCount).toBe(14);
  });

  it('counts only open tasks in totalCount', async () => {
    (listConversations as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 1 },
    });
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

    expect(received.totalCount).toBe(5);
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

  it('returns zero when every visible count is zero', () => {
    expect(
      getFeedTotalCount({
        conversationCount: 0,
        activityCount: 0,
        openTaskCount: 0,
      })
    ).toBe(0);
  });
});
