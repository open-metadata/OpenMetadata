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

import { TFunction } from 'i18next';
import { DateTime } from 'luxon';
import { ReactionOperation } from '../../../../enums/reactions.enum';
import {
  ActivityEvent,
  ActivityEventType,
} from '../../../../generated/entity/activity/activityEvent';
import { Conversation } from '../../../../generated/entity/feed/conversation';
import { Reaction, ReactionType } from '../../../../generated/type/reaction';
import {
  addActivityReaction,
  removeActivityReaction,
} from '../../../../rest/activityAPI';
import {
  addConversationReaction,
  removeConversationReaction,
} from '../../../../rest/conversationsAPI';

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  // Bucket by calendar day derived from the ms timestamp.
  getRelativeCalendar: (ts: number) => `day-${Math.floor(ts / 100)}`,
  getStartOfDayInMillis: (value: number) => value ?? 0,
  getEndOfDayInMillis: (value: number) => value ?? 0,
  getEpochMillisForPastDays: (days: number) => days,
  getCurrentMillis: () => 0,
}));

jest.mock('../../../../constants/profiler.constant', () => ({
  PROFILER_FILTER_RANGE: { last30days: { days: 30 } },
}));

jest.mock('../../../../rest/activityAPI', () => ({
  addActivityReaction: jest.fn().mockResolvedValue({}),
  removeActivityReaction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../../rest/conversationsAPI', () => ({
  addConversationReaction: jest.fn().mockResolvedValue({}),
  removeConversationReaction: jest.fn().mockResolvedValue(undefined),
}));

import { Task } from '../../../../generated/entity/tasks/task';
import {
  formatInboxDateTime,
  getActivityBuckets,
  getActivityEventLabel,
  groupByRelativeDay,
  isTaskOpen,
  toggleActivityReaction,
  toggleConversationReaction,
} from './inbox.utils';

const mockAddReaction = addActivityReaction as jest.Mock;
const mockRemoveReaction = removeActivityReaction as jest.Mock;
const mockAddConversationReaction = addConversationReaction as jest.Mock;
const mockRemoveConversationReaction = removeConversationReaction as jest.Mock;
const t = ((key: string) => key) as TFunction;

