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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { ConversationFilterType } from '../../../../generated/type/conversationFilterType';

const mockGetActivityEvents = jest.fn();
const mockGetMyActivityFeed = jest.fn();
const mockGetFollowingActivityFeed = jest.fn();
const mockGetMentionsActivityFeed = jest.fn();
const mockListConversations = jest.fn();
let mockCurrentUser: { id?: string } | undefined;

jest.mock('rest/activityAPI', () => ({
  getActivityEvents: (...args: unknown[]) => mockGetActivityEvents(...args),
  getMyActivityFeed: (...args: unknown[]) => mockGetMyActivityFeed(...args),
  getFollowingActivityFeed: (...args: unknown[]) =>
    mockGetFollowingActivityFeed(...args),
  getMentionsActivityFeed: (...args: unknown[]) =>
    mockGetMentionsActivityFeed(...args),
}));

jest.mock('rest/conversationsAPI', () => ({
  listConversations: (...args: unknown[]) => mockListConversations(...args),
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: mockCurrentUser }),
}));

import { ActivityFilter } from './inbox.utils';
import {
  fetchInboxActivity,
  useInboxActivity,
  useInboxActivityCounts,
} from './useInboxActivity';

const threeEvents = { data: [{ id: '1' }, { id: '2' }, { id: '3' }] };
const twoThreads = { data: [{ id: 't1' }, { id: 't2' }] };

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUser = { id: 'u1' };
  [
    mockGetActivityEvents,
    mockGetMyActivityFeed,
    mockGetFollowingActivityFeed,
    mockGetMentionsActivityFeed,
  ].forEach((mock) => mock.mockResolvedValue(threeEvents));
  mockListConversations.mockResolvedValue(twoThreads);
});

describe('fetchInboxActivity', () => {
  // "All" is everything the viewer may see: every event, every conversation.
  it('fetches every activity event and conversation for All', async () => {
    const { activities, threads } = await fetchInboxActivity(
      ActivityFilter.All,
      'u1',
      100,
      200
    );

    expect(mockGetActivityEvents).toHaveBeenCalledWith({
      days: 1,
      limit: 200,
    });
    // The limit is 100, not ACTIVITY_LIMIT: /conversations rejects anything
    // above @Max(100).
    expect(mockListConversations).toHaveBeenCalledWith({
      filterType: undefined,
      userId: undefined,
      limit: 100,
      startTs: 100,
      endTs: 200,
    });
    expect(activities).toHaveLength(3);
    expect(threads).toHaveLength(2);
  });

  it.each([
    [
      ActivityFilter.MyAssets,
      mockGetMyActivityFeed,
      ConversationFilterType.Owner,
    ],
    [
      ActivityFilter.Following,
      mockGetFollowingActivityFeed,
      ConversationFilterType.Follows,
    ],
  ])(
    'scopes %s to its activity feed and conversations',
    async (filter, activityRequest, filterType) => {
      await fetchInboxActivity(filter, 'u1');

      expect(activityRequest).toHaveBeenCalledWith({ days: 30, limit: 200 });
      expect(mockGetActivityEvents).not.toHaveBeenCalled();
      expect(mockListConversations).toHaveBeenCalledWith({
        filterType,
        userId: 'u1',
        limit: 100,
        startTs: undefined,
        endTs: undefined,
      });
    }
  );

  // Replies that name the viewer, plus the conversations that do.
  it('reads the mentions feed and mentioning conversations for Mentions', async () => {
    const { activities } = await fetchInboxActivity(
      ActivityFilter.Mentions,
      'u1'
    );

    expect(activities).toEqual(threeEvents.data);
    expect(mockGetMentionsActivityFeed).toHaveBeenCalled();
    expect(mockGetActivityEvents).not.toHaveBeenCalled();
    expect(mockListConversations).toHaveBeenCalledWith(
      expect.objectContaining({
        filterType: ConversationFilterType.Mentions,
        userId: 'u1',
      })
    );
  });

  // Regression: these were fetched with Promise.all, so a rejected conversation
  // request emptied the activity list too and the Inbox rendered nothing at all.
  it('still returns activity when the conversation fetch fails', async () => {
    mockListConversations.mockRejectedValue(new Error('400 Bad Request'));

    const { activities, threads } = await fetchInboxActivity(
      ActivityFilter.All,
      'u1'
    );

    expect(activities).toHaveLength(3);
    expect(threads).toEqual([]);
  });

  it('still returns conversations when the activity fetch fails', async () => {
    mockGetActivityEvents.mockRejectedValue(new Error('boom'));

    const { activities, threads } = await fetchInboxActivity(
      ActivityFilter.All,
      'u1'
    );

    expect(activities).toEqual([]);
    expect(threads).toHaveLength(2);
  });

  it('returns empty lists when the user id is not resolved yet', async () => {
    const result = await fetchInboxActivity(ActivityFilter.All, undefined);

    expect(result).toEqual({ activities: [], threads: [] });
    expect(mockGetActivityEvents).not.toHaveBeenCalled();
    expect(mockListConversations).not.toHaveBeenCalled();
  });
});

