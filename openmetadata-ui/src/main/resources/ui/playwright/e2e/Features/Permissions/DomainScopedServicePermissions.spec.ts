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

import { Page } from '@playwright/test';
import { GlobalSettingOptions } from '../../../constant/settings';
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { Domain } from '../../../support/domain/Domain';
import { expect, test as base } from '../../../support/fixtures/base';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import { settingClick } from '../../../utils/sidebar';

// OpenMetadata#31783 (the issue's own repro): a user whose only grant is a
// hasDomain()-conditioned ViewAll on databaseService must reach
// Settings > Services > Databases instead of the "No permission" placeholder.
// An allow-only policy resolves to conditionalAllow at resource level (the
// Glossary spec covers conditionalDeny via the seeded DomainOnlyAccessRole).
// Regression coverage for the fix in src/utils/permissionPolicy.ts
// (resourceLevelConditionalOperations).

const testUser = new UserClass();
const mainDomain = new Domain();
const domainPolicy = new PolicyClass();
const domainRole = new RolesClass();

const test = base.extend<{ testUserPage: Page }>({
  testUserPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    try {
      await testUser.login(page);
      await use(page);
    } finally {
      await page.close();
    }
  },
});

test.describe('Domain-scoped Service Permissions (OpenMetadata#31783)', () => {
  test.beforeAll('Setup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await testUser.create(apiContext);
    await mainDomain.create(apiContext);

    // Only a domain-conditional grant, so the resource-level check behind the
    // Settings menu entry and the services list can only ever resolve to
    // conditionalAllow, never a hard Allow.
    await domainPolicy.create(apiContext, [
      {
        name: 'DatabaseService-DomainView-Rule',
        description: '',
        resources: ['databaseService'],
        operations: ['ViewAll'],
        effect: 'allow',
        condition: 'hasDomain()',
      },
    ]);
    await domainRole.create(apiContext, [domainPolicy.responseData.name]);

    await testUser.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/domains/0',
          value: { id: mainDomain.responseData.id, type: 'domain' },
        },
        {
          op: 'replace',
          path: '/roles',
          value: [
            {
              id: domainRole.responseData.id,
              type: 'role',
              name: domainRole.responseData.name,
            },
          ],
        },
      ],
    });

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await domainRole.delete(apiContext);
    await domainPolicy.delete(apiContext);
    await mainDomain.delete(apiContext);
    await testUser.delete(apiContext);

    await afterAction();
  });

  test('domain-scoped user can open the Database Services list', async ({
    testUserPage,
  }) => {
    test.slow(true);

    await redirectToHomePage(testUserPage);
    await settingClick(testUserPage, GlobalSettingOptions.DATABASES);

    await expect(
      testUserPage.getByTestId('permission-error-placeholder')
    ).not.toBeVisible();
    await expect(testUserPage.getByTestId('services-container')).toBeVisible();
  });
});
