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
  applyReaction,
  formatInboxCount,
  formatInboxDate,
  formatInboxDateTime,
  getActivityChange,
  getActivityEventLabel,
  getActivityKindType,
  getFeedSortTimestamp,
  getInboxTabBadge,
  isSameLocalDay,
  isTaskOpen,
  pairFieldChanges,
  sendReaction,
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
    const activity = (
      eventType: ActivityEventType,
      fieldName?: string,
      oldValue?: string,
      newValue?: string
    ) => ({ eventType, fieldName, oldValue, newValue } as ActivityEvent);
    const tags = (...fqns: string[]) =>
      JSON.stringify(fqns.map((tagFQN) => ({ tagFQN })));

    // Each sentence is complete; the entity is the card's next line.
    it.each([
      [ActivityEventType.EntityCreated, 'message.activity-created-asset'],
      [ActivityEventType.EntitySoftDeleted, 'message.activity-deleted-asset'],
      [ActivityEventType.OwnerUpdated, 'message.activity-changed-owner'],
      [ActivityEventType.DomainUpdated, 'message.activity-changed-domain'],
      [
        ActivityEventType.DescriptionUpdated,
        'message.activity-updated-description',
      ],
    ])('labels %s as a whole sentence', (eventType, key) => {
      expect(getActivityEventLabel(activity(eventType), t)).toBe(key);
    });

    it('names a column description change', () => {
      expect(
        getActivityEventLabel(
          activity(
            ActivityEventType.DescriptionUpdated,
            'columns.email.description'
          ),
          t
        )
      ).toBe('message.activity-updated-column-description');
    });

    it('reads which way a column tag changed, and how many', () => {
      const added = activity(
        ActivityEventType.TagsUpdated,
        'columns.email.tags',
        undefined,
        tags('PII.Sensitive')
      );
      const removed = activity(
        ActivityEventType.TagsUpdated,
        'tags',
        tags('PII.Sensitive', 'PersonalData.Personal')
      );

      expect(getActivityEventLabel(added, t)).toBe(
        'message.activity-added-column-tag'
      );
      expect(getActivityEventLabel(removed, t)).toBe(
        'message.activity-removed-tag-plural'
      );
    });

    it('calls a swap of tags a change', () => {
      expect(
        getActivityEventLabel(
          activity(
            ActivityEventType.TagsUpdated,
            'tags',
            tags('PII.NonSensitive'),
            tags('PII.Sensitive')
          ),
          t
        )
      ).toBe('message.activity-changed-tags');
    });

    it('calls tags it cannot read a change', () => {
      expect(
        getActivityEventLabel(
          activity(ActivityEventType.TagsUpdated, 'tags', '[{"tagFQN":"PI'),
          t
        )
      ).toBe('message.activity-changed-tags');
    });

    // Tier is stored as a tag, so its own sentence comes from the values.
    it('names a tier change', () => {
      expect(
        getActivityEventLabel(
          activity(
            ActivityEventType.TagsUpdated,
            'tags',
            undefined,
            tags('Tier.Tier1')
          ),
          t
        )
      ).toBe('message.activity-changed-tier');
    });

    // The card's badge reads the kind the same way as its sentence.
    it.each([
      [
        'a tier carried as tags',
        activity(
          ActivityEventType.TagsUpdated,
          'tags',
          tags('Tier.Tier2'),
          tags('Tier.Tier1')
        ),
        ActivityEventType.TierUpdated,
      ],
      [
        "a column's tags carried as the asset's",
        activity(
          ActivityEventType.TagsUpdated,
          'columns.email.tags',
          undefined,
          tags('PII.Sensitive')
        ),
        ActivityEventType.ColumnTagsUpdated,
      ],
      [
        "an asset's tags",
        activity(
          ActivityEventType.TagsUpdated,
          'tags',
          undefined,
          tags('PII.Sensitive')
        ),
        ActivityEventType.TagsUpdated,
      ],
      [
        "a column's description carried as the asset's",
        activity(
          ActivityEventType.DescriptionUpdated,
          'columns.email.description'
        ),
        ActivityEventType.ColumnDescriptionUpdated,
      ],
      [
        'an owner change',
        activity(ActivityEventType.OwnerUpdated, 'owners'),
        ActivityEventType.OwnerUpdated,
      ],
    ])('reads %s as its kind', (_, event, kind) => {
      expect(getActivityKindType(event)).toBe(kind);
    });

    it('uses the field name for a generic EntityUpdated', () => {
      expect(
        getActivityEventLabel(
          activity(ActivityEventType.EntityUpdated, 'schema'),
          t
        )
      ).toBe('label.updated-field-for-lowercase');
    });

    it('falls back to updating the asset when no field is named', () => {
      expect(
        getActivityEventLabel(activity(ActivityEventType.EntityUpdated), t)
      ).toBe('message.activity-updated-asset');
    });
  });

  describe('getFeedSortTimestamp', () => {
    // Last activity first, so a replied conversation sorts above newer
    // unreplied ones (upstream parity). Regression for the inbox sort bug.
    it('prefers updatedAt over createdAt', () => {
      const feed = {
        id: 'c1',
        createdAt: 200,
        updatedAt: 400,
      } as Conversation;

      expect(getFeedSortTimestamp(feed)).toBe(400);
    });
  });

  describe('formatInboxCount', () => {
    it('shows an exact count as is', () => {
      expect(formatInboxCount({ total: 42, isCapped: false })).toBe('42');
    });

    it('shows a count at the cap as is', () => {
      expect(formatInboxCount({ total: 99, isCapped: false })).toBe('99');
    });

    it('caps a count past 99', () => {
      expect(formatInboxCount({ total: 128, isCapped: false })).toBe('99+');
    });

    it('caps a floor past 99', () => {
      expect(formatInboxCount({ total: 300, isCapped: true })).toBe('99+');
    });

    // A full page can pair and clip down to few cards: still a floor, but
    // never more than the list shows.
    it('marks a floor under the cap with a plus, not as 99+', () => {
      expect(formatInboxCount({ total: 30, isCapped: true })).toBe('30+');
    });
  });

  describe('getInboxTabBadge', () => {
    it('formats a count for the tab', () => {
      expect(getInboxTabBadge({ total: 128, isCapped: false })).toBe('99+');
    });

    // A tab with nothing to count shows no badge, not a "0".
    it('drops the badge when there is nothing to count', () => {
      expect(getInboxTabBadge({ total: 0, isCapped: false })).toBeUndefined();
      expect(getInboxTabBadge(undefined)).toBeUndefined();
    });
  });

  describe('formatInboxDate', () => {
    // "expires Oct 8, 2026" reads without a padded day.
    it('leaves a single-digit day unpadded', () => {
      expect(
        formatInboxDate(
          DateTime.fromObject({ year: 2026, month: 10, day: 8 }).toMillis()
        )
      ).toBe('Oct 8, 2026');
    });
  });

  describe('formatInboxDateTime', () => {
    it('formats a timestamp month first, as the design reads', () => {
      const ts = DateTime.fromObject({
        year: 2026,
        month: 5,
        day: 13,
        hour: 20,
        minute: 45,
      }).toMillis();

      expect(formatInboxDateTime(ts)).toBe('May 13, 2026, 08:45 PM');
    });

    it('returns an empty string for undefined', () => {
      expect(formatInboxDateTime()).toBe('');
    });
  });

  describe('applyReaction', () => {
    const user = { id: 'u1', name: 'alice', displayName: 'Alice' };

    it('adds the user reaction with their details', () => {
      expect(
        applyReaction([], ReactionType.Heart, ReactionOperation.ADD, user)
      ).toEqual([
        {
          reactionType: ReactionType.Heart,
          user: { id: 'u1', type: 'user', name: 'alice', displayName: 'Alice' },
        },
      ]);
    });

    it("removes only the current user's reaction of that type", () => {
      const existing = [
        { reactionType: ReactionType.Heart, user: { id: 'u1' } },
        { reactionType: ReactionType.Heart, user: { id: 'u2' } },
        { reactionType: ReactionType.Laugh, user: { id: 'u1' } },
      ] as Reaction[];

      expect(
        applyReaction(
          existing,
          ReactionType.Heart,
          ReactionOperation.REMOVE,
          user
        ).map((r) => `${r.reactionType}:${r.user?.id}`)
      ).toEqual(['heart:u2', 'laugh:u1']);
    });

    // A double click must not count the user twice.
    it('returns the same list when adding a reaction the user already has', () => {
      const existing = [
        { reactionType: ReactionType.ThumbsUp, user: { id: 'u1' } },
      ] as Reaction[];

      expect(
        applyReaction(
          existing,
          ReactionType.ThumbsUp,
          ReactionOperation.ADD,
          user
        )
      ).toBe(existing);
    });

    it('returns the same list when removing a reaction the user lacks', () => {
      const existing = [
        { reactionType: ReactionType.Heart } as Reaction,
      ] as Reaction[];

      expect(
        applyReaction(
          existing,
          ReactionType.Heart,
          ReactionOperation.REMOVE,
          user
        )
      ).toBe(existing);
    });
  });

  describe('sendReaction', () => {
    beforeEach(() => jest.clearAllMocks());

    it('sends an activity reaction to the activity endpoints', async () => {
      await sendReaction(
        { activityId: 'a1' },
        ReactionType.Heart,
        ReactionOperation.ADD
      );
      await sendReaction(
        { activityId: 'a1' },
        ReactionType.Heart,
        ReactionOperation.REMOVE
      );

      expect(mockAddReaction).toHaveBeenCalledWith('a1', ReactionType.Heart);
      expect(mockRemoveReaction).toHaveBeenCalledWith('a1', ReactionType.Heart);
      expect(mockAddConversationReaction).not.toHaveBeenCalled();
    });

    // A conversation PATCH is author-gated, so reacting to someone else's
    // conversation has to go through its own reaction endpoint.
    it('sends a conversation reaction to the conversation endpoints', async () => {
      await sendReaction(
        { conversationId: 'f1' },
        ReactionType.Heart,
        ReactionOperation.ADD
      );
      await sendReaction(
        { conversationId: 'f1' },
        ReactionType.Heart,
        ReactionOperation.REMOVE
      );

      expect(mockAddConversationReaction).toHaveBeenCalledWith(
        'f1',
        ReactionType.Heart
      );
      expect(mockRemoveConversationReaction).toHaveBeenCalledWith(
        'f1',
        ReactionType.Heart
      );
      expect(mockAddReaction).not.toHaveBeenCalled();
    });
  });

  describe('isSameLocalDay', () => {
    const at = (iso: string) => new Date(iso).getTime();

    it('matches two times on one local day', () => {
      expect(
        isSameLocalDay(at('2026-10-05T09:00:00'), at('2026-10-05T23:30:00'))
      ).toBe(true);
    });

    it('tells apart times on different days', () => {
      expect(
        isSameLocalDay(at('2026-10-04T23:59:00'), at('2026-10-05T00:01:00'))
      ).toBe(false);
    });

    it('is false when either time is missing', () => {
      expect(isSameLocalDay(undefined, at('2026-10-05T09:00:00'))).toBe(false);
    });
  });

  describe('getActivityChange', () => {
    const event = (
      eventType: ActivityEventType,
      oldValue?: string,
      newValue?: string
    ) => ({ eventType, oldValue, newValue } as ActivityEvent);

    it('names added tags by their FQN', () => {
      expect(
        getActivityChange(
          event(
            ActivityEventType.TagsUpdated,
            undefined,
            JSON.stringify([{ tagFQN: 'PII.Sensitive' }])
          )
        )
      ).toEqual({
        labelKey: 'label.tag-plural',
        before: [],
        after: ['PII.Sensitive'],
        isText: false,
      });
    });

    it('names owners on both sides of a paired swap', () => {
      expect(
        getActivityChange(
          event(
            ActivityEventType.OwnerUpdated,
            JSON.stringify([{ name: 'ram', displayName: 'Ram' }]),
            JSON.stringify([{ name: 'platform' }])
          )
        )
      ).toMatchObject({ before: ['Ram'], after: ['platform'] });
    });

    // The panel renders it, so markdown reaches it untouched.
    it('keeps a description as written', () => {
      expect(
        getActivityChange(
          event(ActivityEventType.DescriptionUpdated, 'Old', '**New** ')
        )
      ).toEqual({
        labelKey: 'label.description',
        before: ['Old'],
        after: ['**New**'],
        isText: true,
      });
    });

    // The server truncates each side at 1000 characters.
    it('gives up on a value cut off mid-JSON', () => {
      expect(
        getActivityChange(
          event(ActivityEventType.TagsUpdated, undefined, '[{"tagFQN":"PI')
        )
      ).toBeUndefined();
    });

    it('has nothing to show for an event without a change panel', () => {
      expect(
        getActivityChange(event(ActivityEventType.EntityCreated))
      ).toBeUndefined();
    });
  });

  describe('pairFieldChanges', () => {
    const change = (
      id: string,
      values: Partial<ActivityEvent>
    ): ActivityEvent =>
      ({
        id,
        entity: { id: 't1' },
        fieldName: 'owners',
        timestamp: 1,
        ...values,
      } as ActivityEvent);

    it('folds a removal into the addition from the same edit', () => {
      const removal = change('r', { oldValue: '[ram]' });
      const addition = change('a', { newValue: '[team]' });

      expect(pairFieldChanges([removal, addition])).toEqual([
        { ...addition, oldValue: '[ram]' },
      ]);
    });

    it('leaves changes from different edits apart', () => {
      const removal = change('r', { oldValue: '[ram]' });
      const later = change('a', { newValue: '[team]', timestamp: 2 });

      expect(pairFieldChanges([removal, later])).toEqual([removal, later]);
    });

    it('leaves events without a field alone', () => {
      const created = change('c', { fieldName: undefined, newValue: 'x' });

      expect(pairFieldChanges([created])).toEqual([created]);
    });
  });
});
