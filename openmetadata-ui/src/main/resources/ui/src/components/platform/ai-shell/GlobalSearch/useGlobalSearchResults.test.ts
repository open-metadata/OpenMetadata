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
import { act, renderHook } from '@testing-library/react';
import { EntityFields } from '../../../../enums/AdvancedSearch.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { TaskStatus, TaskType } from '../../../../generated/entity/tasks/task';
import {
  searchEntityTypeCounts,
  searchQuery,
} from '../../../../rest/searchAPI';
import { listTasks } from '../../../../rest/tasksAPI';
import { getEntityNameLabel } from '../../../../utils/EntityNameUtils';
import { GLOBAL_SEARCH_DEBOUNCE_MS } from './GlobalSearch.constants';
import { GlobalSearchSourceContribution } from './GlobalSearch.types';
import { getFacetQueryFilter } from './GlobalSearch.utils';
import {
  canOpenEntityType,
  getEntityRowMeta,
  getFqnParents,
  GlobalSearchQuery,
  useGlobalSearchResults,
} from './useGlobalSearchResults';

jest.mock('../../../../utils/i18next/LocalUtil', () => ({
  t: (key: string, options?: { entity?: string }) =>
    options?.entity ? `${key}:${options.entity}` : key,
}));

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
  searchEntityTypeCounts: jest.fn(),
}));

jest.mock('../../../../rest/tasksAPI', () => ({
  listTasks: jest.fn(),
}));

const hit = (id: string, entityType: string) => ({
  _source: {
    id,
    name: id,
    displayName: id,
    entityType,
    fullyQualifiedName: `svc.db.schema.${id}`,
  },
});

const counts = (buckets: [string, number][]) => ({
  aggregations: {
    entityType: {
      buckets: buckets.map(([key, doc_count]) => ({ key, doc_count })),
    },
  },
});

const hits = (total: number, list: ReturnType<typeof hit>[]) => ({
  hits: { total: { value: total }, hits: list },
});

const chatsSource: GlobalSearchSourceContribution = {
  key: 'chats',
  labelKey: 'label.chats',
  search: jest.fn(),
};

const baseParams: GlobalSearchQuery = {
  query: 'customer',
  filter: 'all',
  facets: {},
  sort: '_score',
  sortOrder: 'desc',
  sources: [],
  retryKey: 0,
};

const flushDebounce = async () => {
  await act(async () => {
    jest.advanceTimersByTime(GLOBAL_SEARCH_DEBOUNCE_MS);
  });
};

describe('canOpenEntityType', () => {
  it('keeps types the UI has a page for and drops the rest', () => {
    expect(canOpenEntityType('table')).toBe(true);
    expect(canOpenEntityType('glossaryTerm')).toBe(true);
    expect(canOpenEntityType('domain')).toBe(true);
    expect(canOpenEntityType('aiFrameworkControl')).toBe(false);
    expect(canOpenEntityType('relationshipType')).toBe(false);
  });
});

describe('getEntityRowMeta', () => {
  it('shows the type and the full parent breadcrumb', () => {
    expect(getEntityRowMeta('table', ['svc', 'db', 'schema'])).toBe(
      'label.table · svc › db › schema'
    );
  });

  it('names the table a column belongs to, then the rest of the path', () => {
    expect(
      getEntityRowMeta('tableColumn', getFqnParents('svc.db.schema.orders.id'))
    ).toBe('label.column-in-entity:orders · svc › db › schema');
  });
});