describe('useInboxActivity', () => {
  it('merges activity events and conversations into one list', async () => {
    const { result } = renderHook(() => useInboxActivity(ActivityFilter.All), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // 3 events + 2 threads — both kinds count (OpenMetadata#30879).
    expect(result.current.total).toBe(5);
    expect(result.current.items.filter((item) => item.activity)).toHaveLength(
      3
    );
    expect(result.current.items.filter((item) => item.feed)).toHaveLength(2);
  });

  it('orders the merged list by timestamp, newest first', async () => {
    mockGetActivityEvents.mockResolvedValue({
      data: [
        { id: 'a-old', timestamp: 100 },
        { id: 'a-new', timestamp: 400 },
      ],
    });
    mockListConversations.mockResolvedValue({
      data: [
        // createdAt is the Conversation V2 counterpart of the legacy threadTs;
        // getFeedTimestamp falls back to updatedAt when it is absent.
        { id: 't-mid', createdAt: 200 },
        { id: 't-late', updatedAt: 300 },
      ],
    });

    const { result } = renderHook(() => useInboxActivity(ActivityFilter.All), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(
      result.current.items.map((item) => item.activity?.id ?? item.feed?.id)
    ).toEqual(['a-new', 't-late', 't-mid', 'a-old']);
  });

  it('shows conversations alone when the user has no events', async () => {
    mockGetActivityEvents.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useInboxActivity(ActivityFilter.All), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.total).toBe(2);
    expect(result.current.items.every((item) => item.feed)).toBe(true);
  });

  // Regression for the inbox sort precedence bug (OpenMetadata#30879 parity).
  // A replied conversation (updatedAt bumped past its createdAt) must sort above
  // a newer-but-unreplied one whose createdAt falls strictly between the replied
  // thread's createdAt and updatedAt. The prior code sorted by
  // `createdAt ?? updatedAt` and produced the inverted order; this is the
  // production shape (backend always sets createdAt on insert, bumps only
  // updatedAt), where the `?? updatedAt` fallback never fires.
  it('orders a replied conversation above a newer unreplied one by last-activity', async () => {
    mockGetActivityEvents.mockResolvedValue({ data: [] });
    mockListConversations.mockResolvedValue({
      data: [
        // Replied Aug 20, reply landed Sep 4 -> updatedAt >> createdAt.
        { id: 'c-replied', createdAt: 200, updatedAt: 400 },
        // Newer but unreplied -> createdAt == updatedAt, sits between 200 and 400.
        { id: 'c-unreplied', createdAt: 300, updatedAt: 300 },
      ],
    });

    const { result } = renderHook(() => useInboxActivity(ActivityFilter.All), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Expected (upstream / last-activity): c-replied (400) > c-unreplied (300).
    // Prior (buggy): c-unreplied (createdAt 300) > c-replied (createdAt 200).
    expect(result.current.items.map((i) => i.feed?.id)).toEqual([
      'c-replied',
      'c-unreplied',
    ]);
  });

  // Upstream parity tiebreaker (ActivityFeedListV1New.component.tsx): on equal
  // sort timestamps, items order by ascending id via localeCompare. Without it
  // the inbox would still diverge on equal-timestamp ordering and rely on JS
  // sort stability plus the server's `updatedAt DESC, id DESC` order.
  it('breaks timestamp ties by ascending id, matching upstream', async () => {
    mockGetActivityEvents.mockResolvedValue({ data: [] });
    mockListConversations.mockResolvedValue({
      data: [
        // Both unreplied, equal timestamps -> tie decided by id.
        { id: 'zebra', createdAt: 500, updatedAt: 500 },
        { id: 'alpha', createdAt: 500, updatedAt: 500 },
      ],
    });

    const { result } = renderHook(() => useInboxActivity(ActivityFilter.All), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items.map((i) => i.feed?.id)).toEqual([
      'alpha',
      'zebra',
    ]);
  });
});

describe('useInboxActivityCounts', () => {
  it('counts each sub-tab as its list would show it', async () => {
    const { result } = renderHook(() => useInboxActivityCounts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(result.current).toEqual({
        [ActivityFilter.All]: 5,
        [ActivityFilter.Mentions]: 5,
        [ActivityFilter.MyAssets]: 5,
        [ActivityFilter.Following]: 5,
      })
    );
  });

  it('counts nothing until the user id is resolved', () => {
    mockCurrentUser = undefined;

    const { result } = renderHook(() => useInboxActivityCounts(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toEqual({});
  });
});
