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

/**
 * E2E verification suite for the MUI useTheme removal (Step 5 of the
 * refactor/remove-mui branch).
 *
 * All theme.palette.X and theme.spacing() calls have been replaced with static
 * CSS custom properties (var(--...)) or hex literals.  These tests confirm:
 *   1. No MUI theme-related console errors after the refactor
 *   2. Styled elements are still visible with static colour values
 *   3. Key colour-bearing elements that relied on theme are still functional
 */
import { expect, Page, test } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { LearningResourceClass } from '../../support/learning/LearningResourceClass';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { settingClick, sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

async function goToLearningResourcesAdmin(page: Page) {
  await settingClick(page, GlobalSettingOptions.LEARNING_RESOURCES);
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('learning-resources-page')).toBeVisible();
  await expect(page.getByTestId('learning-resources-table-body')).toBeVisible();
}

async function searchForResource(page: Page, name: string) {
  const searchResponse = page.waitForResponse(
    (r) =>
      r.url().includes('/api/v1/learning/resources') &&
      r.url().includes('search=') &&
      r.request().method() === 'GET'
  );
  await page.getByRole('textbox', { name: 'Search Resource' }).fill(name);
  await searchResponse;
  await waitForAllLoadersToDisappear(page);
}

test.describe(
  'MUI useTheme Removal — Learning Resource Component Colors',
  { tag: ['@Platform', '@MUIRefactor'] },
  () => {
    const videoId = uuid();
    const storylaneId = uuid();

    const videoResource = new LearningResourceClass({
      name: `PW_MUI_Video_${videoId}`,
      displayName: `PW MUI Video Resource ${videoId}`,
      resourceType: 'Video',
      categories: [
        'Discovery',
        'DataGovernance',
        'Observability',
        'DataQuality',
      ],
      contexts: [{ pageId: 'glossary' }],
      status: 'Active',
      estimatedDuration: 300,
      source: {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        provider: 'YouTube',
      },
    });

    const storylaneResource = new LearningResourceClass({
      name: `PW_MUI_Storylane_${storylaneId}`,
      displayName: `PW MUI Storylane Resource ${storylaneId}`,
      resourceType: 'Storylane',
      categories: ['Administration'],
      contexts: [{ pageId: 'lineage' }],
      status: 'Active',
      source: {
        url: 'https://app.storylane.io/share/test',
        provider: 'Storylane',
      },
    });

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await videoResource.create(apiContext);
      await storylaneResource.create(apiContext);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await videoResource.delete(apiContext);
      await storylaneResource.delete(apiContext);
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      await goToLearningResourcesAdmin(page);
    });

    test('should render Learning Resources page with no MUI theme errors in console', async ({
      page,
    }) => {
      const muiErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (
            text.toLowerCase().includes('mui') ||
            text.toLowerCase().includes('themeprovider') ||
            text.toLowerCase().includes('palette')
          ) {
            muiErrors.push(text);
          }
        }
      });

      await redirectToHomePage(page);
      await goToLearningResourcesAdmin(page);

      expect(muiErrors).toHaveLength(0);
    });

    test('should render table rows without crashing when theme is absent', async ({
      page,
    }) => {
      await searchForResource(page, videoResource.data.name);

      const tbody = page.getByTestId('learning-resources-table-body');
      const videoRow = tbody
        .locator('tr')
        .filter({ hasText: videoResource.data.displayName as string });

      await expect(videoRow).toBeVisible();
    });

    test('should render the +N overflow badge for rows with many categories', async ({
      page,
    }) => {
      await searchForResource(page, videoResource.data.name);

      const tbody = page.getByTestId('learning-resources-table-body');
      const videoRow = tbody
        .locator('tr')
        .filter({ hasText: videoResource.data.displayName as string });

      await expect(videoRow).toBeVisible();

      const overflowBadge = videoRow
        .locator('span')
        .filter({ hasText: /^\+\d+$/ });

      await expect(overflowBadge).toBeVisible();
    });

    test('should switch to card view and render video resource card', async ({
      page,
    }) => {
      await searchForResource(page, videoResource.data.name);

      const cardToggle = page.getByTestId('card-view-toggle');
      await expect(cardToggle).toBeVisible();
      await cardToggle.click();
      await waitForAllLoadersToDisappear(page);

      const videoCard = page.getByTestId(
        `learning-resource-card-${videoResource.data.name}`
      );

      await expect(videoCard).toBeVisible();
    });

    test('should switch to card view and render storylane resource card', async ({
      page,
    }) => {
      await searchForResource(page, storylaneResource.data.name);

      const cardToggle = page.getByTestId('card-view-toggle');
      await expect(cardToggle).toBeVisible();
      await cardToggle.click();
      await waitForAllLoadersToDisappear(page);

      const storylaneCard = page.getByTestId(
        `learning-resource-card-${storylaneResource.data.name}`
      );

      await expect(storylaneCard).toBeVisible();
    });

    test('should open resource player modal and render maximize and close buttons', async ({
      page,
    }) => {
      await searchForResource(page, videoResource.data.name);

      const tbody = page.getByTestId('learning-resources-table-body');
      const videoRow = tbody
        .locator('tr')
        .filter({ hasText: videoResource.data.displayName as string });

      await videoRow.click();

      const dialog = page.getByRole('dialog');

      await expect(dialog).toBeVisible();

      await expect(page.getByTestId('maximize-button')).toBeVisible();
      await expect(page.getByTestId('close-resource-player')).toBeVisible();
    });

    test('should show the date-duration pipe separator in the resource player', async ({
      page,
    }) => {
      await searchForResource(page, videoResource.data.name);

      const tbody = page.getByTestId('learning-resources-table-body');
      const videoRow = tbody
        .locator('tr')
        .filter({ hasText: videoResource.data.displayName as string });

      await videoRow.click();

      const dialog = page.getByRole('dialog');

      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('|')).toBeVisible();
    });

    test('should display context chip in the resource player modal', async ({
      page,
    }) => {
      await searchForResource(page, videoResource.data.name);

      const tbody = page.getByTestId('learning-resources-table-body');
      const videoRow = tbody
        .locator('tr')
        .filter({ hasText: videoResource.data.displayName as string });

      await videoRow.click();

      const dialog = page.getByRole('dialog');

      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('Glossary')).toBeVisible();
    });

    test('should close the resource player modal when close button is clicked', async ({
      page,
    }) => {
      await searchForResource(page, videoResource.data.name);

      const tbody = page.getByTestId('learning-resources-table-body');
      const videoRow = tbody
        .locator('tr')
        .filter({ hasText: videoResource.data.displayName as string });

      await videoRow.click();

      const dialog = page.getByRole('dialog');

      await expect(dialog).toBeVisible();

      await page.getByTestId('close-resource-player').click();

      await expect(dialog).not.toBeVisible();
    });

    test('should render resource player modal with no MUI theme errors in console', async ({
      page,
    }) => {
      const muiErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (
            text.toLowerCase().includes('mui') ||
            text.toLowerCase().includes('themeprovider') ||
            text.toLowerCase().includes('palette')
          ) {
            muiErrors.push(text);
          }
        }
      });

      await searchForResource(page, videoResource.data.name);

      const tbody = page.getByTestId('learning-resources-table-body');
      const videoRow = tbody
        .locator('tr')
        .filter({ hasText: videoResource.data.displayName as string });

      await videoRow.click();

      const dialog = page.getByRole('dialog');

      await expect(dialog).toBeVisible();

      expect(muiErrors).toHaveLength(0);
    });

    test('should display the resource title and category in the player modal header', async ({
      page,
    }) => {
      await searchForResource(page, videoResource.data.name);

      const tbody = page.getByTestId('learning-resources-table-body');
      const videoRow = tbody
        .locator('tr')
        .filter({ hasText: videoResource.data.displayName as string });

      await videoRow.click();

      const dialog = page.getByRole('dialog');

      await expect(dialog).toBeVisible();

      await expect(
        dialog.getByText(videoResource.data.displayName as string)
      ).toBeVisible();

      await expect(dialog.getByText('Discovery')).toBeVisible();
    });
  }
);

