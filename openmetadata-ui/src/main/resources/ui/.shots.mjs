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
import { chromium } from 'playwright';
const MODE = process.env.MODE ?? 'after';
const ONLY = process.env.ONLY?.split(',');
const OUT = '/Users/harshitshah/conductor/workspaces/OpenMetadata/hong-kong/.context/buttons';
const U = 'http://localhost:3000';
const T = 'sample_data.ecommerce_db.shopify.dim_address';
const pages = {
  'roles-list': async (p) => { await p.goto(`${U}/settings/access/roles`); await p.getByTestId('add-role').waitFor(); },
  'policies-list': async (p) => { await p.goto(`${U}/settings/access/policies`); await p.getByTestId('add-policy').waitFor(); },
  'team-details': async (p) => { await p.goto(`${U}/settings/members/teams/pwmodal-team`); await p.getByTestId('leave-team-button').or(p.getByRole('button', { name: 'Join Team' })).first().waitFor(); },
  'team-roles-tab': async (p) => { await p.goto(`${U}/settings/members/teams/pwmodal-team`); await p.getByRole('tab', { name: /Roles/ }).click(); await p.waitForTimeout(800); },
  'user-profile': async (p) => { await p.goto(`${U}/users/admin`); await p.getByTestId('user-profile-manage-btn').click(); await p.waitForTimeout(600); },
  'alert-details': async (p) => { await p.goto(`${U}/settings/notifications`); const l = p.locator('[data-testid^="alert-name-"], tbody a').first(); await l.click(); await p.waitForTimeout(1500); },
  'search-settings-table': async (p) => { await p.goto(`${U}/settings/preferences/search-settings/tables`); await p.waitForTimeout(2500); },
  'search-settings-global': async (p) => { await p.goto(`${U}/settings/preferences/search-settings`); await p.waitForTimeout(2500); },
  'email-config': async (p) => { await p.goto(`${U}/settings/preferences/email`); await p.waitForTimeout(1500); },
  'appearance': async (p) => { await p.goto(`${U}/settings/preferences/appearance`); await p.waitForTimeout(2000); },
  'sso-config': async (p) => { await p.goto(`${U}/settings/sso`); await p.waitForTimeout(2500); },
  'app-details': async (p) => { await p.goto(`${U}/settings/apps/SearchIndexingApplication`); await p.waitForTimeout(2500); },
  'app-runs': async (p) => { await p.goto(`${U}/settings/apps/SearchIndexingApplication`); await p.getByRole('tab', { name: /Recent Runs|History/ }).click(); await p.waitForTimeout(1500); },
  'table-queries': async (p) => { await p.goto(`${U}/table/${T}/table_queries`); await p.waitForTimeout(2500); },
  'table-sample-data': async (p) => { await p.goto(`${U}/table/${T}/sample_data`); await p.waitForTimeout(2500); },
  'table-profiler-settings': async (p) => { await p.goto(`${U}/table/${T}/profiler/table-profile`); await p.getByTestId('profiler-setting-btn').click(); await p.waitForTimeout(1500); },
  'pipeline-executions': async (p) => { await p.goto(`${U}/pipeline/sample_airflow.dim_address_etl/executions`); await p.waitForTimeout(2500); },
  'data-insights': async (p) => { await p.goto(`${U}/data-insights/data-assets`); await p.waitForTimeout(4000); },
  'data-contract-add': async (p) => { await p.goto(`${U}/table/${T}/contract`); await p.waitForTimeout(1500); const b = p.getByTestId('add-contract-button').or(p.getByRole('button', { name: /Add Contract|Create/i })).first(); if (await b.isVisible().catch(() => false)) { await b.click(); await p.waitForTimeout(800); const m = p.getByText(/Create Contract|Manual/i).first(); if (await m.isVisible().catch(() => false)) await m.click(); } await p.waitForTimeout(1500); },
  'bot-details': async (p) => { await p.goto(`${U}/bots/ingestion-bot`); await p.waitForTimeout(2500); },
  'test-library': async (p) => { await p.goto(`${U}/data-quality/rules-library`); await p.waitForTimeout(2500); },
  'tasks': async (p) => { await p.goto(`${U}/users/admin/task`); await p.waitForTimeout(3000); },
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${U}/signin`);
await page.locator('input[name=email]').fill('admin@open-metadata.org');
await page.locator('input[name=password]').fill('admin');
await page.getByRole('button', { name: 'Sign In' }).click();
await page.waitForURL((u) => !u.pathname.includes('signin'), { timeout: 60000 });
const res = {};
for (const [name, open] of Object.entries(pages)) {
  if (ONLY && !ONLY.includes(name)) continue;
  page.setDefaultTimeout(15000);
  try { await open(page); await page.screenshot({ path: `${OUT}/${MODE}-${name}.png` }); res[name] = 'ok'; }
  catch (e) { res[name] = 'FAIL ' + e.message.split('\n')[0].slice(0, 120); }
}
console.log(JSON.stringify(res, null, 1));
await browser.close();
