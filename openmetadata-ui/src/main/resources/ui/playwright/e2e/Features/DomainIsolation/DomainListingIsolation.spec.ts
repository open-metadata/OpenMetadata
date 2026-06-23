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
import { expect, Page, test as base } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { Domain } from '../../../support/domain/Domain';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import {
  assignDomainOnlyAccess,
  safeDelete,
} from '../../../utils/domainIsolationUtils';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { enableDisableSearchRBAC } from '../../../utils/searchRBAC';
import { sidebarClick } from '../../../utils/sidebar';

// Issue #24180 — the Domains listing page is driven by the `index=domain` search query, which is
// RBAC-gated by the seeded DomainOnlyAccessRole. A restricted user must only see the domain cards
// they are assigned to; admins see every domain.
const adminUser = new UserClass();
const userA = new UserClass();
const userB = new UserClass();
const tenantA = new Domain();
const tenantB = new Domain();

const test = base.extend<{
  adminPage: Page;
  userAPage: Page;
  userBPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    try {
      await adminUser.login(page);
      await use(page);
    } finally {
      await page.close();
    }
  },
  userAPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    try {
      await userA.login(page);
      await use(page);
    } finally {
      await page.close();
    }
  },
  userBPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    try {
      await userB.login(page);
      await use(page);
    } finally {
      await page.close();
    }
  },
});

const openDomainListing = async (page: Page) => {
  await redirectToHomePage(page);
  const listingResponse = page.waitForResponse(
    '/api/v1/search/query?q=&index=domain*'
  );
  await sidebarClick(page, SidebarItem.DOMAIN);
  await listingResponse;
  await waitForAllLoadersToDisappear(page);
};

test.describe('Domain isolation - domain listing page @domain-isolation', () => {
  test.slow(true);

  test.beforeAll(
    'Setup domains, users and role binding',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await adminUser.create(apiContext);
        await adminUser.setAdminRole(apiContext);
        await userA.create(apiContext);
        await userB.create(apiContext);

        await tenantA.create(apiContext);
        await tenantB.create(apiContext);

        await assignDomainOnlyAccess(apiContext, userA, [tenantA]);
        await assignDomainOnlyAccess(apiContext, userB, [tenantB]);

        await enableDisableSearchRBAC(apiContext, true);
      } finally {
        await afterAction();
      }
    }
  );

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await enableDisableSearchRBAC(apiContext, false);
      await safeDelete(() => tenantA.delete(apiContext));
      await safeDelete(() => tenantB.delete(apiContext));
      await safeDelete(() => userA.delete(apiContext));
      await safeDelete(() => userB.delete(apiContext));
      await safeDelete(() => adminUser.delete(apiContext));
    } finally {
      await afterAction();
    }
  });

  test('userA sees only tenantA on the domains listing page', async ({
    userAPage,
  }) => {
    await openDomainListing(userAPage);

    await expect(userAPage.getByTestId(tenantA.data.name)).toBeVisible();
    await expect(userAPage.getByTestId(tenantB.data.name)).toHaveCount(0);
  });

  test('userB sees only tenantB on the domains listing page', async ({
    userBPage,
  }) => {
    await openDomainListing(userBPage);

    await expect(userBPage.getByTestId(tenantB.data.name)).toBeVisible();
    await expect(userBPage.getByTestId(tenantA.data.name)).toHaveCount(0);
  });

  test('admin sees both tenants on the domains listing page', async ({
    adminPage,
  }) => {
    await openDomainListing(adminPage);

    await expect(adminPage.getByTestId(tenantA.data.name)).toBeVisible();
    await expect(adminPage.getByTestId(tenantB.data.name)).toBeVisible();
  });
});
