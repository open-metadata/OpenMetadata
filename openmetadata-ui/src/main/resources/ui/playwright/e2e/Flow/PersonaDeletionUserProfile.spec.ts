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
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { descriptionBox, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { validateFormNameFieldInput } from '../../utils/form';
import {
  navigateToPersonaSettings,
  navigateToPersonaWithPagination,
} from '../../utils/persona';
import { visitUserProfilePage } from '../../utils/user';
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
      await navigateToPersonaSettings(page);

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

      await waitForAllLoadersToDisappear(page);

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
      await visitUserProfilePage(page, user.responseData.name);
      await waitForAllLoadersToDisappear(page);

      // Check if persona appears on the user profile
      const personaCard = page.getByTestId('persona-details-card');

      await expect(personaCard).toBeVisible();

      // Check if the persona display name is shown
      const personaElement = personaCard.getByTestId(
        `${PERSONA_DETAILS.name}-link`
      );
      await expect(personaElement).toBeVisible();

      // If it shows "No persona assigned", the test should fail
      await expect(
        personaCard.getByText('No persona assigned')
      ).not.toBeVisible();
    });

    // Step 3: Delete the persona
    await test.step('Delete the persona', async () => {
      await navigateToPersonaSettings(page);

      await navigateToPersonaWithPagination(page, PERSONA_DETAILS.name);
      await waitForAllLoadersToDisappear(page);

      await page.getByTestId('manage-button').click();
      await page.getByTestId('delete-button-title').click();

      await expect(page.locator('.ant-modal-header')).toContainText(
        PERSONA_DETAILS.displayName
      );

      await page.getByTestId('hard-delete-option').click();

      const confirmButton = page.getByTestId('confirm-button');
      await expect(confirmButton).toBeDisabled();

      await page.getByTestId('confirmation-text-input').fill(DELETE_TERM);

      const deleteResponse = page.waitForResponse(
        `/api/v1/personas/*?hardDelete=true&recursive=false`
      );

      await expect(confirmButton).toBeEnabled();

      await confirmButton.click();
      await deleteResponse;

      await page.waitForURL('**/settings/persona');
    });

    // Step 4: Go back to user profile and verify it still loads
    await test.step('Verify user profile still loads after persona deletion', async () => {
      await visitUserProfilePage(page, user.responseData.name);
      await waitForAllLoadersToDisappear(page);

      // User profile should load without errors
      // Check if the user name is displayed (this means the page loaded)
      const userName = page.getByTestId('nav-user-name');
      await expect(userName).toBeVisible();

      // Verify the persona card shows "No persona assigned" now
      const personaCard = page.getByTestId('persona-details-card');
      await expect(personaCard).toBeVisible();

      // Check if deleted persona still appears (this would be the bug)
      await expect(personaCard).not.toContainText(PERSONA_DETAILS.displayName);

      const noPersonaText = personaCard.getByText('No persona assigned');
      await expect(noPersonaText).toBeVisible();
    });
  });
});
