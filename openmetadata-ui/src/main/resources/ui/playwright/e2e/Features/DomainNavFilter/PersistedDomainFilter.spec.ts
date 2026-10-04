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
import { expect, Page, Response, test } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { Domain } from '../../../support/domain/Domain';
import { SubDomain } from '../../../support/domain/SubDomain';
import { Glossary } from '../../../support/glossary/Glossary';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import {
  clearDomainFromNavbar,
  selectDomainFromNavbar,
  setPersistedDomain,
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

/**
 * The glossary page lists only its first page of glossaries, so on a busy server the seeded
 * ones may not be rendered. Assert on the list the page actually receives instead: the
 * server applies the persisted selection to it, and once narrowed it is small.
 */
const isGlossaryList = (r: Response) =>
  r.request().method() === 'GET' && r.url().includes('/api/v1/glossaries?');

const glossaryNamesFrom = async (response: Response) =>
  ((await response.json()).data as { name: string }[]).map((g) => g.name);

/** The navbar persists a pick/clear with a PATCH before it reloads; navigating earlier would abort it. */
const persisted = (page: Page) =>
  page.waitForResponse(
    (r) =>
      r.request().method() === 'PATCH' && r.url().includes('/api/v1/users/')
  );

const openGlossaryPage = async (page: Page) => {
  const list = page.waitForResponse(isGlossaryList);
  await sidebarClick(page, SidebarItem.GLOSSARY);

  return glossaryNamesFrom(await list);
};

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
    await openGlossaryPage(page);
    const pickA = persisted(page);
    await selectDomainFromNavbar(page, domainA.responseData);
    await pickA;
    // The pick is persisted before the page reloads; a fresh visit lists with it applied.
    await redirectToHomePage(page);
    const names = await openGlossaryPage(page);

    expect(names).toContain(glossaryInA.responseData.name);
    expect(names).toContain(glossaryInSubA.responseData.name);
    expect(names).not.toContain(glossaryInB.responseData.name);
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
    await openGlossaryPage(first.page);
    const pickB = persisted(first.page);
    await selectDomainFromNavbar(first.page, domainB.responseData);
    await pickB;
  } finally {
    await first.afterAction();
  }

  // A new browser context is a fresh login; the navbar must seed from the persisted defaultDomain.
  const second = await performUserLogin(browser, viewer);
  try {
    await redirectToHomePage(second.page);
    const names = await openGlossaryPage(second.page);

    await expect(second.page.getByTestId('domain-dropdown')).toContainText(
      domainB.responseData.displayName
    );
    expect(names).toContain(glossaryInB.responseData.name);
    expect(names).not.toContain(glossaryInA.responseData.name);
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
    // Start from a saved pick so clearing is a real change: a retry or reordering may run this
    // test without the previous one, and clearing "All Domains" again sends no request.
    await setPersistedDomain(apiContext, domainB.responseData.id);
    await redirectToHomePage(page);
    await openGlossaryPage(page);
    const cleared = persisted(page);
    await clearDomainFromNavbar(page);
    await cleared;

    await redirectToHomePage(page);
    await openGlossaryPage(page);
    await verifyActiveDomainIsDefault(page);

    // Unfiltered, the page's first page may not hold the seeded glossaries; list them all as this user.
    const all = await (
      await apiContext.get('/api/v1/glossaries?limit=1000000')
    ).json();
    const names = (all.data as { name: string }[]).map((g) => g.name);
    for (const g of [glossaryInA, glossaryInB, glossaryInSubA]) {
      expect(names).toContain(g.responseData.name);
    }
  } finally {
    await afterAction();
  }
});
