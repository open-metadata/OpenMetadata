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
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import {
  lineageImpactUrl,
  lineageTable,
  serveLineage as serveGraph,
} from '../../test/browser/fixtures/lineage';
import { renderApp } from '../../test/browser/renderWithApp';
import { scaled } from '../../test/browser/timeouts';

const downstream = Array.from({ length: 16 }, (_, i) => ({
  doc: lineageTable(i, `pw-table-${String(i + 1).padStart(2, '0')}`),
  depth: 1,
}));

const serveLineage = () =>
  serveGraph({
    downstream,
    facets: { serviceType: ['mysql'] },
  }).entityCount;

const URL_IMPACT = lineageImpactUrl();

const goToPageTwo = async (calls: URL[]) => {
  await renderApp(URL_IMPACT);

  await expect
    .element(page.getByText('pw-table-01'), { timeout: scaled(60_000) })
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
  test(
    'a search change resets to page 1',
    async () => {
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
    },
    scaled(90_000)
  );

  test(
    'a quick filter change resets to page 1',
    async () => {
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
      expect(
        calls[calls.length - 1].searchParams.get('query_filter')
      ).toContain('mysql');
      await expect.element(page.getByTestId('previous')).toBeDisabled();
      await expect
        .element(page.getByTestId('page-indicator'))
        .toHaveTextContent('1');
    },
    scaled(90_000)
  );
});
