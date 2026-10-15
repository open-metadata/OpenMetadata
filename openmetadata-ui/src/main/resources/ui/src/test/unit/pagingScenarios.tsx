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
 * Shared list-page paging scenarios. They replay, against a page rendered with its REST and
 * search clients mocked, what the old Playwright helpers `testPaginationNavigation` and
 * `testCompletePaginationWithSearch` drove through a real backend: next/previous, the URL
 * cursor round trip (a "reload" re-mounts the page on the URL it left behind), the page-size
 * picker, and switching between cursor paging and page-numbered search.
 *
 * Pages are rendered in a BrowserRouter because `useTableFilters` merges new params into
 * `window.location.search`; a MemoryRouter would silently drop the params already set.
 */
import {
  act,
  fireEvent,
  render,
  RenderResult,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import { NextPreviousProps } from '../../components/common/NextPrevious/NextPrevious.interface';

export const AFTER_CURSOR = 'after-cursor';
export const PAGE_ONE_ROW = 'page-one-row';
export const PAGE_TWO_ROW = 'page-two-row';
export const RESIZED_PAGE_ROW = 'resized-page-row';
export const SEARCH_PAGE_ONE_ROW = 'search-page-one-row';
export const SEARCH_PAGE_TWO_ROW = 'search-page-two-row';
export const SEARCH_TERM = 'pw';
export const TOTAL = 45;

export interface CursorRequest {
  after?: string;
  limit?: number;
}

export interface SearchRequestSummary {
  term?: string;
  page?: number;
}

export const pagingRow = (name: string) => ({
  id: `${name}-id`,
  name,
  displayName: name,
  fullyQualifiedName: `service.${name}`,
});

/** The cursor page a list endpoint would serve for `request`. */
export const cursorPage = ({ after, limit }: CursorRequest) => {
  if (after) {
    return {
      data: [pagingRow(PAGE_TWO_ROW)],
      paging: {
        before: 'before-cursor',
        after: 'after-cursor-2',
        total: TOTAL,
      },
    };
  }

  return {
    data: [pagingRow(limit === 25 ? RESIZED_PAGE_ROW : PAGE_ONE_ROW)],
    paging: { after: AFTER_CURSOR, total: TOTAL },
  };
};

/** The rows a page-numbered search serves for `page`. */
export const searchPageRow = (page = 1) =>
  pagingRow(page > 1 ? SEARCH_PAGE_TWO_ROW : SEARCH_PAGE_ONE_ROW);

/** `searchQuery`-shaped response (already formatted by the REST client). */
export const searchQueryPage = (page = 1) => ({
  hits: {
    hits: [{ _source: searchPageRow(page) }],
    total: { value: TOTAL },
  },
  aggregations: {},
});

interface TableStubProps {
  dataSource?: Array<{ name?: string; displayName?: string }>;
  customPaginationProps?: NextPreviousProps & { showPagination?: boolean };
  searchProps?: { searchValue?: string; onSearch?: (value: string) => void };
  extraTableFilters?: ReactNode;
  'data-testid'?: string;
}

/**
 * Stands in for TableV2, whose own rendering of `customPaginationProps` and `searchProps` is
 * covered by its parity suite: rows by name, the searchbar wired to `onSearch` without the
 * debounce, and the real NextPrevious. Use as
 * `jest.mock('…/Table/TableV2', () => jest.requireActual('…/pagingScenarios').TableV2Stub)`.
 */
export const TableV2Stub = ({
  dataSource = [],
  customPaginationProps,
  searchProps,
  extraTableFilters,
  'data-testid': testId,
}: TableStubProps) => (
  <div data-testid={testId}>
    {searchProps && (
      <input
        aria-label="label.search"
        data-testid="searchbar"
        defaultValue={searchProps.searchValue}
        onChange={(e) => searchProps.onSearch?.(e.target.value)}
      />
    )}
    {extraTableFilters}
    {dataSource.map((row) => (
      <div key={row.name}>{row.displayName ?? row.name}</div>
    ))}
    {customPaginationProps?.showPagination && (
      <NextPrevious {...customPaginationProps} />
    )}
  </div>
);

export interface RenderedPage {
  result: RenderResult;
  /** Re-mounts the page on the URL it currently shows — a browser reload. */
  reload: () => void;
}

export const renderPageAt = (url: string, ui: ReactElement): RenderedPage => {
  window.history.replaceState({}, '', url);
  const page: RenderedPage = {
    result: render(<BrowserRouter>{ui}</BrowserRouter>),
    reload: () => {
      page.result.unmount();
      page.result = render(<BrowserRouter>{ui}</BrowserRouter>);
    },
  };

  return page;
};

export const urlParam = (name: string) =>
  new URLSearchParams(window.location.search).get(name);

const pageIndicator = () => screen.getByTestId('page-indicator');

const expectOnPage = (page: number) =>
  expect(pageIndicator().textContent).toMatch(
    new RegExp(`\\b${page} label\\.of \\d+`)
  );

const clickNext = () =>
  act(async () => {
    fireEvent.click(screen.getByTestId('next'));
  });

interface CursorPagingScenario {
  url: string;
  ui: ReactElement;
  lastListRequest: () => CursorRequest | undefined;
  /** False where the page keeps its cursor out of the URL (`validateUrl`). */
  validateUrl?: boolean;
  /** False where the page offers no page-size picker. */
  hasPageSizePicker?: boolean;
}

/** testPaginationNavigation, minus the backend. */
export const expectCursorPaging = async ({
  url,
  ui,
  lastListRequest,
  validateUrl = true,
  hasPageSizePicker = true,
}: CursorPagingScenario) => {
  const page = renderPageAt(url, ui);

  expect(await screen.findByText(PAGE_ONE_ROW)).toBeInTheDocument();
  expect(screen.getByTestId('previous')).toBeDisabled();
  expect(screen.getByTestId('next')).toBeEnabled();

  await clickNext();

  expect(await screen.findByText(PAGE_TWO_ROW)).toBeInTheDocument();
  expect(lastListRequest()?.after).toBe(AFTER_CURSOR);
  expect(screen.queryByText(PAGE_ONE_ROW)).not.toBeInTheDocument();
  expect(screen.getByTestId('previous')).toBeEnabled();

  if (validateUrl) {
    expect(urlParam('currentPage')).toBe('2');
    expect(urlParam('cursorType')).toBe('after');
    expect(urlParam('cursorValue')).toBe(AFTER_CURSOR);
  }

  page.reload();

  expect(await screen.findByText(PAGE_TWO_ROW)).toBeInTheDocument();
  expect(lastListRequest()?.after).toBe(AFTER_CURSOR);
  expect(screen.getByTestId('previous')).toBeEnabled();

  expectOnPage(2);

  if (validateUrl) {
    expect(urlParam('currentPage')).toBe('2');
    expect(urlParam('cursorType')).toBe('after');
    expect(urlParam('cursorValue')).toBe(AFTER_CURSOR);
  }

  if (!hasPageSizePicker) {
    return;
  }

  const picker = screen.getByTestId('page-size-selection-dropdown');

  expect(picker).toHaveTextContent('15 / label.page');

  await act(async () => {
    fireEvent.click(picker);
  });
  await act(async () => {
    fireEvent.click(
      await screen.findByRole('menuitem', { name: '25 / label.page' })
    );
  });

  expect(await screen.findByText(RESIZED_PAGE_ROW)).toBeInTheDocument();
  expect(lastListRequest()?.limit).toBe(25);
  expect(screen.getByTestId('page-size-selection-dropdown')).toHaveTextContent(
    '25 / label.page'
  );
};

interface SearchPagingScenario {
  url: string;
  ui: ReactElement;
  lastListRequest: () => CursorRequest | undefined;
  lastSearchRequest: () => SearchRequestSummary | undefined;
  searchRequestCount: () => number;
  /** The query param the page keeps the search term in. */
  searchParamName: string;
  /** Pages that keep the search term in component state, not the URL. */
  skipUrlParamCheck?: boolean;
  deleteToggleTestId?: string;
}

/** testCompletePaginationWithSearch, minus the backend. */
export const expectSearchPaging = async ({
  url,
  ui,
  lastListRequest,
  lastSearchRequest,
  searchRequestCount,
  searchParamName,
  skipUrlParamCheck = false,
  deleteToggleTestId = 'show-deleted',
}: SearchPagingScenario) => {
  const page = renderPageAt(url, ui);

  expect(await screen.findByText(PAGE_ONE_ROW)).toBeInTheDocument();
  expect(screen.getByTestId('previous')).toBeDisabled();

  await clickNext();

  expect(await screen.findByText(PAGE_TWO_ROW)).toBeInTheDocument();
  expect(lastListRequest()?.after).toBe(AFTER_CURSOR);
  expect(screen.getByTestId('previous')).toBeEnabled();

  expectOnPage(2);

  await act(async () => {
    fireEvent.change(screen.getByTestId('searchbar'), {
      target: { value: SEARCH_TERM },
    });
  });

  expect(await screen.findByText(SEARCH_PAGE_ONE_ROW)).toBeInTheDocument();
  expect(lastSearchRequest()).toEqual({ term: SEARCH_TERM, page: 1 });

  if (!skipUrlParamCheck) {
    expect(urlParam(searchParamName)).toBe(SEARCH_TERM);
  }

  expect(screen.getByTestId('previous')).toBeDisabled();

  expectOnPage(1);

  await clickNext();

  expect(await screen.findByText(SEARCH_PAGE_TWO_ROW)).toBeInTheDocument();
  expect(lastSearchRequest()).toEqual({ term: SEARCH_TERM, page: 2 });
  expect(screen.getByTestId('previous')).toBeEnabled();

  expectOnPage(2);

  page.reload();

  expect(await screen.findByText(SEARCH_PAGE_TWO_ROW)).toBeInTheDocument();
  expect(lastSearchRequest()).toEqual({ term: SEARCH_TERM, page: 2 });
  expect(urlParam(searchParamName)).toBe(SEARCH_TERM);
  expect(screen.getByTestId('previous')).toBeEnabled();

  expectOnPage(2);

  expect(screen.getByTestId('searchbar')).toHaveValue(SEARCH_TERM);

  const deleteToggle = screen.queryByTestId(deleteToggleTestId);

  if (!deleteToggle) {
    return;
  }

  for (let flip = 0; flip < 2; flip++) {
    const before = searchRequestCount();

    await act(async () => {
      fireEvent.click(screen.getByTestId(deleteToggleTestId));
    });

    await waitFor(() => expect(searchRequestCount()).toBeGreaterThan(before));
  }

  expect(await screen.findByText(SEARCH_PAGE_ONE_ROW)).toBeInTheDocument();
  expect(lastSearchRequest()).toEqual({ term: SEARCH_TERM, page: 1 });
  expect(screen.getByTestId('previous')).toBeDisabled();

  expectOnPage(1);

  expect(urlParam(searchParamName)).toBe(SEARCH_TERM);
};

const tableRowCount = (tableTestId: string) =>
  screen.getByTestId(tableTestId).querySelectorAll('tbody > tr[data-row-key]')
    .length;

interface ClientPagingScenario {
  url: string;
  ui: ReactElement;
  /** The table whose rows are counted, as the E2E counted `tbody > tr[data-row-key]`. */
  tableTestId: string;
}

/**
 * testClientSidePaginationNavigation, minus the backend. Render the real TableV2 here: for
 * client-side paging the page slices its rows itself, so the row counts are the behaviour.
 */
export const expectClientPaging = async ({
  url,
  ui,
  tableTestId,
}: ClientPagingScenario) => {
  const page = renderPageAt(url, ui);

  await screen.findByTestId(tableTestId);

  expect(screen.getByTestId('previous')).toBeDisabled();

  await clickNext();

  expect(screen.getByTestId('previous')).toBeEnabled();
  expect(urlParam('currentPage')).toBe('2');

  page.reload();

  await screen.findByTestId(tableTestId);

  expect(screen.getByTestId('previous')).toBeEnabled();

  expectOnPage(2);

  expect(urlParam('currentPage')).toBe('2');

  const picker = screen.getByTestId('page-size-selection-dropdown');

  expect(picker).toHaveTextContent('15 / label.page');

  const initialRowCount = tableRowCount(tableTestId);

  expect(initialRowCount).toBeLessThanOrEqual(15);

  await act(async () => {
    fireEvent.click(picker);
  });
  await act(async () => {
    fireEvent.click(
      await screen.findByRole('menuitem', { name: '25 / label.page' })
    );
  });

  expect(screen.getByTestId('page-size-selection-dropdown')).toHaveTextContent(
    '25 / label.page'
  );

  const newRowCount = tableRowCount(tableTestId);

  expect(newRowCount).toBeLessThanOrEqual(25);
  expect(newRowCount).not.toBe(initialRowCount);
};
