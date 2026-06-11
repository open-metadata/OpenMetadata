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
import { Domain } from '../../support/domain/Domain';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { TagClass } from '../../support/tag/TagClass';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
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
const CERTIFICATION_FIELD = 'certification.tagLabel.tagFQN';
const DOMAIN_FIELD = 'domains.displayName.keyword';
const TIER1_KEY = 'tier.tier1';
const TIER2_KEY = 'tier.tier2';
const PERSONAL_TAG_KEY = 'personaldata.personal';

const tierOneTable = new TableClass();
const tierTwoTable = new TableClass();
const tierOneDashboard = new DashboardClass();
const tierTwoTopic = new TopicClass();
const untieredTable = new TableClass();
const assetDomain = new Domain();
const compositionGlossary = new Glossary(`pwCompositionGlossary${uuid()}`);
const compositionTerm = new GlossaryTerm(
  compositionGlossary,
  undefined,
  `pwCompositionTerm${uuid()}`
);
const goldCertification = new TagClass({ classification: 'Certification' });
const silverCertification = new TagClass({ classification: 'Certification' });

const classificationTagPatch = (tagFQN: string, index: number): Operation => ({
  op: 'add',
  path: `/tags/${index}`,
  value: {
    tagFQN,
    source: 'Classification',
    labelType: 'Manual',
  },
});

const glossaryTermTagPatch = (index: number): Operation => ({
  op: 'add',
  path: `/tags/${index}`,
  value: {
    tagFQN: compositionTerm.responseData.fullyQualifiedName,
    source: 'Glossary',
    labelType: 'Manual',
  },
});

// Certification is a first-class entity field — patch /certification, not /tags
const certificationPatch = (tagFQN: string): Operation => ({
  op: 'add',
  path: '/certification',
  value: {
    tagLabel: {
      tagFQN,
      source: 'Classification',
      labelType: 'Manual',
      state: 'Confirmed',
    },
  },
});

const domainPatch = (): Operation => ({
  op: 'add',
  path: '/domains/0',
  value: {
    id: assetDomain.responseData.id,
    type: 'domain',
  },
});

// tagFQN-style aggregation buckets are lowercase-normalized, so option
// testids and chip keys are the lowercased FQN / display name
const lowercaseKey = (value: string) => value.toLowerCase();

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

  // searchParams.get decodes '+' as space (axios encodes spaces as '+'),
  // so multi-word option keys like domain display names still match
  const queryRes = page.waitForResponse((response) => {
    let isMatch = false;
    if (response.url().includes('/api/v1/search/query')) {
      const queryFilter =
        new URL(response.url()).searchParams.get('query_filter') ?? '';
      isMatch = queryFilter.includes(optionKey);
    }

    return isMatch;
  });
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

/**
 * searchAndExpectEntity* helpers leave the page in search mode, where facet
 * aggregations are scoped to the stale search term and the active tab can
 * switch to an entity-specific one (dropping dataAsset-only facets such as
 * Certification). Return to browse mode before further facet interactions.
 */
