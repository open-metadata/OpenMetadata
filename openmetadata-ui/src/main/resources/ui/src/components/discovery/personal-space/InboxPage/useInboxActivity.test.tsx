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

const mockGetUserActivity = jest.fn();
const mockListConversations = jest.fn();
let mockCurrentUser: { id?: string } | undefined;

jest.mock('rest/activityAPI', () => ({
  getUserActivity: (...args: unknown[]) => mockGetUserActivity(...args),
}));

jest.mock('rest/conversationsAPI', () => ({
  listConversations: (...args: unknown[]) => mockListConversations(...args),
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: mockCurrentUser }),
}));

import { fetchInboxActivity, useInboxActivity } from './useInboxActivity';

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
  mockGetUserActivity.mockResolvedValue(threeEvents);
  mockListConversations.mockResolvedValue(twoThreads);
});

describe('fetchInboxActivity', () => {
  it('fetches the user’s own activity + every conversation for "all" (admin)', async () => {
    const { activities, threads } = await fetchInboxActivity(
      'all',
      'u1',
      100,
      200
    );

    // Activity is always the user's own events (actor-based).
    expect(mockGetUserActivity).toHaveBeenCalledWith('u1', {
      days: 1,
      limit: 200,
    });
    // Admin conversations are unfiltered (no filterType, no userId). The limit is
    // 100, not ACTIVITY_LIMIT: /conversations rejects anything above @Max(100).
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

  it('scopes conversations to owned/followed ones for "me" (non-admin)', async () => {
    await fetchInboxActivity('me', 'u1');

    expect(mockGetUserActivity).toHaveBeenCalledWith('u1', {
      days: 30,
      limit: 200,
    });
    expect(mockListConversations).toHaveBeenCalledWith({
      filterType: ConversationFilterType.OwnerOrFollows,
      userId: 'u1',
      limit: 100,
      startTs: undefined,
      endTs: undefined,
    });
  });

  // Regression: these were fetched with Promise.all, so a rejected conversation
  // request emptied the activity list too and the Inbox rendered nothing at all.
  it('still returns activity when the conversation fetch fails', async () => {
    mockListConversations.mockRejectedValue(new Error('400 Bad Request'));

    const { activities, threads } = await fetchInboxActivity('all', 'u1');

    expect(activities).toHaveLength(3);
    expect(threads).toEqual([]);
  });

  it('still returns conversations when the activity fetch fails', async () => {
    mockGetUserActivity.mockRejectedValue(new Error('boom'));

    const { activities, threads } = await fetchInboxActivity('all', 'u1');

    expect(activities).toEqual([]);
    expect(threads).toHaveLength(2);
  });

  it('returns empty lists when the user id is not resolved yet', async () => {
    const result = await fetchInboxActivity('all', undefined);

    expect(result).toEqual({ activities: [], threads: [] });
    expect(mockGetUserActivity).not.toHaveBeenCalled();
    expect(mockListConversations).not.toHaveBeenCalled();
  });
});

describe('useInboxActivity', () => {
  it('merges activity events and conversations into one list', async () => {
    const { result } = renderHook(() => useInboxActivity('all'), {
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
    mockGetUserActivity.mockResolvedValue({
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

    const { result } = renderHook(() => useInboxActivity('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(
      result.current.items.map((item) => item.activity?.id ?? item.feed?.id)
    ).toEqual(['a-new', 't-late', 't-mid', 'a-old']);
  });

  it('shows conversations alone when the user has no events', async () => {
    mockGetUserActivity.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useInboxActivity('all'), {
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
    mockGetUserActivity.mockResolvedValue({ data: [] });
    mockListConversations.mockResolvedValue({
      data: [
        // Replied Aug 20, reply landed Sep 4 -> updatedAt >> createdAt.
        { id: 'c-replied', createdAt: 200, updatedAt: 400 },
        // Newer but unreplied -> createdAt == updatedAt, sits between 200 and 400.
        { id: 'c-unreplied', createdAt: 300, updatedAt: 300 },
      ],
    });

    const { result } = renderHook(() => useInboxActivity('all'), {
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
    mockGetUserActivity.mockResolvedValue({ data: [] });
    mockListConversations.mockResolvedValue({
      data: [
        // Both unreplied, equal timestamps -> tie decided by id.
        { id: 'zebra', createdAt: 500, updatedAt: 500 },
        { id: 'alpha', createdAt: 500, updatedAt: 500 },
      ],
    });

    const { result } = renderHook(() => useInboxActivity('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items.map((i) => i.feed?.id)).toEqual([
      'alpha',
      'zebra',
    ]);
  });
});
