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

import { expect, Page } from '@playwright/test';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  navigateToPersonaSettings,
  navigateToPersonaWithPagination,
} from '../../utils/persona';
import { test } from '../fixtures/pages';

const PERSONA_DETAILS = {
  name: `test-persona-${uuid()}`,
  displayName: `Test Persona ${uuid()}`,
  description: `Test persona for deletion ${uuid()}.`,
};

const visitUserProfileDirectly = async (page: Page, userName: string) => {
  const userDetailsResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes(`/api/v1/users/name/${encodeURIComponent(userName)}`) &&
      response.request().method() === 'GET'
  );

  await page.goto(`/users/${encodeURIComponent(userName)}`);
  expect((await userDetailsResponse).ok()).toBeTruthy();
  await waitForAllLoadersToDisappear(page);
};

test.describe.serial('User profile works after persona deletion', () => {
  const user = new UserClass();
  const persona = new PersonaClass(PERSONA_DETAILS);
  let personaDeleted = false;

  test.beforeAll('Create user', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await user.create(apiContext);
    await persona.create(apiContext, [user.responseData.id]);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    if (!personaDeleted) {
      await persona.delete(apiContext);
    }
    await user.delete(apiContext);
    await afterAction();
  });

  test('User profile loads correctly before and after persona deletion', async ({
    page,
  }) => {
    await test.step('Verify persona with user', async () => {
      await navigateToPersonaSettings(page);
      await waitForAllLoadersToDisappear(page);
      await navigateToPersonaWithPagination(page, PERSONA_DETAILS.name, false);

      await expect(
        page.getByTestId(`persona-details-card-${PERSONA_DETAILS.name}`)
      ).toBeVisible();
    });

    // Step 2: Navigate directly to user profile and verify persona is shown
    await test.step('Verify persona appears on user profile', async () => {
      await visitUserProfileDirectly(page, user.responseData.name);

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

      const confirmButton = page.getByTestId('confirm-button');

      const deleteResponse = page.waitForResponse(
        `/api/v1/personas/*?hardDelete=true&recursive=false`
      );

      await confirmButton.click();
      expect((await deleteResponse).ok()).toBeTruthy();
      personaDeleted = true;

      await page.waitForURL('**/settings/persona');
    });

    // Step 4: Go back to user profile and verify it still loads
    await test.step('Verify user profile still loads after persona deletion', async () => {
      await visitUserProfileDirectly(page, user.responseData.name);

      // User profile should load without errors
      // Check if the user name is displayed (this means the page loaded)
      const userName = page.getByTestId('nav-user-name');
      await expect(userName).toBeVisible();

      // Verify the persona card shows "No persona assigned" now
      const personaCard = page.getByTestId('persona-details-card');
      await expect(personaCard).toBeVisible();

      // Check if deleted persona still appears (this would be the bug)
      // Retry up to 3 times with page reload to handle eventual consistency
      const deletedPersonaLink = page.getByTestId(
        `${PERSONA_DETAILS.name}-link`
      );
      const noPersonaText = personaCard.getByText('No persona assigned');

      for (let attempt = 1; attempt <= 3; attempt++) {
        if (
          !(await deletedPersonaLink.isVisible()) &&
          (await noPersonaText.isVisible())
        ) {
          break;
        }

        if (attempt < 3) {
          await page.reload();
          await waitForAllLoadersToDisappear(page);
        }
      }

      await expect(deletedPersonaLink).not.toBeVisible();
      await expect(noPersonaText).toBeVisible();
    });
  });
});
