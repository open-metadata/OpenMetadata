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
 * UI integration test (POC): the Table page's Schema tab with its REAL
 * children — TableV2, Searchbar, NextPrevious, sort menu, tag cells — in a
 * real Chromium. Only the network is mocked (MSW).
 *
 * Replaces, without a backend, what Playwright's Pagination.spec.ts
 * ("should test pagination on Table columns", "...complete flow with
 * search") checks after seeding 20+ entities through the API.
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { EntityType } from '../../../enums/entity.enum';
import { Table } from '../../../generated/entity/data/table';
import {
  ALL_COLUMNS,
  makeTable,
  pageOf,
  TABLE_FQN,
} from '../../../test/browser/fixtures/table';
import { worker } from '../../../test/browser/msw';
import { currentUrl, renderWithApp } from '../../../test/browser/renderWithApp';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import SchemaTable from './SchemaTable.component';

type ColumnsRequest = { path: string; params: URLSearchParams };

/** Serves the column list/search endpoints from the fixture and records each call. */
const mockColumnsApi = (columns = ALL_COLUMNS) => {
  const calls: ColumnsRequest[] = [];
  const respond = (request: Request, source = columns) => {
    const url = new URL(request.url);
    calls.push({ path: url.pathname, params: url.searchParams });
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const order = url.searchParams.get('sortOrder');
    const sorted = order === 'desc' ? [...source].reverse() : source;

    return HttpResponse.json(pageOf(sorted, { offset, limit }));
  };

  worker.use(
    http.get('/api/v1/tables/name/:fqn/columns', ({ request }) =>
      respond(request)
    ),
    http.get('/api/v1/tables/name/:fqn/columns/search', ({ request }) => {
      const q = new URL(request.url).searchParams.get('q') ?? '';

      return respond(
        request,
        columns.filter((c) => c.name.includes(q))
      );
    })
  );

  return calls;
};

const renderSchemaTab = (search = '?pageSize=25') =>
  renderWithApp(
    <GenericProvider<Table>
      data={makeTable()}
      permissions={{ ...DEFAULT_ENTITY_PERMISSION, ViewAll: true }}
      type={EntityType.TABLE}
      onUpdate={async () => undefined}>
      <SchemaTable />
    </GenericProvider>,
    { url: `/table/${TABLE_FQN}${search}`, path: '/table/:fqn/*' }
  );

const rows = () =>
  page.getByTestId('entity-table').getByRole('row').elements().slice(1);

describe('Table page › Schema tab (UI integration)', () => {
  test('first page renders from the columns API with the page size from the URL', async () => {
    const calls = mockColumnsApi();
    renderSchemaTab();

    await expect.element(page.getByText('order_col_001')).toBeVisible();
    await expect
      .element(page.getByTestId('page-indicator'))
      .toHaveTextContent('1');
    expect(calls[0].params.get('limit')).toBe('25');
    expect(calls[0].params.get('offset')).toBe('0');
    expect(page.getByText('order_col_026').query()).toBeNull();
  });

  test('Next / Previous request the right offset, swap rows and keep the URL in sync', async () => {
    const calls = mockColumnsApi();
    renderSchemaTab();

    await expect.element(page.getByText('order_col_001')).toBeVisible();

    await userEvent.click(page.getByTestId('next'));

    await expect.element(page.getByText('order_col_026')).toBeVisible();
    expect(page.getByText('order_col_001').query()).toBeNull();
    expect(calls.at(-1)?.params.get('offset')).toBe('25');
    await expect.poll(currentUrl).toContain('currentPage=2');

    await userEvent.click(page.getByTestId('previous'));

    await expect.element(page.getByText('order_col_001')).toBeVisible();
    expect(calls.at(-1)?.params.get('offset')).toBe('0');
  });

  test('deep link to page 3 loads that page directly', async () => {
    const calls = mockColumnsApi();
    renderSchemaTab('?pageSize=25&currentPage=3');

    await expect.element(page.getByText('order_col_051')).toBeVisible();
    expect(calls[0].params.get('offset')).toBe('50');
  });

  test('searching switches to the search endpoint and resets to page 1', async () => {
    const calls = mockColumnsApi();
    renderSchemaTab('?pageSize=25&currentPage=2');

    await expect.element(page.getByText('order_col_026')).toBeVisible();

    await userEvent.fill(
      page.getByPlaceholder(/find in table/i),
      'order_col_11'
    );
    await userEvent.keyboard('{Enter}');

    await expect.element(page.getByText('order_col_110')).toBeVisible();

    const last = calls[calls.length - 1];

    expect(last.path).toMatch(/\/columns\/search$/);
    expect(last.params.get('q')).toBe('order_col_11');
    expect(last.params.get('offset')).toBe('0');
    await expect.poll(currentUrl).toContain('columnSearch=order_col_11');
    expect(rows()).toHaveLength(10); // order_col_110..119
  });

  test('empty search result shows the placeholder, not a stale page', async () => {
    mockColumnsApi();
    renderSchemaTab();

    await expect.element(page.getByText('order_col_001')).toBeVisible();

    await userEvent.fill(
      page.getByPlaceholder(/find in table/i),
      'does_not_exist'
    );
    await userEvent.keyboard('{Enter}');

    await expect
      .element(page.getByText('order_col_001'))
      .not.toBeInTheDocument();
    await expect
      .element(
        page.getByTestId('entity-table').getByTestId('search-error-placeholder')
      )
      .toBeVisible();
  });

  test('page size change re-requests with the new limit from page 1', async () => {
    const calls = mockColumnsApi();
    renderSchemaTab('?pageSize=25&currentPage=2');

    await expect.element(page.getByText('order_col_026')).toBeVisible();

    await userEvent.click(page.getByTestId('page-size-selection-dropdown'));
    await userEvent.click(
      page
        .getByRole('menuitem', { name: /50/ })
        .or(page.getByText('50 / Page'))
        .first()
    );

    await expect.poll(() => calls.at(-1)?.params.get('limit')).toBe('50');
    expect(calls.at(-1)?.params.get('offset')).toBe('0');
  });

  test('visual: schema table page 1', async () => {
    mockColumnsApi();
    // Tall enough that the whole table fits, so the capture never scrolls.
    await page.viewport(1440, 1600);
    renderSchemaTab('?pageSize=15');

    await expect.element(page.getByText('order_col_001')).toBeVisible();

    // Park the pointer so no row is in its hover state.
    await userEvent.hover(page.getByTestId('page-indicator'));

    await expect(page.getByTestId('entity-table')).toMatchScreenshot(
      'schema-table-page-1'
    );
  });
});
