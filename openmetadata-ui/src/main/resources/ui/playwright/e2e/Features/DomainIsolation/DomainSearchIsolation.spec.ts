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
import { Domain } from '../../../support/domain/Domain';
import { TableClass } from '../../../support/entity/TableClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext } from '../../../utils/common';
import {
  assignDomainOnlyAccess,
  assignDomainToTable,
  safeDelete,
} from '../../../utils/domainIsolationUtils';
import { enableDisableSearchRBAC } from '../../../utils/searchRBAC';

// Issue #24180 — with the global `enableAccessControl` search setting on, a user holding the
// seeded DomainOnlyAccessRole can only discover (via navbar search / explore) assets in their
// assigned domains plus domainless assets. The SAME foreign asset must be hidden per-user.
const adminUser = new UserClass();
const userA = new UserClass();
const userB = new UserClass();
const tenantA = new Domain();
const tenantB = new Domain();
const tableA = new TableClass();
const tableB = new TableClass();
const tableNoDomain = new TableClass();

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

const fqnOf = (table: TableClass) =>
  table.entityResponseData?.fullyQualifiedName ?? '';

/**
 * Runs the global `/api/v1/search/query` as the logged-in user and returns the serialized hits.
 * With search RBAC (`enableAccessControl`) on, the backend restricts hits to the user's accessible
 * domains plus domainless assets — which is exactly the isolation we assert on. We assert at the
 * search-API layer (through the user's own session) because the redesigned landing page scopes its
 * search box to the user's active domain, which a restricted user cannot widen to "All Domains".
 */
const searchHitsAsUser = async (
  page: Page,
  table: TableClass
): Promise<string> => {
  const { apiContext, afterAction } = await getApiContext(page);

  try {
    const response = await apiContext.get('/api/v1/search/query', {
      params: {
        q: table.entityResponseData?.name ?? '',
        index: 'dataAsset',
        from: 0,
        size: 50,
      },
    });
    const json = await response.json();

    return JSON.stringify(json?.hits?.hits ?? []);
  } finally {
    await afterAction();
  }
};

test.describe('Domain isolation - search and explore @domain-isolation', () => {
  test.slow(true);

  test.beforeAll(
    'Setup domains, tables, users and role binding',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await adminUser.create(apiContext);
        await adminUser.setAdminRole(apiContext);
        await userA.create(apiContext);
        await userB.create(apiContext);

        await tenantA.create(apiContext);
        await tenantB.create(apiContext);

        await tableA.create(apiContext);
        await tableB.create(apiContext);
        await tableNoDomain.create(apiContext);

        await assignDomainToTable(
          apiContext,
          tableA.entityResponseData?.id ?? '',
          tenantA
        );
        await assignDomainToTable(
          apiContext,
          tableB.entityResponseData?.id ?? '',
          tenantB
        );

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
      await safeDelete(() => tableA.delete(apiContext));
      await safeDelete(() => tableB.delete(apiContext));
      await safeDelete(() => tableNoDomain.delete(apiContext));
      await safeDelete(() => tenantA.delete(apiContext));
      await safeDelete(() => tenantB.delete(apiContext));
      await safeDelete(() => userA.delete(apiContext));
      await safeDelete(() => userB.delete(apiContext));
      await safeDelete(() => adminUser.delete(apiContext));
    } finally {
      await afterAction();
    }
  });

  test('userA finds tenantA and domainless tables but not tenantB', async ({
    userAPage,
  }) => {
    await expect
      .poll(() => searchHitsAsUser(userAPage, tableA), { timeout: 30_000 })
      .toContain(fqnOf(tableA));
    await expect
      .poll(() => searchHitsAsUser(userAPage, tableNoDomain), {
        timeout: 30_000,
      })
      .toContain(fqnOf(tableNoDomain));
    await expect
      .poll(() => searchHitsAsUser(userAPage, tableB), { timeout: 30_000 })
      .not.toContain(fqnOf(tableB));
  });

  test('userB finds tenantB and domainless tables but not tenantA', async ({
    userBPage,
  }) => {
    await expect
      .poll(() => searchHitsAsUser(userBPage, tableB), { timeout: 30_000 })
      .toContain(fqnOf(tableB));
    await expect
      .poll(() => searchHitsAsUser(userBPage, tableNoDomain), {
        timeout: 30_000,
      })
      .toContain(fqnOf(tableNoDomain));
    await expect
      .poll(() => searchHitsAsUser(userBPage, tableA), { timeout: 30_000 })
      .not.toContain(fqnOf(tableA));
  });

  test('admin finds tables from both tenants', async ({ adminPage }) => {
    await expect
      .poll(() => searchHitsAsUser(adminPage, tableA), { timeout: 30_000 })
      .toContain(fqnOf(tableA));
    await expect
      .poll(() => searchHitsAsUser(adminPage, tableB), { timeout: 30_000 })
      .toContain(fqnOf(tableB));
  });
});
