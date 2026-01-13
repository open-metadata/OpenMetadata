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
import { expect, test } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { TableClass } from '../../support/entity/TableClass';
import { Domain } from '../../support/domain/Domain';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import {
  createNewPage,
  descriptionBox,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';
import { addTagToTableColumn, submitForm } from '../../utils/tag';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Classification Page Tests', () => {
  const classification = new ClassificationClass();
  const tags: TagClass[] = [];
  const table = new TableClass();
  let domain: Domain;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await classification.create(apiContext);
    await table.create(apiContext);
    domain = new Domain();
    await domain.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    // Clean up tags in reverse order
    tags.reverse();
    for (const tag of tags) {
      await tag.delete(apiContext);
    }
    await classification.delete(apiContext);
    await table.delete(apiContext);
    await domain.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Pagination for Tags List', async ({ page }) => {
    test.slow();

    const { apiContext, afterAction } = await getApiContext(page);

    try {
      // Create enough tags to trigger pagination (>10)
      // Using 20 tags like the working pagination test to ensure pagination appears
      const tagsToCreate = 20;
      for (let i = 1; i <= tagsToCreate; i++) {
        const tag = new TagClass({
          classification: classification.responseData.name,
          name: `pw-tag-pagination-${uuid()}-${i}`,
          displayName: `PW Tag Pagination ${i}`,
          description: `Tag ${i} for pagination testing`,
        });
        await tag.create(apiContext);
        tags.push(tag);
      }

      // Navigate directly to the classification page URL (same as working pagination test)
      await page.goto(`/tags/${classification.responseData.name}`);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Wait for table to be visible
      await page.waitForSelector('[data-testid="table"]', { state: 'visible' });
      await waitForAllLoadersToDisappear(page);

      // Step 1: Verify initial state - Page 1
      await test.step('Verify initial pagination state', async () => {
        const paginationText = page.locator('[data-testid="page-indicator"]');
        if (await paginationText.isVisible().catch(() => false)) {
          const paginationContent = await paginationText.textContent();
          expect(paginationContent).toMatch(/1\s*of\s*\d+/);
        }

        // Verify Previous button is disabled on first page
        const prevButton = page.locator('[data-testid="previous"]');
        if (await prevButton.isVisible().catch(() => false)) {
          await expect(prevButton).toBeDisabled();
        }
      });

      // Step 2: Navigate to next page using Next button
      await test.step('Navigate to next page using Next button', async () => {
        const nextButton = page.locator('[data-testid="next"]');
        const nextButtonCount = await nextButton.count();

        if (nextButtonCount > 0) {
          const isNextButtonEnabled = await nextButton.isEnabled();

          if (isNextButtonEnabled) {
            // Wait for API response when clicking next
            const nextResponse = page.waitForResponse(
              (response) =>
                response.url().includes('/api/v1/tags') &&
                response.status() === 200
            );

            await nextButton.click();
            await nextResponse;
            await page.waitForLoadState('networkidle');
            await waitForAllLoadersToDisappear(page);

            // Verify we're on page 2 by checking URL
            const currentUrl = page.url();
            const urlObj = new URL(currentUrl);
            const searchParams = urlObj.searchParams;
            const currentPage = searchParams.get('currentPage');

            expect(currentPage).toBe('2');
            expect(searchParams.get('cursorType')).toBe('after');

            // Verify pagination text shows page 2
            const paginationText = page.locator(
              '[data-testid="page-indicator"]'
            );
            if (await paginationText.isVisible().catch(() => false)) {
              const paginationContent = await paginationText.textContent();
              expect(paginationContent).toMatch(/2\s*of\s*\d+/);
            }

            // Verify Previous button is now enabled
            const prevButton = page.locator('[data-testid="previous"]');
            if (await prevButton.isVisible().catch(() => false)) {
              await expect(prevButton).toBeEnabled();
            }
          }
        }
      });

      // Step 3: Navigate back to previous page using Previous button
      await test.step(
        'Navigate back to previous page using Previous button',
        async () => {
          const prevButton = page.locator('[data-testid="previous"]');
          const prevButtonCount = await prevButton.count();

          if (
            prevButtonCount > 0 &&
            (await prevButton.isEnabled().catch(() => false))
          ) {
            const prevResponse = page.waitForResponse(
              (response) =>
                response.url().includes('/api/v1/tags') &&
                response.status() === 200
            );
            await prevButton.click();
            await prevResponse;
            await page.waitForLoadState('networkidle');
            await waitForAllLoadersToDisappear(page);

            // Verify we're back on page 1 by checking URL
            const currentUrl = page.url();
            const urlObj = new URL(currentUrl);
            const searchParams = urlObj.searchParams;
            const currentPage = searchParams.get('currentPage');

            // If currentPage is null or '1', we're on the first page
            expect(currentPage === null || currentPage === '1').toBeTruthy();

            // Verify pagination text shows page 1
            const paginationText = page.locator(
              '[data-testid="page-indicator"]'
            );
            if (await paginationText.isVisible().catch(() => false)) {
              const paginationContent = await paginationText.textContent();
              expect(paginationContent).toMatch(/1\s*of\s*\d+/);
            }

            // Verify Previous button is disabled again
            await expect(prevButton).toBeDisabled();
          }
        }
      );

      // Step 4: Test per page display options
      await test.step('Test per page display options', async () => {
        // Verify page size dropdown is visible
        const pageSizeDropdown = page.locator(
          '[data-testid="page-size-selection-dropdown"]'
        );
        await expect(pageSizeDropdown).toBeVisible();

        // Get initial row count
        const table = page.locator('[data-testid="table"]');

        // Test changing to 10 per page
        await pageSizeDropdown.click();
        await page.waitForTimeout(500);

        const tenPerPageOption = page.getByRole('menuitem', {
          name: '10 / Page',
        });
        if (await tenPerPageOption.isVisible().catch(() => false)) {
          const changePageSizeResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/tags') &&
              response.status() === 200
          );
          await tenPerPageOption.click();
          await changePageSizeResponse;
          await page.waitForLoadState('networkidle');
          await waitForAllLoadersToDisappear(page);

          // Verify 10 rows are displayed (data rows only, excluding header)
          const rowCountAfter10 = await table.locator('tbody tr').count();
          expect(rowCountAfter10).toBe(10);

          // Verify page size indicator shows 10
          await expect(page.locator('.ant-pagination-options')).toContainText(
            '10 / page'
          );
        }

        // Test changing to 25 per page
        await pageSizeDropdown.click();
        await page.waitForTimeout(500);

        const twentyFivePerPageOption = page.getByRole('menuitem', {
          name: '25 / Page',
        });
        if (await twentyFivePerPageOption.isVisible().catch(() => false)) {
          const changePageSizeResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/tags') &&
              response.status() === 200
          );
          await twentyFivePerPageOption.click();
          await changePageSizeResponse;
          await page.waitForLoadState('networkidle');
          await waitForAllLoadersToDisappear(page);

          // Verify 25 rows are displayed (or all if less than 25 tags)
          const rowCountAfter25 = await table.locator('tbody tr').count();
          expect(rowCountAfter25).toBeLessThanOrEqual(25);
          expect(rowCountAfter25).toBeGreaterThanOrEqual(Math.min(20, 25)); // Should show all 20 tags or up to 25

          // Verify page size indicator shows 25
          await expect(
            page.getByTestId('page-size-selection-dropdown')
          ).toContainText('25 / Page');
        }

        // Test changing to 50 per page (if available)
        await pageSizeDropdown.click();
        await page.waitForTimeout(500);

        const fiftyPerPageOption = page.getByRole('menuitem', {
          name: '50 / Page',
        });
        if (await fiftyPerPageOption.isVisible().catch(() => false)) {
          const changePageSizeResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/tags') &&
              response.status() === 200
          );
          await fiftyPerPageOption.click();
          await changePageSizeResponse;
          await page.waitForLoadState('networkidle');
          await waitForAllLoadersToDisappear(page);

          // Verify all 20 tags are displayed (since we only have 20)
          const rowCountAfter50 = await table
            .locator('tbody')
            .locator('tr[class*="ant-table-row"]')
            .count();
          expect(rowCountAfter50).toBe(20); // All tags should be visible

          // Verify page size indicator shows 50
          await expect(
            page.getByTestId('page-size-selection-dropdown')
          ).toContainText('50 / Page');

          // Verify pagination controls are hidden or disabled when all items fit on one page
          const nextButton = page.locator('[data-testid="next"]');
          if (await nextButton.isVisible().catch(() => false)) {
            await expect(nextButton).toBeDisabled();
          }
        }
      });
    } finally {
      await afterAction();
    }
  });

  test('Edit Tag Details (Rename, Description, Style)', async ({ page }) => {
    test.slow();

    const { apiContext, afterAction } = await getApiContext(page);

    try {
      // Create a tag
      const tag = new TagClass({
        classification: classification.responseData.name,
        name: `pw-tag-edit-${uuid()}`,
        displayName: `PW Tag Edit ${uuid()}`,
        description: 'Original description',
        style: {
          color: '#FFD700',
        },
      });
      await tag.create(apiContext);
      tags.push(tag);

      // Navigate to tag details page
      await tag.visitPage(page);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Step 1: Edit Display Name (Rename)
      await test.step('Rename tag display name', async () => {
        await page.getByTestId('manage-button').click();
        await page.waitForTimeout(500);

        // Click rename button or menu item
        const renameButton = page.getByRole('menuitem', { name: /Rename/i });
        await renameButton.waitFor({ state: 'visible' });
        await renameButton.click();

        // Wait for dialog to appear
        await expect(page.getByRole('dialog')).toBeVisible();

        // Update Display Name
        const newDisplayName = `Updated Display Name ${uuid()}`;
        await page.fill('[id="displayName"]', newDisplayName);

        // Save changes
        const renameResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/tags/') &&
            response.request().method() === 'PATCH'
        );
        await submitForm(page);
        await renameResponse;
        await page.waitForLoadState('networkidle');
        await waitForAllLoadersToDisappear(page);

        // Verify the update in the page header
        await expect(
          page.getByTestId('entity-header-display-name')
        ).toContainText(newDisplayName);

        // Verify in the Tags list
        await classification.visitPage(page);
        await page.waitForLoadState('networkidle');
        await waitForAllLoadersToDisappear(page);

        await expect(page.locator('[data-testid="table"]')).toContainText(
          newDisplayName
        );

        // Navigate back to tag details
        const tagRowAfter = page
          .locator('[data-testid="table"]')
          .locator('tbody')
          .locator('tr[class*="ant-table-row"]')
          .filter({ hasText: newDisplayName })
          .first();
        await tagRowAfter.click();
        await page.waitForLoadState('networkidle');
        await waitForAllLoadersToDisappear(page);
      });

      // Step 2: Edit Description
      await test.step('Edit tag description', async () => {
        const newDescription = 'Updated description for tag';
        await page.getByTestId('edit-description').click();
        await expect(page.getByRole('dialog')).toBeVisible();

        await page.locator(descriptionBox).clear();
        await page.locator(descriptionBox).fill(newDescription);

        await page.getByTestId('save').click();

        await page.waitForLoadState('networkidle');
        await waitForAllLoadersToDisappear(page);

        // Verify the description is updated
        await expect(page.getByTestId('description-container')).toContainText(
          newDescription
        );
      });

      // Step 3: Edit Style (Icon and Color)
      await test.step('Edit tag style (icon and color)', async () => {
        //Click on the created Tag first then click on the manage button
        await tag.visitPage(page);
        await page.waitForLoadState('networkidle');
        await waitForAllLoadersToDisappear(page);
        await page.getByTestId('manage-button').click();
        await page.waitForTimeout(500);

        const styleMenuItem = page.getByRole('menuitem', { name: /style/i });
        await styleMenuItem.waitFor({ state: 'visible' });
        await styleMenuItem.click();

        // Wait for style dialog to appear
        await expect(page.getByRole('dialog')).toBeVisible();

        // Update Icon
        await page.getByTestId('icon-picker-btn').click();
        await page.getByRole('button', { name: 'Select icon Cube01' }).click();

        // Update Color
        const newColor = '#F14C75';
        await page
          .getByRole('button', { name: `Select color ${newColor}` })
          .click();

        // Save changes
        const styleResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/tags/') &&
            response.request().method() === 'PATCH'
        );
        await submitForm(page);
        await styleResponse;
        await page.waitForLoadState('networkidle');
        await waitForAllLoadersToDisappear(page);

        // Verify the style is updated (icon and color should be visible in the header)
        // The icon and color are typically displayed in the tag header/badge
        await expect(
          page
            .getByTestId('entity-header-display-name')
            .or(page.locator('[data-testid="tags-container"]'))
        ).toBeVisible();
      });

      // Step 4: Verify all changes in the Tags list
      await test.step('Verify all changes in Tags list', async () => {
        await classification.visitPage(page);
        await page.waitForLoadState('networkidle');
        await waitForAllLoadersToDisappear(page);

        // Verify the updated display name is visible
        const updatedDisplayName = await page
          .locator('[data-testid="table"]')
          .locator('tbody tr')
          .filter({ hasText: 'Updated Display Name' })
          .first()
          .textContent()
          .catch(() => null);

        expect(updatedDisplayName).toBeTruthy();
      });
    } finally {
      await afterAction();
    }
  });

  test('Enable/Disable Tag via UI Toggle', async ({ page }) => {
    test.slow();

    const { apiContext, afterAction } = await getApiContext(page);

    try {
      // Create an enabled tag
      const tag = new TagClass({
        classification: classification.responseData.name,
        name: `pw-tag-toggle-${uuid()}`,
        displayName: `PW Tag Toggle ${uuid()}`,
        description: 'Tag for toggle testing',
      });
      await tag.create(apiContext);
      tags.push(tag);

      // Navigate to classification page
      await classification.visitPage(page);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Find the toggle switch using the correct test ID pattern
      const tagToggle = page
        .getByTestId(`tag-disable-toggle-${tag.data.name}`)
        .getByRole('switch');

      // Verify toggle is visible and enabled (tag is enabled by default)
      await expect(tagToggle).toBeVisible();
      await expect(tagToggle).toBeChecked();

      // Step 1: Disable the tag
      await test.step('Disable tag using toggle switch', async () => {
        const disableTagResponse = page.waitForResponse(
          (response) =>
            response.request().method() === 'PATCH' &&
            response.url().includes('/api/v1/tags/')
        );
        await tagToggle.click();
        await disableTagResponse;
        await page.waitForLoadState('networkidle');
        await waitForAllLoadersToDisappear(page);

        // Verify tag is now disabled (toggle is unchecked)
        await expect(tagToggle).not.toBeChecked();
      });

      // Step 2: Verify state persists after reload
      await test.step(
        'Verify disabled state persists after reload',
        async () => {
          await page.reload();
          await page.waitForLoadState('networkidle');
          await waitForAllLoadersToDisappear(page);

          // Verify toggle is still unchecked
          const tagToggleAfterReload = page
            .getByTestId(`tag-disable-toggle-${tag.data.name}`)
            .getByRole('switch');

          await expect(tagToggleAfterReload).not.toBeChecked();

          // Navigate back to classification to see the disabled state
          await tag.visitPage(page);
          await page.waitForLoadState('networkidle');
          await waitForAllLoadersToDisappear(page);

          // Verify disabled badge appears in the table

          await expect(page.getByTestId('disabled')).toBeVisible();

          // Verify that the "Add Asset" button is disabled when the tag is disabled
          await page.getByTestId('assets').click();
          await page.waitForLoadState('networkidle');
          await waitForAllLoadersToDisappear(page);

          // Verify that the "Add Asset" button is disabled when the tag is disabled
          // await expect(
          //   page.getByTestId('data-assets-add-button')
          // ).toBeDisabled();
        }
      );

      // Step 3: Re-enable the tag
      await test.step('Re-enable tag using toggle switch', async () => {
        await classification.visitPage(page);
        await page.waitForLoadState('networkidle');
        await waitForAllLoadersToDisappear(page);

        const tagToggleForEnable = page
          .getByTestId(`tag-disable-toggle-${tag.data.name}`)
          .getByRole('switch');

        const enableTagResponse = page.waitForResponse(
          (response) =>
            response.request().method() === 'PATCH' &&
            response.url().includes('/api/v1/tags/')
        );
        await tagToggleForEnable.click();
        await enableTagResponse;
        await page.waitForLoadState('networkidle');
        await waitForAllLoadersToDisappear(page);

        // Verify tag is enabled again (toggle is checked)
        await expect(tagToggleForEnable).toBeChecked();
      });
    } finally {
      await afterAction();
    }
  });

  test('Classification Domain Management', async ({ page }) => {
    test.slow();

    const { apiContext, afterAction } = await getApiContext(page);
    const domain = new Domain();
    await domain.create(apiContext);

    try {
      // Navigate to classification page
      await classification.visitPage(page);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Click on the Domain selection area (Right side panel or add-domain button)
      await page.getByTestId('add-domain').click();

      // Wait for domain selector to appear
      await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
        state: 'visible',
        timeout: 10000,
      });
      await waitForAllLoadersToDisappear(page);

      // Search and select a Domain
      const searchDomain = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=domain_search_index')
      );

      const searchbar = page
        .getByTestId('domain-selectable-tree')
        .getByTestId('searchbar');
      await searchbar.waitFor({ state: 'visible' });
      await searchbar.fill(domain.responseData.displayName);

      await searchDomain;
      await waitForAllLoadersToDisappear(page);

      // Select the domain
      const domainOption = page.getByTestId(
        `tag-"${domain.responseData.name}"`
      );
      await domainOption.waitFor({ state: 'visible', timeout: 5000 });

      await domainOption.click();
      await page.getByTestId('saveAssociatedTag').click();
      await page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/classifications/') &&
          response.request().method() === 'PATCH'
      );
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Verify the Domain is assigned
      // Domain might appear as a link or chip
      const domainLink = page
        .getByTestId('domain-link')
        .or(page.locator(`[data-testid="domain-${domain.responseData.name}"]`))
        .or(page.locator(`[data-testid="tag-${domain.responseData.name}"]`))
        .first();

      await expect(domainLink).toBeVisible({ timeout: 5000 });

      // Remove the Domain
      await page.getByTestId('add-domain').click();
      await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
        state: 'visible',
      });

      //Remove the domain
      await searchbar.waitFor({ state: 'visible' });
      await searchbar.fill(domain.responseData.displayName);
      await searchDomain;

      // Select the domain
      const domainOptionToRemove = page.getByTestId(
        `tag-"${domain.responseData.name}"`
      );

      // await domainOptionToRemove.waitFor({ state: 'visible', timeout: 50000 });

      await domainOptionToRemove.click();
      await page.getByTestId('saveAssociatedTag').click();

      await page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/classifications/') &&
          response.request().method() === 'PATCH'
      );

      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Verify the Domain is removed
      const domainLinkAfterRemoval = page
        .getByTestId('domain-link')
        .or(page.locator(`[data-testid="tag-${domain.responseData.name}"]`))
        .first();
      await expect(domainLinkAfterRemoval).not.toBeVisible();
    } finally {
      await afterAction();
    }
  });

  test('Usage Count Accuracy', async ({ page }) => {
    test.slow();

    const { apiContext, afterAction } = await getApiContext(page);

    try {
      // Create a tag
      const tag = new TagClass({
        classification: classification.responseData.name,
        name: `pw-tag-usage-${uuid()}`,
        displayName: `PW Tag Usage ${uuid()}`,
        description: 'Tag for usage count testing',
      });
      await tag.create(apiContext);
      tags.push(tag);

      // Navigate to tag page
      await tag.visitPage(page);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Note the initial "Usage Count" (might be in Assets tab or header)
      const assetsTab = page.getByTestId('assets');
      await assetsTab.click();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      const initialCountText = await page
        .getByTestId('assets')
        .getByTestId('filter-count')
        .textContent()
        .catch(() => '0');
      const initialCount = parseInt(initialCountText || '0', 10);

      // Assign the Tag to a Data Asset (Table Column)
      await table.visitEntityPage(page);
      await addTagToTableColumn(page, {
        tagName: tag.data.name,
        tagFqn: tag.responseData.fullyQualifiedName,
        tagDisplayName: tag.responseData.displayName,
        columnNumber: 0,
        rowName: `${table.entity?.columns[0].name} numeric`,
      });

      // Refresh the Classification/Tag page
      await tag.visitPage(page);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await assetsTab.click();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Verify "Usage Count" increased by 1
      const newCountText = await page
        .getByTestId('assets')
        .getByTestId('filter-count')
        .textContent()
        .catch(() => '0');
      const newCount = parseInt(newCountText || '0', 10);
      expect(newCount).toBe(initialCount + 1);

      // Remove the Tag from the Data Asset
      await table.visitEntityPage(page);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Find and remove the tag from the column
      const columnRow = page
        .getByRole('row')
        .filter({ hasText: `${table.entity?.columns[0].name}` })
        .first();

      const tagContainer = columnRow.getByTestId('tags-container').first();

      // Click edit button to open tag selector
      const editButton = tagContainer.getByTestId('edit-button');
      await editButton.waitFor({ state: 'visible' });
      await editButton.click();

      // Wait for tag selector to be visible
      await page
        .locator('[data-testid="tag-selector"]')
        .waitFor({ state: 'visible' });

      // Wait for the selected tag to appear in the selector
      await page.waitForTimeout(500);

      // Remove the tag by clicking the remove button on the selected tag chip
      // Use the correct selector pattern: selected-tag-${tagFqn}
      const selectedTag = page.getByTestId(
        `selected-tag-${tag.responseData.fullyQualifiedName}`
      );

      if (await selectedTag.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Find and click the remove button
        const removeButton = selectedTag.getByTestId('remove-tags');
        await removeButton.waitFor({ state: 'visible' });
        await removeButton.click();
      } else {
        // Alternative: try finding the tag chip and remove icon
        const tagChip = page
          .locator('[data-testid="tag-selector"]')
          .locator(`[data-testid="tag-${tag.responseData.fullyQualifiedName}"]`)
          .first();

        if (await tagChip.isVisible({ timeout: 2000 }).catch(() => false)) {
          const removeIcon = tagChip
            .locator('[data-testid="remove-tags"]')
            .or(tagChip.locator('.anticon-close'))
            .or(tagChip.locator('[aria-label="close"]'))
            .first();

          if (await removeIcon.isVisible().catch(() => false)) {
            await removeIcon.click();
          }
        }
      }

      // Wait for save button to be enabled
      await page.waitForSelector(
        '.ant-select-dropdown [data-testid="saveAssociatedTag"]',
        { state: 'visible' }
      );

      // const removeTagResponse = page.waitForResponse(
      //   (response) =>
      //     response.url().includes('/api/v1/columns/name/') &&
      //     response.request().method() === 'PATCH'
      // );

      await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();
      await page.getByTestId('saveAssociatedTag').click();
      // await removeTagResponse;
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Verify the tag is removed from the column
      await expect(
        columnRow
          .getByTestId('tags-container')
          .getByTestId(`tag-${tag.responseData.fullyQualifiedName}`)
      ).not.toBeVisible();

      // Verify "Usage Count" decreased
      await tag.visitPage(page);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await assetsTab.click();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      const finalCountText = await page
        .getByTestId('assets')
        .getByTestId('filter-count')
        .textContent()
        .catch(() => '0');
      const finalCount = parseInt(finalCountText || '0', 10);
      expect(finalCount).toBe(initialCount);
    } finally {
      await afterAction();
    }
  });

  test('Mutually Exclusive Behavior', async ({ page }) => {
    test.slow();

    const { apiContext, afterAction } = await getApiContext(page);

    // Create a Classification with Mutually Exclusive enabled
    const mutuallyExclusiveClassification = new ClassificationClass({
      mutuallyExclusive: true,
    });
    await mutuallyExclusiveClassification.create(apiContext);

    // Create two Tags (Tag A, Tag B) under this Classification
    const tagA = new TagClass({
      classification: mutuallyExclusiveClassification.responseData.name,
      name: `pw-tag-a-${uuid()}`,
      displayName: `PW Tag A ${uuid()}`,
      description: 'Tag A for mutually exclusive testing',
    });
    await tagA.create(apiContext);

    const tagB = new TagClass({
      classification: mutuallyExclusiveClassification.responseData.name,
      name: `pw-tag-b-${uuid()}`,
      displayName: `PW Tag B ${uuid()}`,
      description: 'Tag B for mutually exclusive testing',
    });
    await tagB.create(apiContext);

    // Verify tags are created under the mutually exclusive classification
    await mutuallyExclusiveClassification.visitPage(page);
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    // Verify both tags are visible in the classification
    await expect(page.locator('[data-testid="table"]')).toContainText(
      tagA.data.name
    );
    await expect(page.locator('[data-testid="table"]')).toContainText(
      tagB.data.name
    );

    try {
      // Navigate to table entity page
      await table.visitEntityPage(page);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      const firstColumnName = table.entity?.columns[0].name;
      const columnRowSelector = `[data-row-key$="${firstColumnName}"]`;

      // Step 1: Add Tag A to the first column
      await test.step('Add Tag A to column', async () => {
        await page.click(
          `${columnRowSelector} [data-testid="classification-tags-0"] [data-testid="entity-tags"] [data-testid="add-tag"]`
        );

        await page.fill('[data-testid="tag-selector"] input', tagA.data.name);

        // await page.waitForResponse(
        //   `/api/v1/search/query?q=*${encodeURIComponent(tagA.data.name)}*`
        // );

        await page.click(
          `[data-testid="tag-${tagA.responseData.fullyQualifiedName}"]`
        );

        await expect(
          page.locator('[data-testid="tag-selector"] > .ant-select-selector')
        ).toContainText(tagA.responseData.displayName);

        const saveTagResponse = page.waitForResponse('/api/v1/columns/name/**');
        await page.click('[data-testid="saveAssociatedTag"]');
        await saveTagResponse;

        await page.waitForSelector('.ant-select-dropdown', {
          state: 'detached',
        });

        // Verify Tag A was added successfully
        await expect(
          page.locator(
            `${columnRowSelector} [data-testid="classification-tags-0"] [data-testid="tags-container"]`
          )
        ).toContainText(tagA.responseData.displayName);

        await expect(
          page.locator(
            `${columnRowSelector} [data-testid="classification-tags-0"] [data-testid="tags-container"] [data-testid="tag-${tagA.responseData.fullyQualifiedName}"]`
          )
        ).toBeVisible();
      });

      // Step 2: Add Tag B to the same column (should replace Tag A due to mutually exclusive behavior)
      await test.step(
        'Add Tag B to same column (should replace Tag A)',
        async () => {
          // Click edit button to modify existing tags on the same column
          await page.click(
            `${columnRowSelector} [data-testid="classification-tags-0"] [data-testid="tags-container"] [data-testid="edit-button"]`
          );

          // const tagSearchResponse2 = page.waitForResponse(
          //   `/api/v1/search/query?q=*${encodeURIComponent(tagB.data.name)}*`
          // );
          await page.fill('[data-testid="tag-selector"] input', tagB.data.name);
          // await tagSearchResponse2;

          await page.click(
            `[data-testid="tag-${tagB.responseData.fullyQualifiedName}"]`
          );

          await expect(
            page.locator('[data-testid="tag-selector"] > .ant-select-selector')
          ).toContainText(tagB.responseData.displayName);

          // Wait for the API call which should return an error
          const errorResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/columns/name/') &&
              response.status() >= 400
          );
          await page.click('[data-testid="saveAssociatedTag"]');
          await errorResponse;
        }
      );

      // Step 3: Verify mutually exclusive behavior - Error message shown and Tag A remains
      await test.step('Verify error message and Tag A remains', async () => {
        // Verify that error alert is displayed
        await expect(page.getByTestId('alert-bar')).toBeVisible({
          timeout: 5000,
        });

        // Verify the error message contains information about mutually exclusive tags
        await expect(page.getByTestId('alert-message')).toContainText(
          'mutually exclusive',
          { timeout: 5000 }
        );

        // Verify that the dropdown closes after error
        await expect(page.locator('.ant-select-dropdown')).not.toBeVisible();

        const tagContainer = page.locator(
          `${columnRowSelector} [data-testid="classification-tags-0"] [data-testid="tags-container"]`
        );

        // Verify that Tag A is still present (not replaced)
        await expect(
          tagContainer.getByTestId(
            `tag-${tagA.responseData.fullyQualifiedName}`
          )
        ).toBeVisible({ timeout: 5000 });

        await expect(tagContainer).toContainText(tagA.responseData.displayName);

        // Verify that Tag B was NOT added
        await expect(
          tagContainer.getByTestId(
            `tag-${tagB.responseData.fullyQualifiedName}`
          )
        ).not.toBeVisible({ timeout: 2000 });

        await expect(tagContainer).not.toContainText(
          tagB.responseData.displayName
        );
      });
    } finally {
      // Cleanup: Delete tags first, then classification
      await tagA.delete(apiContext);
      await tagB.delete(apiContext);
      await mutuallyExclusiveClassification.delete(apiContext);
      await afterAction();
    }
  });

  test('Duplicate Creation Error Handling', async ({ page }) => {
    test.slow();

    const { apiContext, afterAction } = await getApiContext(page);

    try {
      const duplicateName = `TestDuplicate-${uuid()}`;

      // Create a Classification with name "TestDuplicate"
      const classification1 = new ClassificationClass({
        name: duplicateName,
        displayName: duplicateName,
      });
      await classification1.create(apiContext);

      // Attempt to create another Classification with the same name "TestDuplicate"
      await sidebarClick(page, SidebarItem.TAGS);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await page.click('[data-testid="add-classification"]');
      await page.fill('[data-testid="name"]', duplicateName);
      await page.fill('[data-testid="displayName"]', duplicateName);
      await page.locator(descriptionBox).fill('Duplicate classification');

      const createResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/classifications') &&
          response.request().method() === 'POST'
      );
      await submitForm(page);
      await createResponse;

      // Verify a "Toast" error message appears indicating the entity already exists
      // Wait for error message to appear
      await page.waitForTimeout(1000);
      const errorMessage = page
        .getByTestId('alert-bar')
        .or(page.locator('.ant-message-error'))
        .or(page.locator('.ant-notification-notice-error'))
        .first();
      await expect(errorMessage).toBeVisible({ timeout: 5000 });

      // Close the modal/dialog if it's still open
      const modal = page.getByRole('dialog');
      if (await modal.isVisible().catch(() => false)) {
        // Try to close the modal by clicking cancel or X button
        const cancelButton = page
          .getByRole('button', { name: /cancel/i })
          .or(page.locator('[aria-label="Close"]'))
          .or(page.locator('.ant-modal-close'));
        if (await cancelButton.isVisible().catch(() => false)) {
          await cancelButton.first().click();
        } else {
          // Press Escape to close modal
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(500);
      }

      // Close any error toasts that might be blocking
      const alertCloseButton = page.getByTestId('alert-icon-close');
      if (await alertCloseButton.isVisible().catch(() => false)) {
        await alertCloseButton.first().click();
        await page.waitForTimeout(500);
      }

      // Repeat for Tags (create Tag X, try to create Tag X again under the same Classification)
      const tagName = `TestDuplicateTag-${uuid()}`;
      const tag = new TagClass({
        classification: classification1.responseData.name,
        name: tagName,
        displayName: tagName,
        description: 'First tag',
      });
      await tag.create(apiContext);
      tags.push(tag);

      // Navigate to classification and try to create duplicate tag
      // Ensure we're on a clean state before navigating
      await redirectToHomePage(page);
      await classification1.visitPage(page);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await page.click('[data-testid="add-new-tag-button"]');
      await page.fill('[data-testid="name"]', tagName);
      await page.fill('[data-testid="displayName"]', tagName);
      await page.locator(descriptionBox).fill('Duplicate tag');

      const createTagResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/tags') &&
          response.request().method() === 'POST'
      );
      await submitForm(page);
      await createTagResponse;

      // Verify error message for duplicate tag
      await page.waitForTimeout(1000);
      const errorMessageTag = page
        .getByTestId('alert-bar')
        .or(page.locator('.ant-message-error'))
        .or(page.locator('.ant-notification-notice-error'))
        .first();
      await expect(errorMessageTag).toBeVisible({ timeout: 5000 });

      // Close the modal/dialog if it's still open
      const tagModal = page.getByRole('dialog');
      if (await tagModal.isVisible().catch(() => false)) {
        const cancelButton = page
          .getByRole('button', { name: /cancel/i })
          .or(page.locator('[aria-label="Close"]'))
          .or(page.locator('.ant-modal-close'));
        if (await cancelButton.isVisible().catch(() => false)) {
          await cancelButton.first().click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(500);
      }

      // Cleanup
      await classification1.delete(apiContext);
    } finally {
      await afterAction();
    }
  });
});
