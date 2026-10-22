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
import { act, renderHook, waitFor } from '@testing-library/react';
import { SearchIndex } from '../../../../enums/search.enum';
import { User } from '../../../../generated/entity/teams/user';
import { searchQuery } from '../../../../rest/searchAPI';
import { UserAssetsKind } from './UserAssets.utils';
import { useUserAssetsList } from './useUserAssetsList';

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

const mockSearchQuery = searchQuery as jest.Mock;

const user = {
  id: 'u1',
  name: 'alice',
  teams: [{ id: 't1', type: 'team' }],
} as User;

const page = (ids: string[], total: number) => ({
  hits: {
    total: { value: total },
    hits: ids.map((id) => ({ _source: { id } })),
  },
});

const lastRequest = () => mockSearchQuery.mock.calls.at(-1)[0];

const renderList = (
  kind: UserAssetsKind = 'owned',
  search = '',
  indexes: string[] = []
) =>
  renderHook(
    (props) => useUserAssetsList(props.kind, user, props.search, props.indexes),
    { initialProps: { kind, search, indexes } }
  );

describe('useUserAssetsList', () => {
  beforeEach(() => mockSearchQuery.mockReset());

  it('loads the first page of owned assets over every data asset', async () => {
    mockSearchQuery.mockResolvedValue(page(['a', 'b'], 2));
    const { result } = renderList();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.assets.map((a) => a.id)).toEqual(['a', 'b']);
    expect(result.current.total).toBe(2);
    expect(result.current.hasMore).toBe(false);

    const request = lastRequest();

    expect(request).toEqual(
      expect.objectContaining({
        pageNumber: 1,
        pageSize: 15,
        query: '',
        searchIndex: SearchIndex.DATA_ASSET,
      })
    );
    expect(JSON.stringify(request.queryFilter)).toContain('"owners.id":"t1"');
  });

  it('filters followed assets by the user id', async () => {
    mockSearchQuery.mockResolvedValue(page([], 0));
    const { result } = renderList('following');

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(JSON.stringify(lastRequest().queryFilter)).toContain(
      '"followers":"u1"'
    );
  });

  it('passes the search text as a wildcard and the chosen indexes', async () => {
    mockSearchQuery.mockResolvedValue(page([], 0));
    const { result } = renderList('owned', 'ord', [SearchIndex.TABLE]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(lastRequest()).toEqual(
      expect.objectContaining({
        query: '*ord*',
        searchIndex: [SearchIndex.TABLE],
      })
    );
  });

  it('appends the next page on load more', async () => {
    mockSearchQuery.mockResolvedValueOnce(page(['a', 'b'], 3));
    const { result } = renderList();

    await waitFor(() => expect(result.current.hasMore).toBe(true));

    mockSearchQuery.mockResolvedValueOnce(page(['c'], 3));
    act(() => result.current.loadMore());

    await waitFor(() =>
      expect(result.current.assets.map((a) => a.id)).toEqual(['a', 'b', 'c'])
    );

    expect(lastRequest().pageNumber).toBe(2);
    expect(result.current.hasMore).toBe(false);
  });

  it('starts again from page one when the search changes', async () => {
    mockSearchQuery.mockResolvedValueOnce(page(['a'], 2));
    const { result, rerender } = renderList();
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    mockSearchQuery.mockResolvedValueOnce(page(['b'], 2));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.assets).toHaveLength(2));

    mockSearchQuery.mockResolvedValueOnce(page(['z'], 1));
    rerender({ kind: 'owned', search: 'z', indexes: [] });

    await waitFor(() =>
      expect(result.current.assets.map((a) => a.id)).toEqual(['z'])
    );

    expect(lastRequest()).toEqual(
      expect.objectContaining({ pageNumber: 1, query: '*z*' })
    );
  });

  it('empties the list when the first page fails', async () => {
    mockSearchQuery.mockRejectedValue(new Error('boom'));
    const { result } = renderList();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.assets).toEqual([]);
    expect(result.current.total).toBe(0);
  });
});
