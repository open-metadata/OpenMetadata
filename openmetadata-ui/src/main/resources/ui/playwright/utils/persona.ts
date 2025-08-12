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
import { expect, Page } from '@playwright/test';
import { GlobalSettingOptions } from '../constant/settings';
import { redirectToHomePage } from './common';
import { settingClick } from './sidebar';

export const updatePersonaDisplayName = async ({
  page,
  displayName,
}: {
  page: Page;
  displayName: string;
}) => {
  await page.click('[data-testid="manage-button"]');

  await page.click(
    '[data-testid="manage-dropdown-list-container"] [data-testid="rename-button"]'
  );

  await page.waitForSelector('#name', { state: 'visible' });

  await expect(page.locator('#name')).toBeDisabled();

  await page.waitForSelector('#displayName', { state: 'visible' });
  await page.fill('#displayName', displayName);

  await page.click('[data-testid="save-button"]');
};

/**
 * Navigate to persona settings as admin
 */
export const navigateToPersonaSettings = async (page: Page) => {
  await redirectToHomePage(page);
  await settingClick(page, GlobalSettingOptions.PERSONA);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
};

/**
 * Check if persona is present/absent in profile dropdown
 */
export const checkPersonaInProfile = async (
  page: Page,
  expectedPersonaName?: string
) => {
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  const profileDropdown = page.locator('[data-testid="dropdown-profile"]');

  await profileDropdown.click();

  await page.getByTestId('user-name').click();
  await page.waitForLoadState('networkidle');

  if (expectedPersonaName) {
    // Expect persona to be visible with specific name
    await expect(page.locator('.default-persona-text')).toBeVisible();
    await expect(page.locator('.default-persona-text')).toContainText(
      expectedPersonaName
    );
  } else {
    // Expect no persona to be visible
    await expect(page.getByText('No default persona')).toBeVisible();
  }
};

/**
 * Set a persona as default through the admin UI
 */
export const setPersonaAsDefault = async (page: Page) => {
  await page.getByTestId('manage-button').click();
  await page.getByTestId('set-as-default-button').click();

  const setAsDefaultResponse = page.waitForResponse('/api/v1/personas/*');
  const setAsDefaultConfirmationModal = page.getByTestId(
    'default-persona-confirmation-modal'
  );

  await setAsDefaultConfirmationModal.getByText('Yes').click();
  await setAsDefaultResponse;
};

/**
 * Remove persona default through the admin UI
 */
export const removePersonaDefault = async (page: Page, personaName: string) => {
  await page.getByTestId(`persona-details-card-${personaName}`).click();

  await page.getByTestId('manage-button').click();
  await page.getByTestId('remove-default-button').click();

  const removeDefaultResponse = page.waitForResponse('/api/v1/personas/*');
  const removeDefaultConfirmationModal = page.getByTestId(
    'default-persona-confirmation-modal'
  );

  await removeDefaultConfirmationModal.getByText('Yes').click();
  await removeDefaultResponse;
};
