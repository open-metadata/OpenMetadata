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
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { many, named } from '../../test/browser/fixtures/entities';
import {
  DRIVE_SERVICE,
  serveEmptyLists,
  serveEntities,
} from '../../test/browser/fixtures/hierarchy';
import { encodeCursor, serveList } from '../../test/browser/fixtures/paging';
import { describePaginatedList } from '../../test/browser/paginationContract';
import { renderApp } from '../../test/browser/renderWithApp';

const items = many(40, (i) =>
  named('file', i, DRIVE_SERVICE.fullyQualifiedName)
);

describePaginatedList({
  name: 'Drive service › Files',
  route: `/service/driveServices/${DRIVE_SERVICE.name}/files`,
  query: { showDeletedTables: 'false' },
  listPath: '/api/v1/drives/files',
  // Pages also request limit=0 just to read totals for tab badges.
  isPageRequest: (url) => url.searchParams.get('limit') !== '0',
  items,
  itemLabel: (item) => item.displayName,
  search: { index: 'file', urlParam: 'file', term: 'pw' },
  deletedToggleTestId: 'show-deleted',
  setup: () => {
    serveEntities([['/api/v1/services/driveServices', DRIVE_SERVICE]]);
    // Sibling tabs only need their counts here.
    serveEmptyLists([
      '/api/v1/drives/directories',
      '/api/v1/drives/spreadsheets',
    ]);
  },
});

/**
 * Replaces Pagination.spec.ts › "should reset pagination when switching
 * between Files and Spreadsheets tabs and also verify the api is called with
 * correct payload".
 */
describe('Drive service › switching tabs resets pagination', () => {
  const spreadsheets = many(40, (i) =>
    named('spreadsheet', i, DRIVE_SERVICE.fullyQualifiedName)
  );
  const directories = many(5, (i) =>
    named('directory', i, DRIVE_SERVICE.fullyQualifiedName)
  );
  // Inactive tab panes stay mounted (hidden); target the Files pane by name.
  const panel = () => page.getByRole('tabpanel', { name: /files/i });
  const indicator = () =>
    panel().getByTestId('pagination').getByTestId('page-indicator');
  const hasCursor = (url: URL) =>
    url.searchParams.has('after') || url.searchParams.has('before');

  test('a new tab starts without a cursor; reload keeps only the open tab on page 2', async () => {
    serveEntities([['/api/v1/services/driveServices', DRIVE_SERVICE]]);
    // Tab badges ask for limit=0 counts; only page loads matter here.
    const isPage = (url: URL) => url.searchParams.get('limit') !== '0';
    const fileCalls = serveList('/api/v1/drives/files', items, isPage);
    const sheetCalls = serveList(
      '/api/v1/drives/spreadsheets',
      spreadsheets,
      isPage
    );
    const dirCalls = serveList('/api/v1/drives/directories', directories);
    let screen = await renderApp(
      `/service/driveServices/${DRIVE_SERVICE.name}/files?pageSize=15`
    );

    await expect.element(panel().getByText(items[0].displayName)).toBeVisible();
    await expect.element(indicator()).toHaveTextContent(/1\s*of\s*\d+/);

    await userEvent.click(panel().getByTestId('next'));

    await expect.element(indicator()).toHaveTextContent(/2\s*of\s*\d+/);

    const sheetsBefore = sheetCalls.length;
    await userEvent.click(page.getByTestId('spreadsheets'));

    await expect.poll(() => sheetCalls.length).toBeGreaterThan(sheetsBefore);
    expect(sheetCalls.slice(sheetsBefore).some(hasCursor)).toBe(false);

    await userEvent.click(page.getByTestId('files'));

    await expect.element(indicator()).toHaveTextContent(/1\s*of\s*\d+/);

    await userEvent.click(panel().getByTestId('next'));

    await expect.element(indicator()).toHaveTextContent(/2\s*of\s*\d+/);
    // The user-facing check: page 2 rows, fetched with the page-1 cursor.
    await expect
      .element(panel().getByText(items[15].displayName))
      .toBeVisible();
    expect(fileCalls[fileCalls.length - 1].searchParams.get('after')).toBe(
      encodeCursor(15)
    );

    const dirsBefore = dirCalls.length;
    const sheetsBeforeReload = sheetCalls.length;
    const url = `${location.pathname}${location.search}`;
    await screen.unmount();
    screen = await renderApp(url);

    await expect.element(indicator()).toHaveTextContent(/2\s*of\s*\d+/);
    await expect.poll(() => dirCalls.length).toBeGreaterThan(dirsBefore);
    expect(dirCalls.slice(dirsBefore).some(hasCursor)).toBe(false);
    expect(sheetCalls.slice(sheetsBeforeReload).some(hasCursor)).toBe(false);

    await screen.unmount();
  }, 60_000);
});
