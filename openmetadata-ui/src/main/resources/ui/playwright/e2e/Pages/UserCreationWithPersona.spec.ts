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
import { expect } from '@playwright/test';
import { DATA_STEWARD_RULES } from '../../constant/permission';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, uuid } from '../../utils/common';
import {
  addUser,
  permanentDeleteUser,
  visitUserListPage,
  visitUserProfilePage,
} from '../../utils/user';

import { test } from '../fixtures/pages';

const adminUser = new UserClass();
const persona1 = new PersonaClass();
const policy = new PolicyClass();
const role = new RolesClass();

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await policy.create(apiContext, DATA_STEWARD_RULES);
  await role.create(apiContext, [policy.responseData.name]);
  await persona1.create(apiContext, [adminUser.responseData.id]);
  await afterAction();
});

test.describe('Create user with persona', async () => {
  test('Create user with persona and verify on profile', async ({ page }) => {
    await redirectToHomePage(page);
    await visitUserListPage(page);

    const userWithPersonaName = `pw-user-persona-${uuid()}`;
    await addUser(page, {
      name: userWithPersonaName,
      email: `${userWithPersonaName}@gmail.com`,
      password: `User@${uuid()}`,
      role: role.responseData.displayName,
      personas: [
        persona1.responseData.displayName ?? persona1.responseData.name,
      ],
    });

    await visitUserProfilePage(page, userWithPersonaName);
    const expectedPersonaName =
      persona1.responseData.displayName ?? persona1.responseData.name;
    await expect(
      page
        .getByTestId('persona-details-card')
        .getByTestId('tag-chip')
        .filter({ hasText: expectedPersonaName })
    ).toBeVisible();

    await visitUserListPage(page);
    await permanentDeleteUser(
      page,
      userWithPersonaName,
      userWithPersonaName,
      false
    );
  });
});
