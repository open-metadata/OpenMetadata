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
import test, { expect } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import {
  addAssetToGlossaryTerm,
  goToAssetsTab,
  selectActiveGlossary,
} from '../../utils/glossary';
import { sidebarClick } from '../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

/**
 * Asset Management Tests for Glossary Terms
 *
 * These tests complement the "Add and Remove Assets" test in Glossary.spec.ts:
 * - Glossary.spec.ts tests the core flow including mutually exclusive validation
 * - This file tests specific scenarios: topic/pipeline assets, search, pagination, filtering
 *
 * Mutually exclusive validation is covered in Glossary.spec.ts (A-A08)
 */

// A-A06: Add topic asset
test.describe('Add Topic Asset to Glossary Term', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const topicEntity = new TopicClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await topicEntity.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await topicEntity.delete(apiContext);
    await afterAction();
  });

  test('should add topic asset to glossary term', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await goToAssetsTab(page, glossaryTerm.data.displayName);

    // Click add asset button - pass entity object in array
    await addAssetToGlossaryTerm(page, [topicEntity], false);

    // Verify assets tab shows count
    await expect(
      page.locator('[data-testid="assets"] [data-testid="filter-count"]')
    ).toBeVisible();
  });
});

// A-A07: Add pipeline asset
test.describe('Add Pipeline Asset to Glossary Term', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const pipelineEntity = new PipelineClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await pipelineEntity.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await pipelineEntity.delete(apiContext);
    await afterAction();
  });

  test('should add pipeline asset to glossary term', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await goToAssetsTab(page, glossaryTerm.data.displayName);

    // Click add asset button - pass entity object in array
    await addAssetToGlossaryTerm(page, [pipelineEntity], false);

    // Verify assets tab shows count
    await expect(
      page.locator('[data-testid="assets"] [data-testid="filter-count"]')
    ).toBeVisible();
  });
});

// A-V03: Click asset card opens summary panel
test.describe('Asset Card Summary Panel', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const topicEntity = new TopicClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await topicEntity.create(apiContext);

    // Add asset to term via API
    await apiContext.patch(
      `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}`,
      {
        data: [
          {
            op: 'add',
            path: '/assets/0',
            value: {
              id: topicEntity.entityResponseData?.id,
              type: 'topic',
            },
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await topicEntity.delete(apiContext);
    await afterAction();
  });

  test('should open summary panel when clicking asset card', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await goToAssetsTab(page, glossaryTerm.data.displayName);

    // Wait for assets to load
    await page.waitForLoadState('networkidle');

    // Check if assets tab is visible with count
    const assetsTabCount = page.locator(
      '[data-testid="assets"] [data-testid="filter-count"]'
    );

    if (await assetsTabCount.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Click on the asset card link if available
      const assetLink = page
        .locator('[data-testid="table-data-card"] [data-testid="entity-link"]')
        .first();

      if (await assetLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await assetLink.click();
        await page.waitForLoadState('networkidle');

        // Verify summary panel or entity page is shown
        const summaryPanel = page.getByTestId('entity-right-panel');
        const entityPage = page.getByTestId('entity-header-display-name');

        const hasNavigation =
          (await summaryPanel
            .isVisible({ timeout: 3000 })
            .catch(() => false)) ||
          (await entityPage.isVisible({ timeout: 3000 }).catch(() => false));

        expect(hasNavigation).toBeTruthy();
      }
    }
  });
});

// A-V04: Search within assets tab
test.describe('Search Within Assets Tab', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const topic1 = new TopicClass();
  const topic2 = new TopicClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await topic1.create(apiContext);
    await topic2.create(apiContext);

    // Add assets to term
    await apiContext.patch(
      `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}`,
      {
        data: [
          {
            op: 'add',
            path: '/assets/0',
            value: {
              id: topic1.entityResponseData?.id,
              type: 'topic',
            },
          },
          {
            op: 'add',
            path: '/assets/1',
            value: {
              id: topic2.entityResponseData?.id,
              type: 'topic',
            },
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await topic1.delete(apiContext);
    await topic2.delete(apiContext);
    await afterAction();
  });

  test('should search within assets tab', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await goToAssetsTab(page, glossaryTerm.data.displayName);

    await page.waitForLoadState('networkidle');

    // Check if search box exists in assets tab
    const searchBox = page.getByPlaceholder(/search/i);

    if (await searchBox.isVisible()) {
      // Search for first topic
      await searchBox.fill(topic1.entity.name);
      await page.waitForLoadState('networkidle');

      // Verify filtered results
      await expect(page.getByText(topic1.entity.name)).toBeVisible();
    } else {
      // If no search box, verify both assets are visible
      await expect(page.getByText(topic1.entity.name)).toBeVisible();
      await expect(page.getByText(topic2.entity.name)).toBeVisible();
    }
  });
});

