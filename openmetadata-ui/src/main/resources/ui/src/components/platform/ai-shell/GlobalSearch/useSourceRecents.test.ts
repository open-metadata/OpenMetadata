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
import { renderHook, waitFor } from '@testing-library/react';
import { GlobalSearchSourceContribution } from './GlobalSearch.types';
import { useSourceRecents } from './useSourceRecents';

const rows = [{ id: 'r1', title: 'Row', icon: null }];

const source = (
  key: string,
  extra: Partial<GlobalSearchSourceContribution> = {}
): GlobalSearchSourceContribution => ({
  key,
  labelKey: `label.${key}`,
  search: jest.fn(),
  ...extra,
});

describe('useSourceRecents', () => {
  it('loads recent rows labelled by recentLabelKey, falling back to labelKey', async () => {
    const chats = source('chats', {
      recentLabelKey: 'label.recent-chats',
      recent: jest.fn().mockResolvedValue(rows),
    });
    const notes = source('notes', { recent: jest.fn().mockResolvedValue([]) });
    const { result } = renderHook(() =>
      useSourceRecents([chats, source('plain'), notes])
    );

    await waitFor(() =>
      expect(result.current).toEqual([
        { key: 'chats', label: 'label.recent-chats', rows },
        { key: 'notes', label: 'label.notes', rows: [] },
      ])
    );

    expect(chats.recent).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('skips a source whose recent call fails', async () => {
    const { result } = renderHook(() =>
      useSourceRecents([
        source('broken', {
          recent: jest.fn().mockRejectedValue(new Error('boom')),
        }),
        source('chats', { recent: jest.fn().mockResolvedValue(rows) }),
      ])
    );

    await waitFor(() =>
      expect(result.current).toEqual([
        { key: 'chats', label: 'label.chats', rows },
      ])
    );
  });
});
