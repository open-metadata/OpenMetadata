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
import { getFeedCounts } from './FeedUtilsPure';

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
});
