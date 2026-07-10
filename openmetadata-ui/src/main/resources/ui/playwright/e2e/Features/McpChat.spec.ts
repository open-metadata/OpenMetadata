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

test.describe(
  'MCP Chat - Sidebar Navigation',
  { tag: ['@Features', '@Platform'] },
  () => {
    // Run serially in a single worker. These tests share one global platform
    // setting (aiSettings.mcpChat.enabled) toggled in beforeAll and reset in
    // afterAll. Under the project's `fullyParallel` mode the reset could run
    // while a sibling test in another worker is still asserting the
    // `app-bar-item-mcp-chat` entry — making it disappear and the test fail.
    test.describe.configure({ mode: 'serial' });

    test.beforeAll('Enable MCP Chat', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      const response = await apiContext.put('/api/v1/system/settings', {
        data: {
          config_type: 'aiSettings',
          config_value: {
            enabled: true,
            mcpChat: { enabled: true, systemPrompt: 'Test prompt' },
          },
        },
      });

      expect([200, 201]).toContain(response.status());

      await afterAction();
    });

    test.afterAll('Disable MCP Chat', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await apiContext.put('/api/v1/system/settings/reset/aiSettings');

      await afterAction();
    });

    test('MCP Chat nav item should appear in sidebar when enabled', async ({
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
