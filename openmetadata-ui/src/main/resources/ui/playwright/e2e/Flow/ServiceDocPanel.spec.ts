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

import { expect, Page, test } from '@playwright/test';
import { redirectToHomePage } from '../../utils/common';
import {
  copyAndGetClipboardText,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import {
  advanceToServiceConnectionStep,
  selectServiceConnector,
  waitForServiceConnectionForm,
} from '../../utils/serviceIngestion';

test.use({ storageState: 'playwright/.auth/admin.json' });

const goToMysqlConnectionStep = async (page: Page, serviceName: string) => {
  await page.goto('/databaseServices/add-service', {
    waitUntil: 'domcontentloaded',
  });
  await waitForAllLoadersToDisappear(page);
  await selectServiceConnector(page, 'Mysql');
  await page.locator('#service-name').fill(serviceName);
  await advanceToServiceConnectionStep(page);
};

const goToBigQueryConnectionStep = async (page: Page) => {
  await page.goto('/databaseServices/add-service', {
    waitUntil: 'domcontentloaded',
  });
  await waitForAllLoadersToDisappear(page);
  await selectServiceConnector(page, 'BigQuery');
  await waitForServiceConnectionForm(page);
};

test.describe('ServiceDocPanel', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test.describe('Content rendering', () => {
    test('should render headings not raw markdown', async ({ page }) => {
      await goToMysqlConnectionStep(page, 'pw-doc-panel-headings');

      const docPanel = page.getByTestId('service-requirements');

      await expect(
        docPanel.getByRole('heading', { name: 'Requirements', level: 1 })
      ).toBeVisible();
      await expect(docPanel).not.toContainText('## Requirements');
    });

    test('should render admonition blocks with correct class', async ({
      page,
    }) => {
      await goToMysqlConnectionStep(page, 'pw-doc-panel-admonition');

      const docPanel = page.getByTestId('service-requirements');

      // Mysql.md has $$note blocks — should render as .admonition.admonition-note
      const admonition = docPanel.locator('.admonition-note').first();

      await expect(admonition).toBeVisible();
      // Should contain actual note content, not raw "$$note" syntax
      await expect(docPanel).not.toContainText('$$note');
    });

    test('should render code blocks inside pre > code, not as raw text', async ({
      page,
    }) => {
      await goToMysqlConnectionStep(page, 'pw-doc-panel-codeblock');

      const docPanel = page.getByTestId('service-requirements');

      await expect(docPanel.locator('pre code').first()).toBeVisible();
      // Raw fence markers should not appear
      await expect(docPanel).not.toContainText('```');
    });

    test('should render links that open in a new tab', async ({ page }) => {
      await goToMysqlConnectionStep(page, 'pw-doc-panel-links');

      const docPanel = page.getByTestId('service-requirements');
      const externalLink = docPanel.locator('a[target="_blank"]').first();

      await expect(externalLink).toBeVisible();
      await expect(externalLink).toHaveAttribute('href', /^https?:\/\//);
    });

    test('should render image in Mssql doc panel', async ({ page }) => {
      await page.goto('/databaseServices/add-service', {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);
      await selectServiceConnector(page, 'Mssql');
      await page.locator('#service-name').fill('pw-doc-panel-mssql-img');
      await advanceToServiceConnectionStep(page);

      const docPanel = page.getByTestId('service-requirements');
      const image = docPanel.locator('img').first();

      await expect(image).toBeVisible();
      // Verify the image loaded successfully (no broken image)
      const naturalWidth = await image.evaluate(
        (img: HTMLImageElement) => img.naturalWidth
      );

      expect(naturalWidth).toBeGreaterThan(0);
    });
  });

  test.describe('Focused field documentation', () => {
    test('should show field documentation when the corresponding form field is focused', async ({
      page,
    }) => {
      await goToMysqlConnectionStep(page, 'pw-doc-panel-highlight');

      const docPanel = page.getByTestId('service-requirements');

      await page.locator(String.raw`#root\/username`).focus();

      await expect(
        docPanel.getByRole('heading', { name: 'Username', level: 1 })
      ).toBeVisible();
    });

    test('should replace focused documentation when a new field is focused', async ({
      page,
    }) => {
      await goToMysqlConnectionStep(page, 'pw-doc-panel-highlight-switch');

      const docPanel = page.getByTestId('service-requirements');

      await page.locator(String.raw`#root\/username`).focus();

      await expect(
        docPanel.getByRole('heading', { name: 'Username', level: 1 })
      ).toBeVisible();

      await page.locator(String.raw`#root\/hostPort`).focus();

      await expect(
        docPanel.getByRole('heading', { name: 'Username', level: 1 })
      ).toHaveCount(0);

      await expect(
        docPanel.getByRole('heading', { name: 'Host Port', level: 1 })
      ).toBeVisible();
    });

    test('should show service name docs without requirements when service name is focused', async ({
      page,
    }) => {
      const serviceName = 'pw-doc-panel-service-name-docs';

      await goToMysqlConnectionStep(page, serviceName);
      const docPanel = page.getByTestId('service-requirements');

      await page.locator(String.raw`#root\/username`).focus();
      await expect(
        docPanel.getByRole('heading', { name: 'Username', level: 1 })
      ).toBeVisible();

      await page.locator('#service-name').focus();

      await expect(
        docPanel.getByRole('heading', { name: 'Name this service', level: 1 })
      ).toBeVisible();
      await expect(
        docPanel.getByRole('heading', { name: 'Requirements', level: 1 })
      ).toHaveCount(0);
    });

    test('should auto-focus service name input and show name docs when entering step 2', async ({
      page,
    }) => {
      await page.goto('/databaseServices/add-service', {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);
      await selectServiceConnector(page, 'Mysql');

      const docPanel = page.getByTestId('service-requirements');
      const serviceNameInput = page.locator('#service-name');

      await expect(serviceNameInput).toBeFocused();
      await expect(
        docPanel.getByRole('heading', { name: 'Name this service', level: 1 })
      ).toBeVisible();
      await expect(
        docPanel.getByRole('heading', { name: 'Requirements', level: 1 })
      ).toHaveCount(0);
    });

    test('should update panel when a oneOf select field is focused', async ({
      page,
    }) => {
      await goToBigQueryConnectionStep(page);

      const docPanel = page.getByTestId('service-requirements');

      await page.locator('#service-name').focus();
      await expect(
        docPanel.getByRole('heading', { name: 'Name this service', level: 1 })
      ).toBeVisible();

      await page
        .locator(
          '[data-testid="select-widget-root/credentials/gcpConfig__oneof_select"] button'
        )
        .first()
        .focus();

      await expect(
        docPanel.getByRole('heading', {
          name: 'GCP Credentials Configuration',
          level: 1,
        })
      ).toBeVisible();
    });

    test('should show field fallback without requirements for fields with no markdown docs', async ({
      page,
    }) => {
      await page.goto('/databaseServices/add-service', {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);
      await selectServiceConnector(page, 'Snowflake');
      await waitForServiceConnectionForm(page);

      const docPanel = page.getByTestId('service-requirements');

      await page.locator(String.raw`#root\/accountUsageSchema`).focus();

      await expect(
        docPanel.getByRole('heading', {
          name: 'Account Usage Schema Name',
          level: 1,
        })
      ).toBeVisible();
      await expect(
        docPanel.getByRole('heading', { name: 'Requirements', level: 1 })
      ).toHaveCount(0);
    });

    test('should show general docs when no field is focused', async ({
      page,
    }) => {
      await page.goto('/databaseServices/add-service', {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);
      await selectServiceConnector(page, 'Mysql');

      const docPanel = page.getByTestId('service-requirements');

      await page.locator(String.raw`#root\/username`).focus();
      await expect(
        docPanel.getByRole('heading', { name: 'Username', level: 1 })
      ).toBeVisible();

      await docPanel.getByRole('link', { name: /View.*docs/i }).focus();

      await expect(
        docPanel.getByRole('heading', { name: 'Requirements', level: 1 })
      ).toBeVisible();
    });

    test('should load the correct doc file for the selected service type', async ({
      page,
    }) => {
      await goToMysqlConnectionStep(page, 'pw-doc-panel-correct-doc');

      const docPanel = page.getByTestId('service-requirements');

      await expect(docPanel).toContainText('INFORMATION_SCHEMA');
    });
  });

  test.describe('Code block copy button', () => {
    test.use({
      contextOptions: {
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    });

    test('should copy code block content to clipboard and show copied tooltip', async ({
      page,
    }) => {
      await goToMysqlConnectionStep(page, 'pw-doc-panel-copy');

      const docPanel = page.getByTestId('service-requirements');
      const codeBlock = docPanel.locator('pre').first();
      const copyButton = docPanel.getByTestId('code-block-copy-icon').first();

      // Hover code block to reveal the button
      await codeBlock.hover();
      await expect(copyButton).toBeVisible();

      // Click and verify copied text
      const clipboardText = await copyAndGetClipboardText(page, copyButton);

      expect(clipboardText.length).toBeGreaterThan(0);
    });
  });
});
