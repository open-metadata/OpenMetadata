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
import { expect, Page, test } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { Domain } from '../../../support/domain/Domain';
import { SubDomain } from '../../../support/domain/SubDomain';
import { Glossary } from '../../../support/glossary/Glossary';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import {
  selectDomainFromNavbar,
  verifyActiveDomainIsDefault,
} from '../../../utils/domain';
import { sidebarClick } from '../../../utils/sidebar';
import { performUserLogin } from '../../../utils/user';

/**
 * The navbar domain selection is persisted on the user (`defaultDomain`) and applied
 * server-side to REST list views: a parent pick also includes its sub-domains, the pick
 * survives a fresh login, and clearing it restores the unfiltered view.
 *
 * The selection is per user and persisted, so these tests run as a dedicated user and
 * in series: on the shared admin account a pick would leak into every other worker's
 * list views, and parallel picks would clobber each other.
 */
test.describe.configure({ mode: 'serial' });

const viewer = new UserClass();
const domainA = new Domain();
const domainB = new Domain();
let subDomainA: SubDomain;
const glossaryInA = new Glossary();
const glossaryInB = new Glossary();
const glossaryInSubA = new Glossary();

const glossaryPanel = (page: Page) => page.getByTestId('glossary-left-panel');

const expectGlossaryVisible = (page: Page, glossary: Glossary) =>
  expect(
    glossaryPanel(page).getByRole('menuitem', {
      name: glossary.responseData.displayName,
      exact: true,
    })
  ).toBeVisible();

const expectGlossaryHidden = (page: Page, glossary: Glossary) =>
  expect(
    glossaryPanel(page).getByRole('menuitem', {
      name: glossary.responseData.displayName,
      exact: true,
    })
  ).toBeHidden();

test.beforeAll(
  'Seed a viewer, domains, a sub-domain and one glossary in each',
  async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await viewer.create(apiContext);
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
  for (const g of [glossaryInSubA, glossaryInA, glossaryInB]) {
    await g.delete(apiContext);
  }
  await subDomainA.delete(apiContext);
  await domainA.delete(apiContext);
  await domainB.delete(apiContext);
  await viewer.delete(apiContext);
  await afterAction();
});

test('picking a domain narrows the glossary list and includes its sub-domain', async ({
  browser,
}) => {
  const { page, afterAction } = await performUserLogin(browser, viewer);
  try {
    await redirectToHomePage(page);
    // The navbar domain dropdown is not shown on the home page; pick it from the glossary page.
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectDomainFromNavbar(page, domainA.responseData);

    await expectGlossaryVisible(page, glossaryInA);
    await expectGlossaryVisible(page, glossaryInSubA);
    await expectGlossaryHidden(page, glossaryInB);
  } finally {
    await afterAction();
  }
});

test('the pick is persisted and restored on a fresh login', async ({
  browser,
}) => {
  const first = await performUserLogin(browser, viewer);
  try {
    await redirectToHomePage(first.page);
    await sidebarClick(first.page, SidebarItem.GLOSSARY);
    await selectDomainFromNavbar(first.page, domainB.responseData);
  } finally {
    await first.afterAction();
  }

  // A new browser context is a fresh login; the navbar must seed from the persisted defaultDomain.
  const second = await performUserLogin(browser, viewer);
  try {
    await redirectToHomePage(second.page);
    await sidebarClick(second.page, SidebarItem.GLOSSARY);
    await expect(second.page.getByTestId('domain-dropdown')).toContainText(
      domainB.responseData.displayName
    );
    await expectGlossaryVisible(second.page, glossaryInB);
    await expectGlossaryHidden(second.page, glossaryInA);
  } finally {
    await second.afterAction();
  }
});

test('clearing the selection restores the unfiltered list', async ({
  browser,
}) => {
  const { page, apiContext, afterAction } = await performUserLogin(
    browser,
    viewer
  );
  try {
    await apiContext.patch(`/api/v1/users/${viewer.responseData.id}`, {
      data: [{ op: 'add', path: '/defaultDomain', value: null }],
      headers: { 'Content-Type': 'application/json-patch+json' },
    });

    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await verifyActiveDomainIsDefault(page);
    for (const g of [glossaryInA, glossaryInB, glossaryInSubA]) {
      await expectGlossaryVisible(page, g);
    }
  } finally {
    await afterAction();
  }
});
