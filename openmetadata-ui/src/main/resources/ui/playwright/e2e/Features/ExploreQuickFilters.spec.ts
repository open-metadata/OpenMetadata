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
import { isUndefined } from 'lodash';
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { TableClass } from '../../support/entity/TableClass';
import { TagClass } from '../../support/tag/TagClass';
import {
  clickOutside,
  createNewPage,
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

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  test.slow();

  const { apiContext, afterAction } = await createNewPage(browser);
  await table.create(apiContext);
  await domain.create(apiContext);
  await tier.create(apiContext);

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
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });
});

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

test('should search for empty or null filters', async ({ page }) => {
  const items = [
    { label: 'Owners', key: 'owners.displayName.keyword' },
    { label: 'Tag', key: 'tags.tagFQN' },
    { label: 'Domains', key: 'domains.displayName.keyword' },
    { label: 'Tier', key: 'tier.tagFQN' },
  ];

  for (const filter of items) {
    await selectNullOption(page, filter);
  }
});

test('should show correct count for initial options', async ({ page }) => {
  const items = [{ label: 'Tier', key: 'tier.tagFQN' }];

  for (const filter of items) {
    const aggregateAPI = page.waitForResponse(
      '/api/v1/search/aggregate?index=dataAsset&field=tier.tagFQN*'
    );
    const tierFetchAPI = page.waitForResponse(
      '/api/v1/tags?parent=Tier&limit=50'
    );
    await page.click(`[data-testid="search-dropdown-${filter.label}"]`);

    const res = await aggregateAPI;
    const tierRes = await tierFetchAPI;
    const data = await res.json();
    const tierList = (await tierRes.json()).data;
    const buckets = data.aggregations['sterms#tier.tagFQN'].buckets;

    await waitForAllLoadersToDisappear(page);

    // The following logic is required due to special case for tier filter
    // where we are fetching the tier options from tag API and
    // the count from aggregation API.
    // So we need to match the bucket count with the corresponding tier option.
    for (const tierItem of tierList) {
      // Find the corresponding bucket for the tier
      const bucket = buckets.find(
        (item: { key: string }) =>
          item.key.toLowerCase() === tierItem.fullyQualifiedName?.toLowerCase()
      );
      // Check if the tier in the dropdown has a corresponding bucket in elastic search response
      if (!isUndefined(bucket)) {
        await expect(
          page
            .locator(`[data-menu-id$="-${tierItem.fullyQualifiedName}"]`)
            .getByTestId('filter-count')
        ).toHaveText(bucket.doc_count.toString());
      }
    }

    await clickOutside(page);
  }
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
  ];

  for (const filter of items) {
    await selectNullOption(page, filter);
  }
});

test('should persist quick filter on global search', async ({ page }) => {
  const items = [{ label: 'Owners', key: 'owners.displayName.keyword' }];

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
    page.getByRole('button', { name: 'Owners : No Owners' })
  ).toBeVisible();

  await page.getByTestId('searchBox').click();
  await page.keyboard.down('Enter');

  await page.waitForLoadState('networkidle');

  // expect the quick filter to be persisted
  await expect(
    page.getByRole('button', { name: 'Owners : No Owners' })
  ).toBeVisible();
});
