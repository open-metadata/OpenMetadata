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
 * Replaces Pagination.spec.ts › Impact Analysis: "should reset ... pagination
 * to page 1 on search change" and "... on quick filter change".
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { SCHEMA } from '../../test/browser/fixtures/hierarchy';
import { worker } from '../../test/browser/msw';
import { renderApp } from '../../test/browser/renderWithApp';

const SOURCE_FQN = `${SCHEMA.fullyQualifiedName}.pw_source`;
const source = {
  id: '00000000-0000-4000-8000-0000000000f0',
  name: 'pw_source',
  fullyQualifiedName: SOURCE_FQN,
  tableType: 'Regular',
  columns: [],
  databaseSchema: SCHEMA,
  database: SCHEMA.database,
  service: SCHEMA.service,
  serviceType: 'Mysql',
  owners: [],
  tags: [],
  domains: [],
  dataProducts: [],
  followers: [],
  version: 0.1,
};
const downstream = Array.from({ length: 16 }, (_, i) => {
  const name = `pw-table-${String(i + 1).padStart(2, '0')}`;

  return {
    id: `00000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`,
    type: 'table',
    name,
    displayName: name,
    fullyQualifiedName: `${SCHEMA.fullyQualifiedName}.${name}`,
    serviceType: 'Mysql',
  };
});

const serveLineage = () => {
  const calls: URL[] = [];
  worker.use(
    http.get('/api/v1/tables/name/:fqn', () => HttpResponse.json(source)),
    // The lineage map behind the impact table renders an empty scene.
    http.get('/api/v1/lineage/scene', () =>
      HttpResponse.json({
        band: 'ASSET',
        lens: 'service',
        breadcrumb: [],
        nodes: [],
        edges: [],
      })
    ),
    // Quick-filter options come from a search aggregation on the field.
    http.post('/api/v1/search/aggregate', async ({ request }) => {
      const { fieldName } = (await request.json()) as { fieldName: string };

      return HttpResponse.json({
        hits: { total: { value: 16 }, hits: [] },
        aggregations: {
          [`sterms#${fieldName}`]: {
            buckets: [{ key: 'mysql', doc_count: 16 }],
          },
        },
      });
    }),
    http.get('/api/v1/queries', () =>
      HttpResponse.json({ data: [], paging: { total: 0 } })
    ),
    http.get('/api/v1/lineage/getLineageByEntityCount', ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      const from = Number(url.searchParams.get('from') ?? 0);
      const size = Number(url.searchParams.get('size') ?? 15);
      const nodes = Object.fromEntries([
        [SOURCE_FQN, { entity: { ...source, type: 'table' }, nodeDepth: 0 }],
        ...downstream
          .slice(from, from + size)
          .map((entity) => [
            entity.fullyQualifiedName,
            { entity, nodeDepth: 1, paging: {} },
          ]),
      ]);

      return HttpResponse.json({
        nodes,
        upstreamEdges: {},
        downstreamEdges: {},
        paginationInfo: {
          downstreamDepthInfo: [{ depth: 1, entityCount: downstream.length }],
          upstreamDepthInfo: [],
          maxDownstreamDepth: 1,
          maxUpstreamDepth: 0,
          totalDownstreamEntities: downstream.length,
          totalUpstreamEntities: 0,
        },
      });
    })
  );

  return calls;
};

const URL_IMPACT = `/table/${encodeURIComponent(
  SOURCE_FQN
)}/lineage?mode=impact_analysis&dir=Downstream&depth=1&pageSize=15`;

const goToPageTwo = async (calls: URL[]) => {
  await renderApp(URL_IMPACT);

  await expect
    .element(page.getByText('pw-table-01'), { timeout: 60_000 })
    .toBeVisible();
  await expect.element(page.getByTestId('previous')).toBeDisabled();

  await userEvent.click(page.getByTestId('next'));

  await expect.element(page.getByText('pw-table-16')).toBeVisible();
  expect(calls[calls.length - 1].searchParams.get('from')).toBe('15');
  await expect.element(page.getByTestId('previous')).toBeEnabled();
  await expect
    .element(page.getByTestId('page-indicator'))
    .toHaveTextContent('2');
};

describe('Impact analysis pagination', () => {
  test('a search change resets to page 1', async () => {
    const calls = serveLineage();
    await goToPageTwo(calls);

    await userEvent.fill(page.getByTestId('searchbar'), 'pw-table');

    await expect
      .poll(() => calls[calls.length - 1].searchParams.get('from'))
      .toBe('0');
    await expect.element(page.getByTestId('previous')).toBeDisabled();
    await expect
      .element(page.getByTestId('page-indicator'))
      .toHaveTextContent('1');
  }, 90_000);

  test('a quick filter change resets to page 1', async () => {
    const calls = serveLineage();
    await goToPageTwo(calls);

    await userEvent.click(page.getByTestId('filters-button'));
    await userEvent.click(page.getByTestId('search-dropdown-Service Type'));
    await userEvent.click(
      page.getByTestId('drop-down-menu').getByTestId('mysql')
    );
    await userEvent.click(page.getByTestId('update-btn'));

    await expect
      .poll(() => calls[calls.length - 1].searchParams.get('from'))
      .toBe('0');
    expect(calls[calls.length - 1].searchParams.get('query_filter')).toContain(
      'mysql'
    );
    await expect.element(page.getByTestId('previous')).toBeDisabled();
    await expect
      .element(page.getByTestId('page-indicator'))
      .toHaveTextContent('1');
  }, 90_000);
});
