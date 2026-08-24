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

import { renderHook } from '@testing-library/react';

const mockGetAllFeeds = jest.fn();
let mockSeenTs: number | null = 1000;

jest.mock('@tanstack/react-query', () => ({
  useQuery: ({
    queryFn,
    enabled,
  }: {
    queryFn: () => Promise<number>;
    enabled: boolean;
  }) => {
    if (enabled) {
      queryFn();
    }

    return { data: enabled ? 7 : undefined };
  },
}));

jest.mock('../rest/feedsAPI', () => ({
  getAllFeeds: (...args: unknown[]) => mockGetAllFeeds(...args),
}));

jest.mock('./useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'user-1' } }),
}));

jest.mock('./usePersonalSpaceStore', () => ({
  usePersonalSpaceStore: (selector: (s: unknown) => unknown) =>
    selector({ inboxActivitySeenTs: mockSeenTs }),
}));

import { FeedFilter } from '../enums/mydata.enum';
import { useUnreadInboxActivity } from './useUnreadInboxActivity';

describe('useUnreadInboxActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSeenTs = 1000;
    mockGetAllFeeds.mockResolvedValue({ paging: { total: 7 } });
  });

  /**
   * OWNER_OR_FOLLOWS matches threads the user created, and the author of a
   * collaborator notification is the person who shared the chat — using it would
   * badge them for their own action.
   */
  it('counts only threads that mention the user', () => {
    renderHook(() => useUnreadInboxActivity());

    expect(mockGetAllFeeds.mock.calls[0][3]).toBe(FeedFilter.MENTIONS);
  });

  it('counts only what arrived after the last look at the Inbox', () => {
    renderHook(() => useUnreadInboxActivity());

    expect(mockGetAllFeeds.mock.calls[0][7]).toBe(1000);
  });

  /**
   * A user who has never opened the Inbox has no mark to compare against;
   * counting everything would greet them with a badge for history.
   */
  it('counts nothing before the first visit to the Inbox', () => {
    mockSeenTs = null;

    const { result } = renderHook(() => useUnreadInboxActivity());

    expect(mockGetAllFeeds).not.toHaveBeenCalled();
    expect(result.current).toBe(0);
  });
});