describe('useGlobalSearchResults', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (chatsSource.search as jest.Mock).mockResolvedValue({
      count: 1,
      rows: [{ id: 'c1', title: 'Chat', icon: null }],
    });
    (searchEntityTypeCounts as jest.Mock).mockImplementation(
      ({ searchIndex }: { searchIndex: string[] }) =>
        Promise.resolve(
          searchIndex[0] === SearchIndex.DATA_ASSET
            ? counts([
                ['table', 2],
                ['topic', 1],
              ])
            : counts([
                ['table', 2],
                ['topic', 1],
                ['glossaryTerm', 3],
                ['domain', 0],
              ])
        )
    );
    (searchQuery as jest.Mock).mockImplementation(({ searchIndex }) =>
      Promise.resolve(
        searchIndex === SearchIndex.DATA_ASSET
          ? hits(3, [hit('t1', 'table'), hit('t2', 'topic')])
          : hits(3, [hit('g1', 'glossaryTerm')])
      )
    );
    (listTasks as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not search for an empty query', async () => {
    const { result } = renderHook(() =>
      useGlobalSearchResults({ ...baseParams, query: '   ' })
    );
    await flushDebounce();

    expect(searchQuery).not.toHaveBeenCalled();
    expect(searchEntityTypeCounts).not.toHaveBeenCalled();
    expect(listTasks).not.toHaveBeenCalled();
    expect(result.current).toEqual({
      results: {},
      isLoading: false,
      isQueryLoading: false,
      isListLoading: false,
      isCounting: false,
      hasError: false,
    });
  });

  it('debounces the search and shows the typing loader, not skeletons, until it settles', async () => {
    const { result } = renderHook(() => useGlobalSearchResults(baseParams));

    expect(result.current.isQueryLoading).toBe(true);
    expect(result.current.isListLoading).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(GLOBAL_SEARCH_DEBOUNCE_MS - 1);
    });

    expect(searchEntityTypeCounts).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(searchEntityTypeCounts).toHaveBeenCalledTimes(2);
    expect(listTasks).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'customer' }),
      expect.any(AbortSignal)
    );
    expect(searchEntityTypeCounts).toHaveBeenCalledWith(
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result.current.isLoading).toBe(false);
  });

  it('rolls data asset types into assets and gives other types their own key', async () => {
    const { result } = renderHook(() => useGlobalSearchResults(baseParams));
    await flushDebounce();

    const { results } = result.current;

    expect(Object.keys(results).sort()).toEqual([
      'assets',
      'glossaryTerm',
      'tasks',
    ]);
    expect(results.assets.count).toBe(3);
    expect(results.assets.rows.map((row) => row.id)).toEqual(['t1', 't2']);
    expect(results.glossaryTerm).toEqual(
      expect.objectContaining({
        count: 3,
        label: getEntityNameLabel('glossaryTerm'),
      })
    );
    expect(results.glossaryTerm.rows[0].id).toBe('g1');
    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        searchIndex: SearchIndex.ALL,
        queryFilter: {
          query: {
            bool: {
              must: [
                {
                  term: { [EntityFields.ENTITY_TYPE_KEYWORD]: 'glossaryTerm' },
                },
              ],
            },
          },
        },
      })
    );
  });

  it('keeps the other sources when one fails', async () => {
    (listTasks as jest.Mock).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() =>
      useGlobalSearchResults({ ...baseParams, sources: [chatsSource] })
    );
    await flushDebounce();

    expect(result.current.hasError).toBe(false);
    expect(result.current.results.tasks).toBeUndefined();
    expect(result.current.results.chats.count).toBe(1);
    expect(result.current.results.assets.count).toBe(3);
  });

  it('shows the error when one source fails and nothing else matched', async () => {
    (searchEntityTypeCounts as jest.Mock).mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => useGlobalSearchResults(baseParams));
    await flushDebounce();

    expect(result.current.results.tasks.count).toBe(0);
    expect(result.current.hasError).toBe(true);
  });

  it('sends the task filters and sort only from their own tab', async () => {
    const filtered = {
      ...baseParams,
      sort: 'updatedAt',
      sortOrder: 'asc',
      taskStatus: TaskStatus.Open,
      taskType: TaskType.DescriptionUpdate,
    };
    renderHook(() => useGlobalSearchResults(filtered));
    await flushDebounce();

    expect(listTasks).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined, type: undefined }),
      expect.any(AbortSignal)
    );
    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        searchIndex: SearchIndex.DATA_ASSET,
        sortField: '_score',
        sortOrder: 'desc',
      })
    );
  });

  it('refetches only the open tab when its filters change after a query loaded', async () => {
    const { rerender } = renderHook(
      (props: GlobalSearchQuery) => useGlobalSearchResults(props),
      { initialProps: baseParams }
    );
    await flushDebounce();
    (searchEntityTypeCounts as jest.Mock).mockClear();
    (listTasks as jest.Mock).mockClear();
    (searchQuery as jest.Mock).mockClear();

    rerender({ ...baseParams, filter: 'tasks', taskStatus: TaskStatus.Open });
    await flushDebounce();

    expect(listTasks).toHaveBeenCalledWith(
      expect.objectContaining({ status: TaskStatus.Open }),
      expect.any(AbortSignal)
    );
    expect(searchEntityTypeCounts).not.toHaveBeenCalled();
    expect(searchQuery).not.toHaveBeenCalled();
  });

  it('reloads every type when leaving a tab its own filters narrowed', async () => {
    const facets = {
      [EntityFields.OWNERS]: [{ key: 'alice', label: 'Alice' }],
    };
    const onAssets: GlobalSearchQuery = {
      ...baseParams,
      filter: 'assets',
      facets,
    };
    const { result, rerender } = renderHook(
      (props: GlobalSearchQuery) => useGlobalSearchResults(props),
      { initialProps: onAssets }
    );
    await flushDebounce();
    (searchEntityTypeCounts as jest.Mock).mockClear();
    // The owner filter narrowed Data assets to nothing.
    (searchQuery as jest.Mock).mockResolvedValueOnce(hits(0, []));
    rerender({ ...onAssets, facets: { ...facets } });
    rerender({ ...onAssets, sort: 'updatedAt' });
    await flushDebounce();

    expect(result.current.results.assets.count).toBe(0);
    expect(searchEntityTypeCounts).not.toHaveBeenCalled();

    // Leaving the tab clears its filters; the Data assets count must recover.
    rerender({ ...baseParams, filter: 'tasks' });
    await flushDebounce();

    expect(searchEntityTypeCounts).toHaveBeenCalled();
    expect(result.current.results.assets.count).toBe(3);
  });

  it('reports loading on the same render a filter or a new query changes', async () => {
    // What each render saw, before its effects run: the panel decides on that
    // render whether a tab is empty, so a stale "not loading" strands the tab.
    const seen: boolean[] = [];
    const onTab: GlobalSearchQuery = { ...baseParams, filter: 'glossaryTerm' };
    const { rerender } = renderHook(
      (props: GlobalSearchQuery) => {
        const state = useGlobalSearchResults(props);
        seen.push(state.isLoading);

        return state;
      },
      { initialProps: onTab }
    );
    await flushDebounce();

    let first = seen.length;
    rerender({
      ...onTab,
      facets: { [EntityFields.OWNERS]: [{ key: 'alice', label: 'Alice' }] },
    });

    expect(seen[first]).toBe(true);

    rerender({ ...onTab, query: '' });
    first = seen.length;
    rerender({ ...onTab, query: 'orders' });

    expect(seen[first]).toBe(true);
  });

  it('shows the error when the Data assets search fails while its counts load', async () => {
    (searchQuery as jest.Mock).mockImplementation(({ searchIndex }) =>
      searchIndex === SearchIndex.DATA_ASSET
        ? Promise.reject(new Error('500'))
        : Promise.resolve(hits(3, [hit('g1', 'glossaryTerm')]))
    );
    const { result } = renderHook(() =>
      useGlobalSearchResults({ ...baseParams, filter: 'assets' })
    );
    await flushDebounce();

    expect(result.current.results.assets).toBeUndefined();
    expect(result.current.hasError).toBe(true);
  });

  it('treats a plugin source that throws synchronously as a failed source', async () => {
    const broken: GlobalSearchSourceContribution = {
      key: 'notes',
      labelKey: 'label.notes',
      search: () => {
        throw new Error('not a promise');
      },
    };
    const { result } = renderHook(() =>
      useGlobalSearchResults({ ...baseParams, sources: [broken] })
    );
    await flushDebounce();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.results.assets.count).toBe(3);
  });

  it('reports an error only when every source fails', async () => {
    (chatsSource.search as jest.Mock).mockRejectedValue(new Error('boom'));
    (searchEntityTypeCounts as jest.Mock).mockRejectedValue(new Error('boom'));
    (listTasks as jest.Mock).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() =>
      useGlobalSearchResults({ ...baseParams, sources: [chatsSource] })
    );
    await flushDebounce();

    expect(result.current.hasError).toBe(true);
    expect(result.current.results).toEqual({});
    expect(result.current.isLoading).toBe(false);
  });

  it('searches only the scoped plugin sources', async () => {
    const otherSource: GlobalSearchSourceContribution = {
      key: 'notes',
      labelKey: 'label.notes',
      search: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    };
    const { result } = renderHook(() =>
      useGlobalSearchResults({
        ...baseParams,
        sources: [chatsSource, otherSource],
        scopedSources: ['chats'],
      })
    );
    await flushDebounce();

    expect(chatsSource.search).toHaveBeenCalledWith(
      'customer',
      expect.any(AbortSignal)
    );
    expect(otherSource.search).not.toHaveBeenCalled();
    expect(searchEntityTypeCounts).not.toHaveBeenCalled();
    expect(searchQuery).not.toHaveBeenCalled();
    expect(listTasks).not.toHaveBeenCalled();
    expect(Object.keys(result.current.results)).toEqual(['chats']);
  });

  it('passes the facet selection as the data asset query filter', async () => {
    const facets = {
      [EntityFields.OWNERS]: [{ key: 'alice', label: 'Alice' }],
    };
    renderHook(() =>
      useGlobalSearchResults({ ...baseParams, filter: 'assets', facets })
    );
    await flushDebounce();

    const expected = getFacetQueryFilter(facets);

    expect(expected).toBeDefined();
    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        searchIndex: SearchIndex.DATA_ASSET,
        queryFilter: expected,
        sortField: '_score',
        sortOrder: 'desc',
      })
    );
  });

  it('applies a type tab’s own filters to that type’s query only', async () => {
    const facets = {
      [EntityFields.OWNERS]: [{ key: 'alice', label: 'Alice' }],
    };
    renderHook(() =>
      useGlobalSearchResults({ ...baseParams, filter: 'glossaryTerm', facets })
    );
    await flushDebounce();
    await act(async () => {
      await Promise.resolve();
    });

    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        searchIndex: SearchIndex.ALL,
        queryFilter: {
          query: {
            bool: {
              must: [
                {
                  term: { [EntityFields.ENTITY_TYPE_KEYWORD]: 'glossaryTerm' },
                },
                ...(getFacetQueryFilter(facets)?.query.bool.must ?? []),
              ],
            },
          },
        },
      })
    );
    // Another type's filters leave the data asset query unfiltered.
    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        searchIndex: SearchIndex.DATA_ASSET,
        queryFilter: getFacetQueryFilter({}),
      })
    );
  });

  it('shows skeletons only when the tab, filters or sort change, the loader only while typing', async () => {
    const { result, rerender } = renderHook(
      (props: GlobalSearchQuery) => useGlobalSearchResults(props),
      { initialProps: baseParams }
    );
    await flushDebounce();
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);

    rerender({ ...baseParams, query: 'customer_o' });

    expect(result.current.isQueryLoading).toBe(true);
    expect(result.current.isListLoading).toBe(false);

    await flushDebounce();
    await act(async () => {
      await Promise.resolve();
    });
    rerender({ ...baseParams, query: 'customer_o', sort: 'updatedAt' });

    expect(result.current.isListLoading).toBe(true);
    expect(result.current.isQueryLoading).toBe(false);
    // Counts from the last load stay while the list reloads.
    expect(result.current.isCounting).toBe(false);
  });
});
