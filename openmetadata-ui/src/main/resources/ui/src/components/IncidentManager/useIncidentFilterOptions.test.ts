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
import APIClient from '../../rest/index';
import { getUserAndTeamSearch } from '../../rest/miscAPI';
import { useIncidentFilterOptions } from './useIncidentFilterOptions';

jest.mock('../../rest/miscAPI', () => ({
  getUserAndTeamSearch: jest.fn(),
}));

jest.mock('../../rest/index', () => ({
  get: jest.fn(),
}));

const mockGetUserAndTeamSearch = getUserAndTeamSearch as jest.Mock;
const mockGet = APIClient.get as jest.Mock;

type TestCaseOption = { label: string; value?: string };

describe('useIncidentFilterOptions', () => {
  beforeEach(() => {
    mockGetUserAndTeamSearch.mockResolvedValue({
      data: { hits: { hits: [] } },
    });
    mockGet.mockResolvedValue({ data: { hits: { hits: [] } } });
  });

  it('should expose the default option state and helper functions', () => {
    const { result } = renderHook(() =>
      useIncidentFilterOptions({ filters: {} })
    );

    expect(result.current.users).toEqual({ options: [] });
    expect(result.current.testCaseFilterOptions).toEqual([]);
    expect(result.current.isTestCaseOptionsLoading).toBe(false);
    expect(result.current.assigneeOptionsWithSelected).toEqual([]);
    expect(result.current.selectedAssignees).toEqual([]);
    expect(typeof result.current.setUsers).toBe('function');
    expect(typeof result.current.fetchUserFilterOptions).toBe('function');
    expect(typeof result.current.searchTestCases).toBe('function');
    expect(typeof result.current.fetchTestCaseFilterOptions).toBe('function');
  });

  it('should synthesize a selected assignee option when it is not already loaded', () => {
    const { result } = renderHook(() =>
      useIncidentFilterOptions({ filters: { assignee: 'ua' } })
    );

    expect(result.current.assigneeOptionsWithSelected).toEqual([
      { label: 'ua', value: 'ua', name: 'ua', type: 'user' },
    ]);
    expect(result.current.selectedAssignees).toEqual([
      { label: 'ua', value: 'ua', name: 'ua', type: 'user' },
    ]);
  });

  it('should not duplicate the selected assignee when it is already in the options', () => {
    const { result } = renderHook(() =>
      useIncidentFilterOptions({ filters: { assignee: 'ua' } })
    );

    act(() => {
      result.current.setUsers({
        options: [{ label: 'UA', value: 'ua', name: 'ua', type: 'user' }],
      });
    });

    expect(result.current.assigneeOptionsWithSelected).toEqual([
      { label: 'UA', value: 'ua', name: 'ua', type: 'user' },
    ]);
    expect(result.current.selectedAssignees).toEqual([
      { label: 'UA', value: 'ua', name: 'ua', type: 'user' },
    ]);
  });

  it('should skip the user search and keep options empty for an empty query', async () => {
    const { result } = renderHook(() =>
      useIncidentFilterOptions({ filters: {} })
    );

    await act(async () => {
      await result.current.fetchUserFilterOptions('');
    });

    expect(mockGetUserAndTeamSearch).not.toHaveBeenCalled();
    expect(result.current.users).toEqual({ options: [] });
  });

  it('should map the user search response into assignee options', async () => {
    mockGetUserAndTeamSearch.mockResolvedValueOnce({
      data: {
        hits: {
          hits: [
            {
              _source: {
                name: 'bob',
                entityType: 'user',
                displayName: 'Bob',
              },
            },
          ],
        },
      },
    });
    const { result } = renderHook(() =>
      useIncidentFilterOptions({ filters: {} })
    );

    await act(async () => {
      await result.current.fetchUserFilterOptions('bob');
    });

    expect(mockGetUserAndTeamSearch).toHaveBeenCalledWith('bob', true);
    expect(result.current.users.options).toEqual([
      { label: 'Bob', value: 'bob', type: 'user', name: 'bob' },
    ]);
  });

  it('should reset the assignee options to empty when the user search rejects', async () => {
    const { result } = renderHook(() =>
      useIncidentFilterOptions({ filters: {} })
    );

    act(() => {
      result.current.setUsers({
        options: [{ label: 'seed', value: 'seed', type: 'user' }],
      });
    });
    mockGetUserAndTeamSearch.mockRejectedValueOnce(new Error('boom'));

    await act(async () => {
      await result.current.fetchUserFilterOptions('bob');
    });

    expect(result.current.users.options).toEqual([]);
  });

  it('should query the test-case index with the wildcard and map fqn options', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        hits: {
          hits: [
            {
              _source: {
                fullyQualifiedName: 'svc.db.tc',
                name: 'tc',
                displayName: 'TC',
              },
            },
          ],
        },
      },
    });
    const { result } = renderHook(() =>
      useIncidentFilterOptions({ filters: {} })
    );

    let options: TestCaseOption[] = [];
    await act(async () => {
      options = await result.current.searchTestCases();
    });

    expect(mockGet).toHaveBeenCalledWith(
      '/search/query?q=*',
      expect.objectContaining({
        params: expect.objectContaining({
          from: 0,
          size: 15,
          index: 'testCase',
          fetch_source: true,
          include_source_fields: ['name', 'displayName', 'fullyQualifiedName'],
        }),
      })
    );
    expect(options).toEqual([{ label: 'TC', value: 'svc.db.tc' }]);
  });

  it.each(['a#b', 'a&b', 'a+b', '100% complete', 'literal%20value', '測試 ✓'])(
    'should preserve %s in the test-case HTTP query and returned options',
    async (query) => {
      mockGet.mockResolvedValueOnce({
        data: {
          hits: {
            hits: [
              {
                _source: {
                  fullyQualifiedName: 'svc.db.tc',
                  name: 'tc',
                  displayName: query,
                },
              },
            ],
          },
        },
      });
      const { result } = renderHook(() =>
        useIncidentFilterOptions({ filters: {} })
      );

      let options: TestCaseOption[] = [];
      await act(async () => {
        options = await result.current.searchTestCases(query);
      });

      expect(mockGet).toHaveBeenCalledTimes(1);

      const url = new URL(mockGet.mock.calls[0][0], 'http://localhost');

      expect(url.pathname).toBe('/search/query');
      expect(Array.from(url.searchParams.entries())).toEqual([['q', query]]);
      expect(url.hash).toBe('');
      expect(options).toEqual([{ label: query, value: 'svc.db.tc' }]);
    }
  );

  it('should return an empty test-case list when the search rejects', async () => {
    mockGet.mockRejectedValueOnce(new Error('nope'));
    const { result } = renderHook(() =>
      useIncidentFilterOptions({ filters: {} })
    );

    let options: TestCaseOption[] = [{ label: 'stale', value: 'stale' }];
    await act(async () => {
      options = await result.current.searchTestCases();
    });

    expect(options).toEqual([]);
  });

  it('should toggle the loading flag and store only fqn-backed test-case options', async () => {
    let resolveSearch: (value: unknown) => void = (_value) => undefined;
    mockGet.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        })
    );
    const { result } = renderHook(() =>
      useIncidentFilterOptions({ filters: {} })
    );

    act(() => {
      void result.current.fetchTestCaseFilterOptions();
    });

    expect(result.current.isTestCaseOptionsLoading).toBe(true);

    await act(async () => {
      resolveSearch({
        data: {
          hits: {
            hits: [
              {
                _source: {
                  fullyQualifiedName: 'svc.db.tc',
                  name: 'tc',
                  displayName: 'TC',
                },
              },
              {
                _source: {
                  fullyQualifiedName: undefined,
                  name: 'nofqn',
                  displayName: 'NoFQN',
                },
              },
            ],
          },
        },
      });
    });

    await waitFor(() =>
      expect(result.current.isTestCaseOptionsLoading).toBe(false)
    );

    expect(result.current.testCaseFilterOptions).toEqual([
      { value: 'svc.db.tc', label: 'TC' },
    ]);
  });
});
