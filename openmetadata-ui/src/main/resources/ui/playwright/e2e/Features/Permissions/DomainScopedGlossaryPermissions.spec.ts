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
import { SidebarItem } from '../../../constant/sidebar';
import { Domain } from '../../../support/domain/Domain';
import { expect, test as base } from '../../../support/fixtures/base';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { okJson } from '../../../utils/apiResponse';
import { redirectToHomePage } from '../../../utils/common';
import { DOMAIN_ONLY_ACCESS_ROLE } from '../../../utils/domainIsolationUtils';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { sidebarClick } from '../../../utils/sidebar';

// OpenMetadata#33834 / #33356: a user whose only role is the seeded
// DomainOnlyAccessRole (allow if hasDomain(), deny if !hasDomain()) must still
// get into the Glossary sidebar/list and their own-domain glossary term, while
// a different-domain term stays denied. The role's policy includes a
// conditional deny rule, so the resource-level check answers conditionalDeny
// (the Services spec covers conditionalAllow) — regression coverage for
// src/utils/permissionPolicy.ts (resourceLevelConditionalOperations).

const testUser = new UserClass();
const mainDomain = new Domain();
const otherDomain = new Domain();
const glossary = new Glossary();
const ownDomainTerm = new GlossaryTerm(glossary);
const otherDomainTerm = new GlossaryTerm(glossary);

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

test.describe('Domain-scoped Glossary Permissions (OpenMetadata#33834, #33356)', () => {
  test.beforeAll('Setup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await testUser.create(apiContext);
    await mainDomain.create(apiContext);
    await otherDomain.create(apiContext);

    await glossary.create(apiContext);
    await ownDomainTerm.create(apiContext);
    await otherDomainTerm.create(apiContext);

    await ownDomainTerm.patch(apiContext, [
      {
        op: 'add',
        path: '/domains',
        value: [{ id: mainDomain.responseData.id, type: 'domain' }],
      },
    ]);
    await otherDomainTerm.patch(apiContext, [
      {
        op: 'add',
        path: '/domains',
        value: [{ id: otherDomain.responseData.id, type: 'domain' }],
      },
    ]);

    const domainOnlyRole = await okJson<{ id: string; name: string }>(
      await apiContext.get(`/api/v1/roles/name/${DOMAIN_ONLY_ACCESS_ROLE}`),
      'DomainScopedGlossaryPermissions.setup'
    );

    // Replace (not append) so no broader role, e.g. the default
    // DataConsumer, can grant an unconditional view and mask the bug.
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
              id: domainOnlyRole.id,
              type: 'role',
              name: domainOnlyRole.name,
            },
          ],
        },
      ],
    });

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await otherDomainTerm.delete(apiContext);
    await ownDomainTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await otherDomain.delete(apiContext);
    await mainDomain.delete(apiContext);
    await testUser.delete(apiContext);

    await afterAction();
  });

  test('domain-scoped user can open the Glossary list and their own-domain term', async ({
    testUserPage,
  }) => {
    test.slow(true);

    await redirectToHomePage(testUserPage);
    await sidebarClick(testUserPage, SidebarItem.GLOSSARY);
    await waitForAllLoadersToDisappear(testUserPage);

    await expect(
      testUserPage.getByTestId('permission-error-placeholder')
    ).not.toBeVisible();

    // Assert the panel's actual list content, not the
    // `glossary-left-panel-scroller` sentinel: that div is the
    // IntersectionObserver target for infinite scroll, so it is empty and
    // `w-full` sets width only - its bounding box is always zero-height and
    // toBeVisible() can never pass on it. The panel also collapses to zero
    // width until ResizableLeftPanels measures, so assert attachment (same
    // reasoning as GlossaryDisplayNameEdit.spec.ts).
    await expect(
      testUserPage.getByTestId('glossary-left-panel').getByRole('link', {
        name: glossary.responseData.displayName,
        exact: true,
      })
    ).toBeAttached();

    await testUserPage.goto(
      `/glossary/${encodeURIComponent(
        ownDomainTerm.responseData.fullyQualifiedName
      )}`
    );
    await waitForAllLoadersToDisappear(testUserPage);

    await expect(
      testUserPage.getByTestId('permission-error-placeholder')
    ).not.toBeVisible();
    await expect(
      testUserPage.getByTestId('entity-header-display-name')
    ).toContainText(ownDomainTerm.data.displayName);
  });

  test('domain-scoped user is denied a glossary term in a different domain', async ({
    testUserPage,
  }) => {
    test.slow(true);

    await testUserPage.goto(
      `/glossary/${encodeURIComponent(
        otherDomainTerm.responseData.fullyQualifiedName
      )}`
    );
    await waitForAllLoadersToDisappear(testUserPage);

    await expect(
      testUserPage.getByTestId('permission-error-placeholder')
    ).toBeVisible();
  });
});
