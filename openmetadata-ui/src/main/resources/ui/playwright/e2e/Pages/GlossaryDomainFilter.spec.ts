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
import { expect, Page, test as base } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { Glossary } from '../../support/glossary/Glossary';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { selectDomainFromNavbar } from '../../utils/domain';
import {
  assignDomainOnlyAccess,
  safeDelete,
} from '../../utils/domainIsolationUtils';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

// Reported by a customer: a glossary that belongs to Domain A stays visible in the
// Glossary left panel even when Domain B is selected in the global (navbar) domain
// filter. The global filter should scope every list view, but GET /api/v1/glossaries
// did not honour the `domain` query param the UI sends. This spec exercises both the
// global-selector path (admin) and the RBAC path (DomainOnlyAccessRole users) so the
// two mechanisms are told apart empirically.
const adminUser = new UserClass();
const userA = new UserClass();
const userB = new UserClass();
const userAB = new UserClass();
const domainA = new Domain();
const domainB = new Domain();
const glossaryA = new Glossary();
const glossaryB = new Glossary();

const test = base.extend<{
  adminPage: Page;
  userAPage: Page;
  userBPage: Page;
  userABPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await adminUser.login(page);
    await use(page);
    await page.close();
  },
  userAPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await userA.login(page);
    await use(page);
    await page.close();
  },
  userBPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await userB.login(page);
    await use(page);
    await page.close();
  },
  userABPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await userAB.login(page);
    await use(page);
    await page.close();
  },
});

const assignDomainToGlossary = async (
  apiContext: Parameters<typeof assignDomainOnlyAccess>[0],
  glossary: Glossary,
  domain: Domain
) => {
  await glossary.patch(apiContext, [
    {
      op: 'add',
      path: '/domains',
      value: [
        {
          id: domain.responseData.id,
          type: 'domain',
          name: domain.responseData.name,
          fullyQualifiedName: domain.responseData.fullyQualifiedName,
        },
      ],
    },
  ]);
};

const waitForGlossaryList = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/v1/glossaries?') &&
      response.status() === 200
  );

const openGlossaryList = async (page: Page) => {
  const listResponse = waitForGlossaryList(page);
  await sidebarClick(page, SidebarItem.GLOSSARY);
  await listResponse;
  await waitForAllLoadersToDisappear(page);
};

// The navbar domain dropdown (`data-testid="domain-dropdown"`) is hidden on the
// home page (NavBar.tsx: `!isHomePage && ...`), so it can only be operated from a
// non-home page such as the Glossary page. After switching the domain we reload so
// the glossary list is re-fetched with the `?domain=` param the interceptor adds.
const applyNavbarDomainOnGlossary = async (
  page: Page,
  domain: Domain['responseData']
) => {
  await selectDomainFromNavbar(page, domain);
  const listResponse = waitForGlossaryList(page);
  await page.reload();
  await listResponse;
  await waitForAllLoadersToDisappear(page);
};

const glossaryItem = (page: Page, glossary: Glossary) =>
  page
    .getByTestId('glossary-left-panel')
    .getByRole('menuitem', { name: glossary.data.displayName, exact: true });

test.describe('Glossary global domain filter', () => {
  test.slow(true);

  test.beforeAll('Setup domains, glossaries, users', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    await userA.create(apiContext);
    await userB.create(apiContext);
    await userAB.create(apiContext);

    await domainA.create(apiContext);
    await domainB.create(apiContext);
    await glossaryA.create(apiContext);
    await glossaryB.create(apiContext);

    await assignDomainToGlossary(apiContext, glossaryA, domainA);
    await assignDomainToGlossary(apiContext, glossaryB, domainB);

    await assignDomainOnlyAccess(apiContext, userA, [domainA]);
    await assignDomainOnlyAccess(apiContext, userB, [domainB]);
    await assignDomainOnlyAccess(apiContext, userAB, [domainA, domainB]);

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await safeDelete(() => glossaryA.delete(apiContext));
    await safeDelete(() => glossaryB.delete(apiContext));
    await safeDelete(() => domainA.delete(apiContext));
    await safeDelete(() => domainB.delete(apiContext));
    await safeDelete(() => userA.delete(apiContext));
    await safeDelete(() => userB.delete(apiContext));
    await safeDelete(() => userAB.delete(apiContext));
    await safeDelete(() => adminUser.delete(apiContext));

    await afterAction();
  });

  test('Admin: navbar domain selector filters the glossary list', async ({
    adminPage,
  }) => {
    await test.step('All Domains shows both glossaries', async () => {
      await redirectToHomePage(adminPage);
      await openGlossaryList(adminPage);

      await expect(glossaryItem(adminPage, glossaryA)).toBeVisible();
      await expect(glossaryItem(adminPage, glossaryB)).toBeVisible();
    });

    await test.step('Selecting Domain B hides the Domain A glossary', async () => {
      await applyNavbarDomainOnGlossary(adminPage, domainB.responseData);

      await expect(glossaryItem(adminPage, glossaryB)).toBeVisible();
      await expect(glossaryItem(adminPage, glossaryA)).toHaveCount(0);
    });
  });

  test('DomainOnlyAccess userA sees only Domain A glossary', async ({
    userAPage,
  }) => {
    await redirectToHomePage(userAPage);
    await openGlossaryList(userAPage);

    await expect(glossaryItem(userAPage, glossaryA)).toBeVisible();
    await expect(glossaryItem(userAPage, glossaryB)).toHaveCount(0);
  });

  test('DomainOnlyAccess userB sees only Domain B glossary', async ({
    userBPage,
  }) => {
    await redirectToHomePage(userBPage);
    await openGlossaryList(userBPage);

    await expect(glossaryItem(userBPage, glossaryB)).toBeVisible();
    await expect(glossaryItem(userBPage, glossaryA)).toHaveCount(0);
  });

  test('DomainOnlyAccess userAB: navbar selector narrows within assigned domains', async ({
    userABPage,
  }) => {
    await redirectToHomePage(userABPage);
    await openGlossaryList(userABPage);
    await applyNavbarDomainOnGlossary(userABPage, domainB.responseData);

    await expect(glossaryItem(userABPage, glossaryB)).toBeVisible();
    await expect(glossaryItem(userABPage, glossaryA)).toHaveCount(0);
  });
});
