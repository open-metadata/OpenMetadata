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
import { toastNotification, visitOwnProfilePage } from './common';
import { settingClick } from './sidebar';

export const navigateToCustomizeLandingPage = async (
  page: Page,
  {
    personaName,
    customPageDataResponse,
  }: { personaName: string; customPageDataResponse: number }
) => {
  const getPersonas = page.waitForResponse('/api/v1/personas*');

  await settingClick(page, GlobalSettingOptions.PERSONA);

  await getPersonas;

  const getCustomPageDataResponse = page.waitForResponse(
    `/api/v1/docStore/name/persona.${encodeURIComponent(personaName)}`
  );

  // Navigate to the customize landing page
  await page.getByTestId(`persona-details-card-${personaName}`).click();

  await page.getByRole('tab', { name: 'Customize UI' }).click();

  await page.getByTestId('LandingPage').click();

  expect((await getCustomPageDataResponse).status()).toBe(
    customPageDataResponse
  );
};

export const removeAndCheckWidget = async (
  page: Page,
  { widgetTestId, widgetKey }: { widgetTestId: string; widgetKey: string }
) => {
  // Click on remove widget button
  await page.click(
    `[data-testid="${widgetTestId}"] [data-testid="remove-widget-button"]`
  );

  // Check if widget does not exist
  await page.waitForSelector(`[data-testid="${widgetTestId}"]`, {
    state: 'detached',
  });

  // Check if empty widget placeholder is displayed in place of removed widget
  await page.waitForSelector(
    `[data-testid*="${widgetKey}"][data-testid$="EmptyWidgetPlaceholder"]`
  );

  // Remove empty widget placeholder
  await page.click(
    `[data-testid*="${widgetKey}"][data-testid$="EmptyWidgetPlaceholder"] [data-testid="remove-widget-button"]`
  );

  // Check if empty widget placeholder does not exist
  await page.waitForSelector(
    `[data-testid*="${widgetKey}"][data-testid$="EmptyWidgetPlaceholder"]`,
    { state: 'detached' }
  );
};

export const checkAllDefaultWidgets = async (
  page: Page,
  checkEmptyWidgetPlaceholder = false
) => {
  await expect(page.getByTestId('activity-feed-widget')).toBeVisible();
  await expect(page.getByTestId('following-widget')).toBeVisible();
  await expect(page.getByTestId('recently-viewed-widget')).toBeVisible();
  await expect(page.getByTestId('data-assets-widget')).toBeVisible();
  await expect(page.getByTestId('my-data-widget')).toBeVisible();
  await expect(page.getByTestId('kpi-widget')).toBeVisible();
  await expect(page.getByTestId('total-assets-widget')).toBeVisible();

  if (checkEmptyWidgetPlaceholder) {
    await expect(
      page.getByTestId('ExtraWidget.EmptyWidgetPlaceholder')
    ).toBeVisible();
  }
};

export const setUserDefaultPersona = async (
  page: Page,
  personaName: string
) => {
  await visitOwnProfilePage(page);

  await page.locator('[data-testid="edit-user-persona"]').nth(1).click();
  await page.locator('[data-testid="persona-popover"]').isVisible();
  await page.locator('input[role="combobox"]').nth(1).click();
  await page.waitForSelector('[data-testid="persona-select-list"]');

  const setDefaultPersona = page.waitForResponse('/api/v1/users/*');

  await page.getByTitle(personaName).click();
  await page.locator('[data-testid="user-profile-persona-edit-save"]').click();

  await setDefaultPersona;

  await expect(
    page.locator('[data-testid="persona-details-card"]')
  ).toContainText(personaName);
};

export const openAddCustomizeWidgetModal = async (page: Page) => {
  const fetchResponse = page.waitForResponse(
    '/api/v1/docStore?fqnPrefix=KnowledgePanel*'
  );
  await page
    .locator(
      '[data-testid="ExtraWidget.EmptyWidgetPlaceholder"] [data-testid="add-widget-button"]'
    )
    .click();

  await fetchResponse;
};

export const saveCustomizeLayoutPage = async (
  page: Page,
  isCreated?: boolean
) => {
  const saveResponse = page.waitForResponse(
    isCreated ? '/api/v1/docStore' : '/api/v1/docStore/*'
  );
  await page.locator('[data-testid="save-button"]').click();
  await saveResponse;

  await toastNotification(
    page,
    `Page layout ${isCreated ? 'created' : 'updated'} successfully.`
  );
};
