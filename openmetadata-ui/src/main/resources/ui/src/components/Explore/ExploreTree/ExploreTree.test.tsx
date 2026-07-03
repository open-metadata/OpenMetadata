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
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { EntityFields } from '../../../enums/AdvancedSearch.enum';
import * as miscAPI from '../../../rest/miscAPI';
import * as searchAPI from '../../../rest/searchAPI';
import ExploreTree, { getExploreTreeAggregationResponse } from './ExploreTree';

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

const buildFieldAggregationResponse = (
  field: string,
  buckets: { key: string; doc_count: number; [key: string]: unknown }[]
) =>
  ({
    data: {
      aggregations: { [`sterms#${field}`]: { buckets } },
      hits: { hits: [], total: { value: 0 } },
    },
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
    expect(
      getByText('label.dashboard-plural').closest('.ant-tree-treenode')
    ).not.toHaveClass('ant-tree-treenode-disabled');
  });

  it('grays out non-matching categories when a service browse path is active', async () => {
    const browsePath = JSON.stringify([
      {
        key: 'serviceType',
        label: 'serviceType',
        value: [{ key: 'BigQuery', label: 'BigQuery' }],
      },
    ]);
    const filteredBuckets = [
      { key: 'table', doc_count: 5 },
      { key: 'tableColumn', doc_count: 4 },
    ];
    const unfilteredBuckets = [
      { key: 'table', doc_count: 50 },
      { key: 'dashboard', doc_count: 10 },
      { key: 'topic', doc_count: 3 },
    ];
    const searchQuerySpy = jest
      .spyOn(searchAPI, 'searchQuery')
      .mockImplementation(({ queryFilter }) =>
        Promise.resolve(
          buildAggregationResponse(
            mustLength({ queryFilter }) > 0
              ? filteredBuckets
              : unfilteredBuckets
          )
        )
      );

    window.history.pushState(
      {},
      '',
      `/explore?browsePath=${encodeURIComponent(browsePath)}`
    );

    const { getByText, queryByTestId } = render(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    const filteredCall = searchQuerySpy.mock.calls.find(
      ([arg]) =>
        mustLength(arg) > 0 &&
        JSON.stringify(arg.queryFilter).includes('serviceType')
    );
    const databaseNode = getByText('label.database-plural').closest(
      '.ant-tree-treenode'
    );
    const dashboardNode = getByText('label.dashboard-plural').closest(
      '.ant-tree-treenode'
    );

    expect(filteredCall).toBeDefined();
    expect(databaseNode).not.toHaveClass('ant-tree-treenode-disabled');
    expect(dashboardNode).toHaveClass('ant-tree-treenode-disabled');
  });

  it('grays out non-matching categories when an advanced service filter is active', async () => {
    const queryFilter = {
      query: {
        bool: {
          must: [{ bool: { should: [{ term: { serviceType: 'BigQuery' } }] } }],
        },
      },
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

    const { getByText, queryByTestId } = render(
      <ExploreTree
        additionalQueryFilter={queryFilter}
        onFieldValueSelect={jest.fn()}
        onTreeSelect={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    const filteredCall = searchQuerySpy.mock.calls.find(
      ([arg]) =>
        mustLength(arg) > 0 &&
        JSON.stringify(arg.queryFilter).includes('serviceType')
    );
    const dashboardNode = getByText('label.dashboard-plural').closest(
      '.ant-tree-treenode'
    );

    expect(filteredCall).toBeDefined();
    expect(dashboardNode).toHaveClass('ant-tree-treenode-disabled');
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

  it('drops a superseded count fetch so out-of-order responses settle on the latest filter', async () => {
    const tierResolvers: Record<string, () => void> = {};
    const unfiltered = [
      { key: 'tag', doc_count: 50 },
      { key: 'table', doc_count: 100 },
    ];
    jest
      .spyOn(searchAPI, 'searchQuery')
      .mockImplementation(({ queryFilter }) => {
        const serialized = JSON.stringify(queryFilter);
        const isFilteredCount =
          !serialized.includes('should') && serialized.includes('Tier');
        if (isFilteredCount) {
          const tier = serialized.includes('Tier1') ? 'Tier1' : 'Tier2';

          return new Promise((resolve) => {
            tierResolvers[tier] = () =>
              resolve(
                buildAggregationResponse([
                  { key: 'tag', doc_count: tier === 'Tier1' ? 10 : 5 },
                ])
              );
          });
        }

        return Promise.resolve(buildAggregationResponse(unfiltered));
      });

    const urlFor = (tier: string) =>
      `/explore?quickFilter=${encodeURIComponent(
        JSON.stringify({
          query: {
            bool: { must: [{ term: { 'tier.tagFQN': `Tier.${tier}` } }] },
          },
        })
      )}`;

    window.history.pushState({}, '', urlFor('Tier1'));
    const { getByText, queryByTestId, rerender } = render(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );
    await waitFor(() => expect(tierResolvers.Tier1).toBeDefined());

    window.history.pushState({}, '', urlFor('Tier2'));
    rerender(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );
    await waitFor(() => expect(tierResolvers.Tier2).toBeDefined());

    // Resolve the newer fetch first, then the older (now stale) one.
    await act(async () => {
      tierResolvers.Tier2();
    });
    await act(async () => {
      tierResolvers.Tier1();
    });

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    const governanceSwitcher = getByText('label.governance')
      .closest('.ant-tree-treenode')
      ?.querySelector('.ant-tree-switcher');
    fireEvent.click(governanceSwitcher as Element);

    const tagsNode =
      getByText('label.tag-plural').closest('.ant-tree-treenode');

    // The latest filter (Tier2 → 5) wins; the stale Tier1 (→ 10) is dropped.
    expect(tagsNode).toHaveTextContent('5');
    expect(tagsNode).not.toHaveTextContent('10');
  });

  it('degrades to the browsable static tree when the count aggregation fails', async () => {
    jest
      .spyOn(searchAPI, 'searchQuery')
      .mockRejectedValue(new Error('network down'));

    const { getByText, queryByTestId } = render(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );

    // The spinner clears (no hang) and the categories still render, so the user
    // can keep browsing even though counts could not be fetched.
    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(getByText('label.database-plural')).toBeInTheDocument();
    expect(getByText('label.governance')).toBeInTheDocument();
  });

  it('opts into service style top hits only for service name buckets', async () => {
    const postAggregateSpy = jest
      .spyOn(miscAPI, 'postAggregateFieldOptions')
      .mockResolvedValue(
        buildFieldAggregationResponse('service.displayName.keyword', [
          {
            key: 'custom_bigquery',
            doc_count: 10,
            'top_hits#top': {
              hits: {
                hits: [
                  {
                    _source: {
                      service: {
                        style: {
                          iconURL: '/custom.svg',
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        ])
      );

    const response = await getExploreTreeAggregationResponse({
      bucketToFind: EntityFields.SERVICE,
      countQueryFilter: { query: { bool: {} } },
      searchQueryParam: '',
    });

    expect(postAggregateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldName: 'service.displayName.keyword',
        sourceFields: ['service.style'],
        topHits: {
          size: 1,
        },
      })
    );
    expect(
      response.aggregations['sterms#service.displayName.keyword'].buckets
    ).toHaveLength(1);
  });

  const treeWithServiceMock = () =>
    ({
      aggregations: {
        entityType: {
          buckets: [
            { key: 'table', doc_count: 50 },
            { key: 'dashboard', doc_count: 10 },
          ],
        },
        serviceType: { buckets: [{ key: 'BigQuery', doc_count: 1687 }] },
        'service.displayName.keyword': {
          buckets: [{ key: 'bigquery_prod', doc_count: 900 }],
        },
      },
      hits: { hits: [], total: { value: 0 } },
    } as never);

  const drillToServiceNode = async (
    findByText: (text: string) => Promise<HTMLElement>
  ) => {
    // The service level loads via the service-style field-options aggregation
    // (top hits), not searchQuery, so stub it to return the service bucket.
    jest
      .spyOn(miscAPI, 'postAggregateFieldOptions')
      .mockResolvedValue(
        buildFieldAggregationResponse('service.displayName.keyword', [
          { key: 'bigquery_prod', doc_count: 900 },
        ])
      );

    // Databases is expanded by default and lazy-loads its service types; drill
    // one level deeper into the service so a nested level is mounted.
    const bigQueryNode = await findByText('BigQuery');
    const switcher = bigQueryNode
      .closest('.ant-tree-treenode')
      ?.querySelector('.ant-tree-switcher');
    fireEvent.click(switcher as Element);

    expect(await findByText('bigquery_prod')).toBeInTheDocument();
  };

  it('keeps the expanded subtree mounted when a node is selected (browse)', async () => {
    jest
      .spyOn(searchAPI, 'searchQuery')
      .mockResolvedValue(treeWithServiceMock());

    const { findByText, getByTestId, queryByTestId, rerender } = render(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    await drillToServiceNode(findByText);

    // Selecting a node is a browse click — the subsequent count refresh must
    // keep the expanded subtree instead of collapsing it.
    fireEvent.click(getByTestId('explore-tree-title-bigquery_prod'));
    window.history.pushState(
      {},
      '',
      `/explore?browsePath=${encodeURIComponent(
        JSON.stringify([
          {
            key: 'serviceType',
            label: 'serviceType',
            value: [{ key: 'BigQuery', label: 'BigQuery' }],
          },
        ])
      )}`
    );
    rerender(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );

    expect(await findByText('bigquery_prod')).toBeInTheDocument();
  });

  it('rebuilds the tree on an external Data Assets filter change', async () => {
    const searchQuerySpy = jest
      .spyOn(searchAPI, 'searchQuery')
      .mockResolvedValue(treeWithServiceMock());

    const { findByText, queryByText, queryByTestId, rerender } = render(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    await drillToServiceNode(findByText);

    // A dropdown filter change (no tree selection) rebuilds from the static
    // roots so the deeper levels re-fetch fresh under the new filter — the
    // stale expanded service must drop.
    window.history.pushState(
      {},
      '',
      `/explore?quickFilter=${encodeURIComponent(
        JSON.stringify({
          query: {
            bool: { must: [{ term: { 'tier.tagFQN': 'Tier.Tier1' } }] },
          },
        })
      )}`
    );
    rerender(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );

    await waitFor(() => {
      expect(
        searchQuerySpy.mock.calls.some(([arg]) =>
          JSON.stringify(arg.queryFilter ?? {}).includes('Tier.Tier1')
        )
      ).toBe(true);
    });

    await waitFor(() => {
      expect(queryByText('bigquery_prod')).not.toBeInTheDocument();
    });
  });

  it('does not leak the browse flag from a no-op re-select into a filter change', async () => {
    const browsePath = encodeURIComponent(
      JSON.stringify([
        {
          key: 'serviceType',
          label: 'serviceType',
          value: [{ key: 'BigQuery', label: 'BigQuery' }],
        },
      ])
    );
    const searchQuerySpy = jest
      .spyOn(searchAPI, 'searchQuery')
      .mockResolvedValue(treeWithServiceMock());

    const { findByText, getByTestId, queryByText, queryByTestId, rerender } =
      render(
        <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
      );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    await drillToServiceNode(findByText);

    // Select the service type and reflect its browsePath — the browse refresh
    // consumes the flag and the highlight settles on the service-type node.
    fireEvent.click(getByTestId('explore-tree-title-BigQuery'));
    window.history.pushState({}, '', `/explore?browsePath=${browsePath}`);
    rerender(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );

    expect(await findByText('bigquery_prod')).toBeInTheDocument();

    // Re-click the already-selected node (no navigation) then change a dropdown
    // filter: the re-click must not leave the flag armed, so this still rebuilds.
    fireEvent.click(getByTestId('explore-tree-title-BigQuery'));
    window.history.pushState(
      {},
      '',
      `/explore?browsePath=${browsePath}&quickFilter=${encodeURIComponent(
        JSON.stringify({
          query: {
            bool: { must: [{ term: { 'tier.tagFQN': 'Tier.Tier1' } }] },
          },
        })
      )}`
    );
    rerender(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );

    await waitFor(() => {
      expect(
        searchQuerySpy.mock.calls.some(([arg]) =>
          JSON.stringify(arg.queryFilter ?? {}).includes('Tier.Tier1')
        )
      ).toBe(true);
    });

    await waitFor(() => {
      expect(queryByText('bigquery_prod')).not.toBeInTheDocument();
    });
  });

  it('does not blank the tree with a spinner on a browse selection', async () => {
    let releaseRefresh: (() => void) | undefined;
    let refreshStarted = false;
    jest
      .spyOn(searchAPI, 'searchQuery')
      .mockImplementation(({ queryFilter }) => {
        // Hold the browse refresh (it carries the browsePath entity types) open
        // so the in-flight UI can be observed; the initial load and presence
        // aggregation resolve at once.
        if (JSON.stringify(queryFilter ?? {}).includes('entityType.keyword')) {
          refreshStarted = true;

          return new Promise((resolve) => {
            releaseRefresh = () =>
              resolve(
                buildAggregationResponse([{ key: 'table', doc_count: 5 }])
              );
          });
        }

        return Promise.resolve(
          buildAggregationResponse([
            { key: 'table', doc_count: 50 },
            { key: 'dashboard', doc_count: 10 },
          ])
        );
      });

    const { getByText, queryByTestId, rerender } = render(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    // Selecting a category root is a browse click; reflect its browsePath so the
    // browse refresh fires without rebuilding (and so without the spinner).
    fireEvent.click(getByText('label.database-plural'));
    window.history.pushState(
      {},
      '',
      `/explore?browsePath=${encodeURIComponent(
        JSON.stringify([
          {
            key: 'entityType',
            label: 'label.database-plural',
            value: [{ key: 'table', label: 'table' }],
          },
        ])
      )}`
    );
    rerender(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );

    await waitFor(() => expect(refreshStarted).toBe(true));

    // A browse refresh keeps the tree on screen instead of swapping in the
    // full-screen spinner (the "page reload" symptom the user reported).
    expect(queryByTestId('loader')).not.toBeInTheDocument();
    expect(getByText('label.database-plural')).toBeInTheDocument();

    await act(async () => {
      releaseRefresh?.();
    });
  });
});