test.describe(
  'MUI useTheme Removal — Learning Resource Cards in Drawer',
  { tag: ['@Platform', '@MUIRefactor'] },
  () => {
    const drawerId = uuid();

    const glossaryResource = new LearningResourceClass({
      name: `PW_MUI_Drawer_${drawerId}`,
      displayName: `PW MUI Drawer Resource ${drawerId}`,
      resourceType: 'Video',
      categories: ['Discovery'],
      contexts: [{ pageId: 'glossary' }],
      status: 'Active',
      source: {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        provider: 'YouTube',
      },
    });

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await glossaryResource.create(apiContext);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await glossaryResource.delete(apiContext);
      await afterAction();
    });

    test('should render learning resource card in glossary learning drawer with no MUI errors', async ({
      page,
    }) => {
      const muiErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (
            text.toLowerCase().includes('mui') ||
            text.toLowerCase().includes('themeprovider') ||
            text.toLowerCase().includes('palette')
          ) {
            muiErrors.push(text);
          }
        }
      });

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await waitForAllLoadersToDisappear(page);

      const learningIcon = page.getByTestId('learning-icon');

      await expect(learningIcon).toBeVisible();
      await learningIcon.click();

      const drawer = page.getByTestId('learning-drawer');

      await expect(drawer).toBeVisible();

      const resourceCard = drawer.getByTestId(
        `learning-resource-card-${glossaryResource.data.name}`
      );
      await resourceCard.scrollIntoViewIfNeeded();

      await expect(resourceCard).toBeVisible();

      expect(muiErrors).toHaveLength(0);
    });

    test('should open resource player from learning drawer card', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await waitForAllLoadersToDisappear(page);

      const learningIcon = page.getByTestId('learning-icon');

      await expect(learningIcon).toBeVisible();
      await learningIcon.click();

      const drawer = page.getByTestId('learning-drawer');

      await expect(drawer).toBeVisible();

      const resourceCard = drawer.getByTestId(
        `learning-resource-card-${glossaryResource.data.name}`
      );
      await resourceCard.scrollIntoViewIfNeeded();
      await expect(resourceCard).toBeVisible();
      await resourceCard.click();

      const playerDialog = page.getByRole('dialog');

      await expect(playerDialog).toBeVisible();
      await expect(
        playerDialog.getByText(glossaryResource.data.displayName as string)
      ).toBeVisible();

      await expect(page.getByTestId('close-resource-player')).toBeVisible();
    });
  }
);
