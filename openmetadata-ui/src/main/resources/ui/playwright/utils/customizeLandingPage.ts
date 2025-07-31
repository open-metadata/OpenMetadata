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

  await page.waitForLoadState('networkidle');

  expect((await getCustomPageDataResponse).status()).toBe(
    customPageDataResponse
  );
};

export const removeAndCheckWidget = async (
  page: Page,
  { widgetKey }: { widgetKey: string }
) => {
  // Click on remove widget button
  await page
    .locator(`[data-testid="${widgetKey}"] [data-testid="more-options-button"]`)
    .click();

  await page.getByText('Remove').click();

  await expect(page.getByTestId(`${widgetKey}`)).not.toBeVisible();
};

export const checkAllDefaultWidgets = async (
  page: Page,
  checkEmptyWidgetPlaceholder = false
) => {
  await expect(page.getByTestId('KnowledgePanel.ActivityFeed')).toBeVisible();
  await expect(page.getByTestId('KnowledgePanel.Following')).toBeVisible();
  await expect(page.getByTestId('KnowledgePanel.DataAssets')).toBeVisible();
  await expect(page.getByTestId('KnowledgePanel.MyData')).toBeVisible();
  await expect(page.getByTestId('KnowledgePanel.KPI')).toBeVisible();
  await expect(page.getByTestId('KnowledgePanel.TotalAssets')).toBeVisible();

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
      '[data-testid="customize-landing-page-header"] [data-testid="add-widget-button"]'
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