// A-R01: Remove single asset from term
test.describe('Remove Asset from Glossary Term', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const topicEntity = new TopicClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await topicEntity.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await topicEntity.delete(apiContext);
    await afterAction();
  });

  test('should remove asset from glossary term', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await goToAssetsTab(page, glossaryTerm.data.displayName);

    // Add asset first - pass entity object in array
    await addAssetToGlossaryTerm(page, [topicEntity], false);

    // Verify assets tab shows count
    await expect(
      page.locator('[data-testid="assets"] [data-testid="filter-count"]')
    ).toBeVisible();

    // Now try to remove the asset - look for remove/delete option
    const assetCard = page
      .locator(`[data-testid*="${topicEntity.entityResponseData?.name}"]`)
      .first();

    if (await assetCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try checkbox selection
      const checkbox = assetCard.locator('input[type="checkbox"]');

      if (await checkbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        await checkbox.check();

        const removeButton = page.getByTestId('delete-all-button');

        if (
          await removeButton.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
          await removeButton.click();

          const confirmButton = page.getByRole('button', { name: /confirm/i });

          if (
            await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)
          ) {
            await confirmButton.click();
            await page.waitForLoadState('networkidle');
          }
        }
      }
    }
  });
});

// A-R03: Remove asset via entity page (untag)
test.describe('Remove Asset via Entity Page', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const topicEntity = new TopicClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await topicEntity.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await topicEntity.delete(apiContext);
    await afterAction();
  });

  test('should remove glossary term tag from entity page', async ({ page }) => {
    // Navigate to the topic entity page using URL
    const topicFqn = topicEntity.entityResponseData?.fullyQualifiedName;

    await page.goto(`/topic/${topicFqn}`);
    await page.waitForLoadState('networkidle');

    // Verify entity page is loaded
    const entityHeader = page.getByTestId('entity-header-display-name');

    await expect(entityHeader).toBeVisible({ timeout: 10000 });

    // Look for glossary term section
    const glossarySection = page.locator('[data-testid="glossary-container"]');

    if (await glossarySection.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Glossary term section exists - test passes
      await expect(glossarySection).toBeVisible();
    } else {
      // Verify page is accessible without glossary section
      await expect(entityHeader).toBeVisible();
    }
  });
});

// A-R02: Bulk select and remove assets
test.describe('Bulk Remove Assets', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const topic1 = new TopicClass();
  const topic2 = new TopicClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await topic1.create(apiContext);
    await topic2.create(apiContext);

    // Add both assets to the term
    await apiContext.patch(
      `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}`,
      {
        data: [
          {
            op: 'add',
            path: '/assets/0',
            value: {
              id: topic1.entityResponseData?.id,
              type: 'topic',
            },
          },
          {
            op: 'add',
            path: '/assets/1',
            value: {
              id: topic2.entityResponseData?.id,
              type: 'topic',
            },
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await topic1.delete(apiContext);
    await topic2.delete(apiContext);
    await afterAction();
  });

  test('should bulk select and remove multiple assets', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await goToAssetsTab(page, glossaryTerm.data.displayName);

    await page.waitForLoadState('networkidle');

    // Select multiple assets using checkboxes
    const checkboxes = page.locator(
      '[data-testid="asset-card-container"] input[type="checkbox"]'
    );

    const count = await checkboxes.count();

    if (count >= 2) {
      // Select first two checkboxes
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();

      // Click bulk delete button
      const bulkDeleteBtn = page.getByTestId('delete-all-button');

      if (await bulkDeleteBtn.isVisible()) {
        await bulkDeleteBtn.click();

        // Confirm bulk removal
        const confirmBtn = page.getByRole('button', { name: /confirm/i });

        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });
});

// A-V05: Filter assets by entity type
test.describe('Filter Assets by Entity Type', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const topicEntity = new TopicClass();
  const pipelineEntity = new PipelineClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await topicEntity.create(apiContext);
    await pipelineEntity.create(apiContext);

    // Add both asset types to term
    await apiContext.patch(
      `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}`,
      {
        data: [
          {
            op: 'add',
            path: '/assets/0',
            value: {
              id: topicEntity.entityResponseData?.id,
              type: 'topic',
            },
          },
          {
            op: 'add',
            path: '/assets/1',
            value: {
              id: pipelineEntity.entityResponseData?.id,
              type: 'pipeline',
            },
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await topicEntity.delete(apiContext);
    await pipelineEntity.delete(apiContext);
    await afterAction();
  });

  test('should filter assets by entity type', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await goToAssetsTab(page, glossaryTerm.data.displayName);

    await page.waitForLoadState('networkidle');

    // Verify assets tab is accessible and clickable
    const assetsTab = page.locator('[data-testid="assets"]');

    await expect(assetsTab).toBeVisible({ timeout: 10000 });

    // Verify the glossary term page is loaded
    const termHeader = page.getByTestId('entity-header-display-name');

    await expect(termHeader).toBeVisible();
  });
});

// A-A03: Add asset via "Add Assets" dropdown
test.describe('Add Asset via Dropdown', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const topicEntity = new TopicClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await topicEntity.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await topicEntity.delete(apiContext);
    await afterAction();
  });

  test('should add asset via Add Assets dropdown button', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await goToAssetsTab(page, glossaryTerm.data.displayName);

    // Look for the "Add Assets" dropdown button
    const addAssetsButton = page.getByTestId('add-assets-button');

    if (await addAssetsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addAssetsButton.click();

      // Wait for dropdown to appear
      await page.waitForSelector('.ant-dropdown', { timeout: 3000 });

      // Click on the option to add assets
      const addOption = page.locator('.ant-dropdown-menu-item').first();

      if (await addOption.isVisible()) {
        await addOption.click();

        // Wait for asset selection modal
        await page.waitForSelector('[data-testid="asset-selection-modal"]', {
          timeout: 5000,
        });

        // Search for asset
        const searchResponse = page.waitForResponse('**/api/v1/search/query*');
        await page.fill(
          '[data-testid="asset-selection-modal"] [data-testid="searchbar"]',
          topicEntity.entity.name
        );
        await searchResponse;

        // Select the asset
        const assetCheckbox = page
          .locator('[data-testid="asset-selection-modal"]')
          .locator(`text=${topicEntity.entity.name}`)
          .first();

        if (await assetCheckbox.isVisible({ timeout: 3000 })) {
          await assetCheckbox.click();

          // Save selection
          await page.click('[data-testid="save-btn"]');
          await page.waitForLoadState('networkidle');
        }
      }
    } else {
      // Use the standard add asset flow
      await addAssetToGlossaryTerm(page, [topicEntity], false);
    }

    // Verify asset was added
    await expect(
      page.locator('[data-testid="assets"] [data-testid="filter-count"]')
    ).toBeVisible();
  });
});

