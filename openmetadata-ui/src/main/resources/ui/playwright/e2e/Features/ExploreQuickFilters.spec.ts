/*
 *  Copyright 2024 Collate.
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
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { MetricClass } from '../../support/entity/MetricClass';
import { TableClass } from '../../support/entity/TableClass';
import { TagClass } from '../../support/tag/TagClass';
import {
  clickOutside,
  createNewPage,
  getApiContext,
  redirectToHomePage,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { searchAndClickOnOption, selectNullOption } from '../../utils/explore';
import { sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const domain = new Domain();
const table = new TableClass();
const tier = new TagClass({
  classification: 'Tier',
});
// Second tier tag — created but NOT assigned to any asset
const tierWithoutAsset = new TagClass({
  classification: 'Tier',
});

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  test.slow();

  const { apiContext, afterAction } = await createNewPage(browser);
  await table.create(apiContext);
  await domain.create(apiContext);
  await tier.create(apiContext);
  // Create second tier but do NOT assign it to any asset
  await tierWithoutAsset.create(apiContext);

  await table.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        value: {
          tagFQN: 'PersonalData.Personal',
        },
        path: '/tags/0',
      },
      {
        op: 'add',
        value: {
          tagFQN: tier.responseData.fullyQualifiedName,
        },
        path: '/tags/1',
      },
      {
        op: 'add',
        path: '/domains/0',
        value: {
          id: domain.responseData.id,
          type: 'domain',
          name: domain.responseData.name,
          displayName: domain.responseData.displayName,
        },
      },
    ],
  });
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
  await sidebarClick(page, SidebarItem.EXPLORE);
  await waitForAllLoadersToDisappear(page);
});

test.describe('search dropdown quick filters - index readiness', () => {
  test('search dropdown should work properly for quick filters', async ({
    page,
  }) => {
    const items = [
      {
        label: 'Domains',
        key: 'domains.displayName.keyword',
        value: domain.responseData.displayName,
      },
      { label: 'Tag', key: 'tags.tagFQN', value: 'PersonalData.Personal' },
    ];

    for (const filter of items) {
      await page.click(`[data-testid="search-dropdown-${filter.label}"]`);
      await searchAndClickOnOption(page, filter, true);

      const querySearchURL = `/api/v1/search/query?*index=dataAsset*query_filter=*should*${
        filter.key
      }*${(filter.value ?? '').replaceAll(' ', '+').toLowerCase()}*`;

      const queryRes = page.waitForResponse(querySearchURL);
      await page.click('[data-testid="update-btn"]');
      await queryRes;
      await page.click('[data-testid="clear-filters"]');
    }
  });
});

test.describe('Quick filter proper casing via sourceFields', () => {
  test('domain filter options should display original-cased display names', async ({
    page,
  }) => {
    const domainDisplayName = domain.responseData.displayName as string;

    await test.step('Open Domains quick filter dropdown and wait for aggregate API with sourceFields', async () => {
      const aggregateRes = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/aggregate') &&
          response.url().includes('field=domains.displayName.keyword') &&
          response.url().includes('sourceFields=domains.displayName')
      );
      await page.getByTestId('search-dropdown-Domains').click();
      await aggregateRes;
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Verify option label has original casing, not all lowercase', async () => {
      const optionTestId = domainDisplayName.toLowerCase();
      const optionItem = page.getByTestId(optionTestId);

      await expect(optionItem).toBeVisible();

      const labelText = await optionItem
        .locator('.dropdown-option-label')
        .textContent();

      expect(labelText?.trim()).toBe(domainDisplayName);
      expect(labelText?.trim()).not.toBe(domainDisplayName.toLowerCase());
    });

    await clickOutside(page);
  });

  test('owner filter aggregate request should include sourceFields=ownerDisplayName', async ({
    page,
  }) => {
    const aggregateRes = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/aggregate') &&
        response.url().includes('field=ownerDisplayName') &&
        response.url().includes('sourceFields=ownerDisplayName')
    );

    await page.getByTestId('search-dropdown-Owners').click();
    await aggregateRes;

    await clickOutside(page);
  });
});

test('should search for empty or null filters', async ({ page }) => {
  const items = [
    { label: 'Owners', key: 'ownerDisplayName' },
    { label: 'Tag', key: 'tags.tagFQN' },
    { label: 'Domains', key: 'domains.displayName.keyword' },
    { label: 'Tier', key: 'tier.tagFQN' },
  ];

  for (const filter of items) {
    await selectNullOption(page, filter);
  }
});

test('should show correct count for tier filter options from aggregation', async ({
  page,
}) => {
  const { apiContext } = await getApiContext(page);
  const res = await apiContext.get(
    '/api/v1/search/query?q=&index=dataAsset&from=0&size=0&deleted=false'
  );
  const data = await res.json();
  const buckets: { key: string; doc_count: number }[] =
    data.aggregations['sterms#tier.tagFQN']?.buckets ?? [];

  await page.getByTestId('search-dropdown-Tier').click();
  await waitForAllLoadersToDisappear(page);

  for (const bucket of buckets) {
    await expect(
      page
        .locator(`[data-menu-id$="-${bucket.key}"]`)
        .getByTestId('filter-count')
    ).toHaveText(bucket.doc_count.toString());
  }

  await clickOutside(page);
});

test('should search for multiple values along with null filters', async ({
  page,
}) => {
  const items = [
    {
      label: 'Tag',
      key: 'tags.tagFQN',
      value: 'PersonalData.Personal',
    },
    {
      label: 'Domains',
      key: 'domains.displayName.keyword',
      value: domain.responseData.displayName,
    },
    {
      label: 'Tier',
      key: 'tier.tagFQN',
      value: tier.responseData.fullyQualifiedName,
    },
  ];

  for (const filter of items) {
    await selectNullOption(page, filter);
  }
});

test('should persist quick filter on global search', async ({ page }) => {
  const items = [{ label: 'Owners', key: 'ownerDisplayName' }];

  for (const filter of items) {
    await selectNullOption(page, filter, false);
  }

  const waitForSearchResponse = page.waitForResponse(
    '/api/v1/search/query?q=*index=dataAsset*'
  );

  await page
    .getByTestId('searchBox')
    .fill(table.entityResponseData.fullyQualifiedName ?? '');
  await waitForSearchResponse;

  await clickOutside(page);

  // expect the quick filter to be persisted
  await expect(
    page.getByRole('button', { name: 'Owners : (1)' })
  ).toBeVisible();

  await page.getByTestId('searchBox').click();
  await page.keyboard.down('Enter');

  // expect the quick filter to be persisted
  await expect(
    page.getByRole('button', { name: 'Owners : (1)' })
  ).toBeVisible();
});

test('Filter by column entity type shows only column results', async ({
  page,
}) => {
  await sidebarClick(page, SidebarItem.EXPLORE);

  await page.getByRole('button', { name: 'Data Assets' }).click();

  const columnCheckbox = page.getByTestId('tablecolumn-checkbox');

  const dataAssetDropdownRequest = page.waitForResponse(
    '/api/v1/search/aggregate?index=dataAsset&field=entityType.keyword*tableColumn*'
  );

  await page
    .getByTestId('drop-down-menu')
    .getByTestId('search-input')
    .fill('tableColumn');

  await dataAssetDropdownRequest;

  await columnCheckbox.check();
  await page.getByTestId('update-btn').click();

  await page.getByTestId('search-dropdown-Data Assets').click();
  await expect(page.getByTestId('tablecolumn-checkbox')).toBeChecked();
  await expect(page.getByTestId('search-dropdown-Data Assets')).toContainText(
    '(1)'
  );
});

test.describe('Tier filter - aggregation-based options', () => {
  test('tier with assigned asset appears in dropdown, tier without asset does not', async ({
    page,
  }) => {
    await test.step('Open Tier filter dropdown', async () => {
      await page.getByTestId('search-dropdown-Tier').click();
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Search for tier with asset — it is visible in dropdown', async () => {
      const searchRes = page.waitForResponse(
        `/api/v1/search/aggregate?index=dataAsset&field=tier.tagFQN*`
      );
      await page
        .getByTestId('search-input')
        .fill(tier.responseData.fullyQualifiedName);
      await searchRes;

      await expect(
        page.getByTestId(tier.responseData.fullyQualifiedName.toLowerCase())
      ).toBeVisible();
    });

    await test.step('Search for tier without asset — it is not visible in dropdown', async () => {
      await page.getByTestId('search-input').clear();
      const searchRes = page.waitForResponse(
        `/api/v1/search/aggregate?index=dataAsset&field=tier.tagFQN*`
      );
      await page
        .getByTestId('search-input')
        .fill(tierWithoutAsset.responseData.fullyQualifiedName);
      await searchRes;

      await expect(
        page.getByTestId(
          tierWithoutAsset.responseData.fullyQualifiedName.toLowerCase()
        )
      ).not.toBeVisible();

      await expect(page.getByText('No data available.')).toBeVisible();
    });

    await clickOutside(page);
  });

  test('selecting a tier filter shows only assets tagged with that tier', async ({
    page,
  }) => {
    await test.step('Open Tier filter dropdown and select the tier', async () => {
      await page.getByTestId('search-dropdown-Tier').click();
      await waitForAllLoadersToDisappear(page);

      const searchRes = page.waitForResponse(
        `/api/v1/search/aggregate?index=dataAsset&field=tier.tagFQN*`
      );
      await page
        .getByTestId('search-input')
        .fill(tier.responseData.fullyQualifiedName);
      await searchRes;

      await page
        .getByTestId(tier.responseData.fullyQualifiedName.toLowerCase())
        .click();
      await expect(
        page.getByTestId(
          `${tier.responseData.fullyQualifiedName.toLowerCase()}-checkbox`
        )
      ).toBeChecked();
    });

    await test.step('Apply filter and verify asset is visible in results', async () => {
      const queryRes = page.waitForResponse(
        `/api/v1/search/query?*index=dataAsset*query_filter=*tier.tagFQN*`
      );
      await page.getByTestId('update-btn').click();
      await queryRes;
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByTestId(
          `table-data-card_${table.entityResponseData?.fullyQualifiedName}`
        )
      ).toBeVisible();
    });
  });
});

test.describe('Filter persistence after bug fixes', () => {
  test('explore tree sidebar selection is not cleared when a top dropdown filter is applied', async ({
    page,
  }) => {
    test.slow();

    await test.step('Click on Databases in the explore tree to select it', async () => {
      const treeSearchRes = page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/v1/search/query') &&
          resp.url().includes('index=dataAsset')
      );
      await page.getByTestId('explore-tree-title-Databases').click();
      await treeSearchRes;
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Verify the Databases node is marked as selected', async () => {
      await expect(page.locator('.ant-tree-node-selected')).toBeVisible();
    });

    await test.step('Apply Tag filter from top dropdown', async () => {
      await page.getByTestId('search-dropdown-Tag').click();
      await searchAndClickOnOption(
        page,
        { key: 'tags.tagFQN', label: 'Tag', value: 'PersonalData.Personal' },
        true
      );
      const queryRes = page.waitForResponse(
        '/api/v1/search/query?*index=dataAsset*'
      );
      await page.getByTestId('update-btn').click();
      await queryRes;
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Verify Databases node selection is still preserved after filter change', async () => {
      await expect(page.locator('.ant-tree-node-selected')).toBeVisible();
    });
  });

  test('sort order is preserved in URL when explore tree node is clicked after applying a top dropdown filter', async ({
    page,
  }) => {
    test.slow();

    await test.step('Toggle sort order to ascending', async () => {
      const sortRes = page.waitForResponse(
        '/api/v1/search/query?*sort_order=asc*'
      );
      await page.getByTestId('sort-order-button').click();
      await sortRes;
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Apply Tag filter from top dropdown', async () => {
      await page.getByTestId('search-dropdown-Tag').click();
      await searchAndClickOnOption(
        page,
        { key: 'tags.tagFQN', label: 'Tag', value: 'PersonalData.Personal' },
        true
      );
      const queryRes = page.waitForResponse(
        '/api/v1/search/query?*index=dataAsset*'
      );
      await page.getByTestId('update-btn').click();
      await queryRes;
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Click on Databases in the explore tree', async () => {
      const treeSearchRes = page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/v1/search/query') &&
          resp.url().includes('index=dataAsset')
      );
      await page.getByTestId('explore-tree-title-Databases').click();
      await treeSearchRes;
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Verify sort order is preserved in the URL after tree node click', async () => {
      await expect(page).toHaveURL(/sortOrder=asc/);
    });
  });
});

test.describe('Metric search result highlight', () => {
  const metric = new MetricClass();

  test.beforeAll('Create metric entity', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await metric.create(apiContext);

    await expect(async () => {
      const response = await apiContext.get(
        `/api/v1/search/query?q=${metric.entity.name}&index=metric&from=0&size=10`
      );
      const data = await response.json();

      expect(data.hits.total.value).toBeGreaterThan(0);
    }).toPass({ timeout: 90_000, intervals: [2_000] });

    await afterAction();
  });

  test('breadcrumb should show plain entity name and display name header should have highlighted terms', async ({
    page,
  }) => {
    await test.step('Select Metric search index and search', async () => {
      await page.getByTestId('global-search-selector').waitFor({
        state: 'visible',
      });
      await page.getByTestId('global-search-selector').click();
      await page.getByTestId('global-search-select-dropdown').waitFor({
        state: 'visible',
      });

      await page
        .getByTestId('global-search-select-dropdown')
        .locator('.rc-virtual-list-holder')
        .evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });

      const metricOption = page.getByTestId(
        'global-search-select-option-Metric'
      );
      await metricOption.waitFor({ state: 'visible' });
      await metricOption.click();

      const searchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('metric')
      );

      await page.getByTestId('searchBox').fill(metric.entity.name);
      await page.keyboard.press('Enter');

      const response = await searchResponse;
      expect(response.status()).toBe(200);

      await waitForAllLoadersToDisappear(page);
      await page.getByTestId('search-results').waitFor({ state: 'visible' });
    });

    await test.step('Verify breadcrumb shows Metrics / plain entity name without HTML tags', async () => {
      const entityCard = page.getByTestId(
        `table-data-card_${metric.entity.name}`
      );
      await entityCard.waitFor({ state: 'visible' });

      const breadcrumb = entityCard.getByTestId('breadcrumb');

      const firstLink = breadcrumb
        .getByTestId('breadcrumb-link')
        .first()
        .getByRole('link');
      await expect(firstLink).toHaveText('Metrics');

      const inactiveLink = breadcrumb.getByTestId('inactive-link');
      await expect(inactiveLink).toHaveText(metric.entity.name);
      await expect(inactiveLink).not.toContainText('<span');
      await expect(inactiveLink).not.toContainText('text-highlighter');
    });

    await test.step('Verify display name header has highlighted search terms', async () => {
      const entityCard = page.getByTestId(
        `table-data-card_${metric.entity.name}`
      );
      const displayNameHeader = entityCard.getByTestId(
        'entity-header-display-name'
      );

      await expect(displayNameHeader).toBeVisible();

      const highlightedSpan = displayNameHeader.locator(
        'span.text-highlighter'
      );
      await expect(highlightedSpan.first()).toBeVisible();

      const fullText = await displayNameHeader.textContent();
      expect(fullText?.trim()).toBe(metric.entity.name);
    });
  });
});
