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
import test, { expect, Page } from '@playwright/test';
import { Operation } from 'fast-json-patch';
import { SidebarItem } from '../../constant/sidebar';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import {
  searchAndExpectEntityNotVisible,
  searchAndExpectEntityVisible,
} from '../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { clickUpdateButtonIfVisible } from '../../utils/explore';
import { sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const TIER_FIELD = 'tier.tagFQN';
const TAG_FIELD = 'tags.tagFQN';
const TIER1_KEY = 'tier.tier1';
const TIER2_KEY = 'tier.tier2';
const PERSONAL_TAG_KEY = 'personaldata.personal';

const tierOneTable = new TableClass();
const tierTwoTable = new TableClass();
const tierOneDashboard = new DashboardClass();
const tierTwoTopic = new TopicClass();
const untieredTable = new TableClass();

const classificationTagPatch = (tagFQN: string, index: number): Operation => ({
  op: 'add',
  path: `/tags/${index}`,
  value: {
    tagFQN,
    source: 'Classification',
    labelType: 'Manual',
  },
});

/**
 * Facet options are aggregated once when the dropdown opens, so a freshly
 * indexed fixture can miss the first fetch. Retry by closing and reopening
 * the dropdown (each open re-fetches the facet aggregation).
 */
const ensureFilterOptionVisible = async (
  page: Page,
  label: string,
  optionKey: string,
  searchText?: string
) => {
  const menu = page.getByTestId('drop-down-menu');
  const option = menu.getByTestId(optionKey);

  await expect(async () => {
    const isMenuOpen = await menu.isVisible().catch(() => false);
    if (!isMenuOpen) {
      await page.getByTestId(`search-dropdown-${label}`).click();
      await menu.waitFor({ state: 'visible' });
    }
    if (searchText) {
      await menu.getByTestId('search-input').fill(searchText);
    }
    try {
      await option.waitFor({ state: 'visible', timeout: 5_000 });
    } catch (error) {
      await page.keyboard.press('Escape');
      throw error;
    }
  }).toPass({ timeout: 90_000, intervals: [2_000, 5_000, 10_000] });
};

/**
 * Clicks a dropdown option in immediate-apply mode: arm the search request
 * BEFORE the click (the click itself fires the query) and return the
 * response so callers can assert on the generated query_filter.
 */
const selectOptionAndWaitForQuery = async (
  page: Page,
  label: string,
  optionKey: string,
  searchText?: string
) => {
  await ensureFilterOptionVisible(page, label, optionKey, searchText);
  const option = page.getByTestId('drop-down-menu').getByTestId(optionKey);

  const queryRes = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      decodeURIComponent(response.url()).includes(optionKey)
  );
  await option.click();
  await clickUpdateButtonIfVisible(page);
  const response = await queryRes;
  await waitForAllLoadersToDisappear(page);

  return response;
};

const getQueryFilterFromResponseUrl = (url: string) => {
  const queryFilter = new URL(url).searchParams.get('query_filter');

  return queryFilter ? JSON.parse(queryFilter) : {};
};

const collectShouldArrays = (
  node: unknown,
  found: Array<Array<Record<string, unknown>>>
) => {
  if (Array.isArray(node)) {
    node.forEach((item) => collectShouldArrays(item, found));
  } else if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (Array.isArray(record.should)) {
      found.push(record.should as Array<Record<string, unknown>>);
    }
    Object.values(record).forEach((value) => collectShouldArrays(value, found));
  }

  return found;
};

const getShouldClausesForField = (queryFilter: unknown, fieldKey: string) =>
  collectShouldArrays(queryFilter, []).filter((should) =>
    should.some((clause) => JSON.stringify(clause).includes(`"${fieldKey}"`))
  );

const applyTierUnion = async (page: Page) => {
  await selectOptionAndWaitForQuery(page, 'Tier', TIER1_KEY);
  const unionResponse = await selectOptionAndWaitForQuery(
    page,
    'Tier',
    TIER2_KEY
  );
  await page.keyboard.press('Escape');

  return unionResponse;
};

test.beforeAll(
  'Setup tiered fixtures across asset types',
  async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await tierOneTable.create(apiContext);
    await tierTwoTable.create(apiContext);
    await tierOneDashboard.create(apiContext);
    await tierTwoTopic.create(apiContext);
    await untieredTable.create(apiContext);

    await tierOneTable.patch({
      apiContext,
      patchData: [
        classificationTagPatch('Tier.Tier1', 0),
        classificationTagPatch('PersonalData.Personal', 1),
      ],
    });
    await tierTwoTable.patch({
      apiContext,
      patchData: [classificationTagPatch('Tier.Tier2', 0)],
    });
    await tierOneDashboard.patch({
      apiContext,
      patchData: [classificationTagPatch('Tier.Tier1', 0)],
    });
    await tierTwoTopic.patch({
      apiContext,
      patchData: [classificationTagPatch('Tier.Tier2', 0)],
    });

    await afterAction();
  }
);

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await tierOneTable.delete(apiContext);
  await tierTwoTable.delete(apiContext);
  await tierOneDashboard.delete(apiContext);
  await tierTwoTopic.delete(apiContext);
  await untieredTable.delete(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
  const queryRes = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset*'
  );
  await sidebarClick(page, SidebarItem.EXPLORE);
  await queryRes;
  await waitForAllLoadersToDisappear(page);
});

