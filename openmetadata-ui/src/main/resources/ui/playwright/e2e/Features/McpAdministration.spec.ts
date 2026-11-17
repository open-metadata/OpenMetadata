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

import { Page } from '@playwright/test';
import { createAdminApiContext } from '../../utils/admin';
import { expect, test } from '../fixtures/pages';

const saveConfiguration = async (page: Page) => {
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/system/mcp/config') &&
      response.request().method() === 'PUT'
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await saved).ok()).toBe(true);
};

test(
  'admin controls MCP access and revokes registered clients',
  { tag: ['@Features', '@Platform'] },
  async ({ page }) => {
    const { apiContext, afterAction } = await createAdminApiContext();
    const response = await apiContext.get('/api/v1/system/mcp/config');
    expect(response.ok()).toBe(true);
    const original = await response.json();
    let clientId: string | undefined;
    try {
      const setup = await apiContext.put('/api/v1/system/mcp/config', {
        data: {
          ...original,
          enabled: true,
          dynamicClientRegistrationEnabled: true,
          allowedRedirectHosts: [],
          allowLoopbackRedirects: true,
        },
      });
      expect(setup.ok()).toBe(true);
      const registered = await apiContext.post('/mcp/register', {
        data: {
          client_name: `MCP admin UI ${Date.now()}`,
          redirect_uris: ['http://127.0.0.1:8123/callback'],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none',
        },
      });
      expect(registered.ok()).toBe(true);
      const client = await registered.json();
      clientId = client.client_id;
      await page.goto('/apps/McpApplication/configuration');
      const serverSwitch = page.getByRole('switch', {
        name: 'Enable MCP Server',
        exact: true,
      });
      await expect(serverSwitch).toBeChecked();
      await serverSwitch.uncheck();
      await saveConfiguration(page);
      expect((await apiContext.post('/mcp', { data: {} })).status()).toBe(404);
      await page.reload();
      await expect(serverSwitch).not.toBeChecked();
      await page
        .getByRole('tab', { name: 'Registered MCP clients', exact: true })
        .click();
      const table = page.getByRole('table', { name: 'Registered MCP clients' });
      const row = table
        .getByRole('row')
        .filter({ hasText: client.client_name });
      await expect(table).toBeVisible();
      const nextPage = page.getByRole('button', { name: 'Next', exact: true });
      while ((await row.count()) === 0 && (await nextPage.isEnabled())) {
        const loaded = page.waitForResponse(
          (result) =>
            result.url().includes('/api/v1/mcp/clients?') &&
            result.request().method() === 'GET'
        );
        await nextPage.click();
        expect((await loaded).ok()).toBe(true);
        await expect(table).toBeVisible();
      }
      await expect(row).toContainText(client.client_id);
      await row
        .getByRole('button', { name: 'Revoke tokens', exact: true })
        .click();
      const tokensRevoked = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/mcp/clients/${client.client_id}/tokens`) &&
          response.request().method() === 'DELETE'
      );
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Revoke', exact: true })
        .click();
      expect((await tokensRevoked).status()).toBe(204);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(row).toBeVisible();
      await row
        .getByRole('button', { name: 'Remove client', exact: true })
        .click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText(client.client_id);
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(row).toBeVisible();
      await row
        .getByRole('button', { name: 'Remove client', exact: true })
        .click();
      const removed = page.waitForResponse(
        (result) =>
          result.url().endsWith(`/mcp/clients/${client.client_id}`) &&
          result.request().method() === 'DELETE'
      );
      await dialog.getByRole('button', { name: 'Revoke', exact: true }).click();
      expect((await removed).status()).toBe(204);
      await expect(row).toHaveCount(0);
      await page
        .getByRole('tab', { name: 'Configuration', exact: true })
        .click();
      await serverSwitch.check();
      await page
        .getByRole('switch', {
          name: 'Allow Dynamic Client Registration',
          exact: true,
        })
        .uncheck();
      await saveConfiguration(page);
      expect(
        (await apiContext.post('/mcp/register', { data: {} })).status()
      ).toBe(403);
      await page.reload();
      await expect(serverSwitch).toBeChecked();
      await expect(
        page.getByRole('switch', {
          name: 'Allow Dynamic Client Registration',
          exact: true,
        })
      ).not.toBeChecked();
    } finally {
      const restored = await apiContext.put('/api/v1/system/mcp/config', {
        data: original,
      });
      expect(restored.ok()).toBe(true);
      if (clientId) {
        await apiContext.delete(`/api/v1/mcp/clients/${clientId}`);
      }
      await afterAction();
    }
  }
);
