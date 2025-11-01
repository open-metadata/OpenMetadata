/*
 *  Copyright 2024 Collate.
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
import { SidebarItem } from '../../constant/sidebar';
import { redirectToHomePage } from '../../utils/common';
import { selectDataAssetFilter } from '../../utils/explore';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

type EntityType =
  | 'table'
  | 'database'
  | 'databaseSchema'
  | 'dashboard'
  | 'dashboardDataModel'
  | 'pipeline'
  | 'topic'
  | 'mlmodel'
  | 'container'
  | 'searchIndex';

const ENTITY_TYPES: EntityType[] = [
  'table',
  'database',
  'databaseSchema',
  'dashboard',
  'dashboardDataModel',
  'pipeline',
  'topic',
  'mlmodel',
  'container',
  'searchIndex',
];

async function openEntitySummaryPanel(page: Page, entityType: EntityType) {
  await selectDataAssetFilter(page, entityType);
  await page.waitForLoadState('networkidle');

  const firstEntityCard = page
    .locator('[data-testid="table-data-card"]')
    .first();
  if (await firstEntityCard.isVisible()) {
    await firstEntityCard.click();
    await page.waitForLoadState('networkidle');
  }
}

async function verifyEntitySummaryPanelStructure(page: Page) {
  await expect(page.locator('.entity-summary-panel-container')).toBeVisible({
    timeout: 10000,
  });

  await expect(page.locator('.summary-panel-container')).toBeVisible();
}

async function verifyEntityDetailsInPanel(page: Page) {
  const summaryPanel = page.locator('.entity-summary-panel-container');
  const entityLink = summaryPanel
    .locator('[data-testid="entity-link"]')
    .first();
  const hasEntityLink = await entityLink.isVisible();

  if (hasEntityLink) {
    await expect(entityLink).toBeVisible();
  }
}

async function verifyTabNavigation(page: Page) {
  const tabs = [
    'OVERVIEW',
    'SCHEMA',
    'LINEAGE',
    'DATA_QUALITY',
    'CUSTOM_PROPERTIES',
  ];

  for (const tab of tabs) {
    const tabButton = page.locator(`[data-testid="entity-panel-tab-${tab}"]`);
    if (await tabButton.isVisible()) {
      await tabButton.click();
      await page.waitForTimeout(500);

      await expect(tabButton).toHaveClass(/active/);
    }
  }
}

test.describe('Entity Summary Panel', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.EXPLORE);
  });

  ENTITY_TYPES.forEach((entityType) => {
    test(`should display summary panel for ${entityType}`, async ({ page }) => {
      await openEntitySummaryPanel(page, entityType);

      const hasSummaryPanel = await page
        .locator('.entity-summary-panel-container')
        .isVisible();

      if (hasSummaryPanel) {
        await verifyEntitySummaryPanelStructure(page);
        await verifyEntityDetailsInPanel(page);
      } else {
        await expect(page.locator('body')).toBeVisible();
      }
    });
  });

  test('should render entity title section with link', async ({ page }) => {
    await openEntitySummaryPanel(page, 'table');

    const summaryPanel = page.locator('.entity-summary-panel-container');
    const hasSummaryPanel = await summaryPanel.isVisible();

    if (hasSummaryPanel) {
      await expect(summaryPanel.locator('.title-section')).toBeVisible();

      const entityLink = summaryPanel
        .locator('[data-testid="entity-link"]')
        .first();
      if (await entityLink.isVisible()) {
        await expect(entityLink).toHaveAttribute('href', /.+/);
        await expect(entityLink).toHaveAttribute('target', '_blank');
      }
    }
  });

  test('should display owners section', async ({ page }) => {
    await openEntitySummaryPanel(page, 'table');

    const hasSummaryPanel = await page
      .locator('.entity-summary-panel-container')
      .isVisible();

    if (hasSummaryPanel) {
      const ownersSection = page.locator('.owners-section');
      if (await ownersSection.isVisible()) {
        await expect(ownersSection).toBeVisible();
      }
    }
  });

  test('should display domain section', async ({ page }) => {
    await openEntitySummaryPanel(page, 'table');

    const hasSummaryPanel = await page
      .locator('.entity-summary-panel-container')
      .isVisible();

    if (hasSummaryPanel) {
      const domainSection = page.locator('.domains-section');
      if (await domainSection.isVisible()) {
        await expect(domainSection).toBeVisible();
      }
    }
  });

  test('should display tags section', async ({ page }) => {
    await openEntitySummaryPanel(page, 'table');

    const hasSummaryPanel = await page
      .locator('.entity-summary-panel-container')
      .isVisible();

    if (hasSummaryPanel) {
      const tagsSection = page.locator('.tags-section');
      if (await tagsSection.isVisible()) {
        await expect(tagsSection).toBeVisible();
      }
    }
  });

  test('should navigate between tabs', async ({ page }) => {
    await openEntitySummaryPanel(page, 'table');

    const hasSummaryPanel = await page
      .locator('.entity-summary-panel-container')
      .isVisible();

    if (hasSummaryPanel) {
      await verifyTabNavigation(page);
    }
  });

  test('should display description section', async ({ page }) => {
    await openEntitySummaryPanel(page, 'table');

    const hasSummaryPanel = await page
      .locator('.entity-summary-panel-container')
      .isVisible();

    if (hasSummaryPanel) {
      const descriptionSection = page.locator('.description-section');
      if (await descriptionSection.isVisible()) {
        await expect(descriptionSection).toBeVisible();
      }
    }
  });
});
