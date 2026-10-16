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
import {
  encodeCursor,
  RecordedCall,
  serveList,
  serveSearch,
} from './fixtures/paging';
import { worker } from './msw';
import { currentUrl, renderApp } from './renderWithApp';

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
  search?: { index: string; urlParam: string; term: string };
  deletedToggleTestId?: string;
  /** Set false for pages without the "N / Page" selector. */
  hasPageSizeSelector?: boolean;
  /** Pages with a fixed size ignore ?pageSize; the limit they send. */
  fixedPageSize?: number;
  /**
   * Known defects, each with a reason. The matching assertion is skipped so
   * the rest of the contract still guards the page; remove once fixed.
   */
  knownIssues?: {
    duplicateFetchOnPageChange?: string;
    /** The whole test is expected to fail (vitest test.fails) until fixed. */
    failing?: Partial<Record<ContractTest, string>>;
  };
}

export type ContractTest = 'navigation' | 'reload' | 'pageSize' | 'search';

const urlOf = (route: string, params: Record<string, string>) =>
  `${route}?${new URLSearchParams(params).toString()}`;

/** Lets in-flight effects fire so request counts are final. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

export const describePaginatedList = <T>(spec: PaginatedListSpec<T>) => {
  const pageSize = spec.fixedPageSize ?? 15;
  const base = { ...spec.query, pageSize: String(pageSize) };
  const within = () => spec.scope?.() ?? page;
  const next = () => within().getByTestId('next');
  const previous = () => within().getByTestId('previous');
  const indicator = () => within().getByTestId('page-indicator');
  const label = (i: number) => spec.itemLabel(spec.items[i]);
  const last = (calls: RecordedCall[]) => calls[calls.length - 1];
  const rows = () =>
    Array.from(
      (spec.scope?.().element() ?? document).querySelectorAll(
        'tbody tr[data-row-key]'
      )
    );
  // A known-broken step runs as test.fails: it stays red-to-green visible and
  // starts failing the suite the moment the bug is fixed, prompting cleanup.
  const it = (key: ContractTest, name: string, fn: () => Promise<void>) =>
    spec.knownIssues?.failing?.[key]
      ? test.fails(
          `${name} [known issue: ${spec.knownIssues.failing[key]}]`,
          fn
        )
      : test(name, fn);

  const pageTwo = {
    ...base,
    currentPage: '2',
    cursorType: 'after',
    cursorValue: encodeCursor(pageSize),
  };

  const mount = async (params: Record<string, string>) => {
    spec.setup?.();
    const list = serveList(spec.listPath, spec.items, spec.isPageRequest);
    const search = spec.search
      ? serveSearch(spec.search.index, spec.items)
      : [];
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
      const deadline = Date.now() + 90_000;
      while (!within().getByText(label(0)).query()) {
        if (Date.now() > deadline) {
          throw new Error(`${spec.name}: page never rendered ${label(0)}`);
        }
        await settle();
      }
      await settle();
      await (await app.screen()).unmount();
      worker.resetHandlers();
    }, 120_000);

    it(
      'navigation',
      'Next / Previous follow the server cursor and keep it in the URL',
      async () => {
        const { list } = await mount(base);

        await expect.element(within().getByText(label(0))).toBeVisible();
        await expect.element(previous()).toBeDisabled();
        await expect.element(next()).toBeEnabled();
        expect(last(list).searchParams.get('limit')).toBe(String(pageSize));

        await settle();
        const beforeNext = list.length;

        await userEvent.click(next());

        await expect.element(within().getByText(label(pageSize))).toBeVisible();
        expect(within().getByText(label(0)).query()).toBeNull();
        expect(last(list).searchParams.get('after')).toBe(
          encodeCursor(pageSize)
        );
        await expect.element(previous()).toBeEnabled();

        const url = new URL(location.href);

        expect(url.searchParams.get('currentPage')).toBe('2');
        expect(url.searchParams.get('cursorType')).toBe('after');
        expect(url.searchParams.get('cursorValue')).toBe(
          encodeCursor(pageSize)
        );

        await settle();
        if (!spec.knownIssues?.duplicateFetchOnPageChange) {
          expect(list.length - beforeNext, 'requests per page change').toBe(1);
        }

        await userEvent.click(previous());

        await expect.element(within().getByText(label(0))).toBeVisible();
        expect(last(list).searchParams.get('before')).toBe(
          encodeCursor(pageSize)
        );

        await settle();
      }
    );

    it(
      'reload',
      'reload on page 2 restores the page from the URL cursor',
      async () => {
        const { list } = await mount(pageTwo);

        await expect.element(within().getByText(label(pageSize))).toBeVisible();
        expect(within().getByText(label(0)).query()).toBeNull();
        expect(last(list).searchParams.get('after')).toBe(
          encodeCursor(pageSize)
        );
        await expect.element(previous()).toBeEnabled();
        await expect.element(indicator()).toHaveTextContent(/2\s*of\s*\d+/);

        await settle();
      }
    );

    if (spec.hasPageSizeSelector !== false && !spec.fixedPageSize) {
      it(
        'pageSize',
        'page size change refetches with the new limit',
        async () => {
          const { list } = await mount(base);
          const dropdown = within().getByTestId('page-size-selection-dropdown');
          const pinned = spec.pinnedRowsOnFirstPage ?? 0;

          await expect.element(within().getByText(label(0))).toBeVisible();
          await expect
            .element(dropdown)
            .toHaveTextContent(`${pageSize} / Page`);
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

          await settle();
        }
      );
    }

    if (spec.search) {
      const { urlParam, term } = spec.search;

      it(
        'search',
        'search restarts at page 1, pages through hits and survives reload',
        async () => {
          const app = await mount(pageTwo);

          await expect
            .element(within().getByText(label(pageSize)))
            .toBeVisible();

          await userEvent.fill(within().getByTestId('searchbar'), term);

          await expect.poll(() => app.search.length).toBeGreaterThan(0);

          // Pages put the term either in q or inside query_filter.
          const sent = last(app.search).searchParams;

          expect(`${sent.get('q')} ${sent.get('query_filter')}`).toContain(
            term
          );
          expect(last(app.search).searchParams.get('from')).toBe('0');
          await expect
            .poll(() => new URL(location.href).searchParams.get(urlParam))
            .toBe(term);
          await expect.element(indicator()).toHaveTextContent(/1\s*of\s*\d+/);
          await expect.element(previous()).toBeDisabled();

          await userEvent.click(next());

          await expect
            .poll(() => last(app.search).searchParams.get('from'))
            .toBe(String(pageSize));
          await expect.element(indicator()).toHaveTextContent(/2\s*of\s*\d+/);
          await expect.element(previous()).toBeEnabled();

          await settle();

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
            expect(new URL(location.href).searchParams.get(urlParam)).toBe(
              term
            );
          }
          await settle();
        }
      );
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
      const deadline = Date.now() + 90_000;
      while (!page.getByText(spec.rowLabel(0)).query()) {
        if (Date.now() > deadline) {
          throw new Error(`${spec.name}: page never rendered`);
        }
        await settle();
      }
      await screen.unmount();
      worker.resetHandlers();
    }, 120_000);

    test('pages 15 rows at a time, keeps the page in the URL across reload', async () => {
      spec.setup();
      const screen = await renderApp(spec.url);

      await expect.element(table().getByText(spec.rowLabel(0))).toBeVisible();
      await expect.element(page.getByTestId('previous')).toBeDisabled();

      const firstPage = visibleRows().length;

      expect(firstPage).toBeLessThanOrEqual(15);

      await userEvent.click(page.getByTestId('next'));

      await expect.element(table().getByText(spec.rowLabel(15))).toBeVisible();
      await expect.element(page.getByTestId('previous')).toBeEnabled();
      expect(new URL(location.href).searchParams.get('currentPage')).toBe('2');
      expect(firstPage + visibleRows().length).toBe(spec.totalRows);

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
