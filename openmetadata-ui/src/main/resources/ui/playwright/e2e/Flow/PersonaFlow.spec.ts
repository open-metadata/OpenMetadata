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

import test, { expect } from '@playwright/test';

import { DELETE_TERM } from '../../constant/common';
import { GlobalSettingOptions } from '../../constant/settings';
import { UserClass } from '../../support/user/UserClass';
import {
  createNewPage,
  descriptionBox,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { validateFormNameFieldInput } from '../../utils/form';
import { updatePersonaDisplayName } from '../../utils/persona';
import { settingClick } from '../../utils/sidebar';

const PERSONA_DETAILS = {
  name: `persona-with-%-${uuid()}`,
  displayName: `persona ${uuid()}`,
  description: `Persona description ${uuid()}.`,
};

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

    await toastNotification(
      page,
      `"${PERSONA_DETAILS.displayName}" deleted successfully!`
    );
  });
});
