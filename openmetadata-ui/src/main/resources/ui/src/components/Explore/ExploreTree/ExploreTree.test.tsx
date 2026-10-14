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
import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react';
import {
  TourContext,
  TourProviderContextProps,
} from '../../../context/TourProvider/TourProvider';
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

const getTreeRow = (element: HTMLElement) =>
  element.closest('[role="row"]') as HTMLElement;

const getExpandButton = (element: HTMLElement) =>
  within(getTreeRow(element)).getByTestId('tree-expand-btn');

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

  it('does not fetch entity counts while the product tour is open', async () => {
    const searchQuerySpy = jest
      .spyOn(searchAPI, 'searchQuery')
      .mockResolvedValue(buildAggregationResponse([]));

    const { queryByTestId } = render(
      <TourContext.Provider
        value={
          {
            isTourOpen: true,
          } as Partial<TourProviderContextProps> as TourProviderContextProps
        }>
        <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
      </TourContext.Provider>
    );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(searchQuerySpy).not.toHaveBeenCalled();
  });

  it('fetches entity counts when the product tour closes', async () => {
    const searchQuerySpy = jest
      .spyOn(searchAPI, 'searchQuery')
      .mockResolvedValue(buildAggregationResponse([]));

    const renderWithTour = (isTourOpen: boolean) => (
      <TourContext.Provider
        value={
          {
            isTourOpen,
          } as Partial<TourProviderContextProps> as TourProviderContextProps
        }>
        <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
      </TourContext.Provider>
    );

    const { rerender } = render(renderWithTour(true));

    expect(searchQuerySpy).not.toHaveBeenCalled();

    rerender(renderWithTour(false));

    await waitFor(() => {
      expect(searchQuerySpy).toHaveBeenCalled();
    });
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

    const databaseNode = getTreeRow(getByText('label.database-plural'));
    const dashboardNode = getTreeRow(getByText('label.dashboard-plural'));

    expect(databaseNode).not.toHaveAttribute('aria-disabled', 'true');
    expect(dashboardNode).toHaveAttribute('aria-disabled', 'true');
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

  it.each([
    ['Glossaries', 'glossaryTerm'],
    ['Tags', 'tag'],
    ['Metrics', 'metric'],
  ])(
    'keeps the static governance leaf %s on the quick-filter path',
    async (dataId, entityType) => {
      const onTreeSelect = jest.fn();
      const onFieldValueSelect = jest.fn();
      const { getByTestId, getByText, queryByTestId } = render(
        <ExploreTree
          onFieldValueSelect={onFieldValueSelect}
          onTreeSelect={onTreeSelect}
        />
      );

      await waitFor(() => {
        expect(queryByTestId('loader')).not.toBeInTheDocument();
      });

      fireEvent.click(getExpandButton(getByText('label.governance')));

      fireEvent.click(getByTestId(`explore-tree-title-${dataId}`));

      expect(onTreeSelect).not.toHaveBeenCalled();
      expect(onFieldValueSelect).toHaveBeenCalledTimes(1);

      const fields = onFieldValueSelect.mock.calls[0][0];

      expect(fields).toHaveLength(1);
      expect(fields[0].key).toBe('entityType');
      expect(fields[0].value[0].key).toBe(entityType);
    }
  );

  it('re-applies a leaf filter when the already-selected leaf is clicked again', async () => {
    const onFieldValueSelect = jest.fn();
    const { getByText, queryByTestId } = render(
      <ExploreTree
        onFieldValueSelect={onFieldValueSelect}
        onTreeSelect={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    fireEvent.click(getExpandButton(getByText('label.governance')));
    fireEvent.click(getByText('label.glossary-plural'));
    fireEvent.click(getByText('label.glossary-plural'));

    expect(onFieldValueSelect).toHaveBeenCalledTimes(2);
    expect(getTreeRow(getByText('label.glossary-plural'))).toHaveAttribute(
      'aria-selected',
      'true'
    );
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
    expect(getTreeRow(getByText('label.dashboard-plural'))).not.toHaveAttribute(
      'aria-disabled',
      'true'
    );
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
    const databaseNode = getTreeRow(getByText('label.database-plural'));
    const dashboardNode = getTreeRow(getByText('label.dashboard-plural'));

    expect(filteredCall).toBeDefined();
    expect(databaseNode).not.toHaveAttribute('aria-disabled', 'true');
    expect(dashboardNode).toHaveAttribute('aria-disabled', 'true');
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
    const dashboardNode = getTreeRow(getByText('label.dashboard-plural'));

    expect(filteredCall).toBeDefined();
    expect(dashboardNode).toHaveAttribute('aria-disabled', 'true');
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

    fireEvent.click(getExpandButton(getByText('label.governance')));

    const tagsNode = getTreeRow(getByText('label.tag-plural'));

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

  it('includes style top hits and search text for service name buckets', async () => {
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
      searchQueryParam: 'customer',
    });

    expect(postAggregateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldName: 'service.displayName.keyword',
        queryText: 'customer',
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
    fireEvent.click(getExpandButton(bigQueryNode));

    expect(await findByText('bigquery_prod')).toBeInTheDocument();
  };

  it('retries a failed lazy load on the next expand', async () => {
    jest
      .spyOn(searchAPI, 'searchQuery')
      .mockResolvedValue(treeWithServiceMock());
    const aggregateSpy = jest
      .spyOn(miscAPI, 'postAggregateFieldOptions')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue(
        buildFieldAggregationResponse('service.displayName.keyword', [
          { key: 'bigquery_prod', doc_count: 900 },
        ])
      );

    const { findByText, getByText, queryByTestId } = render(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    fireEvent.click(getExpandButton(await findByText('BigQuery')));

    // The failed load collapses the node instead of leaving it expanded and
    // empty, so the next expand fetches again.
    await waitFor(() => {
      expect(aggregateSpy).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(getExpandButton(getByText('BigQuery'))).toHaveAttribute(
        'aria-label',
        'Expand'
      );
    });

    fireEvent.click(getExpandButton(getByText('BigQuery')));

    expect(await findByText('bigquery_prod')).toBeInTheDocument();
    expect(aggregateSpy).toHaveBeenCalledTimes(2);
  });

  it('reports a Columns leaf under a schema as the browse path plus a Type filter', async () => {
    jest.spyOn(searchAPI, 'searchQuery').mockResolvedValue({
      aggregations: {
        entityType: {
          buckets: [
            { key: 'table', doc_count: 50 },
            { key: 'tableColumn', doc_count: 7 },
          ],
        },
        serviceType: { buckets: [{ key: 'BigQuery', doc_count: 57 }] },
        'database.displayName': {
          buckets: [{ key: 'ecommerce_db', doc_count: 57 }],
        },
        'databaseSchema.displayName': {
          buckets: [{ key: 'shopify', doc_count: 57 }],
        },
      },
      hits: { hits: [], total: { value: 0 } },
    } as never);

    const onTreeSelect = jest.fn();
    const onFieldValueSelect = jest.fn();
    const { findByTestId, findByText, getByTestId, queryByTestId } = render(
      <ExploreTree
        onFieldValueSelect={onFieldValueSelect}
        onTreeSelect={onTreeSelect}
      />
    );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    await drillToServiceNode(findByText);
    fireEvent.click(
      getExpandButton(getByTestId('explore-tree-title-bigquery_prod'))
    );
    fireEvent.click(
      getExpandButton(await findByTestId('explore-tree-title-ecommerce_db'))
    );
    fireEvent.click(
      getExpandButton(await findByTestId('explore-tree-title-shopify'))
    );

    const columnsNode = await findByTestId('explore-tree-title-tableColumn');

    expect(getTreeRow(columnsNode)).toHaveTextContent('7');

    fireEvent.click(columnsNode);

    expect(onFieldValueSelect).not.toHaveBeenCalled();
    expect(onTreeSelect).toHaveBeenCalledTimes(1);

    const { browseFields, typeField } = onTreeSelect.mock.calls[0][0];

    expect(
      browseFields.map((field: { key: string; value: { key: string }[] }) => [
        field.key,
        field.value[0].key,
      ])
    ).toEqual([
      ['serviceType', 'BigQuery'],
      ['service.displayName.keyword', 'bigquery_prod'],
      ['database.displayName', 'ecommerce_db'],
      ['databaseSchema.displayName', 'shopify'],
    ]);
    expect(typeField.key).toBe('entityType');
    expect(typeField.value[0].key).toBe('tableColumn');
  });

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

    // The still-expanded Databases root must re-fetch its children after the
    // rebuild, otherwise it stays expanded but empty.
    expect(await findByText('BigQuery')).toBeInTheDocument();
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

describe('ExploreTree browse drill-down', () => {
  const hierarchyResponse = (
    entityTypeBuckets: { key: string; doc_count: number }[]
  ) =>
    ({
      aggregations: {
        entityType: { buckets: entityTypeBuckets },
        serviceType: { buckets: [{ key: 'BigQuery', doc_count: 45 }] },
        'database.displayName': {
          buckets: [{ key: 'ecommerce_db', doc_count: 45 }],
        },
        'databaseSchema.displayName': {
          buckets: [{ key: 'shopify', doc_count: 45 }],
        },
      },
      hits: { hits: [], total: { value: 0 } },
    } as never);

  const tableAndColumnBuckets = [
    { key: 'table', doc_count: 5 },
    { key: 'tableColumn', doc_count: 40 },
  ];

  const setBrowseUrl = (
    browseFields: unknown,
    quickFilter?: Record<string, unknown>
  ) =>
    window.history.pushState(
      {},
      '',
      `/explore?browsePath=${encodeURIComponent(JSON.stringify(browseFields))}${
        quickFilter
          ? `&quickFilter=${encodeURIComponent(JSON.stringify(quickFilter))}`
          : ''
      }`
    );

  const renderDrilledToSchema = async (selectedEntityTypes: string[] = []) => {
    jest
      .spyOn(searchAPI, 'searchQuery')
      .mockResolvedValue(hierarchyResponse(tableAndColumnBuckets));
    jest
      .spyOn(miscAPI, 'postAggregateFieldOptions')
      .mockResolvedValue(
        buildFieldAggregationResponse('service.displayName.keyword', [
          { key: 'bigquery_prod', doc_count: 45 },
        ])
      );
    const onTreeSelect = jest.fn();
    // A fresh element per render: re-rendering the same element instance lets
    // React bail out, so the tree would never re-read the URL.
    const tree = () => (
      <ExploreTree
        selectedEntityTypes={selectedEntityTypes}
        onFieldValueSelect={jest.fn()}
        onTreeSelect={onTreeSelect}
      />
    );
    const utils = render(tree());

    await waitFor(() => {
      expect(utils.queryByTestId('loader')).not.toBeInTheDocument();
    });

    for (const level of ['BigQuery', 'bigquery_prod', 'ecommerce_db']) {
      fireEvent.click(
        getExpandButton(await utils.findByTestId(`explore-tree-title-${level}`))
      );
    }
    fireEvent.click(
      getExpandButton(await utils.findByTestId('explore-tree-title-shopify'))
    );
    await utils.findByTestId('explore-tree-title-table');

    return {
      ...utils,
      onTreeSelect,
      rerenderTree: () => utils.rerender(tree()),
    };
  };

  it('renders the schema entity-type leaves with counts, hiding types outside the Data Assets filter', async () => {
    const unfiltered = await renderDrilledToSchema();

    expect(
      getTreeRow(unfiltered.getByTestId('explore-tree-title-table'))
    ).toHaveTextContent('5');
    expect(
      getTreeRow(unfiltered.getByTestId('explore-tree-title-tableColumn'))
    ).toHaveTextContent('40');

    unfiltered.unmount();

    const tableOnly = await renderDrilledToSchema(['table']);

    expect(
      tableOnly.getByTestId('explore-tree-title-table')
    ).toBeInTheDocument();
    expect(
      tableOnly.queryByTestId('explore-tree-title-tableColumn')
    ).not.toBeInTheDocument();
  });

  it('keeps the drilled path expanded and the schema highlighted after selecting it', async () => {
    const { getByTestId, onTreeSelect, rerenderTree } =
      await renderDrilledToSchema();

    fireEvent.click(getByTestId('explore-tree-title-shopify'));

    const { browseFields } = onTreeSelect.mock.calls[0][0];

    expect(browseFields).toHaveLength(4);

    setBrowseUrl(browseFields);
    rerenderTree();

    await waitFor(() => {
      expect(
        getTreeRow(getByTestId('explore-tree-title-shopify'))
      ).toHaveAttribute('aria-selected', 'true');
    });

    for (const level of ['bigquery_prod', 'ecommerce_db', 'table']) {
      expect(getByTestId(`explore-tree-title-${level}`)).toBeInTheDocument();
    }
  });

  it('highlights the selected Tables leaf instead of its parent schema', async () => {
    const { getByTestId, onTreeSelect, rerenderTree } =
      await renderDrilledToSchema();

    fireEvent.click(getByTestId('explore-tree-title-table'));

    const { browseFields, typeField } = onTreeSelect.mock.calls[0][0];

    expect(typeField.value[0].key).toBe('table');

    setBrowseUrl(browseFields, {
      query: {
        bool: { must: [{ term: { 'entityType.keyword': 'table' } }] },
      },
    });
    rerenderTree();

    await waitFor(() => {
      expect(
        getTreeRow(getByTestId('explore-tree-title-table'))
      ).toHaveAttribute('aria-selected', 'true');
    });

    expect(
      getTreeRow(getByTestId('explore-tree-title-shopify'))
    ).not.toHaveAttribute('aria-selected', 'true');
  });

  it('re-enables unrelated roots once the service-type browse is cleared', async () => {
    jest.spyOn(searchAPI, 'searchQuery').mockImplementation(({ queryFilter }) =>
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
    setBrowseUrl([
      {
        key: 'serviceType',
        label: 'serviceType',
        value: [{ key: 'BigQuery', label: 'BigQuery' }],
      },
    ]);
    const { getByText, queryByTestId, rerender } = render(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(getTreeRow(getByText('label.dashboard-plural'))).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    window.history.pushState({}, '', '/explore');
    rerender(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );

    await waitFor(() => {
      expect(
        getTreeRow(getByText('label.dashboard-plural'))
      ).not.toHaveAttribute('aria-disabled', 'true');
    });
  });
});
