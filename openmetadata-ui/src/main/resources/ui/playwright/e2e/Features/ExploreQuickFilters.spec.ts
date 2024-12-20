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
import test from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { TableClass } from '../../support/entity/TableClass';
import {
  assignDomain,
  createNewPage,
  redirectToHomePage,
} from '../../utils/common';
import { assignTag } from '../../utils/entity';
import { searchAndClickOnOption, selectNullOption } from '../../utils/explore';
import { sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const domain = new Domain();
const table = new TableClass();

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { page, apiContext, afterAction } = await createNewPage(browser);
  await table.create(apiContext);
  await domain.create(apiContext);
  await table.visitEntityPage(page);
  await assignDomain(page, domain.data);
  await assignTag(page, 'PersonalData.Personal');
  await afterAction();
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.delete(apiContext);
  await domain.delete(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
  await sidebarClick(page, SidebarItem.EXPLORE);
});

test('search dropdown should work properly for quick filters', async ({
  page,
}) => {
  const items = [
    {
      label: 'Domain',
      key: 'domain.displayName.keyword',
      value: domain.responseData.displayName,
    },
    { label: 'Tag', key: 'tags.tagFQN', value: 'PersonalData.Personal' },
  ];

  for (const filter of items) {
    await page.click(`[data-testid="search-dropdown-${filter.label}"]`);
    await searchAndClickOnOption(page, filter, true);

    const querySearchURL = `/api/v1/search/query?*index=dataAsset*query_filter=*should*${
      filter.key
    }*${(filter.value ?? '').replace(/ /g, '+').toLowerCase()}*`;

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
    { label: 'Domain', key: 'domain.displayName.keyword' },
    { label: 'Tier', key: 'tier.tagFQN' },
  ];

  for (const filter of items) {
    await selectNullOption(page, filter);
  }
});

test('should search for multiple values alongwith null filters', async ({
  page,
}) => {
  const items = [
    {
      label: 'Tag',
      key: 'tags.tagFQN',
      value: 'PersonalData.Personal',
    },
    {
      label: 'Domain',
      key: 'domain.displayName.keyword',
      value: domain.responseData.displayName,
    },
  ];

  for (const filter of items) {
    await selectNullOption(page, filter);
  }
});
