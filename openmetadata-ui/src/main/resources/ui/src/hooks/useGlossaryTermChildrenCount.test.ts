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
import { act } from 'react';
import { useGlossaryStore } from '../components/Glossary/useGlossary.store';
import { getFirstLevelGlossaryTermsPaginated } from '../rest/glossaryAPI';
import { useGlossaryTermChildrenCount } from './useGlossaryTermChildrenCount';

jest.mock('../rest/glossaryAPI', () => ({
  getFirstLevelGlossaryTermsPaginated: jest.fn(),
}));

const mockGetFirstLevelGlossaryTermsPaginated =
  getFirstLevelGlossaryTermsPaginated as jest.Mock;

describe('useGlossaryTermChildrenCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGlossaryStore.setState({ termsStatusFilter: undefined } as never);
  });

  it('returns 0 by default and does not fetch when fqn is undefined', () => {
    const { result } = renderHook(() =>
      useGlossaryTermChildrenCount(undefined)
    );

    expect(result.current).toBe(0);
    expect(mockGetFirstLevelGlossaryTermsPaginated).not.toHaveBeenCalled();
  });

  it('seeds the returned count from initialCount before the fetch resolves', () => {
    mockGetFirstLevelGlossaryTermsPaginated.mockReturnValue(
      new Promise(() => {})
    );

    const { result } = renderHook(() =>
      useGlossaryTermChildrenCount('Test Glossary', undefined, 3)
    );

    expect(result.current).toBe(3);
  });

  it('requests a status-filtered, count-only page of direct children for the fqn', async () => {
    useGlossaryStore.setState({
      termsStatusFilter: 'Approved,Draft,In Review',
    } as never);
    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
      data: [],
      paging: { total: 4 },
    });

    const { result } = renderHook(() =>
      useGlossaryTermChildrenCount('Test Glossary')
    );

    await waitFor(() => expect(result.current).toBe(4));

    expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledWith(
      'Test Glossary',
      0,
      undefined,
      'Approved,Draft,In Review'
    );
  });

  it('falls back to 0 when the fetch fails', async () => {
    mockGetFirstLevelGlossaryTermsPaginated.mockRejectedValueOnce(
      new Error('network error')
    );

    const { result } = renderHook(() =>
      useGlossaryTermChildrenCount('Test Glossary', undefined, 5)
    );

    await waitFor(() => expect(result.current).toBe(0));
  });

  it('does not update state after unmount (isMounted cleanup)', async () => {
    let resolveFetch: (value: { data: []; paging: { total: number } }) => void;
    mockGetFirstLevelGlossaryTermsPaginated.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result, unmount } = renderHook(() =>
      useGlossaryTermChildrenCount('Test Glossary')
    );

    unmount();

    await act(async () => {
      resolveFetch({ data: [], paging: { total: 9 } });
      // Flush the microtask queue so the (guarded) state update would have
      // run if the isMounted check didn't prevent it.
      await Promise.resolve();
    });

    expect(result.current).toBe(0);
  });

  it('re-fetches when refreshTrigger changes', async () => {
    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
      data: [],
      paging: { total: 2 },
    });

    const { result, rerender } = renderHook(
      ({ refreshTrigger }) =>
        useGlossaryTermChildrenCount('Test Glossary', refreshTrigger),
      { initialProps: { refreshTrigger: 0 } }
    );

    await waitFor(() => expect(result.current).toBe(2));

    expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(1);

    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
      data: [],
      paging: { total: 3 },
    });

    rerender({ refreshTrigger: 1 });

    await waitFor(() => expect(result.current).toBe(3));

    expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(2);
  });

  it('re-fetches when fqn changes', async () => {
    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
      data: [],
      paging: { total: 1 },
    });

    const { result, rerender } = renderHook(
      ({ fqn }) => useGlossaryTermChildrenCount(fqn),
      { initialProps: { fqn: 'Test Glossary.Term A' } }
    );

    await waitFor(() => expect(result.current).toBe(1));

    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
      data: [],
      paging: { total: 7 },
    });

    rerender({ fqn: 'Test Glossary.Term B' });

    await waitFor(() => expect(result.current).toBe(7));

    expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenLastCalledWith(
      'Test Glossary.Term B',
      0,
      undefined,
      undefined
    );
  });

  it('re-fetches when termsStatusFilter changes', async () => {
    useGlossaryStore.setState({
      termsStatusFilter: 'Approved,Draft,In Review',
    } as never);
    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
      data: [],
      paging: { total: 4 },
    });

    const { result, rerender } = renderHook(() =>
      useGlossaryTermChildrenCount('Test Glossary')
    );

    await waitFor(() => expect(result.current).toBe(4));

    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
      data: [],
      paging: { total: 1 },
    });

    act(() => {
      useGlossaryStore.setState({ termsStatusFilter: 'Approved' } as never);
    });
    rerender();

    await waitFor(() => expect(result.current).toBe(1));

    expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenLastCalledWith(
      'Test Glossary',
      0,
      undefined,
      'Approved'
    );
  });
});
