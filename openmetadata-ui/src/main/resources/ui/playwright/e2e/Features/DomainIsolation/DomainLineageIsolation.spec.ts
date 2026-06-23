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
import {
  connectEdgeBetweenNodesViaAPI,
  visitLineageTab,
} from '../../../utils/lineage';
import { enableDisableSearchRBAC } from '../../../utils/searchRBAC';
import {
  assignDomainOnlyAccess,
  assignDomainToTable,
  safeDelete,
} from './domainIsolationUtils';

// Issue #24180 — lineage search is RBAC-gated by the global `enableAccessControl` setting. With it
// on, the lineage graph for a user holding the seeded DomainOnlyAccessRole must prune nodes that
// belong to domains they cannot access, while admins continue to see the full graph.
const adminUser = new UserClass();
const userA = new UserClass();
const userB = new UserClass();
const tenantA = new Domain();
const tenantB = new Domain();
const tableA = new TableClass();
const tableB = new TableClass();

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

test.describe('Domain isolation - lineage graph @domain-isolation', () => {
  test.slow(true);

  test.beforeAll(
    'Setup domains, tables, lineage, users and role binding',
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

        await connectEdgeBetweenNodesViaAPI(
          apiContext,
          { id: tableA.entityResponseData?.id ?? '', type: 'table' },
          { id: tableB.entityResponseData?.id ?? '', type: 'table' }
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
      await safeDelete(() =>
        apiContext.delete(
          `/api/v1/lineage/table/${tableA.entityResponseData?.id}/table/${tableB.entityResponseData?.id}`
        )
      );
      await safeDelete(() => tableA.delete(apiContext));
      await safeDelete(() => tableB.delete(apiContext));
      await safeDelete(() => tenantA.delete(apiContext));
      await safeDelete(() => tenantB.delete(apiContext));
      await safeDelete(() => userA.delete(apiContext));
      await safeDelete(() => userB.delete(apiContext));
      await safeDelete(() => adminUser.delete(apiContext));
    } finally {
      await afterAction();
    }
  });

  test('userA sees tableA but not the cross-tenant tableB node', async ({
    userAPage,
  }) => {
    await tableA.visitEntityPage(userAPage);
    await visitLineageTab(userAPage);

    await expect(
      userAPage.getByTestId(`lineage-node-${fqnOf(tableA)}`)
    ).toBeVisible();
    await expect(
      userAPage.getByTestId(`lineage-node-${fqnOf(tableB)}`)
    ).toHaveCount(0);
  });

  test('userB sees tableB but not the cross-tenant tableA node', async ({
    userBPage,
  }) => {
    await tableB.visitEntityPage(userBPage);
    await visitLineageTab(userBPage);

    await expect(
      userBPage.getByTestId(`lineage-node-${fqnOf(tableB)}`)
    ).toBeVisible();
    await expect(
      userBPage.getByTestId(`lineage-node-${fqnOf(tableA)}`)
    ).toHaveCount(0);
  });

  test('admin sees both nodes in the lineage graph', async ({ adminPage }) => {
    await tableA.visitEntityPage(adminPage);
    await visitLineageTab(adminPage);

    await expect(
      adminPage.getByTestId(`lineage-node-${fqnOf(tableA)}`)
    ).toBeVisible();
    await expect(
      adminPage.getByTestId(`lineage-node-${fqnOf(tableB)}`)
    ).toBeVisible();
  });
});
