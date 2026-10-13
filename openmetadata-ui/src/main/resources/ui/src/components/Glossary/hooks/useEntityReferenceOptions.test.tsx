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
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import { useUserTeamOptions } from './useEntityReferenceOptions';

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../rest/domainAPI', () => ({
  searchDomains: jest.fn().mockResolvedValue([]),
}));

type SearchResponse = Awaited<ReturnType<typeof searchQuery>>;

const userHits = (...names: string[]) =>
  ({
    hits: {
      hits: names.map((name) => ({
        _source: {
          id: name,
          name,
          displayName: name,
          fullyQualifiedName: name,
        },
      })),
    },
  } as unknown as SearchResponse);

const NO_HITS = { hits: { hits: [] } } as unknown as SearchResponse;

const mockSearchQuery = searchQuery as jest.MockedFunction<typeof searchQuery>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const optionLabels = (options: { label?: string }[]) =>
  options.map((option) => option.label);

describe('useUserTeamOptions', () => {
  beforeEach(() => {
    mockSearchQuery.mockReset();
  });

  it('does not search until the picker is focused', async () => {
    mockSearchQuery.mockResolvedValue(NO_HITS);
    const { result } = renderHook(() => useUserTeamOptions(), {
      wrapper: createWrapper(),
    });

    expect(mockSearchQuery).not.toHaveBeenCalled();

    act(() => result.current.onFocus());

    await waitFor(() => expect(mockSearchQuery).toHaveBeenCalled());
  });

  it('never lets a slow, older search overwrite the results for newer input', async () => {
    let releaseUnfiltered: (() => void) | undefined;

    mockSearchQuery.mockImplementation(({ query, searchIndex }) => {
      if (searchIndex === SearchIndex.TEAM) {
        return Promise.resolve(NO_HITS);
      }
      if (query === 'aaron') {
        return Promise.resolve(userHits('Aaron'));
      }

      // The unfiltered focus search is held back until after "aaron" lands.
      return new Promise((resolve) => {
        releaseUnfiltered = () => resolve(userHits('Adam', 'Aaron', 'Zoe'));
      });
    });

    const { result } = renderHook(() => useUserTeamOptions(), {
      wrapper: createWrapper(),
    });

    act(() => result.current.onFocus());
    act(() => result.current.onSearchChange('aaron'));

    await waitFor(() =>
      expect(optionLabels(result.current.options)).toEqual(['Aaron'])
    );

    await act(async () => releaseUnfiltered?.());

    expect(optionLabels(result.current.options)).toEqual(['Aaron']);
  });

  it('keeps the owners and reviewers pickers independent', async () => {
    mockSearchQuery.mockImplementation(({ query, searchIndex }) => {
      if (searchIndex === SearchIndex.TEAM) {
        return Promise.resolve(NO_HITS);
      }

      return Promise.resolve(
        userHits(query === 'aaron' ? 'Aaron' : 'Everyone')
      );
    });

    const { result } = renderHook(
      () => ({ owners: useUserTeamOptions(), reviewers: useUserTeamOptions() }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.owners.onFocus();
      result.current.reviewers.onFocus();
    });
    act(() => result.current.owners.onSearchChange('aaron'));

    await waitFor(() =>
      expect(optionLabels(result.current.owners.options)).toEqual(['Aaron'])
    );

    expect(optionLabels(result.current.reviewers.options)).toEqual([
      'Everyone',
    ]);
  });
});
