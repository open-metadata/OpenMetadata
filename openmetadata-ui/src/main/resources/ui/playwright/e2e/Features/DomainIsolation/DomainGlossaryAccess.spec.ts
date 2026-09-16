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
import { Domain } from '../../../support/domain/Domain';
import { expect, test as base } from '../../../support/fixtures/base';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import {
  assignDomainOnlyAccess,
  assignDomainToGlossary,
  safeDelete,
} from '../../../utils/domainIsolationUtils';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

// Issue #33356 — a user with DomainOnlyAccessRole scoped to a domain must be
// able to navigate directly to a glossary term page whose domain matches, without
// hitting the permission-error-placeholder rendered by the route guard.
//
// Root cause: the bulk /permissions endpoint returns CONDITIONAL_ALLOW (no entity
// context), which permissionPolicy strict mode mapped to false, so GlossaryRouter's
// AdminProtectedRoute blocked the page before any entity-level permission call ran.
// Fix: permissionPolicy resourceLevelConditionalAllow set to 'attempt'.
const domainUser = new UserClass();
const domain = new Domain();
const glossary = new Glossary();
const glossaryTerm = new GlossaryTerm(glossary);

const test = base.extend<{ domainUserPage: Page }>({
  domainUserPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    try {
      await domainUser.login(page);
      await use(page);
    } finally {
      await page.close();
    }
  },
});

test.describe(
  'Domain isolation - glossary term direct navigation @domain-isolation',
  () => {
    test.beforeAll(
      'Setup domain, user, glossary and term',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        try {
          await domain.create(apiContext);
          await domainUser.create(apiContext);
          await assignDomainOnlyAccess(apiContext, domainUser, [domain]);

          await glossary.create(apiContext);
          await assignDomainToGlossary(
            apiContext,
            glossary.responseData.id,
            domain
          );
          await glossaryTerm.create(apiContext);
        } finally {
          await afterAction();
        }
      }
    );

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await safeDelete(() => glossaryTerm.delete(apiContext));
        await safeDelete(() => glossary.delete(apiContext));
        await safeDelete(() => domainUser.delete(apiContext));
        await safeDelete(() => domain.delete(apiContext));
      } finally {
        await afterAction();
      }
    });

    test(
      'domain-scoped user can view a glossary term page whose domain matches',
      async ({ domainUserPage }) => {
        const termFqn = glossaryTerm.responseData.fullyQualifiedName;

        await domainUserPage.goto(
          `/glossary/${encodeURIComponent(termFqn)}`
        );
        await waitForAllLoadersToDisappear(domainUserPage);

        await expect(
          domainUserPage.getByTestId('entity-header-display-name')
        ).toBeVisible();

        await expect(
          domainUserPage.getByTestId('permission-error-placeholder')
        ).not.toBeAttached();
      }
    );
  }
);
