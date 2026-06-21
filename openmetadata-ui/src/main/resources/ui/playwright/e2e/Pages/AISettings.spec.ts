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
import { expect, Page, test as base } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { AdminClass } from '../../support/user/AdminClass';
import { performAdminLogin } from '../../utils/admin';
import {
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

const AI_SETTINGS_URL = '/settings/preferences/ai-settings';

let adminUser: AdminClass;

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
});

const visitAISettings = async (page: Page) => {
  await redirectToHomePage(page);
  await page.goto(AI_SETTINGS_URL);
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('ai-master-toggle')).toBeVisible();
};

test.describe('AI Settings', () => {
  test.beforeAll(async ({ browser }) => {
    adminUser = new AdminClass();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.delete(apiContext);
    await afterAction();
  });

  test.describe('AI Settings Page', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
    test('renders all configuration sections', async ({ page }) => {
      await visitAISettings(page);

      await expect(page.getByTestId('ai-master-toggle')).toBeVisible();
      await expect(page.getByTestId('ontology-agent-toggle')).toBeVisible();
      await expect(page.getByTestId('mcp-chat-toggle')).toBeVisible();
      await expect(page.getByTestId('mcp-chat-prompt')).toBeVisible();
      await expect(page.getByTestId('mcp-server-toggle')).toBeVisible();
      await expect(page.getByTestId('mcp-server-path')).toBeVisible();
      await expect(page.getByTestId('ai-settings-save')).toBeVisible();
      await expect(page.getByTestId('ai-settings-reset')).toBeVisible();
    });

    test('persists MCP Chat configuration after save', async ({ page }) => {
      await visitAISettings(page);

      const prompt = `Playwright MCP chat prompt ${uuid()}`;

      await page.getByTestId('mcp-chat-toggle').click();
      await page
        .getByTestId('mcp-chat-prompt')
        .locator('textarea')
        .fill(prompt);
      await page.getByTestId('ai-settings-save').click();
      await toastNotification(page, /updated successfully/);

      await visitAISettings(page);

      await expect(
        page.getByTestId('mcp-chat-prompt').locator('textarea')
      ).toHaveValue(prompt);
    });

    test('persists MCP Server configuration after save', async ({ page }) => {
      await visitAISettings(page);

      const path = `/api/v1/mcp-${uuid()}`;

      await page.getByTestId('mcp-server-path').locator('input').fill(path);
      await page.getByTestId('mcp-server-origin-validation-toggle').click();
      await page.getByTestId('ai-settings-save').click();
      await toastNotification(page, /updated successfully/);

      await visitAISettings(page);

      await expect(
        page.getByTestId('mcp-server-path').locator('input')
      ).toHaveValue(path);
    });

    test('resets AI settings to defaults', async ({ page }) => {
      await visitAISettings(page);

      const prompt = `Playwright reset probe ${uuid()}`;

      await page
        .getByTestId('mcp-chat-prompt')
        .locator('textarea')
        .fill(prompt);
      await page.getByTestId('ai-settings-save').click();
      await toastNotification(page, /updated successfully/);

      await visitAISettings(page);
      await page.getByTestId('ai-settings-reset').click();
      await toastNotification(page, /updated successfully/);

      await expect(
        page.getByTestId('mcp-chat-prompt').locator('textarea')
      ).not.toHaveValue(prompt);
    });
  });
});
