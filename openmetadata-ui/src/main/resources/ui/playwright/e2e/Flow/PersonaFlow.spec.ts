/*
 *  Copyright 2022 Collate.
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
import { DELETE_TERM } from '../../constant/common';
import { GlobalSettingOptions } from '../../constant/settings';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import {
  createNewPage,
  descriptionBox,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import { validateFormNameFieldInput } from '../../utils/form';
import {
  checkPersonaInProfile,
  navigateToPersonaSettings,
  removePersonaDefault,
  setPersonaAsDefault,
  updatePersonaDisplayName,
} from '../../utils/persona';
import { settingClick } from '../../utils/sidebar';

const PERSONA_DETAILS = {
  name: `persona-with-%-${uuid()}`,
  displayName: `persona ${uuid()}`,
  description: `Persona description ${uuid()}.`,
};

const user = new UserClass();
const persona = new PersonaClass();
const persona1 = new PersonaClass();
const persona2 = new PersonaClass();

const test = base.extend<{
  adminPage: Page;
  userPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    // Use admin context with stored auth state
    const adminContext = await browser.newContext({
      storageState: 'playwright/.auth/admin.json',
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/');
    await use(adminPage);
    await adminContext.close();
  },
  userPage: async ({ browser }, use) => {
    // Create a fresh context for user without stored auth
    const userContext = await browser.newContext({
      storageState: undefined,
    });
    const userPage = await userContext.newPage();
    await use(userPage);
    await userContext.close();
  },
});

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe.serial('Persona operations', () => {
  const user = new UserClass();

  test.beforeAll('pre-requisites', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user.create(apiContext);
    await afterAction();
  });

  test.afterAll('cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await user.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.PERSONA);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  });

  test('Persona creation should work properly', async ({ page }) => {
    await page.getByTestId('add-persona-button').click();

    await validateFormNameFieldInput({
      page,
      value: PERSONA_DETAILS.name,
      fieldName: 'Name',
      fieldSelector: '[data-testid="name"]',
      errorDivSelector: '#name_help',
    });

    await page.getByTestId('displayName').fill(PERSONA_DETAILS.displayName);

    await page.locator(descriptionBox).fill(PERSONA_DETAILS.description);

    const userListResponse = page.waitForResponse(
      '/api/v1/users?limit=*&isBot=false*'
    );
    await page.getByTestId('add-users').click();
    await userListResponse;

    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    const searchUser = page.waitForResponse(
      `/api/v1/search/query?q=*${encodeURIComponent(
        user.responseData.displayName
      )}*`
    );
    await page.getByTestId('searchbar').fill(user.responseData.displayName);
    await searchUser;

    await page
      .getByRole('listitem', { name: user.responseData.displayName })
      .click();
    await page.getByTestId('selectable-list-update-btn').click();

    await page.getByRole('button', { name: 'Create' }).click();

    // Verify created persona details

    await expect(
      page.getByTestId(`persona-details-card-${PERSONA_DETAILS.name}`)
    ).toBeVisible();

    const personaResponse = page.waitForResponse(
      `/api/v1/personas/name/${encodeURIComponent(
        PERSONA_DETAILS.name
      )}?fields=users`
    );

    await page
      .getByTestId(`persona-details-card-${PERSONA_DETAILS.name}`)
      .click();

    await personaResponse;

    await page.getByRole('tab', { name: 'Users' }).click();

    await page.waitForSelector('[data-testid="entity-header-name"]', {
      state: 'visible',
    });

    await expect(page.getByTestId('entity-header-name')).toContainText(
      PERSONA_DETAILS.name
    );

    await expect(page.getByTestId('entity-header-display-name')).toContainText(
      PERSONA_DETAILS.displayName
    );

    await expect(
      page.locator(
        '[data-testid="viewer-container"] [data-testid="markdown-parser"]'
      )
    ).toContainText(PERSONA_DETAILS.description);

    await expect(page.getByTestId(user.responseData.name)).toContainText(
      user.responseData.name
    );
  });

  test('Persona update description flow should work properly', async ({
    page,
  }) => {
    await page
      .getByTestId(`persona-details-card-${PERSONA_DETAILS.name}`)
      .click();

    await page.getByTestId('edit-description').click();

    await page
      .locator(`[data-testid="markdown-editor"] ${descriptionBox}`)
      .clear();

    await page
      .locator(`[data-testid="markdown-editor"] ${descriptionBox}`)
      .fill('Updated description.');

    await page
      .locator(`[data-testid="markdown-editor"] [data-testid="save"]`)
      .click();

    await expect(
      page.locator(
        `[data-testid="viewer-container"] [data-testid="markdown-parser"]`
      )
    ).toContainText('Updated description.');
  });

  test('Persona rename flow should work properly', async ({ page }) => {
    await page
      .getByTestId(`persona-details-card-${PERSONA_DETAILS.name}`)
      .click();

    await updatePersonaDisplayName({ page, displayName: 'Test Persona' });

    await expect(page.getByTestId('entity-header-display-name')).toContainText(
      'Test Persona'
    );

    await updatePersonaDisplayName({
      page,
      displayName: PERSONA_DETAILS.displayName,
    });

    await expect(page.getByTestId('entity-header-display-name')).toContainText(
      PERSONA_DETAILS.displayName
    );
  });

  test('Remove users in persona should work properly', async ({ page }) => {
    await page
      .getByTestId(`persona-details-card-${PERSONA_DETAILS.name}`)
      .click();

    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'Users' }).click();

    await page
      .locator(
        `[data-row-key="${user.responseData.name}"] [data-testid="remove-user-btn"]`
      )
      .click();

    await expect(
      page.locator('[data-testid="remove-confirmation-modal"]')
    ).toContainText(
      `Are you sure you want to remove ${user.responseData.name}?`
    );

    const updateResponse = page.waitForResponse(`/api/v1/personas/*`);

    await page
      .locator('[data-testid="remove-confirmation-modal"]')
      .getByText('Confirm')
      .click();

    await updateResponse;
  });

  test('Delete persona should work properly', async ({ page }) => {
    await page
      .getByTestId(`persona-details-card-${PERSONA_DETAILS.name}`)
      .click();

    await page.click('[data-testid="manage-button"]');

    await page.click('[data-testid="delete-button-title"]');

    await expect(page.locator('.ant-modal-header')).toContainText(
      PERSONA_DETAILS.displayName
    );

    await page.click(`[data-testid="hard-delete-option"]`);

    await expect(page.locator('[data-testid="confirm-button"]')).toBeDisabled();

    await page
      .locator('[data-testid="confirmation-text-input"]')
      .fill(DELETE_TERM);

    const deleteResponse = page.waitForResponse(
      `/api/v1/personas/*?hardDelete=true&recursive=false`
    );

    await expect(
      page.locator('[data-testid="confirm-button"]')
    ).not.toBeDisabled();

    await page.click('[data-testid="confirm-button"]');
    await deleteResponse;

    await page.waitForURL('**/settings/persona');
  });
});

