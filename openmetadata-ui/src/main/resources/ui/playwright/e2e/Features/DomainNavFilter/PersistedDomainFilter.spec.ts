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
import { expect, test } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { Domain } from '../../../support/domain/Domain';
import { SubDomain } from '../../../support/domain/SubDomain';
import { Glossary } from '../../../support/glossary/Glossary';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import {
  selectDomainFromNavbar,
  verifyActiveDomainIsDefault,
} from '../../../utils/domain';
import { sidebarClick } from '../../../utils/sidebar';

/**
 * The navbar domain selection is persisted on the user (`defaultDomain`) and applied
 * server-side to REST list views: a parent pick also includes its sub-domains, the pick
 * survives a fresh login, and clearing it restores the unfiltered view.
 */
// use the admin user for all the tests
test.use({ storageState: 'playwright/.auth/admin.json' });

const domainA = new Domain();
const domainB = new Domain();
let subDomainA: SubDomain;
const glossaryInA = new Glossary();
const glossaryInB = new Glossary();
const glossaryInSubA = new Glossary();

const glossaryPanel = (page: import('@playwright/test').Page) =>
  page.getByTestId('glossary-left-panel');

test.beforeAll(
  'Seed domains, a sub-domain and one glossary in each',
  async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await domainA.create(apiContext);
    await domainB.create(apiContext);
    subDomainA = new SubDomain(domainA);
    await subDomainA.create(apiContext);
    for (const [glossary, domain] of [
      [glossaryInA, domainA.responseData],
      [glossaryInB, domainB.responseData],
      [glossaryInSubA, subDomainA.responseData],
    ] as const) {
      await glossary.create(apiContext);
      await glossary.patch(apiContext, [
        {
          op: 'add',
          path: '/domains',
          value: [{ id: domain.id, type: 'domain' }],
        },
      ]);
    }
    await afterAction();
  }
);

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  // Reset the persisted selection so later specs start unfiltered.
  const me = await (await apiContext.get('/api/v1/users/loggedInUser')).json();
  await apiContext.patch(`/api/v1/users/${me.id}`, {
    data: [{ op: 'add', path: '/defaultDomain', value: null }],
    headers: { 'Content-Type': 'application/json-patch+json' },
  });
  for (const g of [glossaryInSubA, glossaryInA, glossaryInB]) {
    await g.delete(apiContext);
  }
  await subDomainA.delete(apiContext);
  await domainA.delete(apiContext);
  await domainB.delete(apiContext);
  await afterAction();
});

test('picking a domain narrows the glossary list and includes its sub-domain', async ({
  page,
}) => {
  await redirectToHomePage(page);
  // The navbar domain dropdown is not shown on the home page; pick it from the glossary page.
  await sidebarClick(page, SidebarItem.GLOSSARY);
  await selectDomainFromNavbar(page, domainA.responseData);

  const panel = glossaryPanel(page);
  await expect(
    panel.getByRole('menuitem', {
      name: glossaryInA.responseData.displayName,
      exact: true,
    })
  ).toBeVisible();
  await expect(
    panel.getByRole('menuitem', {
      name: glossaryInSubA.responseData.displayName,
      exact: true,
    })
  ).toBeVisible();
  await expect(
    panel.getByRole('menuitem', {
      name: glossaryInB.responseData.displayName,
      exact: true,
    })
  ).toBeHidden();
});

test('the pick is persisted and restored on a fresh login', async ({
  page,
}) => {
  await redirectToHomePage(page);
  await sidebarClick(page, SidebarItem.GLOSSARY);
  await selectDomainFromNavbar(page, domainB.responseData);

  // A reload is a fresh app boot; the navbar must seed from the persisted defaultDomain.
  await page.reload();
  await expect(page.getByTestId('domain-dropdown')).toContainText(
    domainB.responseData.displayName
  );

  const panel = glossaryPanel(page);
  await expect(
    panel.getByRole('menuitem', {
      name: glossaryInB.responseData.displayName,
      exact: true,
    })
  ).toBeVisible();
  await expect(
    panel.getByRole('menuitem', {
      name: glossaryInA.responseData.displayName,
      exact: true,
    })
  ).toBeHidden();
});

test('clearing the selection restores the unfiltered list', async ({
  page,
  browser,
}) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  const me = await (await apiContext.get('/api/v1/users/loggedInUser')).json();
  await apiContext.patch(`/api/v1/users/${me.id}`, {
    data: [{ op: 'add', path: '/defaultDomain', value: null }],
    headers: { 'Content-Type': 'application/json-patch+json' },
  });
  await afterAction();

  await redirectToHomePage(page);
  await sidebarClick(page, SidebarItem.GLOSSARY);
  await verifyActiveDomainIsDefault(page);
  const panel = glossaryPanel(page);
  for (const g of [glossaryInA, glossaryInB, glossaryInSubA]) {
    await expect(
      panel.getByRole('menuitem', {
        name: g.responseData.displayName,
        exact: true,
      })
    ).toBeVisible();
  }
});