describe('inbox.utils', () => {
  describe('isTaskOpen', () => {
    const task = (status: string, type: string) =>
      ({ status, type } as unknown as Task);

    it.each(['Open', 'InProgress', 'Pending', 'ManualRevoke'])(
      'treats %s as open',
      (status) => {
        expect(isTaskOpen(task(status, 'RequestApproval'))).toBe(true);
      }
    );

    it('treats an Approved Data Access Request as open (awaiting grant)', () => {
      expect(isTaskOpen(task('Approved', 'DataAccessRequest'))).toBe(true);
    });

    it('treats an Approved non-DAR review as closed', () => {
      expect(isTaskOpen(task('Approved', 'RequestApproval'))).toBe(false);
    });

    it.each(['Granted', 'Rejected', 'Completed', 'Revoked', 'Expired'])(
      'treats %s as closed',
      (status) => {
        expect(isTaskOpen(task(status, 'DataAccessRequest'))).toBe(false);
      }
    );
  });

  describe('getActivityEventLabel', () => {
    const activity = (eventType: ActivityEventType, fieldName?: string) =>
      ({ eventType, fieldName } as ActivityEvent);

    it('labels EntityCreated as "created on"', () => {
      expect(
        getActivityEventLabel(activity(ActivityEventType.EntityCreated), t)
      ).toBe('label.created-lowercase label.on-lowercase');
    });

    it('labels DescriptionUpdated as "updated description for"', () => {
      expect(
        getActivityEventLabel(activity(ActivityEventType.DescriptionUpdated), t)
      ).toBe('label.updated-lowercase label.description label.for-lowercase');
    });

    it('labels TagsUpdated as "added tags to"', () => {
      expect(
        getActivityEventLabel(activity(ActivityEventType.TagsUpdated), t)
      ).toBe('label.added-lowercase label.tag-plural label.to-lowercase');
    });

    it('uses the field name for a generic EntityUpdated', () => {
      expect(
        getActivityEventLabel(
          activity(ActivityEventType.EntityUpdated, 'schema'),
          t
        )
      ).toBe('label.updated-lowercase schema label.for-lowercase');
    });

    it('falls back to "updated on" for EntityUpdated with no field', () => {
      expect(
        getActivityEventLabel(activity(ActivityEventType.EntityUpdated), t)
      ).toBe('label.updated-lowercase label.on-lowercase');
    });
  });

  describe('groupByRelativeDay', () => {
    it('buckets items by relative day, preserving order', () => {
      const items = [
        { id: 'a', ts: 100 },
        { id: 'b', ts: 150 },
        { id: 'c', ts: 500 },
      ];

      const groups = groupByRelativeDay(items, (item) => item.ts);

      expect(groups).toHaveLength(2);
      expect(groups[0].day).toBe('day-1');
      expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b']);
      expect(groups[1].day).toBe('day-5');
      expect(groups[1].items.map((i) => i.id)).toEqual(['c']);
    });

    it('treats a missing timestamp as 0', () => {
      const groups = groupByRelativeDay([{ id: 'x' }], () => undefined);

      expect(groups[0].day).toBe('day-0');
    });

    it('returns an empty array for no items', () => {
      expect(groupByRelativeDay([], () => 0)).toEqual([]);
    });
  });

  describe('getActivityBuckets', () => {
    const now = DateTime.now();
    const single = (ms: number) =>
      DateTime.fromMillis(ms).toFormat('cccc, LLLL d');
    const range = (ms: number) => DateTime.fromMillis(ms).toFormat('LLLL d');

    it('buckets feeds into today / yesterday / earlier with date labels', () => {
      const todayTs = now.toMillis();
      const yesterdayTs = now.minus({ days: 1 }).toMillis();
      const oldNewer = now.minus({ days: 5 }).toMillis();
      const oldOlder = now.minus({ days: 10 }).toMillis();

      const feeds = [
        { id: 'today', createdAt: todayTs },
        { id: 'yest', createdAt: yesterdayTs },
        { id: 'old-a', createdAt: oldOlder },
        { id: 'old-b', createdAt: oldNewer },
      ] as Conversation[];

      const buckets = getActivityBuckets(feeds);

      expect(buckets.map((b) => b.key)).toEqual([
        'today',
        'yesterday',
        'earlier',
      ]);
      expect(buckets[0].items.map((f) => f.id)).toEqual(['today']);
      expect(buckets[0].dateText).toBe(single(todayTs));
      expect(buckets[1].dateText).toBe(single(yesterdayTs));
      expect(buckets[2].items.map((f) => f.id)).toEqual(['old-a', 'old-b']);
      expect(buckets[2].dateText).toBe(
        `${range(oldOlder)} - ${range(oldNewer)}`
      );
    });

    it('omits empty buckets and uses a single date when earlier spans one day', () => {
      const old = now.minus({ days: 3 }).toMillis();
      const buckets = getActivityBuckets([
        { id: 'o', createdAt: old },
      ] as Conversation[]);

      expect(buckets).toHaveLength(1);
      expect(buckets[0].key).toBe('earlier');
      expect(buckets[0].dateText).toBe(range(old));
    });

    it('returns an empty array for no feeds', () => {
      expect(getActivityBuckets([])).toEqual([]);
    });
  });

  describe('formatInboxDateTime', () => {
    it('formats a timestamp as "dd LLL, yyyy hh:mm a"', () => {
      const ts = DateTime.fromObject({
        year: 2026,
        month: 5,
        day: 13,
        hour: 20,
        minute: 45,
      }).toMillis();

      expect(formatInboxDateTime(ts)).toBe(
        DateTime.fromMillis(ts).toFormat('dd LLL, yyyy hh:mm a')
      );
    });

    it('returns an empty string for undefined', () => {
      expect(formatInboxDateTime()).toBe('');
    });
  });

  describe('toggleConversationReaction', () => {
    beforeEach(() => {
      mockAddConversationReaction.mockClear();
      mockRemoveConversationReaction.mockClear();
    });

    const user = { id: 'u1', name: 'alice', displayName: 'Alice' };

    // The reaction endpoints exist because a conversation PATCH is author-gated —
    // reacting to someone else's conversation has to be its own operation.
    it('adds a reaction via the conversation reaction endpoint', async () => {
      const result = await toggleConversationReaction(
        'f1',
        [],
        ReactionType.Heart,
        ReactionOperation.ADD,
        user
      );

      expect(result).toHaveLength(1);
      expect(mockAddConversationReaction).toHaveBeenCalledWith(
        'f1',
        ReactionType.Heart
      );
      expect(mockRemoveConversationReaction).not.toHaveBeenCalled();
    });

    it('removes the current user reaction', async () => {
      const existing = [
        { reactionType: ReactionType.Heart, user: { id: 'u1' } },
        { reactionType: ReactionType.Heart, user: { id: 'u2' } },
      ] as Reaction[];

      const result = await toggleConversationReaction(
        'f1',
        existing,
        ReactionType.Heart,
        ReactionOperation.REMOVE,
        user
      );

      expect(result.map((r) => r.user?.id)).toEqual(['u2']);
      expect(mockRemoveConversationReaction).toHaveBeenCalledWith(
        'f1',
        ReactionType.Heart
      );
      expect(mockAddConversationReaction).not.toHaveBeenCalled();
    });
  });

  describe('toggleActivityReaction', () => {
    beforeEach(() => {
      mockAddReaction.mockClear();
      mockRemoveReaction.mockClear();
    });

    const user = { id: 'u1', name: 'alice', displayName: 'Alice' };

    it('adds a reaction with the user details and calls addActivityReaction', async () => {
      const result = await toggleActivityReaction(
        'a1',
        [],
        ReactionType.Heart,
        ReactionOperation.ADD,
        user
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        reactionType: ReactionType.Heart,
        user: { id: 'u1', type: 'user', name: 'alice', displayName: 'Alice' },
      });
      expect(mockAddReaction).toHaveBeenCalledWith('a1', ReactionType.Heart);
    });

    it('removes the current user reaction and calls removeActivityReaction', async () => {
      const existing = [
        { reactionType: ReactionType.Heart, user: { id: 'u1' } },
        { reactionType: ReactionType.Heart, user: { id: 'u2' } },
      ] as Reaction[];

      const result = await toggleActivityReaction(
        'a1',
        existing,
        ReactionType.Heart,
        ReactionOperation.REMOVE,
        user
      );

      expect(result.map((r) => r.user?.id)).toEqual(['u2']);
      expect(mockRemoveReaction).toHaveBeenCalledWith('a1', ReactionType.Heart);
    });

    it('does not crash when a reaction has no user', async () => {
      const existing = [
        { reactionType: ReactionType.Heart } as Reaction,
        { reactionType: ReactionType.Heart, user: { id: 'u1' } } as Reaction,
      ];

      const result = await toggleActivityReaction(
        'a1',
        existing,
        ReactionType.Heart,
        ReactionOperation.REMOVE,
        user
      );

      expect(result).toHaveLength(1);
    });
  });
});
