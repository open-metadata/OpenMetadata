/*
 *  Copyright 2025 Collate.
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
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

const APP_NAME = 'McpChatApplication';

test.describe(
  'MCP Chat - Sidebar Navigation',
  { tag: ['@Features', '@Platform'] },
  () => {
    test.beforeAll('Install MCP Chat app', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      const installResponse = await apiContext.post('/api/v1/apps', {
        data: {
          name: APP_NAME,
          appConfiguration: {
            systemPrompt: 'Test prompt',
          },
        },
      });

      // 201 = newly installed, 409 = already installed — both are fine
      expect([201, 409]).toContain(installResponse.status());

      await afterAction();
    });

    test.afterAll('Uninstall MCP Chat app', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await apiContext.delete(`/api/v1/apps/name/${APP_NAME}?hardDelete=true`);

      await afterAction();
    });

    test('MCP Chat nav item should appear in sidebar when app is installed', async ({
      page,
    }) => {
      await test.step('Navigate to home page', async () => {
        await redirectToHomePage(page);
      });

      await test.step('Verify MCP Chat sidebar item is visible', async () => {
        const mcpChatNav = page.getByTestId('app-bar-item-mcp-chat');
        await expect(mcpChatNav).toBeVisible();
      });
    });

    test('Clicking MCP Chat sidebar nav should navigate to chat page', async ({
      page,
    }) => {
      await test.step('Navigate to home page', async () => {
        await redirectToHomePage(page);
      });

      await test.step('Click MCP Chat in sidebar', async () => {
        await sidebarClick(page, 'mcp-chat');
        await page.waitForURL('**/mcp-chat');
      });

      await test.step('Verify chat UI elements are rendered', async () => {
        await expect(page.getByTestId('new-chat-button')).toBeVisible();
        await expect(page.getByTestId('mcp-chat-input')).toBeVisible();

        const sendButton = page.getByTestId('mcp-send-button');
        await expect(sendButton).toBeVisible();
        await expect(sendButton).toBeDisabled();
      });
    });

    test('Send button should enable when input has text', async ({ page }) => {
      await test.step('Navigate to MCP Chat page', async () => {
        await page.goto('/mcp-chat');
        await page.waitForURL('**/mcp-chat');
      });

      await test.step('Verify send button enables with text input', async () => {
        const sendButton = page.getByTestId('mcp-send-button');
        await expect(sendButton).toBeDisabled();

        await page.getByTestId('mcp-chat-input').fill('Hello, test message');
        await expect(sendButton).toBeEnabled();
      });
    });
  }
);
