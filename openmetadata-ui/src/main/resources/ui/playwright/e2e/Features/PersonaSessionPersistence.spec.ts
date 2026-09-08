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
import { expect, test as base } from '../../support/fixtures/base';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { selectPersonaFromDropdown } from '../../utils/persona';

const defaultPersona = new PersonaClass();
const otherPersona = new PersonaClass();
const user = new UserClass();

const test = base.extend<{ userPage: Page }>({
  userPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await user.login(page);
    await use(page);
    await page.close();
  },
});

test.beforeAll(
  'Setup persona session persistence tests',
  async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await user.create(apiContext);
    await defaultPersona.create(apiContext);
    await otherPersona.create(apiContext);

    // Assign both personas to the user and set defaultPersona as default
    await user.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/personas/0',
          value: {
            id: defaultPersona.responseData.id,
            name: defaultPersona.responseData.name,
            displayName: defaultPersona.responseData.displayName,
            fullyQualifiedName: defaultPersona.responseData.fullyQualifiedName,
            type: 'persona',
          },
        },
        {
          op: 'add',
          path: '/personas/1',
          value: {
            id: otherPersona.responseData.id,
            name: otherPersona.responseData.name,
            displayName: otherPersona.responseData.displayName,
            fullyQualifiedName: otherPersona.responseData.fullyQualifiedName,
            type: 'persona',
          },
        },
        {
          op: 'add',
          path: '/defaultPersona',
          value: {
            id: defaultPersona.responseData.id,
            name: defaultPersona.responseData.name,
            displayName: defaultPersona.responseData.displayName,
            fullyQualifiedName: defaultPersona.responseData.fullyQualifiedName,
            type: 'persona',
          },
        },
      ],
    });

    await afterAction();
  }
);

test.afterAll(
  'Teardown persona session persistence tests',
  async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await defaultPersona.delete(apiContext);
    await otherPersona.delete(apiContext);
    await user.delete(apiContext);

    await afterAction();
  }
);

/** Reload the page and wait for the logged-in-user fetch that drives persona resolution. */
const reloadAndAwaitUser = async (page: Page) => {
  const loggedInUserResponse = page.waitForResponse(
    '/api/v1/users/loggedInUser*'
  );
  await page.reload();
  await loggedInUserResponse;
  await waitForAllLoadersToDisappear(page);
};

test.describe('Persona session persistence', () => {
  test('selected persona persists across page refresh', async ({
    userPage,
  }) => {
    await redirectToHomePage(userPage);

    const defaultPersonaName =
      defaultPersona.responseData.displayName ??
      defaultPersona.responseData.name;
    const otherPersonaName =
      otherPersona.responseData.displayName ?? otherPersona.responseData.name;

    // Verify the server-configured default is shown on first load
    await expect(userPage.getByTestId('default-persona')).toContainText(
      defaultPersonaName
    );

    // Switch to the other persona
    await selectPersonaFromDropdown(userPage, otherPersonaName);

    await expect(userPage.getByTestId('default-persona')).toContainText(
      otherPersonaName
    );

    // Refresh — the selection must survive
    await reloadAndAwaitUser(userPage);

    await expect(userPage.getByTestId('default-persona')).toContainText(
      otherPersonaName
    );
  });

  test('default persona is restored when the session key is cleared', async ({
    userPage,
  }) => {
    await redirectToHomePage(userPage);

    const defaultPersonaName =
      defaultPersona.responseData.displayName ??
      defaultPersona.responseData.name;
    const otherPersonaName =
      otherPersona.responseData.displayName ?? otherPersona.responseData.name;

    // Switch to the other persona so the session key is written
    await selectPersonaFromDropdown(userPage, otherPersonaName);

    await expect(userPage.getByTestId('default-persona')).toContainText(
      otherPersonaName
    );

    // Simulate a new-tab / post-logout scenario by removing the session key
    await userPage.evaluate(() =>
      sessionStorage.removeItem('omSelectedPersona')
    );

    // Reload — without the key, the server default must be restored
    await reloadAndAwaitUser(userPage);

    await expect(userPage.getByTestId('default-persona')).toContainText(
      defaultPersonaName
    );
  });
});
