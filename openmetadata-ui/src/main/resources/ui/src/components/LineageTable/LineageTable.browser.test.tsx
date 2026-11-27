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
/**
 * Impact analysis (the Lineage tab's table view): the quick filters, the
 * search box and the upstream/downstream counts. Replaces the browser half of
 * LineageFilters.spec.ts (filter panel toggle, Impact Analysis service and
 * service type filters, upstream/downstream counts); whether the server
 * filters and counts correctly is the Java ITs' job.
 */
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import {
  columnEdge,
  LineageDoc,
  lineageImpactUrl,
  lineageTable,
  serveLineage,
} from '../../test/browser/fixtures/lineage';
import { renderApp } from '../../test/browser/renderWithApp';
import { scaled } from '../../test/browser/timeouts';

const ORDERS = lineageTable(1, 'orders_mart', {
  domains: [
    { name: 'PW_Domain_1', displayName: 'PW Domain 1', type: 'domain' },
  ],
  ownerDisplayName: ['Aaron Johnson'],
  tags: [{ tagFQN: 'PII.Sensitive' }, { tagFQN: 'Tier.Tier1' }],
  tier: { tagFQN: 'Tier.Tier1' },
});
const CUSTOMERS = lineageTable(2, 'customers_snow', {
  serviceType: 'Snowflake',
  service: {
    name: 'pw_snowflake',
    displayName: 'pw_snowflake',
    type: 'databaseService',
  },
});
const EVENTS: LineageDoc = {
  id: '00000000-0000-4000-8000-000000000103',
  type: 'topic',
  name: 'order_events',
  displayName: 'order_events',
  fullyQualifiedName: 'pw_kafka.order_events',
  serviceType: 'Kafka',
  service: {
    name: 'pw_kafka',
    displayName: 'pw_kafka',
    type: 'messagingService',
  },
  domains: [
    { name: 'PW_Domain_2', displayName: 'PW Domain 2', type: 'domain' },
  ],
  ownerDisplayName: ['Bea Lin'],
  tags: [{ tagFQN: 'Tier.Tier3' }],
  tier: { tagFQN: 'Tier.Tier3' },
};

const DOWNSTREAM = [
  { doc: ORDERS, depth: 1 },
  { doc: CUSTOMERS, depth: 1 },
  { doc: EVENTS, depth: 2 },
];
const UPSTREAM = [
  { doc: lineageTable(11, 'raw_orders'), depth: 1 },
  { doc: lineageTable(12, 'raw_customers'), depth: 1 },
  { doc: lineageTable(13, 'raw_seed'), depth: 2 },
];

const FACETS = {
  'service.displayName.keyword': ['pw_mysql', 'pw_snowflake', 'pw_kafka'],
  serviceType: ['mysql', 'snowflake', 'kafka'],
  'domains.displayName.keyword': ['PW Domain 1', 'PW Domain 2'],
  ownerDisplayName: ['Aaron Johnson', 'Bea Lin'],
  'tags.tagFQN': ['PII.Sensitive'],
  'tier.tagFQN': ['Tier.Tier1', 'Tier.Tier3'],
  'columns.name.keyword': ['order_id', 'amount', 'customer_id'],
};

const fqn = (doc: LineageDoc) => doc.fullyQualifiedName;

const serve = () =>
  serveLineage({ downstream: DOWNSTREAM, upstream: UPSTREAM, facets: FACETS });

/** The data-row-key of every row the impact table shows. */
const rowKeys = () =>
  [
    ...page
      .getByTestId('lineage-card-table')
      .element()
      .querySelectorAll('[data-row-key]'),
  ].map((row) => row.getAttribute('data-row-key'));

const lastParam = (calls: URL[], name: string) =>
  calls[calls.length - 1].searchParams.get(name);

const termFilter = (field: string, value: string) => ({
  query: {
    bool: { must: [{ bool: { should: [{ term: { [field]: value } }] } }] },
  },
});

const open = async (query = 'dir=Downstream&depth=2&pageSize=15') => {
  await renderApp(lineageImpactUrl(query));

  await expect
    .element(page.getByText(ORDERS.name), { timeout: scaled(60_000) })
    .toBeVisible();
};

