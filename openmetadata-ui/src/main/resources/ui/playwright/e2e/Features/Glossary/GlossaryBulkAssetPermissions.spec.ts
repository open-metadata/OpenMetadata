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
import { APIRequestContext } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { VIEW_ALL_RULE } from '../../../constant/permission';
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { TableClass } from '../../../support/entity/TableClass';
import { expect, test } from '../../../support/fixtures/base';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext } from '../../../utils/common';

/**
 * Broken-access-control regression for the glossary-term bulk asset endpoints
 * (GHSA-jmw6-578h-gw4r): PUT /v1/glossaryTerms/{id}/assets/add and /assets/remove
 * must require EDIT_GLOSSARY_TERMS on every target asset's type. A view-only
 * user gets 403 on both, the denied calls must not mutate the asset, and an
 * admin succeeds (positive control proving the endpoint itself works).
 */
test.describe(
  'Glossary Term Bulk Asset Permissions',
  { tag: `${DOMAIN_TAGS.GOVERNANCE}:Glossary` },
  () => {
    // Serial so all tests share one beforeAll/worker and run in declaration order:
    // the deny tests must run before the untouched-state check for that check to be meaningful.
    test.describe.configure({ mode: 'serial' });

    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);
    const table = new TableClass();
    const viewOnlyUser = new UserClass();
    const viewOnlyPolicy = new PolicyClass();
    const viewOnlyRole = new RolesClass();

    const assetsPayload = () => ({
      assets: [
        {
          id: table.entityResponseData?.id,
          type: 'table',
        },
      ],
      dryRun: false,
    });

    const tableHasGlossaryTerm = async (apiContext: APIRequestContext) => {
      const response = await apiContext.get(
        `/api/v1/tables/${table.entityResponseData?.id}?fields=tags`
      );
      const tableData = await response.json();

      return (tableData.tags ?? []).some(
        (tag: { tagFQN?: string; source?: string }) =>
          tag.tagFQN === glossaryTerm.responseData.fullyQualifiedName &&
          tag.source === 'Glossary'
      );
    };

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await glossary.create(apiContext);
        await glossaryTerm.create(apiContext);
        await table.create(apiContext);

        // Positive control: an admin can associate the term via the bulk endpoint.
        const addResponse = await apiContext.put(
          `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}/assets/add`,
          { data: assetsPayload() }
        );

        expect(addResponse.status(), await addResponse.text()).toBe(200);

        // View-only user: no default role, an explicit ViewAll-only policy.
        await viewOnlyUser.create(apiContext, false);
        const policyResponse = await viewOnlyPolicy.create(
          apiContext,
          VIEW_ALL_RULE
        );
        const roleResponse = await viewOnlyRole.create(apiContext, [
          policyResponse.fullyQualifiedName ?? policyResponse.name,
        ]);
        await viewOnlyUser.patch({
          apiContext,
          patchData: [
            {
              op: 'add',
              path: '/roles/0',
              value: {
                id: roleResponse.id,
                type: 'role',
                name: roleResponse.name,
              },
            },
          ],
        });
      } finally {
        await afterAction();
      }
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await glossary.delete(apiContext);
        await table.delete(apiContext);
        await viewOnlyUser.delete(apiContext);
        await viewOnlyRole.delete(apiContext);
        await viewOnlyPolicy.delete(apiContext);
      } finally {
        await afterAction();
      }
    });

    test('view-only user cannot bulk remove the term from an asset', async ({
      browser,
    }) => {
      const page = await browser.newPage();
      await viewOnlyUser.login(page);
      const { apiContext, afterAction } = await getApiContext(page);

      try {
        const response = await apiContext.put(
          `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}/assets/remove`,
          { data: assetsPayload() }
        );

        expect(response.status()).toBe(403);
      } finally {
        await afterAction();
        await page.close();
      }
    });

    test('view-only user cannot bulk add the term to an asset', async ({
      browser,
    }) => {
      const page = await browser.newPage();
      await viewOnlyUser.login(page);
      const { apiContext, afterAction } = await getApiContext(page);

      try {
        const response = await apiContext.put(
          `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}/assets/add`,
          { data: assetsPayload() }
        );

        expect(response.status()).toBe(403);
      } finally {
        await afterAction();
        await page.close();
      }
    });

    test('denied bulk requests leave the asset association untouched', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        expect(await tableHasGlossaryTerm(apiContext)).toBe(true);
      } finally {
        await afterAction();
      }
    });

    test('admin can bulk remove and re-add the term', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        const removeResponse = await apiContext.put(
          `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}/assets/remove`,
          { data: assetsPayload() }
        );

        expect(removeResponse.status(), await removeResponse.text()).toBe(200);
        expect(await tableHasGlossaryTerm(apiContext)).toBe(false);

        // Re-add so afterAll cleanup starts from the associated state.
        const reAddResponse = await apiContext.put(
          `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}/assets/add`,
          { data: assetsPayload() }
        );

        expect(reAddResponse.status(), await reAddResponse.text()).toBe(200);
        expect(await tableHasGlossaryTerm(apiContext)).toBe(true);
      } finally {
        await afterAction();
      }
    });
  }
);
