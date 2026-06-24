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

import { expect, Page, test as base } from '@playwright/test';
import { Domain } from '../../../support/domain/Domain';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';

// Issue #24180 — a user holding the seeded DomainOnlyAccessRole must only see their own
// domains in the navbar domain dropdown; admins see every domain plus the "All Domains" option.
const adminUser = new UserClass();
const restrictedUser = new UserClass();
const ownedDomainA = new Domain();
const ownedDomainB = new Domain();
const foreignDomain = new Domain();

const test = base.extend<{ adminPage: Page; restrictedUserPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    try {
      await adminUser.login(page);
      await use(page);
    } finally {
      await page.close();
    }
  },
  restrictedUserPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    try {
      await restrictedUser.login(page);
      await use(page);
    } finally {
      await page.close();
    }
  },
});

const openDomainDropdown = async (page: Page) => {
  await redirectToHomePage(page);
  await page.getByTestId('domain-selector').click();
  await page
    .getByTestId('domain-selectable-tree')
    .waitFor({ state: 'visible' });
};

test.beforeAll('Setup domains, users and role binding', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await restrictedUser.create(apiContext);

  await ownedDomainA.create(apiContext);
  await ownedDomainB.create(apiContext);
  await foreignDomain.create(apiContext);

  const roleResponse = await apiContext.get(
    '/api/v1/roles/name/DomainOnlyAccessRole'
  );
  const domainOnlyRole = await roleResponse.json();

  await restrictedUser.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/roles/-',
        value: {
          id: domainOnlyRole.id,
          type: 'role',
          name: domainOnlyRole.name,
        },
      },
      {
        op: 'add',
        path: '/domains',
        value: [
          {
            id: ownedDomainA.responseData.id,
            type: 'domain',
            name: ownedDomainA.responseData.name,
            fullyQualifiedName: ownedDomainA.responseData.fullyQualifiedName,
          },
          {
            id: ownedDomainB.responseData.id,
            type: 'domain',
            name: ownedDomainB.responseData.name,
            fullyQualifiedName: ownedDomainB.responseData.fullyQualifiedName,
          },
        ],
      },
    ],
  });

  await afterAction();
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await ownedDomainA.delete(apiContext);
  await ownedDomainB.delete(apiContext);
  await foreignDomain.delete(apiContext);
  await restrictedUser.delete(apiContext);
  await adminUser.delete(apiContext);
  await afterAction();
});

test('Restricted user sees only their own domains in the navbar dropdown', async ({
  restrictedUserPage,
}) => {
  test.slow(true);

  await openDomainDropdown(restrictedUserPage);

  await expect(
    restrictedUserPage.getByTestId('all-domains-selector')
  ).toHaveCount(0);
  await expect(
    restrictedUserPage.getByTestId(
      `tag-${ownedDomainA.responseData.fullyQualifiedName}`
    )
  ).toBeVisible();
  await expect(
    restrictedUserPage.getByTestId(
      `tag-${ownedDomainB.responseData.fullyQualifiedName}`
    )
  ).toBeVisible();
  await expect(
    restrictedUserPage.getByTestId(
      `tag-${foreignDomain.responseData.fullyQualifiedName}`
    )
  ).toHaveCount(0);
});

test('Admin sees every domain and the All Domains option', async ({
  adminPage,
}) => {
  test.slow(true);

  await openDomainDropdown(adminPage);

  await expect(adminPage.getByTestId('all-domains-selector')).toBeVisible();
  await expect(
    adminPage.getByTestId(`tag-${ownedDomainA.responseData.fullyQualifiedName}`)
  ).toBeVisible();
  await expect(
    adminPage.getByTestId(
      `tag-${foreignDomain.responseData.fullyQualifiedName}`
    )
  ).toBeVisible();
});
