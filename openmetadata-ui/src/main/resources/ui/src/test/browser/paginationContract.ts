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
import { beforeAll, describe, expect, test } from 'vitest';
import { Locator, page, userEvent } from 'vitest/browser';
import { PAGE_SIZE_BASE } from '../../constants/constants';
import {
  encodeCursor,
  RecordedCall,
  serveList,
  serveSearch,
} from './fixtures/paging';
import { worker } from './msw';
import { networkIdle, until } from './network';
import { currentUrl, renderApp } from './renderWithApp';
import { scaled } from './timeouts';

/**
 * The paginated-list contract every list page must keep. It replaces
 * Playwright's testPaginationNavigation and testCompletePaginationWithSearch
 * (playwright/utils/common.ts) step for step, against MSW instead of a seeded
 * server. "Reload" is a remount at the current URL: only the URL survives.
 */
export interface PaginatedListSpec<T> {
  /** Shown in test names. */
  name: string;
  /** Route without query, e.g. '/settings/members/users'. */
  route: string;
  /** Extra query params the page needs, e.g. { showDeletedTables: 'false' }. */
  query?: Record<string, string>;
  /** MSW path of the list endpoint, e.g. '/api/v1/users'. */
  listPath: string;
  /** Requests to listPath that are not the paginated list (e.g. a lookup). */
  isPageRequest?: (url: URL) => boolean;
  /** At least 40 items; each row shows itemLabel(item). */
  items: T[];
  itemLabel: (item: T) => string;
  /** Mock every other endpoint the page calls. */
  setup?: () => void;
  /** Where the list lives when the page has more than one paginator. */
  scope?: () => Locator;
  /** Rows the page adds to page 1 itself (e.g. a pinned system alert). */
  pinnedRowsOnFirstPage?: number;
  /**
   * The search mock filters only on `q` (not `query_filter`), so these tests
   * check that search pages and restores correctly, not which hits match.
   */
  search?: { index: string; urlParam: string; term: string };
  deletedToggleTestId?: string;
  /** Set false for pages without the "N / Page" selector. */
  hasPageSizeSelector?: boolean;
  /** Pages with a fixed size ignore ?pageSize; the limit they send. */
  fixedPageSize?: number;
}

const urlOf = (route: string, params: Record<string, string>) =>
  `${route}?${new URLSearchParams(params).toString()}`;