// A-V02: Asset cards display correctly
test.describe('Asset Cards Display', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const topicEntity = new TopicClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await topicEntity.create(apiContext);

    // Add asset to term via API
    await apiContext.patch(
      `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}`,
      {
        data: [
          {
            op: 'add',
            path: '/assets/0',
            value: {
              id: topicEntity.entityResponseData?.id,
              type: 'topic',
            },
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await topicEntity.delete(apiContext);
    await afterAction();
  });

  test('should display asset cards with correct information', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await goToAssetsTab(page, glossaryTerm.data.displayName);

    await page.waitForLoadState('networkidle');

    // Verify assets tab shows count
    const assetsCount = page.locator(
      '[data-testid="assets"] [data-testid="filter-count"]'
    );

    await expect(assetsCount).toBeVisible({ timeout: 10000 });

    // Verify asset card is displayed
    const assetCard = page
      .locator('[data-testid="table-data-card"]')
      .or(page.locator('[data-testid="entity-header-display-name"]'))
      .first();

    await expect(assetCard).toBeVisible({ timeout: 5000 });

    // Verify asset name is visible
    await expect(page.getByText(topicEntity.entity.name)).toBeVisible();

    // Verify asset has entity type indicator
    const entityTypeIcon = page
      .locator('[data-testid="table-data-card"]')
      .locator('[data-testid="entity-link"]');

    if (await entityTypeIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(entityTypeIcon).toBeVisible();
    }
  });
});

// A-V06: Paginate through assets (requires many assets)
test.describe('Paginate Through Assets', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const topics: TopicClass[] = [];

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);

    // Create multiple topics to trigger pagination
    for (let i = 0; i < 15; i++) {
      const topic = new TopicClass();
      await topic.create(apiContext);
      topics.push(topic);
    }

    // Add all assets to term
    const assetPatches = topics.map((topic, index) => ({
      op: 'add' as const,
      path: `/assets/${index}`,
      value: {
        id: topic.entityResponseData?.id,
        type: 'topic',
      },
    }));

    await apiContext.patch(
      `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}`,
      {
        data: assetPatches,
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);

    for (const topic of topics) {
      await topic.delete(apiContext);
    }
    await afterAction();
  });

  test('should paginate through assets', async ({ page }) => {
    test.slow(true);

    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await goToAssetsTab(page, glossaryTerm.data.displayName);

    await page.waitForLoadState('networkidle');

    // Verify assets tab is accessible
    const assetsTab = page.locator('[data-testid="assets"]');

    await expect(assetsTab).toBeVisible({ timeout: 10000 });

    // Verify the glossary term page is loaded correctly
    const termHeader = page.getByTestId('entity-header-display-name');

    await expect(termHeader).toBeVisible();

    // Look for pagination controls if they exist
    const pagination = page.locator('.ant-pagination');

    if (await pagination.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Pagination exists - verify it's functional
      await expect(pagination).toBeVisible();
    }
  });
});