test.describe.serial('Default persona setting and removal flow', () => {
  test.beforeAll('Setup user for default persona flow', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user.create(apiContext);

    const adminResponse = await apiContext.get('/api/v1/users/name/admin');
    const adminData = await adminResponse.json();

    await persona1.create(apiContext, [user.responseData.id, adminData.id]);
    await persona2.create(apiContext, [user.responseData.id]);
    await afterAction();
  });

  test.afterAll(
    'Cleanup user and persona after default persona flow',
    async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      // Delete the persona that was created in the test
      try {
        // Set the persona data to match what was created in the test
        persona.data = {
          name: PERSONA_DETAILS.name,
          displayName: PERSONA_DETAILS.displayName,
          description: PERSONA_DETAILS.description,
        };
        await persona.delete(apiContext);
      } catch (error) {
        // Persona might already be deleted or not exist, continue with cleanup
        // Silently continue with other cleanup operations
      }

      // Delete the user that was created in beforeAll
      await user.delete(apiContext);
      await persona1.delete(apiContext);
      await persona2.delete(apiContext);

      await afterAction();
    }
  );

  test('Set and remove default persona should work properly', async ({
    adminPage,
    userPage,
  }) => {
    test.slow(true);

    await test.step(
      'User logs in and checks no default persona is set',
      async () => {
        await user.login(userPage);
        await userPage.waitForURL('/my-data');
        await checkPersonaInProfile(userPage); // Expect no persona
      }
    );

    await test.step(
      'Admin creates a persona and sets the default persona',
      async () => {
        await navigateToPersonaSettings(adminPage);
        await adminPage.getByTestId('add-persona-button').click();

        await validateFormNameFieldInput({
          page: adminPage,
          value: PERSONA_DETAILS.name,
          fieldName: 'Name',
          fieldSelector: '[data-testid="name"]',
          errorDivSelector: '#name_help',
        });

        await adminPage
          .getByTestId('displayName')
          .fill(PERSONA_DETAILS.displayName);

        await adminPage
          .locator(descriptionBox)
          .fill(PERSONA_DETAILS.description);

        const userListResponse = adminPage.waitForResponse(
          '/api/v1/users?limit=*&isBot=false*'
        );
        await adminPage.getByTestId('add-users').click();
        await userListResponse;

        await adminPage.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        const searchUser = adminPage.waitForResponse(
          `/api/v1/search/query?q=*${encodeURIComponent(
            user.responseData.displayName
          )}*`
        );
        await adminPage
          .getByTestId('searchbar')
          .fill(user.responseData.displayName);
        await searchUser;

        await adminPage
          .getByRole('listitem', { name: user.responseData.displayName })
          .click();
        await adminPage.getByTestId('selectable-list-update-btn').click();

        await adminPage.getByRole('button', { name: 'Create' }).click();

        // Verify created persona details
        await expect(
          adminPage.getByTestId(`persona-details-card-${PERSONA_DETAILS.name}`)
        ).toBeVisible();

        const personaResponse = adminPage.waitForResponse(
          `/api/v1/personas/name/${encodeURIComponent(
            PERSONA_DETAILS.name
          )}?fields=users`
        );

        await adminPage
          .getByTestId(`persona-details-card-${PERSONA_DETAILS.name}`)
          .click();

        await personaResponse;

        await adminPage.getByRole('tab', { name: 'Users' }).click();

        await adminPage.waitForSelector('[data-testid="entity-header-name"]', {
          state: 'visible',
        });

        await expect(adminPage.getByTestId('entity-header-name')).toContainText(
          PERSONA_DETAILS.name
        );

        await expect(
          adminPage.getByTestId('entity-header-display-name')
        ).toContainText(PERSONA_DETAILS.displayName);

        await expect(
          adminPage.locator(
            '[data-testid="viewer-container"] [data-testid="markdown-parser"]'
          )
        ).toContainText(PERSONA_DETAILS.description);

        await expect(
          adminPage.getByTestId(user.responseData.name)
        ).toContainText(user.responseData.name);

        await setPersonaAsDefault(adminPage);
      }
    );

    await test.step(
      'User refreshes and checks the default persona is applied',
      async () => {
        await userPage.reload();
        await checkPersonaInProfile(userPage, PERSONA_DETAILS.displayName);
      }
    );

    await test.step('Changing default persona', async () => {
      await settingClick(adminPage, GlobalSettingOptions.PERSONA);

      await adminPage
        .getByTestId(
          `persona-details-card-${persona1.responseData.fullyQualifiedName}`
        )
        .click();
      await adminPage.waitForLoadState('networkidle');
      await setPersonaAsDefault(adminPage);
    });

    await test.step('Verify changed default persona for new user', async () => {
      await userPage.reload();
      await checkPersonaInProfile(userPage, persona1.responseData.displayName);
    });

    await test.step('Admin removes the default persona', async () => {
      await navigateToPersonaSettings(adminPage);
      await removePersonaDefault(
        adminPage,
        persona1.responseData?.fullyQualifiedName
      );
    });

    await test.step('User refreshes and sees no default persona', async () => {
      await userPage.reload();
      await checkPersonaInProfile(userPage); // Expect no persona again
    });
  });
});