export const describePaginatedList = <T>(spec: PaginatedListSpec<T>) => {
  const pageSize = spec.fixedPageSize ?? PAGE_SIZE_BASE;
  const base = { ...spec.query, pageSize: String(pageSize) };
  const within = () => spec.scope?.() ?? page;
  const next = () => within().getByTestId('next');
  const previous = () => within().getByTestId('previous');
  const indicator = () => within().getByTestId('page-indicator');
  const label = (i: number) => spec.itemLabel(spec.items[i]);
  const hits = [...spec.items].reverse();
  const hitLabel = (i: number) => spec.itemLabel(hits[i]);
  const last = (calls: RecordedCall[]) => {
    expect(calls.length, 'requests recorded').toBeGreaterThan(0);

    return calls[calls.length - 1];
  };
  const rows = () =>
    Array.from(
      (spec.scope?.().element() ?? document).querySelectorAll(
        'tbody tr[data-row-key]'
      )
    );

  const pageTwo = {
    ...base,
    currentPage: '2',
    cursorType: 'after',
    cursorValue: encodeCursor(pageSize),
  };

  const mount = async (params: Record<string, string>) => {
    spec.setup?.();
    const list = serveList(spec.listPath, spec.items, spec.isPageRequest);
    // Search hits come back in reverse, so a page still showing the plain
    // list (or the previous page) cannot pass for showing the results.
    const search = spec.search ? serveSearch(spec.search.index, hits) : [];
    let screen = await renderApp(urlOf(spec.route, params));

    return {
      list,
      search,
      screen: async () => screen,
      reload: async () => {
        const url = currentUrl() || `${location.pathname}${location.search}`;
        await screen.unmount();
        screen = await renderApp(url);
      },
    };
  };

  describe(`${spec.name} pagination`, () => {
    // Routes are lazy chunks that Vite compiles on first request. Load the page
    // once up front so that cost is not charged to the first test's timeout.
    beforeAll(async () => {
      const app = await mount(base);

      await until(
        () => Boolean(within().getByText(label(0)).query()),
        90_000,
        `${spec.name} to render ${label(0)}`
      );

      await networkIdle();
      await (await app.screen()).unmount();
      worker.resetHandlers();
    }, scaled(120_000));

    test('Next / Previous follow the server cursor and keep it in the URL', async () => {
      const { list } = await mount(base);

      await expect.element(within().getByText(label(0))).toBeVisible();
      await expect.element(previous()).toBeDisabled();
      await expect.element(next()).toBeEnabled();
      expect(last(list).searchParams.get('limit')).toBe(String(pageSize));

      await networkIdle();
      const beforeNext = list.length;

      await userEvent.click(next());

      await expect.element(within().getByText(label(pageSize))).toBeVisible();
      expect(within().getByText(label(0)).query()).toBeNull();
      expect(last(list).searchParams.get('after')).toBe(encodeCursor(pageSize));
      await expect.element(previous()).toBeEnabled();

      const url = new URL(location.href);

      expect(url.searchParams.get('currentPage')).toBe('2');
      expect(url.searchParams.get('cursorType')).toBe('after');
      expect(url.searchParams.get('cursorValue')).toBe(encodeCursor(pageSize));

      await networkIdle();

      expect(list.length - beforeNext, 'requests per page change').toBe(1);

      await userEvent.click(previous());

      await expect.element(within().getByText(label(0))).toBeVisible();
      expect(last(list).searchParams.get('before')).toBe(
        encodeCursor(pageSize)
      );

      await networkIdle();
    });

    test('reload on page 2 restores the page from the URL cursor', async () => {
      const { list } = await mount(pageTwo);

      await expect.element(within().getByText(label(pageSize))).toBeVisible();
      expect(within().getByText(label(0)).query()).toBeNull();
      expect(last(list).searchParams.get('after')).toBe(encodeCursor(pageSize));
      await expect.element(previous()).toBeEnabled();
      await expect.element(indicator()).toHaveTextContent(/2\s*of\s*\d+/);

      await networkIdle();
    });

    if (spec.hasPageSizeSelector !== false && !spec.fixedPageSize) {
      test('page size change refetches with the new limit', async () => {
        const { list } = await mount(base);
        const dropdown = within().getByTestId('page-size-selection-dropdown');
        const pinned = spec.pinnedRowsOnFirstPage ?? 0;

        await expect.element(within().getByText(label(0))).toBeVisible();
        await expect.element(dropdown).toHaveTextContent(`${pageSize} / Page`);
        expect(rows().length).toBe(pageSize + pinned);

        await userEvent.click(dropdown);
        await userEvent.click(
          page.getByRole('menuitem', { name: '25 / Page' })
        );

        await expect
          .poll(() => last(list).searchParams.get('limit'))
          .toBe('25');
        await expect.element(within().getByText(label(24))).toBeVisible();
        await expect.element(dropdown).toHaveTextContent('25 / Page');
        expect(rows().length).toBe(25 + pinned);

        await networkIdle();
      });
    }

    if (spec.search) {
      const { urlParam, term } = spec.search;

      test('search restarts at page 1, pages through hits and survives reload', async () => {
        const app = await mount(pageTwo);

        await expect.element(within().getByText(label(pageSize))).toBeVisible();

        await userEvent.fill(within().getByTestId('searchbar'), term);

        await expect.poll(() => app.search.length).toBeGreaterThan(0);

        // Pages put the term either in q or inside query_filter.
        const sent = last(app.search).searchParams;

        expect(`${sent.get('q')} ${sent.get('query_filter')}`).toContain(term);
        expect(last(app.search).searchParams.get('from')).toBe('0');
        await expect
          .poll(() => new URL(location.href).searchParams.get(urlParam))
          .toBe(term);
        await expect.element(indicator()).toHaveTextContent(/1\s*of\s*\d+/);
        await expect.element(previous()).toBeDisabled();
        await expect.element(within().getByText(hitLabel(0))).toBeVisible();

        await userEvent.click(next());

        await expect
          .poll(() => last(app.search).searchParams.get('from'))
          .toBe(String(pageSize));
        await expect.element(indicator()).toHaveTextContent(/2\s*of\s*\d+/);
        await expect.element(previous()).toBeEnabled();
        await expect
          .element(within().getByText(hitLabel(pageSize)))
          .toBeVisible();

        await networkIdle();

        const beforeReload = app.search.length;
        await app.reload();

        await expect
          .poll(() => app.search.length)
          .toBeGreaterThan(beforeReload);
        expect(last(app.search).searchParams.get('from')).toBe(
          String(pageSize)
        );
        await expect
          .element(within().getByTestId('searchbar'))
          .toHaveValue(term);
        await expect.element(indicator()).toHaveTextContent(/2\s*of\s*\d+/);
        await expect
          .element(within().getByText(hitLabel(pageSize)))
          .toBeVisible();

        if (spec.deletedToggleTestId) {
          const toggle = within().getByTestId(spec.deletedToggleTestId);

          await userEvent.click(toggle);

          await expect
            .poll(() => last(app.search).searchParams.get('deleted'))
            .toBe('true');

          await userEvent.click(toggle);

          await expect
            .poll(() => last(app.search).searchParams.get('deleted'))
            .toBe('false');

          await expect.element(indicator()).toHaveTextContent(/1\s*of\s*\d+/);
          await expect.element(previous()).toBeDisabled();
          expect(new URL(location.href).searchParams.get(urlParam)).toBe(term);
        }
        await networkIdle();
      });
    }
  });
};

