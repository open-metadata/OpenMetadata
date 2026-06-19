/*
 *  Copyright 2024 Collate.
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
import { fireEvent, render, waitFor } from '@testing-library/react';
import * as searchAPI from '../../../rest/searchAPI';
import ExploreTree from './ExploreTree';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    tab: 'tables',
  }),
}));

const buildAggregationResponse = (
  buckets: { key: string; doc_count: number }[]
) =>
  ({
    aggregations: { entityType: { buckets } },
    hits: { hits: [], total: { value: 0 } },
  } as never);

const mustLength = (arg: { queryFilter?: unknown }): number =>
  (
    (arg.queryFilter as { query?: { bool?: { must?: unknown[] } } })?.query
      ?.bool?.must ?? []
  ).length;

afterEach(() => {
  jest.restoreAllMocks();
  window.history.pushState({}, '', '/');
});

describe('ExploreTree', () => {
  it('renders the correct tree nodes', async () => {
    const { getByText, queryByTestId } = render(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );

    // Wait for loader to disappear
    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(getByText('label.database-plural')).toBeInTheDocument();
    expect(getByText('label.dashboard-plural')).toBeInTheDocument();
    expect(getByText('label.topic-plural')).toBeInTheDocument();
    expect(getByText('label.container-plural')).toBeInTheDocument();
    expect(getByText('label.pipeline-plural')).toBeInTheDocument();
    expect(getByText('label.search-index-plural')).toBeInTheDocument();
    expect(getByText('label.ml-model-plural')).toBeInTheDocument();
    expect(getByText('label.governance')).toBeInTheDocument();
  });

  it('grays out categories that cannot contain the selected asset type', async () => {
    const { getByText, queryByTestId } = render(
      <ExploreTree
        selectedEntityTypes={['table']}
        onFieldValueSelect={jest.fn()}
        onTreeSelect={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    const databaseNode = getByText('label.database-plural').closest(
      '.ant-tree-treenode'
    );
    const dashboardNode = getByText('label.dashboard-plural').closest(
      '.ant-tree-treenode'
    );

    expect(databaseNode).not.toHaveClass('ant-tree-treenode-disabled');
    expect(dashboardNode).toHaveClass('ant-tree-treenode-disabled');
  });

  it('reports a category-root click as a browse selection, not a quick filter', async () => {
    const onTreeSelect = jest.fn();
    const onFieldValueSelect = jest.fn();
    const { getByText, queryByTestId } = render(
      <ExploreTree
        onFieldValueSelect={onFieldValueSelect}
        onTreeSelect={onTreeSelect}
      />
    );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    fireEvent.click(getByText('label.database-plural'));

    expect(onFieldValueSelect).not.toHaveBeenCalled();
    expect(onTreeSelect).toHaveBeenCalledTimes(1);

    const { browseFields, typeField } = onTreeSelect.mock.calls[0][0];

    expect(typeField).toBeUndefined();
    expect(browseFields).toHaveLength(1);
    expect(browseFields[0].key).toBe('entityType');
    expect(browseFields[0].label).toBe('label.database-plural');
    expect(browseFields[0].value.map((v: { key: string }) => v.key)).toContain(
      'table'
    );
  });

  it('keeps static governance leaves on the quick-filter path', async () => {
    const onTreeSelect = jest.fn();
    const onFieldValueSelect = jest.fn();
    const { getByText, queryByTestId } = render(
      <ExploreTree
        onFieldValueSelect={onFieldValueSelect}
        onTreeSelect={onTreeSelect}
      />
    );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    const governanceSwitcher = getByText('label.governance')
      .closest('.ant-tree-treenode')
      ?.querySelector('.ant-tree-switcher');
    fireEvent.click(governanceSwitcher as Element);

    fireEvent.click(getByText('label.glossary-plural'));

    expect(onTreeSelect).not.toHaveBeenCalled();
    expect(onFieldValueSelect).toHaveBeenCalledTimes(1);

    const fields = onFieldValueSelect.mock.calls[0][0];

    expect(fields).toHaveLength(1);
    expect(fields[0].key).toBe('entityType');
    expect(fields[0].value[0].key).toBe('glossaryTerm');
  });

  it('counts honor the active quick filter while category visibility tracks the whole estate', async () => {
    const quickFilter = {
      query: { bool: { must: [{ term: { 'tier.tagFQN': 'Tier.Tier1' } }] } },
    };
    const filteredBuckets = [{ key: 'table', doc_count: 5 }];
    const unfilteredBuckets = [
      { key: 'table', doc_count: 50 },
      { key: 'dashboard', doc_count: 10 },
      { key: 'topic', doc_count: 3 },
      { key: 'pipeline', doc_count: 4 },
      { key: 'mlmodel', doc_count: 2 },
      { key: 'container', doc_count: 6 },
      { key: 'searchIndex', doc_count: 1 },
    ];
    const searchQuerySpy = jest
      .spyOn(searchAPI, 'searchQuery')
      .mockImplementation(({ queryFilter }) => {
        const must = (
          queryFilter as { query?: { bool?: { must?: unknown[] } } }
        )?.query?.bool?.must;

        return Promise.resolve(
          buildAggregationResponse(
            (must ?? []).length > 0 ? filteredBuckets : unfilteredBuckets
          )
        );
      });

    window.history.pushState(
      {},
      '',
      `/explore?quickFilter=${encodeURIComponent(JSON.stringify(quickFilter))}`
    );

    const { getByText, queryByTestId } = render(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    const filteredCall = searchQuerySpy.mock.calls.find(
      ([arg]) => mustLength(arg) > 0
    );
    const presenceCall = searchQuerySpy.mock.calls.find(
      ([arg]) => mustLength(arg) === 0
    );

    // The count aggregation carries the active filter (the bug: it sent {}).
    expect(filteredCall?.[0].queryFilter).toEqual(quickFilter);
    // A second unfiltered aggregation backs category visibility.
    expect(presenceCall).toBeDefined();
    // A category with no matches under the filter (Dashboards has 0 tables) is
    // still rendered, because visibility tracks the unfiltered estate.
    expect(getByText('label.dashboard-plural')).toBeInTheDocument();
  });

  it('reuses the cached unfiltered presence aggregation across filter changes', async () => {
    const filterA = {
      query: { bool: { must: [{ term: { 'tier.tagFQN': 'Tier.Tier1' } }] } },
    };
    const filterB = {
      query: { bool: { must: [{ term: { 'tier.tagFQN': 'Tier.Tier2' } }] } },
    };
    const searchQuerySpy = jest
      .spyOn(searchAPI, 'searchQuery')
      .mockImplementation(({ queryFilter }) =>
        Promise.resolve(
          buildAggregationResponse(
            mustLength({ queryFilter }) > 0
              ? [{ key: 'table', doc_count: 5 }]
              : [
                  { key: 'table', doc_count: 50 },
                  { key: 'dashboard', doc_count: 10 },
                ]
          )
        )
      );

    window.history.pushState(
      {},
      '',
      `/explore?quickFilter=${encodeURIComponent(JSON.stringify(filterA))}`
    );
    const { queryByTestId, rerender } = render(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );
    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    window.history.pushState(
      {},
      '',
      `/explore?quickFilter=${encodeURIComponent(JSON.stringify(filterB))}`
    );
    rerender(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );

    // Wait until the second filter change (Tier2) has fired its count query.
    await waitFor(() => {
      expect(
        searchQuerySpy.mock.calls.some(([arg]) =>
          JSON.stringify(arg.queryFilter).includes('Tier.Tier2')
        )
      ).toBe(true);
    });

    // The unfiltered presence aggregation (empty query_filter) is fetched once
    // on the first filtered load and reused across the filter change.
    expect(
      searchQuerySpy.mock.calls.filter(([arg]) => mustLength(arg) === 0)
    ).toHaveLength(1);
  });
});
