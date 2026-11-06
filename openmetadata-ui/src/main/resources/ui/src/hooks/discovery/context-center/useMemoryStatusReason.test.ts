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
import { createElement, ReactNode } from 'react';
import {
  ContextMemory,
  ContextMemoryStatus,
} from '../../../generated/entity/context/contextMemory';
import { getContextMemoryVersions } from '../../../rest/contextMemoryAPI';
import {
  getRetiredQueryId,
  useMemoryStatusReason,
} from './useMemoryStatusReason';

jest.mock('react-i18next', () => {
  // One object across renders, like the global mock; echoes the Query a translated reason names.
  const translation = {
    t: (key: string, options?: { query?: string }) =>
      options?.query === undefined ? key : `${key}:${options.query}`,
    i18n: { language: 'en-US', dir: () => 'ltr' },
  };

  return {
    ...jest.requireActual('react-i18next'),
    useTranslation: () => translation,
  };
});

jest.mock('../../../rest/contextMemoryAPI', () => ({
  getContextMemoryVersions: jest.fn(),
}));

const QUERY_ID = '6f1c2a5e-0b8e-4c55-9d43-2f0e6c1b7a10';
const HELD_REASON = `Supporting query ${QUERY_ID} was deleted; review whether this memory still holds without it`;
const SHOWN_NAMED = 'message.memory-supporting-query-deleted:Monthly expenses';
const SHOWN_WITH_ID = `message.memory-supporting-query-deleted:${QUERY_ID}`;

const heldMemory: ContextMemory = {
  id: 'memory-id',
  name: 'expense-limit',
  entityStatus: ContextMemoryStatus.Draft,
  statusReason: HELD_REASON,
};

// Versions newest first: the hold removed the Query, the one before still cites it.
const historyCiting = (query: Record<string, unknown>) => ({
  entityType: 'contextMemory',
  versions: [
    JSON.stringify({ ...heldMemory, relatedEntities: [] }),
    JSON.stringify({ ...heldMemory, relatedEntities: [query] }),
  ],
});

describe('getRetiredQueryId', () => {
  it('reads the Query id out of the hold reason only', () => {
    expect(getRetiredQueryId(HELD_REASON)).toBe(QUERY_ID);
    expect(
      getRetiredQueryId('Conflicts with an approved memory')
    ).toBeUndefined();
    expect(
      getRetiredQueryId(
        'Supporting query was deleted; review whether this memory still holds without it'
      )
    ).toBeUndefined();
    expect(getRetiredQueryId(undefined)).toBeUndefined();
  });
});

const newQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

const renderReason = (
  memory: ContextMemory,
  queryClient: QueryClient = newQueryClient()
) => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return renderHook(() => useMemoryStatusReason(memory), { wrapper });
};

describe('useMemoryStatusReason', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('names the deleted Query for a viewer its history shows it to', async () => {
    (getContextMemoryVersions as jest.Mock).mockResolvedValue(
      historyCiting({
        id: QUERY_ID,
        type: 'query',
        name: 'monthly_expenses',
        displayName: 'Monthly expenses',
      })
    );

    const { result } = renderReason(heldMemory);

    await waitFor(() => expect(result.current).toBe(SHOWN_NAMED));

    expect(getContextMemoryVersions).toHaveBeenCalledWith('memory-id');
  });

  // A held card and its panel, or a remount, share one lookup instead of each reading the history.
  it("reads a memory's history once for every view of it", async () => {
    (getContextMemoryVersions as jest.Mock).mockResolvedValue(
      historyCiting({
        id: QUERY_ID,
        type: 'query',
        displayName: 'Monthly expenses',
      })
    );
    const queryClient = newQueryClient();

    const card = renderReason(heldMemory, queryClient);
    const panel = renderReason(heldMemory, queryClient);

    await waitFor(() => expect(card.result.current).toBe(SHOWN_NAMED));
    await waitFor(() => expect(panel.result.current).toBe(SHOWN_NAMED));

    expect(getContextMemoryVersions).toHaveBeenCalledTimes(1);
  });

  // The server keeps only the id and type of a Query the caller may not view.
  it('shows the id, translated, for a viewer the Query is hidden from', async () => {
    (getContextMemoryVersions as jest.Mock).mockResolvedValue(
      historyCiting({ id: QUERY_ID, type: 'query' })
    );

    const { result } = renderReason(heldMemory);

    await waitFor(() => expect(getContextMemoryVersions).toHaveBeenCalled());

    expect(result.current).toBe(SHOWN_WITH_ID);
  });

  it.each([
    [
      'the history cannot be read',
      () => Promise.reject({ response: { status: 403 } }),
    ],
    [
      'no version names the Query',
      () => Promise.resolve({ entityType: 'contextMemory', versions: [] }),
    ],
  ])('keeps the id when %s', async (_, versions) => {
    (getContextMemoryVersions as jest.Mock).mockImplementation(versions);

    const { result } = renderReason(heldMemory);

    await waitFor(() => expect(getContextMemoryVersions).toHaveBeenCalled());

    expect(result.current).toBe(SHOWN_WITH_ID);
  });

  it('reads no history for any other reason', () => {
    const { result } = renderReason({
      ...heldMemory,
      statusReason: 'Conflicts with an approved memory',
    });

    expect(result.current).toBe('Conflicts with an approved memory');
    expect(getContextMemoryVersions).not.toHaveBeenCalled();
  });
});
