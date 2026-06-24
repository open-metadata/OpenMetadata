/*
 *  Copyright 2025 Collate.
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
import test, { expect } from '@playwright/test';
import { Column, DataType } from '../../../src/generated/entity/data/table';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

const LUCENE_MAX_TERM_BYTES = 32766;
const NESTING_DEPTH = 25;

// word_delimiter fragments alphanumeric runs on letter/digit boundaries, so a token carrying hex
// digits tokenizes inconsistently between the indexed column name and the query. Letters-only keeps
// the leaf name a single, exactly-matchable term.
const lettersToken = (): string => `pw${uuid().replace(/[^a-z]/g, '')}`;

// A >32 KB multi-byte expression (mirrors a real Looker/DAX measure) that, indexed as one keyword
// term under the flattened children field, tripped Lucene's per-term limit and failed indexing.
const buildOversizedExpression = (): string => {
  const unit =
    'Expression : SUM(CASE WHEN revenue > 0 THEN revenue END) 収益 / ';
  let value = '';
  while (Buffer.byteLength(value, 'utf8') < LUCENE_MAX_TERM_BYTES + 20000) {
    value += unit;
  }

  return value;
};

const table = new TableClass();
const leafColumnName = `deepleaf${lettersToken()}`;

// A struct column nested NESTING_DEPTH levels deep (past index.mapping.depth.limit) whose deepest
// leaf carries the oversized expression — the combined depth + immense-term worst case.
const buildDeeplyNestedOversizedColumn = (): Column => {
  let column = {
    name: leafColumnName,
    dataType: DataType.Varchar,
    dataLength: 256,
    dataTypeDisplay: 'varchar(256)',
    description: buildOversizedExpression(),
  } as Column;

  for (let level = NESTING_DEPTH; level >= 1; level--) {
    column = {
      name: `lvl${level}${lettersToken()}`,
      dataType: DataType.Struct,
      dataTypeDisplay: 'struct<...>',
      children: [column],
    } as Column;
  }

  return column;
};

test.describe('Search index - deeply nested oversized columns', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    table.entity.columns = [
      buildDeeplyNestedOversizedColumn(),
      ...table.entity.columns,
    ];
    await table.create(apiContext);

    // Indexing is async. On the pre-fix flattened mapping the oversized leaf failed the bulk insert
    // (immense term) and the table never reached the index; object/enabled:false lets it index.
    await expect
      .poll(
        async () => {
          const response = await apiContext.get(
            `/api/v1/search/query?q=${encodeURIComponent(
              table.entity.name
            )}&index=table&from=0&size=10`
          );
          const body = await response.json();

          return (body?.hits?.hits ?? []).some(
            (hit: { _source?: { name?: string } }) =>
              hit._source?.name === table.entity.name
          );
        },
        { timeout: 90_000, intervals: [2_000] }
      )
      .toBe(true);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('25-level oversized nested column indexes and is searchable by its deep column name', async ({
    page,
  }) => {
    const searchInput = page.getByTestId('searchBox');
    const suggestions = page.locator(
      '[data-testid="global-search-suggestion-box"]'
    );

    // Indexing: the table indexed despite the >32 KB nested leaf, so it is found by name.
    await searchInput.click();
    const byNameResponse = page.waitForResponse('/api/v1/search/query?*');
    await searchInput.fill(table.entity.name);
    await byNameResponse;

    await expect(suggestions).toBeVisible();
    await expect(suggestions).toContainText(table.entity.name);

    // Searching: the 25-level-deep column name surfaces the table via columnNamesFuzzy - the
    // mechanism that replaced the dropped flattened columns.children.name search field.
    await searchInput.clear();
    const byColumnResponse = page.waitForResponse('/api/v1/search/query?*');
    await searchInput.fill(leafColumnName);
    await byColumnResponse;

    await expect(suggestions).toBeVisible();
    await expect(suggestions).toContainText(table.entity.name);
  });
});
