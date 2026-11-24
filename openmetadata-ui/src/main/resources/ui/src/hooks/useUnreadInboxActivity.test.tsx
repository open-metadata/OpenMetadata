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

const mockListConversations = jest.fn();
const mockListTasks = jest.fn();
let mockSeenTs: number | null = 1000;

jest.mock('../rest/conversationsAPI', () => ({
  listConversations: (...args: unknown[]) => mockListConversations(...args),
}));

jest.mock('../rest/tasksAPI', () => ({
  listTasks: (...args: unknown[]) => mockListTasks(...args),
}));

jest.mock('./useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'user-1', name: 'admin' } }),
}));

jest.mock('./usePersonalSpaceStore', () => ({
  usePersonalSpaceStore: (selector: (s: unknown) => unknown) =>
    selector({ inboxActivitySeenTs: mockSeenTs }),
}));

import { ConversationFilterType } from '../generated/type/conversationFilterType';
import { useUnreadInboxActivity } from './useUnreadInboxActivity';

const renderUnreadCount = () => {
  const client = new QueryClient();

  return renderHook(() => useUnreadInboxActivity(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
};

describe('useUnreadInboxActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSeenTs = 1000;
    mockListConversations.mockResolvedValue({ paging: { total: 7 } });
    mockListTasks.mockResolvedValue({ data: [] });
  });

  /**
   * OWNER_OR_FOLLOWS also matches conversations the user created, which would
   * badge them for their own posts.
   */
  it('queries conversations that mention the user', () => {
    renderUnreadCount();

    expect(mockListConversations).toHaveBeenCalledWith(
      expect.objectContaining({ filterType: ConversationFilterType.Mentions })
    );
  });

  it('counts only what arrived after the last look at the Inbox', () => {
    renderUnreadCount();

    expect(mockListConversations).toHaveBeenCalledWith(
      expect.objectContaining({ startTs: 1000 })
    );
  });

  it('adds unread task comments that mention the current user', async () => {
    mockListTasks.mockResolvedValue({
      data: [
        {
          comments: [
            { createdAt: 900, message: '<#E::user::admin|[@admin](url)>' },
            { createdAt: 1100, message: '<#E::user::admin|[@admin](url)>' },
            { createdAt: 1200, message: '<#E::user::someone|[@someone](url)>' },
          ],
        },
      ],
    });

    const { result } = renderUnreadCount();

    await waitFor(() => expect(result.current).toBe(8));

    expect(mockListTasks).toHaveBeenCalledWith(
      expect.objectContaining({ updatedSince: 1001 })
    );
  });

  it('caps task mentions for the sidebar badge without walking older history', async () => {
    mockListConversations.mockResolvedValue({ paging: { total: 0 } });
    mockListTasks
      .mockResolvedValueOnce({
        data: [
          {
            id: 'task',
            updatedAt: 1500,
            comments: Array.from({ length: 110 }, (_, index) => ({
              createdAt: 1200 + index,
              message: '<#E::user::admin>',
            })),
          },
          { id: 'older', updatedAt: 1100 },
        ],
        paging: { after: 'history' },
      })
      .mockResolvedValue({ data: [] });
    const { result } = renderUnreadCount();
    await waitFor(() => expect(result.current).toBe(100));

    expect(mockListTasks).toHaveBeenCalledTimes(1);
  });

  /**
   * A user who has never opened the Inbox has no mark to compare against;
   * counting everything would greet them with a badge for history.
   */
  it('counts nothing before the first visit to the Inbox', () => {
    mockSeenTs = null;

    const { result } = renderUnreadCount();

    expect(mockListConversations).not.toHaveBeenCalled();
    expect(mockListTasks).not.toHaveBeenCalled();
    expect(result.current).toBe(0);
  });
});
