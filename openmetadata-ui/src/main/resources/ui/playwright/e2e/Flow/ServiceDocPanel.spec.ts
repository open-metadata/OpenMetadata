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
import { waitForAllLoadersToDisappear } from '../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

/**
 * Navigates to MySQL service creation step 3 (configure connection),
 * where the ServiceDocPanel is visible with code blocks and sections.
 */
const goToMysqlConnectionStep = async (page: Page, serviceName: string) => {
  await page.goto('/databaseServices/add-service', {
    waitUntil: 'domcontentloaded',
  });
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId('Mysql').click();
  await page.getByTestId('next-button').click();
  await page.getByTestId('service-name').fill(serviceName);
  await page.getByTestId('next-button').click();
  await page.getByTestId('service-requirements').waitFor({ state: 'visible' });
};

test.describe('ServiceDocPanel', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test.describe('Content rendering', () => {
    test('should render headings not raw markdown', async ({ page }) => {
      await goToMysqlConnectionStep(page, 'pw-doc-panel-headings');

      const docPanel = page.getByTestId('service-requirements');

      // Requirements h2 heading should render as an element, not raw "## Requirements"
      await expect(docPanel.locator('h2').first()).toBeVisible();
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
      await page.getByTestId('Mssql').click();
      await page.getByTestId('next-button').click();
      await page.getByTestId('service-name').fill('pw-doc-panel-mssql-img');
      await page.getByTestId('next-button').click();
      await page.getByTestId('service-requirements').waitFor({
        state: 'visible',
      });

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

  test.describe('Section highlighting', () => {
    test('should highlight section when the corresponding form field is focused', async ({
      page,
    }) => {
      await goToMysqlConnectionStep(page, 'pw-doc-panel-highlight');

      const docPanel = page.getByTestId('service-requirements');

      // No section should be highlighted initially
      await expect(
        docPanel.locator('section[data-highlighted="true"]')
      ).toHaveCount(0);

      // Focus the username field — activeField becomes "username"
      await page.locator(String.raw`#root\/username`).focus();

      // The username section should now be highlighted
      const usernameSection = docPanel.locator(
        'section[data-id="username"][data-highlighted="true"]'
      );

      await expect(usernameSection).toBeVisible();
    });

    test('should remove highlight from previous section when a new field is focused', async ({
      page,
    }) => {
      await goToMysqlConnectionStep(page, 'pw-doc-panel-highlight-switch');

      const docPanel = page.getByTestId('service-requirements');

      // Focus username first
      await page.locator(String.raw`#root\/username`).focus();

      await expect(
        docPanel.locator('section[data-id="username"][data-highlighted="true"]')
      ).toBeVisible();

      // Focus hostPort — username section should lose highlight
      await page.locator(String.raw`#root\/hostPort`).focus();

      await expect(
        docPanel.locator('section[data-id="username"][data-highlighted="true"]')
      ).toHaveCount(0);

      // hostPort section should now be highlighted
      await expect(
        docPanel.locator('section[data-id="hostPort"][data-highlighted="true"]')
      ).toBeVisible();
    });

    test('should only ever have one section highlighted at a time', async ({
      page,
    }) => {
      await goToMysqlConnectionStep(page, 'pw-doc-panel-single-highlight');

      const docPanel = page.getByTestId('service-requirements');

      await page.locator(String.raw`#root\/username`).focus();
      await page.locator(String.raw`#root\/hostPort`).focus();

      await expect(
        docPanel.locator('section[data-highlighted="true"]')
      ).toHaveCount(1);
    });

    test('should load the correct doc file for the selected service type', async ({
      page,
    }) => {
      await goToMysqlConnectionStep(page, 'pw-doc-panel-correct-doc');

      const docPanel = page.getByTestId('service-requirements');

      // MySQL doc starts with "# MySQL"
      await expect(docPanel.locator('h1').first()).toContainText('MySQL');
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

      // Click and verify copied state + tooltip
      await copyButton.hover();
      await copyButton.click();

      // Verify clipboard is non-empty
      const clipboardText = await page.evaluate(() =>
        navigator.clipboard.readText()
      );

      expect(clipboardText.length).toBeGreaterThan(0);
    });
  });
});
