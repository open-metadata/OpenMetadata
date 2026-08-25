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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 */
import { ActivityEventType } from '../../../generated/entity/activity/activityEvent';
import {
  createMetricFeedCounts,
  getMetricMentionQuery,
  insertMetricMention,
  mergeMetricActivity,
} from './MetricActivity.utils';

describe('MetricActivity utilities', () => {
  it('parses and inserts both people and asset mentions', () => {
    const userQuery = getMetricMentionQuery('Please ask @ali');

    expect(userQuery).toEqual({ denotation: '@', query: 'ali', start: 11 });

    if (!userQuery) {
      throw new Error('Expected the mention query to be parsed');
    }

    expect(
      insertMetricMention('Please ask @ali', userQuery, {
        displayName: 'Alice',
        fullyQualifiedName: 'alice',
        id: 'user-1',
        type: 'user',
      })
    ).toBe('Please ask <#E::user::alice|@Alice> ');
    expect(getMetricMentionQuery('Investigate #orders')).toEqual({
      denotation: '#',
      query: 'orders',
      start: 12,
    });
    expect(getMetricMentionQuery('email@example.com')).toBeUndefined();
  });

  it('merges activity and conversations in descending event order', () => {
    const merged = mergeMetricActivity(
      [
        {
          entity: { id: 'metric-1', type: 'metric' },
          eventType: ActivityEventType.EntityUpdated,
          id: 'event',
          timestamp: 10,
        },
      ],
      [
        {
          about: '<#E::metric::revenue>',
          id: 'thread',
          message: 'Discuss revenue',
          threadTs: 20,
        },
      ]
    );

    expect(merged.map(({ id }) => id)).toEqual(['thread', 'event']);
  });

  it('keeps task and conversation counts distinct', () => {
    expect(
      createMetricFeedCounts({
        activityEventCount: 8,
        closedTaskCount: 2,
        conversationThreadCount: 5,
        mentionCount: 3,
        openTaskCount: 4,
        totalTaskCount: 6,
      })
    ).toEqual({
      closedTaskCount: 2,
      conversationCount: 13,
      mentionCount: 3,
      openTaskCount: 4,
      totalCount: 19,
      totalTasksCount: 6,
    });
  });
});
