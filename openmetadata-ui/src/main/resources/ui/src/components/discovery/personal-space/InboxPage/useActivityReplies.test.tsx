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

const mockListActivityReplies = jest.fn();
const mockCreateActivityReply = jest.fn();
const mockListConversationReplies = jest.fn();
const mockCreateConversationReply = jest.fn();

jest.mock('rest/activityAPI', () => ({
  listActivityReplies: (...a: unknown[]) => mockListActivityReplies(...a),
  createActivityReply: (...a: unknown[]) => mockCreateActivityReply(...a),
}));

jest.mock('rest/conversationsAPI', () => ({
  listConversationReplies: (...a: unknown[]) =>
    mockListConversationReplies(...a),
  createConversationReply: (...a: unknown[]) =>
    mockCreateConversationReply(...a),
}));

import { createThreadReply, useActivityReplies } from './useActivityReplies';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const twoReplies = { data: [{ id: 'r1' }, { id: 'r2' }] };

describe('useActivityReplies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListActivityReplies.mockResolvedValue(twoReplies);
    mockListConversationReplies.mockResolvedValue(twoReplies);
  });

  // An activity's replies live in a conversation whose id is the activity id
  // (open-metadata/OpenMetadata#30909).
  it('reads an activity’s replies through the activity', async () => {
    const { result } = renderHook(
      () => useActivityReplies({ activityId: 'A' }, true),
      { wrapper }
    );

    await waitFor(() => expect(result.current.replies).toHaveLength(2));

    expect(result.current.threadId).toBe('A');
    expect(mockListActivityReplies).toHaveBeenCalledWith('A', {
      limit: 100,
      after: undefined,
    });
    expect(mockListConversationReplies).not.toHaveBeenCalled();
  });

  it('reads a conversation’s replies through the conversation', async () => {
    const { result } = renderHook(
      () => useActivityReplies({ conversationId: 'T' }, true),
      { wrapper }
    );

    await waitFor(() => expect(result.current.replies).toHaveLength(2));

    expect(mockListConversationReplies).toHaveBeenCalledWith('T', {
      limit: 100,
      after: undefined,
    });
  });

  // Replies come oldest first a page at a time: the newest, including one just
  // posted, sit on the last page.
  it('reads a long thread page by page to its newest reply', async () => {
    mockListActivityReplies
      .mockResolvedValueOnce({ data: [{ id: 'r1' }], paging: { after: 'p2' } })
      .mockResolvedValueOnce({ data: [{ id: 'r2' }], paging: { after: 'p3' } })
      .mockResolvedValueOnce({ data: [{ id: 'r3' }], paging: {} });

    const { result } = renderHook(
      () => useActivityReplies({ activityId: 'A' }, true),
      { wrapper }
    );

    await waitFor(() =>
      expect(result.current.replies.map(({ id }) => id)).toEqual([
        'r1',
        'r2',
        'r3',
      ])
    );

    expect(mockListActivityReplies).toHaveBeenLastCalledWith('A', {
      limit: 100,
      after: 'p3',
    });
  });

  it('stops paging at the read cap', async () => {
    mockListActivityReplies.mockImplementation(
      (_id: string, { after }: { after?: string }) =>
        Promise.resolve({
          data: [{ id: after ?? 'first' }],
          paging: { after: `${after ?? ''}x` },
        })
    );

    const { result } = renderHook(
      () => useActivityReplies({ activityId: 'A' }, true),
      { wrapper }
    );

    await waitFor(() => expect(result.current.replies).toHaveLength(10));

    expect(mockListActivityReplies).toHaveBeenCalledTimes(10);
  });

  it('waits until the card is on screen', () => {
    const { result } = renderHook(
      () => useActivityReplies({ activityId: 'A' }, false),
      { wrapper }
    );

    expect(result.current.replies).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(mockListActivityReplies).not.toHaveBeenCalled();
  });
});

describe('createThreadReply', () => {
  it('replies to an activity through the activity', () => {
    createThreadReply('hi', { activityId: 'A' });

    expect(mockCreateActivityReply).toHaveBeenCalledWith('A', {
      message: 'hi',
    });
  });

  it('replies to a conversation through the conversation', () => {
    createThreadReply('hi', { conversationId: 'T' });

    expect(mockCreateConversationReply).toHaveBeenCalledWith('T', {
      message: 'hi',
    });
  });
});
