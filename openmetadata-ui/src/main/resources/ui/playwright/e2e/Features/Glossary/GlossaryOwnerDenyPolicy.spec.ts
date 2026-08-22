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
import { expect, test } from '@playwright/test';
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { Glossary } from '../../../support/glossary/Glossary';
import { TeamClass } from '../../../support/team/TeamClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

const policy = new PolicyClass();
const role = new RolesClass();
const team = new TeamClass();
const ownerUser = new UserClass();
const nonOwnerUser = new UserClass();
const glossary = new Glossary();

test.describe(
  'Glossary - Owner access with a Deny !isOwner() policy',
  { tag: ['@Features', '@Governance'] },
  () => {
    test.beforeAll(
      'Setup policy, role, team, users and owned glossary',
      async ({ browser }) => {
        test.slow();
        const { apiContext, afterAction } = await performAdminLogin(browser);

        // Deny ViewAll on Glossary/GlossaryTerm for anyone who is not the owner.
        await policy.create(apiContext, [
          {
            name: `deny-non-owner-${uuid()}`,
            effect: 'deny',
            resources: ['glossary', 'glossaryTerm'],
            operations: ['ViewAll'],
            condition: '!isOwner()',
          },
        ]);
        await role.create(apiContext, [policy.responseData.name]);

        await ownerUser.create(apiContext);
        await nonOwnerUser.create(apiContext);

        // Both users belong to a team that carries the deny role, so the restriction is inherited.
        team.data.defaultRoles = role.responseData.id
          ? [role.responseData.id]
          : [];
        team.data.users = [
          ownerUser.responseData.id,
          nonOwnerUser.responseData.id,
        ];
        await team.create(apiContext);

        await glossary.create(apiContext);
        await glossary.patch(apiContext, [
          {
            op: 'add',
            path: '/owners',
            value: [{ id: ownerUser.responseData.id, type: 'user' }],
          },
        ]);

        await afterAction();
      }
    );

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await glossary.delete(apiContext);
      await team.delete(apiContext);
      await role.delete(apiContext);
      await policy.delete(apiContext);
      await ownerUser.delete(apiContext);
      await nonOwnerUser.delete(apiContext);
      await afterAction();
    });

    test('Owner can open their glossary despite the Deny !isOwner() policy', async ({
      browser,
    }) => {
      test.slow();
      const page = await browser.newPage();
      await ownerUser.login(page);

      await test.step('The glossary listing loads (no longer denied at the collection level)', async () => {
        const glossaryList = page.waitForResponse(
          '/api/v1/glossaries?fields=*'
        );
        await glossary.visitPage(page);
        expect((await glossaryList).status()).toBe(200);
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('The owned glossary renders instead of the permission error', async () => {
        await expect(page.getByTestId('entity-header-display-name')).toHaveText(
          glossary.responseData.displayName
        );
        await expect(
          page.getByTestId('permission-error-placeholder')
        ).toBeHidden();
      });

      await page.close();
    });

    test('Deny still applies per-entity: a non-owner is refused the glossary', async ({
      browser,
    }) => {
      const page = await browser.newPage();
      await nonOwnerUser.login(page);
      const { apiContext, afterAction } = await getApiContext(page);

      await test.step('Listing glossaries is allowed', async () => {
        const listResponse = await apiContext.get(
          '/api/v1/glossaries?fields=owners&limit=50'
        );
        expect(listResponse.status()).toBe(200);
      });

      await test.step('The specific non-owned glossary is denied', async () => {
        const encodedFqn = encodeURIComponent(
          glossary.responseData.fullyQualifiedName
        );
        const getResponse = await apiContext.get(
          `/api/v1/glossaries/name/${encodedFqn}?fields=owners`
        );
        expect(getResponse.status()).toBe(403);
      });

      await afterAction();
      await page.close();
    });
  }
);
