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
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const OUT = '/Users/harshitshah/conductor/workspaces/OpenMetadata/spokane/.context/vv';
const T = 'sample_data.ecommerce_db.shopify.dim_address';
const S = [
  ['table-schema-copy-link', `/table/${T}/schema`, '[data-testid="copy-column-link-button"]', 'row'],
  ['table-schema-edit-display-name', `/table/${T}/schema`, '[data-testid="edit-displayName-button"]', 'row'],
  ['table-version-button', `/table/${T}/versions/0.1`, '[data-testid="version-button"]'],
  ['topic-schema-name', '/topic/sample_kafka.address_book/schema', '.break-word'],
  ['api-endpoint-schema-name', '/apiEndpoint/sample_api_service.pet.addPet', '.break-word'],
  ['container-data-model-type', '/container/s3_storage_sample.departments.customer_profiles_exports', 'td .cursor-pointer.tw\\:text-primary'],
  ['nav-user-name', '/my-data', '[data-testid="nav-user-name"]'],
  ['team-edit-name', '/settings/members/teams/Organization', '[data-testid="edit-team-name"]'],
  ['team-edit-email', '/settings/members/teams/Organization', '[data-testid="edit-email"]'],
  ['team-edit-subscription', '/settings/members/teams/Organization', '[data-testid="edit-team-subscription"]'],
  ['team-total-users-info', '/settings/members/teams/Organization', '[data-testid="helper-icon"]'],
  ['team-roles-add', '/settings/members/teams/Organization', '[data-testid="add-placeholder-button"]', 'tab:Roles'],
  ['bots-delete-disabled', '/settings/bots', '[data-testid="bot-delete-ingestion-bot"]'],
  ['roles-delete', '/settings/access/roles', '[data-testid^="delete-action-"]'],
  ['policies-delete', '/settings/access/policies', '[data-testid^="delete-action-"]'],
  ['role-detail-remove', '/settings/access/roles/DataConsumer', '[data-testid^="remove-action-"]'],
  ['services-add', '/settings/services/databases', '[data-testid="add-service-button"]'],
  ['service-edit-connection', '/service/databaseServices/sample_data/connection', '[data-testid="edit-connection-button"]'],
  ['notification-alert-delete-disabled', '/settings/notifications/alerts', '[data-testid^="alert-delete-"]'],
  ['login-config-info', '/settings/preferences/loginConfiguration', '[data-testid="max-login-fail-attampts-url-info"]'],
  ['marketplace-install', '/marketplace/apps/AIChatApplication', '[data-testid="install-application"]'],
  ['users-list-delete', '/settings/members/users', '[data-testid^="delete-user-btn-"]'],
];
const only = process.argv.slice(3);
const [, , label] = process.argv; const base = label === 'before' ? 'http://localhost:3192' : 'http://localhost:3191';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(base + '/signin');
await page.fill('input[name="email"]', 'admin@open-metadata.org');
await page.fill('input[name="password"]', 'admin');
await page.click('[data-testid="login"]');
await page.waitForURL(/my-data|home|\/$/, { timeout: 60000 }).catch(() => {});
const report = [];
for (const [name, path, sel, mode] of S) {
  if (only.length && !only.includes(name)) continue;
  for (const theme of ['light', 'dark']) {
    try {
      await page.goto(base + path, { waitUntil: 'domcontentloaded' });
      await page.evaluate((t) => document.documentElement.classList.toggle('dark-mode', t === 'dark'), theme);
      if (mode?.startsWith('tab:')) await page.getByRole('tab', { name: new RegExp(mode.slice(4)) }).first().click();
      const el = page.locator(sel).first();
      await el.waitFor({ state: 'attached', timeout: 20000 });
      await page.evaluate((t) => document.documentElement.classList.toggle('dark-mode', t === 'dark'), theme);
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(2500);
      if (mode === 'row') await el.locator('xpath=ancestor::tr[1]').hover();
      await page.waitForTimeout(400);
      await page.mouse.move(0, 0);
      const c = await el.boundingBox();
      await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 6 });
      const tip = page.locator('[role="tooltip"], .ant-tooltip:not(.ant-tooltip-hidden)').last();
      await tip.waitFor({ state: 'visible', timeout: 6000 });
      await page.waitForTimeout(350);
      const a = await el.boundingBox(); const b = await tip.boundingBox();
      const x0 = Math.max(0, Math.min(a.x, b.x) - 60), y0 = Math.max(0, Math.min(a.y, b.y) - 40);
      const x1 = Math.min(1440, Math.max(a.x + a.width, b.x + b.width) + 60), y1 = Math.min(900, Math.max(a.y + a.height, b.y + b.height) + 40);
      await page.screenshot({ path: `${OUT}/${label}/${name}-${theme}.png`, clip: { x: x0, y: y0, width: Math.max(x1 - x0, 260), height: Math.max(y1 - y0, 120) } });
      report.push(`${name}-${theme}: ok`);
    } catch (e) { report.push(`${name}-${theme}: FAIL ${String(e.message).split('\n')[0].slice(0, 120)}`); }
  }
}
fs.writeFileSync(`${OUT}/${label}-report.txt`, report.join('\n'));
console.log(report.join('\n'));
await browser.close();
