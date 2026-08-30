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

const mockListConversations = jest.fn();
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

jest.mock('../rest/conversationsAPI', () => ({
  listConversations: (...args: unknown[]) => mockListConversations(...args),
}));

jest.mock('./useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'user-1' } }),
}));

jest.mock('./usePersonalSpaceStore', () => ({
  usePersonalSpaceStore: (selector: (s: unknown) => unknown) =>
    selector({ inboxActivitySeenTs: mockSeenTs }),
}));

import { ConversationFilterType } from '../generated/type/conversationFilterType';
import { useUnreadInboxActivity } from './useUnreadInboxActivity';

describe('useUnreadInboxActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSeenTs = 1000;
    mockListConversations.mockResolvedValue({ paging: { total: 7 } });
  });

  /**
   * OWNER_OR_FOLLOWS also matches conversations the user created, which would
   * badge them for their own posts.
   */
  it('counts only conversations that mention the user', () => {
    renderHook(() => useUnreadInboxActivity());

    expect(mockListConversations).toHaveBeenCalledWith(
      expect.objectContaining({ filterType: ConversationFilterType.Mentions })
    );
  });

  it('counts only what arrived after the last look at the Inbox', () => {
    renderHook(() => useUnreadInboxActivity());

    expect(mockListConversations).toHaveBeenCalledWith(
      expect.objectContaining({ startTs: 1000 })
    );
  });

  /**
   * A user who has never opened the Inbox has no mark to compare against;
   * counting everything would greet them with a badge for history.
   */
  it('counts nothing before the first visit to the Inbox', () => {
    mockSeenTs = null;

    const { result } = renderHook(() => useUnreadInboxActivity());

    expect(mockListConversations).not.toHaveBeenCalled();
    expect(result.current).toBe(0);
  });
});
