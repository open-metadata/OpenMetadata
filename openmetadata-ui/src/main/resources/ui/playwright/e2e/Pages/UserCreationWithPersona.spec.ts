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
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  addUser,
  permanentDeleteUser,
  visitUserListPage,
} from '../../utils/user';

import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { test } from '../fixtures/pages';

const adminUser = new UserClass();
const persona1 = new PersonaClass();

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await persona1.create(apiContext, [adminUser.responseData.id]);
  await afterAction();
});

test.describe('Create user with persona', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test('Create user with persona and verify on profile', async ({ page }) => {
    await redirectToHomePage(page);
    await visitUserListPage(page);

    const userWithPersonaName = `pw-user-persona-${uuid()}`;
    await addUser(page, {
      name: userWithPersonaName,
      email: `${userWithPersonaName}@gmail.com`,
      password: `User@${uuid()}`,
      role: 'Data Consumer',
      personas: [
        persona1.responseData.displayName ?? persona1.responseData.name,
      ],
    });

    // Navigate to user profile — search with retry to handle ES indexing lag
    await visitUserListPage(page);
    await waitForAllLoadersToDisappear(page);

    const searchBar = page.getByTestId('searchbar');
    const userRow = page.getByTestId(userWithPersonaName);

    await expect
      .poll(
        async () => {
          const searchRequest = page.waitForResponse('/api/v1/search/query*');
          await searchBar.fill('');
          await searchBar.fill(userWithPersonaName);
          await searchRequest;
          await waitForAllLoadersToDisappear(page);

          return await userRow.count();
        },
        {
          timeout: 30_000,
          intervals: [2_000, 3_000, 5_000],
        }
      )
      .toBeGreaterThan(0);

    await userRow.click();
    await waitForAllLoadersToDisappear(page);

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
