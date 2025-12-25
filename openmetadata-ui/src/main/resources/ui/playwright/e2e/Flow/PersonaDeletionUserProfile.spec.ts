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

import { expect } from '@playwright/test';
import { DELETE_TERM } from '../../constant/common';
import { GlobalSettingOptions } from '../../constant/settings';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { descriptionBox, redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { validateFormNameFieldInput } from '../../utils/form';
import { navigateToPersonaWithPagination } from '../../utils/persona';
import { settingClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

const PERSONA_DETAILS = {
  name: `test-persona-${uuid()}`,
  displayName: `Test Persona ${uuid()}`,
  description: `Test persona for deletion ${uuid()}.`,
};

test.describe.serial('User profile works after persona deletion', () => {
  const user = new UserClass();

  test.beforeAll('Create user', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await user.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await user.delete(apiContext);
    await afterAction();
  });

  test('User profile loads correctly before and after persona deletion', async ({
    page,
  }) => {
    // Step 1: Create persona and add user
    await test.step('Create persona with user', async () => {
      await redirectToHomePage(page);
      await settingClick(page, GlobalSettingOptions.PERSONA);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Create persona
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

      // Add user to persona during creation
      const userListResponse = page.waitForResponse(
        '/api/v1/users?limit=*&isBot=false*'
      );
      await page.getByTestId('add-users').click();
      await userListResponse;

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

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

      const createPersona = page.waitForResponse('/api/v1/personas');
      const listPersonas = page.waitForResponse('/api/v1/personas?*');

      await page.getByRole('button', { name: 'Create' }).click();

      await createPersona;
      await listPersonas;

      await waitForAllLoadersToDisappear(page, 'skeleton-card-loader');

      // Verify persona was created
      await navigateToPersonaWithPagination(page, PERSONA_DETAILS.name, false);

      await expect(
        page.getByTestId(`persona-details-card-${PERSONA_DETAILS.name}`)
      ).toBeVisible();
    });

    // Step 2: Navigate directly to user profile and verify persona is shown
    await test.step('Verify persona appears on user profile', async () => {
      // Go directly to user profile URL
      await page.goto(`/users/${user.responseData.name}`);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Check if persona appears on the user profile
      const personaCard = page.getByTestId('persona-details-card');

      await expect(personaCard).toBeVisible();

      // Check if the persona display name is shown
      const personaList = personaCard
        .locator('[data-testid="persona-list"]')
        .first();
      const personaText = await personaList.textContent();

      // If it shows "No persona assigned", the test should fail
      if (personaText?.includes('No persona assigned')) {
        throw new Error('Persona was not assigned to user properly');
      }
    });

    // Step 3: Delete the persona
    await test.step('Delete the persona', async () => {
      const listPersonas = page.waitForResponse('/api/v1/personas?*');
      await settingClick(page, GlobalSettingOptions.PERSONA);
      await listPersonas;
      await waitForAllLoadersToDisappear(page, 'skeleton-card-loader');

      await navigateToPersonaWithPagination(page, PERSONA_DETAILS.name);
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="delete-button-title"]');

      await expect(page.locator('.ant-modal-header')).toContainText(
        PERSONA_DETAILS.displayName
      );

      await page.click(`[data-testid="hard-delete-option"]`);

      await expect(
        page.locator('[data-testid="confirm-button"]')
      ).toBeDisabled();

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

    // Step 4: Go back to user profile and verify it still loads
    await test.step(
      'Verify user profile still loads after persona deletion',
      async () => {
        // Go directly to user profile URL again
        await page.goto(`/users/${user.responseData.name}`);
        await page.waitForLoadState('networkidle');

        // User profile should load without errors
        // Check if the user name is displayed (this means the page loaded)
        const userName = page.getByTestId('nav-user-name');

        await expect(userName).toBeVisible();

        // Verify the persona card shows "No persona assigned" now
        const personaCard = page.getByTestId('persona-details-card');

        await expect(personaCard).toBeVisible();

        const noPersonaText = personaCard.locator(
          '.no-data-chip-placeholder, .no-default-persona-text'
        );
        const hasNoPersona = (await noPersonaText.count()) > 0;

        if (hasNoPersona) {
          await noPersonaText.first().textContent();
        } else {
          // Check if deleted persona still appears (this would be the bug)
          const personaList = personaCard
            .locator('[data-testid="persona-list"]')
            .first();
          const personaText = await personaList.textContent();
          if (personaText && !personaText.includes('No persona assigned')) {
            throw new Error(`User still shows deleted persona: ${personaText}`);
          }
        }
      }
    );
  });
});
