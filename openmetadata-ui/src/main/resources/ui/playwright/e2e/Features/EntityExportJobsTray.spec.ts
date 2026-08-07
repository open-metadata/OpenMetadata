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

import { expect, Page, test } from '@playwright/test';

import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { getApiContext, redirectToHomePage } from '../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

// ── helpers ──────────────────────────────────────────────────────────────────

// Trigger export from a data asset's Manage menu and return the real jobId.
const triggerDataAssetExport = async (page: Page): Promise<string> => {
  const exportResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/exportAsync') &&
      response.request().method() === 'GET' &&
      response.ok()
  );

  await page.getByTestId('manage-button').click();
  await page
    .getByTestId('manage-dropdown-list-container')
    .waitFor({ state: 'visible' });
  await page.getByTestId('export-button-title').click();

  const { jobId } = (await (await exportResponse).json()) as { jobId: string };

  return jobId;
};

// Glossary uses its own Manage dropdown container and export button test id.
const triggerGlossaryExport = async (page: Page): Promise<string> => {
  const exportResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/glossaries/name/') &&
      response.url().includes('/exportAsync') &&
      response.request().method() === 'GET' &&
      response.ok()
  );

  await page.getByTestId('manage-button').click();
  const manageDropdown = page
    .locator('.glossary-manage-dropdown-list-container')
    .last();
  await expect(manageDropdown).toBeVisible();
  await manageDropdown.getByTestId('export-button').click();

  const { jobId } = (await (await exportResponse).json()) as { jobId: string };

  return jobId;
};

// Assert that the specific job surfaces in the tray.  Scoped by jobId via
// data-testid so parallel workers sharing the admin user cannot interfere.
const assertExportJobInTray = async (page: Page, jobId: string) => {
  // Tray renders once the component picks up the job from its first poll
  // (triggered by the csv-jobs-refresh event the export button fires).
  await expect(page.locator('.csv-jobs-tray')).toBeVisible({ timeout: 30_000 });

  // If the tray hasn't auto-opened yet (job still active), open it manually.
  if (!(await page.locator('.csv-jobs-tray-popover').isVisible())) {
    await page.locator('.csv-jobs-tray-launcher').click();
  }

  await expect(page.locator('.csv-jobs-tray-popover')).toBeVisible();

  await expect(
    page.locator(`[data-testid="csv-jobs-tray-item-${jobId}"]`)
  ).toBeVisible({ timeout: 30_000 });

  await expect(page.getByText(/Exporting/i).first()).toBeVisible();
};

// ── suite ─────────────────────────────────────────────────────────────────────

test.describe('Export jobs tray surfaces entity exports', () => {
  test.slow();

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Database service export appears in the jobs tray', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const dbService = new DatabaseServiceClass();

    try {
      await dbService.create(apiContext);
      await dbService.visitEntityPage(page);

      const jobId = await triggerDataAssetExport(page);
      await assertExportJobInTray(page, jobId);
    } finally {
      await dbService.delete(apiContext);
      await afterAction();
    }
  });

  test('Database export appears in the jobs tray', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const database = new DatabaseClass();

    try {
      await database.create(apiContext);
      await database.visitEntityPage(page);

      const jobId = await triggerDataAssetExport(page);
      await assertExportJobInTray(page, jobId);
    } finally {
      await database.delete(apiContext);
      await afterAction();
    }
  });

  test('Database schema export appears in the jobs tray', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const schema = new DatabaseSchemaClass();

    try {
      await schema.create(apiContext);
      await schema.visitEntityPage(page);

      const jobId = await triggerDataAssetExport(page);
      await assertExportJobInTray(page, jobId);
    } finally {
      await schema.delete(apiContext);
      await afterAction();
    }
  });

  test('Table export appears in the jobs tray', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const table = new TableClass();

    try {
      await table.create(apiContext);
      await table.visitEntityPage(page);

      const jobId = await triggerDataAssetExport(page);
      await assertExportJobInTray(page, jobId);
    } finally {
      await table.delete(apiContext);
      await afterAction();
    }
  });

  test('Glossary export appears in the jobs tray', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);
      await glossary.visitEntityPage(page);

      const jobId = await triggerGlossaryExport(page);
      await assertExportJobInTray(page, jobId);
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});