/** Picks `key` in the `label` quick filter and applies it. */
const applyFilter = async (label: string, key: string) => {
  await userEvent.click(page.getByTestId(`search-dropdown-${label}`));
  await userEvent.click(page.getByTestId('drop-down-menu').getByTestId(key));
  await userEvent.click(page.getByTestId('update-btn'));
};

describe('Impact analysis', () => {
  test(
    'the filters button shows and hides the filter dropdowns',
    async () => {
      serve();
      await open();

      await userEvent.click(page.getByTestId('filters-button'));

      for (const label of ['Domains', 'Owners', 'Tier', 'Service']) {
        await expect
          .element(page.getByTestId(`search-dropdown-${label}`))
          .toBeVisible();
      }

      await userEvent.click(page.getByTestId('filters-button'));

      for (const label of ['Domains', 'Owners', 'Tier', 'Service']) {
        await expect
          .element(page.getByTestId(`search-dropdown-${label}`))
          .not.toBeInTheDocument();
      }
    },
    scaled(90_000)
  );

  test.each([
    ['Service', 'service.displayName.keyword', 'pw_snowflake', [CUSTOMERS]],
    ['Service Type', 'serviceType', 'kafka', [EVENTS]],
  ])(
    'the %s filter fetches only its rows, and Clear All fetches them all again',
    async (label, field, key, expected) => {
      const { entityCount } = serve();
      await open();

      await expect.poll(rowKeys).toEqual(DOWNSTREAM.map(({ doc }) => fqn(doc)));

      await userEvent.click(page.getByTestId('filters-button'));
      await applyFilter(label, key);

      await expect.poll(rowKeys).toEqual(expected.map(fqn));
      expect(JSON.parse(lastParam(entityCount, 'query_filter') ?? '')).toEqual(
        termFilter(field, key)
      );
      await expect
        .element(page.getByRole('radio', { name: 'Downstream' }))
        .toHaveTextContent(String(expected.length));

      await userEvent.click(page.getByRole('button', { name: /clear all/i }));

      await expect.poll(rowKeys).toEqual(DOWNSTREAM.map(({ doc }) => fqn(doc)));
      expect(lastParam(entityCount, 'query_filter')).toBeNull();
    },
    scaled(90_000)
  );

  test.each([
    [
      'Domains',
      'domains.displayName.keyword',
      'PW Domain 2',
      'PW Domain 2',
      EVENTS,
    ],
    ['Owners', 'ownerDisplayName', 'Aaron Johnson', 'Aaron Johnson', ORDERS],
    ['Tag', 'tags.tagFQN', 'PII.Sensitive', 'PII.Sensitive', ORDERS],
    // The tier option shows the tag name; the query uses its FQN.
    ['Tier', 'tier.tagFQN', 'Tier.Tier3', 'Tier3', EVENTS],
  ])(
    'the %s filter sends its term and shows only matching rows',
    async (label, field, key, optionLabel, expected) => {
      const { entityCount } = serve();
      await open();

      await userEvent.click(page.getByTestId('filters-button'));
      await userEvent.click(page.getByTestId(`search-dropdown-${label}`));

      await expect
        .element(page.getByTestId('drop-down-menu').getByTestId(key))
        .toHaveTextContent(optionLabel);

      await userEvent.click(
        page.getByTestId('drop-down-menu').getByTestId(key)
      );
      await userEvent.click(page.getByTestId('update-btn'));

      await expect.poll(rowKeys).toEqual([fqn(expected)]);
      expect(JSON.parse(lastParam(entityCount, 'query_filter') ?? '')).toEqual(
        termFilter(field, key)
      );
    },
    scaled(90_000)
  );

  test(
    'searching sends a name wildcard and shows only matching rows',
    async () => {
      const { entityCount } = serve();
      await open();

      await userEvent.fill(page.getByTestId('searchbar'), 'customers');

      await expect.poll(rowKeys).toEqual([fqn(CUSTOMERS)]);
      expect(JSON.parse(lastParam(entityCount, 'query_filter') ?? '')).toEqual({
        query: {
          bool: {
            must: [
              {
                bool: {
                  should: [
                    { wildcard: { 'name.keyword': { value: '*customers*' } } },
                    {
                      wildcard: {
                        'displayName.keyword': { value: '*customers*' },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      });
    },
    scaled(90_000)
  );

  test(
    'the radios count the entities up to the selected depth, per direction',
    async () => {
      const { entityCount } = serve();
      await open('dir=Downstream&depth=1&pageSize=15');

      // Depth 1: the two depth-1 nodes; the depth-2 topic is not counted.
      await expect
        .element(page.getByRole('radio', { name: 'Downstream' }))
        .toHaveTextContent('Downstream 2');
      await expect.poll(rowKeys).toEqual([fqn(ORDERS), fqn(CUSTOMERS)]);
      expect(lastParam(entityCount, 'nodeDepth')).toBe('1');

      await userEvent.click(page.getByTestId('filters-button'));
      await userEvent.click(page.getByRole('button', { name: /node depth/i }));
      await userEvent.click(
        page.getByRole('menu', { name: /node depth/i }).getByText('2')
      );

      await expect
        .element(page.getByRole('radio', { name: 'Downstream' }))
        .toHaveTextContent('Downstream 3');
      await expect.poll(() => lastParam(entityCount, 'nodeDepth')).toBe('2');
      await expect.poll(rowKeys).toEqual(DOWNSTREAM.map(({ doc }) => fqn(doc)));

      await userEvent.click(page.getByRole('radio', { name: 'Upstream' }));

      await expect
        .element(page.getByRole('radio', { name: 'Upstream' }))
        .toHaveTextContent('Upstream 3');
      await expect
        .poll(() => lastParam(entityCount, 'direction'))
        .toBe('Upstream');
      // The upstream depth comes from the lineage config (default 3).
      await expect.poll(() => lastParam(entityCount, 'nodeDepth')).toBe('3');
      await expect.poll(rowKeys).toEqual(UPSTREAM.map(({ doc }) => fqn(doc)));
      // Only the selected direction shows its count.
      await expect
        .element(page.getByRole('radio', { name: 'Downstream' }))
        .toHaveTextContent(/^Downstream\s*$/);
    },
    scaled(90_000)
  );

  // Impact analysis only: LineageTable routes Column/Tag/Glossary picks to
  // column_filter at Column level. The lineage canvas (Lineage.tsx) sends the
  // Column filter as a query_filter term on columns.name.keyword instead.
  test(
    'at column level the Column filter is sent as column_filter, not query_filter',
    async () => {
      const { directional } = serveLineage({
        downstream: DOWNSTREAM,
        facets: FACETS,
        columnEdges: [
          columnEdge(ORDERS, [
            ['order_id', 'order_id'],
            ['amount', 'total'],
          ]),
          columnEdge(CUSTOMERS, [['customer_id', 'id']]),
        ],
      });
      await open();

      await userEvent.click(page.getByTestId('impact-on-dropdown'));
      await userEvent.click(
        page.getByRole('menuitemradio', { name: 'Column Level' })
      );

      const root = 'pw_mysql.pw_db.pw_schema.pw_lineage_root';

      await expect
        .poll(rowKeys)
        .toEqual([
          `${root}.order_id->${fqn(ORDERS)}.order_id`,
          `${root}.amount->${fqn(ORDERS)}.total`,
          `${root}.customer_id->${fqn(CUSTOMERS)}.id`,
        ]);
      expect(directional[directional.length - 1].pathname).toBe(
        '/api/v1/lineage/getLineage/Downstream'
      );

      await userEvent.click(page.getByTestId('filters-button'));
      await applyFilter('Column', 'customer_id');

      await expect
        .poll(rowKeys)
        .toEqual([`${root}.customer_id->${fqn(CUSTOMERS)}.id`]);
      expect(lastParam(directional, 'column_filter')).toBe(
        'columnName:customer_id'
      );
      expect(lastParam(directional, 'query_filter')).toBeNull();
    },
    scaled(90_000)
  );
});
