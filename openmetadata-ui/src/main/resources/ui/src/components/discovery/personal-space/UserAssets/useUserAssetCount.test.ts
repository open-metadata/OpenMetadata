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
import { SearchIndex } from '../../../../enums/search.enum';
import { User } from '../../../../generated/entity/teams/user';
import { searchQuery } from '../../../../rest/searchAPI';
import { useUserAssetCount } from './useUserAssetCount';

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

const mockSearchQuery = searchQuery as jest.Mock;

const user = {
  id: 'u1',
  name: 'alice',
  teams: [{ id: 't1', type: 'team' }],
} as User;

describe('useUserAssetCount', () => {
  beforeEach(() => mockSearchQuery.mockReset());

  it('counts owned assets across the user and their teams', async () => {
    mockSearchQuery.mockResolvedValue({ hits: { total: { value: 7 } } });
    const { result } = renderHook(() => useUserAssetCount(user, 'owned'));

    await waitFor(() => expect(result.current).toBe(7));

    const request = mockSearchQuery.mock.calls[0][0];

    expect(request).toEqual(
      expect.objectContaining({
        pageSize: 0,
        searchIndex: SearchIndex.DATA_ASSET,
      })
    );
    expect(JSON.stringify(request.queryFilter)).toContain('"owners.id":"u1"');
    expect(JSON.stringify(request.queryFilter)).toContain('"owners.id":"t1"');
  });

  it('counts followed assets by the user id only', async () => {
    mockSearchQuery.mockResolvedValue({ hits: { total: { value: 2 } } });
    const { result } = renderHook(() => useUserAssetCount(user, 'following'));

    await waitFor(() => expect(result.current).toBe(2));

    const filter = JSON.stringify(mockSearchQuery.mock.calls[0][0].queryFilter);

    expect(filter).toContain('"followers":"u1"');
    expect(filter).not.toContain('t1');
  });

  it('stays undefined without a user and does not search', () => {
    const { result } = renderHook(() => useUserAssetCount(undefined, 'owned'));

    expect(result.current).toBeUndefined();
    expect(mockSearchQuery).not.toHaveBeenCalled();
  });

  it('stays undefined when the search fails', async () => {
    mockSearchQuery.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useUserAssetCount(user, 'owned'));

    await waitFor(() => expect(mockSearchQuery).toHaveBeenCalled());

    expect(result.current).toBeUndefined();
  });

  it('does not refetch for a new user object with the same ids', async () => {
    mockSearchQuery.mockResolvedValue({ hits: { total: { value: 1 } } });
    const { result, rerender } = renderHook(
      ({ u }) => useUserAssetCount(u, 'owned'),
      { initialProps: { u: user } }
    );
    await waitFor(() => expect(result.current).toBe(1));

    rerender({ u: { ...user } });

    expect(mockSearchQuery).toHaveBeenCalledTimes(1);
  });
});
