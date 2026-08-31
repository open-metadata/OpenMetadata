/*
 *  Copyright 2026 Collate.
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
import { EntityType } from '../../../enums/entity.enum';
import { ConversationFilterType } from '../../../generated/type/conversationFilterType';
import { getEntityActivityByFqn } from '../../../rest/activityAPI';
import { listConversations } from '../../../rest/conversationsAPI';
import { getTaskCounts } from '../../../rest/tasksAPI';
import { getMetricFeedCounts } from './MetricFeedCountUtils';

jest.mock('../../../rest/activityAPI');
jest.mock('../../../rest/conversationsAPI');
jest.mock('../../../rest/tasksAPI');

describe('getMetricFeedCounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listConversations as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    (getTaskCounts as jest.Mock).mockResolvedValue({});
  });

  it('uses the unbounded activity paging total instead of the returned page size', async () => {
    (getEntityActivityByFqn as jest.Mock).mockResolvedValue({
      data: [{ id: 'one-visible-event' }],
      paging: { total: 13 },
    });
    (getTaskCounts as jest.Mock).mockResolvedValue({
      open: 2,
      completed: 3,
      total: 5,
    });

    await expect(getMetricFeedCounts('finance.margin')).resolves.toEqual({
      conversationCount: 13,
      openTaskCount: 2,
      closedTaskCount: 3,
      totalTasksCount: 5,
      totalCount: 18,
      mentionCount: 0,
    });
    expect(getEntityActivityByFqn).toHaveBeenCalledWith(
      EntityType.METRIC,
      'finance.margin',
      { days: 30, limit: 0 }
    );
    expect(getTaskCounts).toHaveBeenCalledWith({
      aboutEntity: 'finance.margin',
    });
  });

  it('counts conversations and current-user mentions independently', async () => {
    (getEntityActivityByFqn as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    (listConversations as jest.Mock)
      .mockResolvedValueOnce({ data: [], paging: { total: 7 } })
      .mockResolvedValueOnce({ data: [], paging: { total: 3 } });

    await expect(getMetricFeedCounts('metric', 'user-1')).resolves.toEqual({
      conversationCount: 7,
      openTaskCount: 0,
      closedTaskCount: 0,
      totalTasksCount: 0,
      totalCount: 7,
      mentionCount: 3,
    });
    expect(listConversations).toHaveBeenNthCalledWith(1, {
      entityLink: '<#E::metric::metric>',
      limit: 1,
    });
    expect(listConversations).toHaveBeenNthCalledWith(2, {
      entityLink: '<#E::metric::metric>',
      filterType: ConversationFilterType.Mentions,
      limit: 1,
      userId: 'user-1',
    });
  });

  it('combines activity events, threads, mentions, and tasks exactly once', async () => {
    (getEntityActivityByFqn as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 8 },
    });
    (listConversations as jest.Mock)
      .mockResolvedValueOnce({ data: [], paging: { total: 5 } })
      .mockResolvedValueOnce({ data: [], paging: { total: 3 } });
    (getTaskCounts as jest.Mock).mockResolvedValue({
      completed: 2,
      open: 4,
      total: 6,
    });

    await expect(getMetricFeedCounts('metric', 'user-1')).resolves.toEqual({
      closedTaskCount: 2,
      conversationCount: 13,
      mentionCount: 3,
      openTaskCount: 4,
      totalCount: 19,
      totalTasksCount: 6,
    });
  });

  it('normalizes missing counts to zero', async () => {
    (getEntityActivityByFqn as jest.Mock).mockResolvedValue({ data: [] });

    await expect(getMetricFeedCounts('metric')).resolves.toEqual({
      closedTaskCount: 0,
      conversationCount: 0,
      mentionCount: 0,
      openTaskCount: 0,
      totalCount: 0,
      totalTasksCount: 0,
    });
  });
});