/**
 * Tables that receive every row at once and page in the browser (pipeline
 * tasks, version-page columns). Replaces testClientSidePaginationNavigation.
 */
export interface ClientPagedTableSpec {
  name: string;
  /** Route with query, e.g. '/pipeline/svc.p?pageSize=15'. */
  url: string;
  tableTestId: string;
  totalRows: number;
  rowLabel: (i: number) => string;
  setup: () => void;
}

export const describeClientPagedTable = (spec: ClientPagedTableSpec) => {
  const table = () => page.getByTestId(spec.tableTestId);
  const visibleRows = () =>
    Array.from(
      table()
        .element()
        .querySelectorAll<HTMLElement>('tbody > tr[data-row-key]')
    ).filter((row) => row.offsetParent !== null);

  describe(`${spec.name} client-side pagination`, () => {
    beforeAll(async () => {
      spec.setup();
      const screen = await renderApp(spec.url);

      await until(
        () => Boolean(page.getByText(spec.rowLabel(0)).query()),
        90_000,
        `${spec.name} to render`
      );

      await networkIdle();
      await screen.unmount();
      worker.resetHandlers();
    }, scaled(120_000));

    test('pages 15 rows at a time, keeps the page in the URL across reload', async () => {
      spec.setup();
      const screen = await renderApp(spec.url);

      await expect.element(table().getByText(spec.rowLabel(0))).toBeVisible();
      await expect.element(page.getByTestId('previous')).toBeDisabled();

      const firstPage = visibleRows().length;

      expect(firstPage).toBe(15);

      await userEvent.click(page.getByTestId('next'));

      await expect.element(table().getByText(spec.rowLabel(15))).toBeVisible();
      await expect.element(page.getByTestId('previous')).toBeEnabled();
      expect(new URL(location.href).searchParams.get('currentPage')).toBe('2');
      // Page 2 holds the next 15 rows, or the rest when fewer remain.
      expect(visibleRows().length).toBe(Math.min(15, spec.totalRows - 15));

      const url = `${location.pathname}${location.search}`;
      await screen.unmount();
      spec.setup();
      await renderApp(url);

      await expect.element(table().getByText(spec.rowLabel(15))).toBeVisible();
      await expect.element(page.getByTestId('previous')).toBeEnabled();
      await expect
        .element(page.getByTestId('page-indicator'))
        .toHaveTextContent(/2\s*of\s*\d+/);
      expect(new URL(location.href).searchParams.get('currentPage')).toBe('2');
      await expect
        .element(page.getByTestId('page-size-selection-dropdown'))
        .toHaveTextContent('15 / Page');

      await userEvent.click(page.getByTestId('page-size-selection-dropdown'));
      await userEvent.click(page.getByRole('menuitem', { name: '25 / Page' }));

      await expect
        .element(page.getByTestId('page-size-selection-dropdown'))
        .toHaveTextContent('25 / Page');
      await expect
        .poll(() => visibleRows().length)
        .toBe(Math.min(25, spec.totalRows));
    });
  });
};