test('Tier1 OR Tier2 union shows assets with either tier across asset types', async ({
  page,
}) => {
  test.slow();

  const unionResponse = await applyTierUnion(page);

  await test.step('Query has ONE tier clause with both values ORed', async () => {
    const queryFilter = getQueryFilterFromResponseUrl(unionResponse.url());
    const tierShouldClauses = getShouldClausesForField(queryFilter, TIER_FIELD);

    expect(tierShouldClauses).toHaveLength(1);
    expect(tierShouldClauses[0]).toEqual(
      expect.arrayContaining([
        { term: { [TIER_FIELD]: TIER1_KEY } },
        { term: { [TIER_FIELD]: TIER2_KEY } },
      ])
    );
  });

  await test.step('Both tier chips stack in the QUERY bar', async () => {
    await expect(
      page.getByTestId(`query-chip-${TIER_FIELD}-${TIER1_KEY}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`query-chip-${TIER_FIELD}-${TIER2_KEY}`)
    ).toBeVisible();
  });

  await test.step('Assets with either tier are visible, untiered are not', async () => {
    await searchAndExpectEntityVisible(page, tierOneTable);
    await searchAndExpectEntityVisible(page, tierTwoTable);
    await searchAndExpectEntityVisible(page, tierOneDashboard);
    await searchAndExpectEntityVisible(page, tierTwoTopic);
    await searchAndExpectEntityNotVisible(page, untieredTable);
  });
});

test('removing one tier chip narrows the union to the remaining tier', async ({
  page,
}) => {
  test.slow();

  await applyTierUnion(page);

  await test.step('Remove the Tier1 chip from the QUERY bar', async () => {
    const removeRes = page.waitForResponse(
      '/api/v1/search/query?*index=dataAsset*'
    );
    await page.getByTestId(`remove-chip-${TIER_FIELD}-${TIER1_KEY}`).click();
    await removeRes;
    await waitForAllLoadersToDisappear(page);

    await expect(
      page.getByTestId(`query-chip-${TIER_FIELD}-${TIER1_KEY}`)
    ).not.toBeVisible();
    await expect(
      page.getByTestId(`query-chip-${TIER_FIELD}-${TIER2_KEY}`)
    ).toBeVisible();
  });

  await test.step('Only Tier2 assets remain visible', async () => {
    await searchAndExpectEntityVisible(page, tierTwoTable);
    await searchAndExpectEntityVisible(page, tierTwoTopic);
    await searchAndExpectEntityNotVisible(page, tierOneTable);
    await searchAndExpectEntityNotVisible(page, tierOneDashboard);
  });
});

test('tier and tag filters AND across fields', async ({ page }) => {
  test.slow();

  await test.step('Apply Tier1 filter', async () => {
    await selectOptionAndWaitForQuery(page, 'Tier', TIER1_KEY);
    await page.keyboard.press('Escape');
  });

  const tagResponse =
    await test.step('Apply PersonalData.Personal tag filter', async () => {
      const response = await selectOptionAndWaitForQuery(
        page,
        'Tag',
        PERSONAL_TAG_KEY,
        'PersonalData'
      );
      await page.keyboard.press('Escape');

      return response;
    });

  await test.step('Query has separate must clauses for tier and tag', async () => {
    const queryFilter = getQueryFilterFromResponseUrl(tagResponse.url());
    const tierShouldClauses = getShouldClausesForField(queryFilter, TIER_FIELD);
    const tagShouldClauses = getShouldClausesForField(queryFilter, TAG_FIELD);

    expect(tierShouldClauses).toHaveLength(1);
    expect(tagShouldClauses).toHaveLength(1);
    expect(tierShouldClauses[0]).toEqual([
      { term: { [TIER_FIELD]: TIER1_KEY } },
    ]);
    expect(tagShouldClauses[0]).toEqual([
      { term: { [TAG_FIELD]: PERSONAL_TAG_KEY } },
    ]);
  });

  await test.step('Only assets matching BOTH filters are visible', async () => {
    await expect(
      page.getByTestId(`query-chip-${TIER_FIELD}-${TIER1_KEY}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`query-chip-${TAG_FIELD}-${PERSONAL_TAG_KEY}`)
    ).toBeVisible();

    await searchAndExpectEntityVisible(page, tierOneTable);
    await searchAndExpectEntityNotVisible(page, tierOneDashboard);
    await searchAndExpectEntityNotVisible(page, tierTwoTable);
  });
});

test('asset-type union composes with tier union (AND across, OR within)', async ({
  page,
}) => {
  test.slow();

  await test.step('Select Table + Topic asset types', async () => {
    await selectOptionAndWaitForQuery(page, 'Data Assets', 'table');
    await selectOptionAndWaitForQuery(page, 'Data Assets', 'topic');
    await page.keyboard.press('Escape');

    await expect(
      page.getByTestId('query-chip-entityType.keyword-table')
    ).toBeVisible();
    await expect(
      page.getByTestId('query-chip-entityType.keyword-topic')
    ).toBeVisible();
  });

  await applyTierUnion(page);

  await test.step('Tiered tables and topics are visible, tiered dashboard is filtered out by type', async () => {
    await searchAndExpectEntityVisible(page, tierOneTable);
    await searchAndExpectEntityVisible(page, tierTwoTable);
    await searchAndExpectEntityVisible(page, tierTwoTopic);
    await searchAndExpectEntityNotVisible(page, tierOneDashboard);
    await searchAndExpectEntityNotVisible(page, untieredTable);
  });
});