const clearGlobalSearch = async (page: Page) => {
  const queryRes = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset*'
  );
  await page.getByTestId('searchBox').fill('');
  await page.getByTestId('searchBox').press('Enter');
  await queryRes;
  await waitForAllLoadersToDisappear(page);
};

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
  'Setup tagged fixtures across asset types',
  async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await tierOneTable.create(apiContext);
    await tierTwoTable.create(apiContext);
    await tierOneDashboard.create(apiContext);
    await tierTwoTopic.create(apiContext);
    await untieredTable.create(apiContext);
    await assetDomain.create(apiContext);
    await compositionGlossary.create(apiContext);
    await compositionTerm.create(apiContext);
    await goldCertification.create(apiContext);
    await silverCertification.create(apiContext);

    await tierOneTable.patch({
      apiContext,
      patchData: [
        classificationTagPatch('Tier.Tier1', 0),
        classificationTagPatch('PersonalData.Personal', 1),
        certificationPatch(goldCertification.responseData.fullyQualifiedName),
        domainPatch(),
      ],
    });
    await tierTwoTable.patch({
      apiContext,
      patchData: [
        classificationTagPatch('Tier.Tier2', 0),
        glossaryTermTagPatch(1),
      ],
    });
    await tierOneDashboard.patch({
      apiContext,
      patchData: [
        classificationTagPatch('Tier.Tier1', 0),
        glossaryTermTagPatch(1),
        certificationPatch(silverCertification.responseData.fullyQualifiedName),
      ],
    });
    await tierTwoTopic.patch({
      apiContext,
      patchData: [
        classificationTagPatch('Tier.Tier2', 0),
        certificationPatch(goldCertification.responseData.fullyQualifiedName),
        domainPatch(),
      ],
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
  await assetDomain.delete(apiContext);
  await compositionTerm.delete(apiContext);
  await compositionGlossary.delete(apiContext);
  await goldCertification.delete(apiContext);
  await silverCertification.delete(apiContext);
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

test('glossary term filter spans asset types and ANDs with tier', async ({
  page,
}) => {
  test.slow();

  const termKey = lowercaseKey(compositionTerm.responseData.fullyQualifiedName);

  await test.step('Filter by the glossary term via the Tag facet', async () => {
    await selectOptionAndWaitForQuery(
      page,
      'Tag',
      termKey,
      compositionTerm.responseData.name
    );
    await page.keyboard.press('Escape');

    await expect(
      page.getByTestId(`query-chip-${TAG_FIELD}-${termKey}`)
    ).toBeVisible();
  });

  await test.step('Term-tagged table and dashboard are visible, untagged table is not', async () => {
    await searchAndExpectEntityVisible(page, tierTwoTable);
    await searchAndExpectEntityVisible(page, tierOneDashboard);
    await searchAndExpectEntityNotVisible(page, tierOneTable);
  });

  const tierResponse =
    await test.step('Stack a Tier2 filter on top of the term', async () => {
      await clearGlobalSearch(page);
      const response = await selectOptionAndWaitForQuery(
        page,
        'Tier',
        TIER2_KEY
      );
      await page.keyboard.press('Escape');

      return response;
    });

  await test.step('Term and tier AND across fields', async () => {
    const queryFilter = getQueryFilterFromResponseUrl(tierResponse.url());

    expect(getShouldClausesForField(queryFilter, TAG_FIELD)).toHaveLength(1);
    expect(getShouldClausesForField(queryFilter, TIER_FIELD)).toHaveLength(1);

    await searchAndExpectEntityVisible(page, tierTwoTable);
    await searchAndExpectEntityNotVisible(page, tierOneDashboard);
  });
});

test('domain filter spans asset types and ANDs with an asset-type filter', async ({
  page,
}) => {
  test.slow();

  const domainKey = lowercaseKey(assetDomain.responseData.displayName);

  await test.step('Filter by domain', async () => {
    await selectOptionAndWaitForQuery(
      page,
      'Domains',
      domainKey,
      assetDomain.responseData.displayName
    );
    await page.keyboard.press('Escape');

    await expect(
      page.getByTestId(`query-chip-${DOMAIN_FIELD}-${domainKey}`)
    ).toBeVisible();
  });

  await test.step('Domain assets across types are visible, others are not', async () => {
    await searchAndExpectEntityVisible(page, tierOneTable);
    await searchAndExpectEntityVisible(page, tierTwoTopic);
    await searchAndExpectEntityNotVisible(page, tierTwoTable);
  });

  await test.step('Narrow the domain to tables only', async () => {
    await clearGlobalSearch(page);
    await selectOptionAndWaitForQuery(page, 'Data Assets', 'table');
    await page.keyboard.press('Escape');

    await expect(
      page.getByTestId('query-chip-entityType.keyword-table')
    ).toBeVisible();

    await searchAndExpectEntityVisible(page, tierOneTable);
    await searchAndExpectEntityNotVisible(page, tierTwoTopic);
  });
});

test('certification union shows assets certified with either level', async ({
  page,
}) => {
  test.slow();

  const goldKey = lowercaseKey(
    goldCertification.responseData.fullyQualifiedName
  );
  const silverKey = lowercaseKey(
    silverCertification.responseData.fullyQualifiedName
  );

  await test.step('Filter by the gold certification', async () => {
    await selectOptionAndWaitForQuery(
      page,
      'Certification',
      goldKey,
      goldCertification.responseData.name
    );
    await page.keyboard.press('Escape');

    await searchAndExpectEntityVisible(page, tierOneTable);
    await searchAndExpectEntityVisible(page, tierTwoTopic);
    await searchAndExpectEntityNotVisible(page, tierOneDashboard);
  });

  const unionResponse =
    await test.step('Add the silver certification to the union', async () => {
      await clearGlobalSearch(page);
      const response = await selectOptionAndWaitForQuery(
        page,
        'Certification',
        silverKey,
        silverCertification.responseData.name
      );
      await page.keyboard.press('Escape');

      return response;
    });

  await test.step('Query has ONE certification clause with both levels ORed', async () => {
    const queryFilter = getQueryFilterFromResponseUrl(unionResponse.url());
    const certificationShouldClauses = getShouldClausesForField(
      queryFilter,
      CERTIFICATION_FIELD
    );

    expect(certificationShouldClauses).toHaveLength(1);
    expect(certificationShouldClauses[0]).toEqual(
      expect.arrayContaining([
        { term: { [CERTIFICATION_FIELD]: goldKey } },
        { term: { [CERTIFICATION_FIELD]: silverKey } },
      ])
    );
  });

  await test.step('Assets certified with either level are visible, uncertified are not', async () => {
    await expect(
      page.getByTestId(`query-chip-${CERTIFICATION_FIELD}-${goldKey}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`query-chip-${CERTIFICATION_FIELD}-${silverKey}`)
    ).toBeVisible();

    await searchAndExpectEntityVisible(page, tierOneTable);
    await searchAndExpectEntityVisible(page, tierTwoTopic);
    await searchAndExpectEntityVisible(page, tierOneDashboard);
    await searchAndExpectEntityNotVisible(page, tierTwoTable);
  });
});
