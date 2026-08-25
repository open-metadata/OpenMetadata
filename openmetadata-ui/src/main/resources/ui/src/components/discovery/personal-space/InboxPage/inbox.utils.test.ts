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
    ActivityEventType
} from '../../../../generated/entity/activity/activityEvent';
import { Thread } from '../../../../generated/entity/feed/thread';
import { Reaction, ReactionType } from '../../../../generated/type/reaction';
import {
    addActivityReaction,
    removeActivityReaction,
    updateThread
} from '../../../../rest/feedsAPI';

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

jest.mock('../../../../rest/feedsAPI', () => ({
  addActivityReaction: jest.fn().mockResolvedValue({}),
  removeActivityReaction: jest.fn().mockResolvedValue(undefined),
  updateThread: jest.fn().mockResolvedValue({}),
}));

import { CardStyle } from '../../../../generated/entity/feed/thread';
import { Task } from '../../../../generated/entity/tasks/task';
import {
    formatInboxDateTime,
    getActivityActionLabel,
    getActivityBuckets,
    getActivityEventLabel,
    getChatConversationTitle,
    groupByRelativeDay,
    isChatCollaboratorThread,
    isTaskOpen,
    toggleActivityReaction,
    toggleThreadReaction
} from './inbox.utils';

const mockAddReaction = addActivityReaction as jest.Mock;
const mockRemoveReaction = removeActivityReaction as jest.Mock;
const mockUpdateThread = updateThread as jest.Mock;
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

    it('returns the collaborator label for a chat-share notification', () => {
      const feed = {
        entityUrlLink: '/conversations/abc-123',
      } as Thread;

      expect(getActivityActionLabel(feed, t)).toBe(
        'label.added-you-as-a-collaborator-on'
      );
    });
  });

  describe('isChatCollaboratorThread', () => {
    it('matches a thread carrying a conversation deep link', () => {
      expect(
        isChatCollaboratorThread({
          entityUrlLink: '/conversations/abc-123',
        } as Thread)
      ).toBe(true);
    });

    it.each([
      ['no entityUrlLink', {}],
      ['an unrelated entity link', { entityUrlLink: '/table/foo.bar' }],
      // A path that merely contains the segment must not match, or ordinary
      // activity on an entity with a similar URL would render as a chat share.
      ['the segment mid-path', { entityUrlLink: '/x/conversations/abc' }],
    ])('does not match a thread with %s', (_label, feed) => {
      expect(isChatCollaboratorThread(feed as Thread)).toBe(false);
    });
  });

  describe('getChatConversationTitle', () => {
    it('reads the title the backend stores for the entity chip', () => {
      expect(
        getChatConversationTitle({
          feedInfo: { headerMessage: 'Chat Initialization' },
        } as Thread)
      ).toBe('Chat Initialization');
    });

    it.each([
      ['feedInfo is absent', {}],
      ['headerMessage is empty', { feedInfo: { headerMessage: '' } }],
    ])('returns undefined when %s', (_label, feed) => {
      expect(getChatConversationTitle(feed as Thread)).toBeUndefined();
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
        { id: 'today', threadTs: todayTs },
        { id: 'yest', threadTs: yesterdayTs },
        { id: 'old-a', threadTs: oldOlder },
        { id: 'old-b', threadTs: oldNewer },
      ] as Thread[];

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
        { id: 'o', threadTs: old },
      ] as Thread[]);

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

  describe('getActivityActionLabel', () => {
    it('returns the test-failure label for TestCaseResult threads', () => {
      const feed = { cardStyle: CardStyle.TestCaseResult } as Thread;

      expect(getActivityActionLabel(feed, t)).toBe(
        'label.reported-test-failure-on'
      );
    });

    it('returns the posted-on label otherwise', () => {
      expect(getActivityActionLabel({} as Thread, t)).toBe('label.posted-on');
    });
  });

  describe('toggleThreadReaction', () => {
    beforeEach(() => mockUpdateThread.mockClear());

    const user = { id: 'u1', name: 'alice', displayName: 'Alice' };

    it('adds a reaction and persists it via a thread PATCH', async () => {
      const result = await toggleThreadReaction(
        'f1',
        [],
        ReactionType.Heart,
        ReactionOperation.ADD,
        user
      );

      expect(result).toHaveLength(1);
      expect(mockUpdateThread).toHaveBeenCalledTimes(1);
      expect(mockUpdateThread.mock.calls[0][0]).toBe('f1');
    });

    it('removes the current user reaction', async () => {
      const existing = [
        { reactionType: ReactionType.Heart, user: { id: 'u1' } },
        { reactionType: ReactionType.Heart, user: { id: 'u2' } },
      ] as Reaction[];

      const result = await toggleThreadReaction(
        'f1',
        existing,
        ReactionType.Heart,
        ReactionOperation.REMOVE,
        user
      );

      expect(result.map((r) => r.user?.id)).toEqual(['u2']);
      expect(mockUpdateThread).toHaveBeenCalledWith('f1', expect.any(Array));
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
