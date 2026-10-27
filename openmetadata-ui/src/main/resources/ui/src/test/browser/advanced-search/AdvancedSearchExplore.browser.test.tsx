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
 * The page-level flows of playwright/e2e/Features/AdvancedSearch.spec.ts: a
 * value nobody has, the Status options, and the results count Explore shows
 * for advanced and quick filters. Real page; only the network is mocked.
 */
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { EntityStatus } from '../../../generated/entity/data/searchIndex';
import { makeTable } from '../fixtures/table';
import {
  applyAdvancedSearch,
  clearAdvancedSearch,
  fillRule,
  openAdvancedSearch,
  openExplore,
  pickField,
  pickOperator,
  rule,
  serveExplore,
} from './queryBuilder';

/** Three tables, so a filtered search has a count to show. */
const TABLES = [1, 2, 3].map((n) => ({
  ...makeTable(),
  id: `8f6b4c2e-1d1a-4c55-9a43-2f4f0f2d9b0${n}`,
  name: `pw_count_${n}`,
  fullyQualifiedName: `svc.db.schema.pw_count_${n}`,
  entityType: 'table',
}));

const count = () => page.getByTestId('search-results-count');

describe('Explore advanced search', { timeout: 60_000 }, () => {
  test('a value nobody has shows "No data" and stops searching', async () => {
    const explore = serveExplore();
    await openExplore();
    await openAdvancedSearch();
    await pickField(0, ['Database']);
    await pickOperator(0, '==');
    const input = rule(0)
      .getByTestId('advanced-search-value')
      .getByRole('combobox');
    await userEvent.fill(input, 'non-existing-value');

    await expect
      .poll(() =>
        // The value goes out as a regex, with `-` escaped.
        explore.aggregates.some((q) => q.get('value')?.includes('existing'))
      )
      .toBe(true);
    await expect
      .element(page.getByRole('listbox').getByText('No data'))
      .toBeVisible();

    const fetched = explore.aggregates.length;
    // The empty result must not trigger another fetch, let alone a loop.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(explore.aggregates).toHaveLength(fetched);
  });

  test('the Status value lists every entity status', async () => {
    serveExplore();
    await openExplore();
    await openAdvancedSearch();
    await pickField(0, ['Status']);
    await pickOperator(0, '==');
    await userEvent.click(
      rule(0)
        .getByTestId('advanced-search-value')
        .getByRole('button', { name: 'Show options' })
    );

    for (const status of Object.values(EntityStatus)) {
      await expect
        .element(page.getByRole('option', { name: status, exact: true }))
        .toBeVisible();
    }
  });

  test('an advanced filter shows the results count; clearing it hides it', async () => {
    const explore = serveExplore({ corpus: { dataAsset: TABLES } });
    await openExplore();

    // Browsing, with no search and no filter, shows no count.
    await expect
      .element(page.getByTestId('advance-search-filter-container'))
      .not.toBeInTheDocument();
    await expect.element(count()).not.toBeInTheDocument();

    await openAdvancedSearch();
    await fillRule(0, {
      field: 'Description',
      operator: 'Contains',
      value: 'test',
    });
    await applyAdvancedSearch(explore);

    await expect.element(count()).toHaveTextContent(String(TABLES.length));

    await clearAdvancedSearch();

    await expect.element(count()).not.toBeInTheDocument();
  });

  test('a quick filter shows the results count and only the chip Clear', async () => {
    const explore = serveExplore({
      corpus: { dataAsset: TABLES },
      values: ['table'],
    });
    await openExplore();
    await userEvent.click(page.getByTestId('search-dropdown-Data Assets'));
    await userEvent.fill(page.getByTestId('search-input'), 'table');
    await userEvent.click(page.getByTestId('table'));

    await expect
      .element(page.getByTestId('table'))
      .toHaveAttribute('aria-checked', 'true');

    const from = explore.searches.length;
    const update = page.getByTestId('update-btn');
    if (update.query()) {
      await userEvent.click(update);
    }

    await expect
      .poll(() =>
        explore.searches
          .slice(from)
          .some((q) => (q.get('query_filter') ?? '').includes('"table"'))
      )
      .toBe(true);
    await expect.element(count()).toHaveTextContent(String(TABLES.length));
    await expect
      .element(page.getByTestId('clear-filters'))
      .not.toBeInTheDocument();
    await expect.element(page.getByTestId('clear-all-chips')).toBeVisible();
  });
});
