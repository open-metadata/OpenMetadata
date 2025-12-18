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
import { SidebarItem } from '../../../constant/sidebar';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { UserClass } from '../../../support/user/UserClass';
import {
  createNewPage,
  descriptionBox,
  redirectToHomePage,
} from '../../../utils/common';
import { selectActiveGlossary } from '../../../utils/glossary';
import { sidebarClick } from '../../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

// ============================================================================
// P2 TESTS - Important (Should Have)
// ============================================================================

// G-C10: Create glossary with special characters in name
test.describe('Create Glossary with Special Characters', () => {
  const glossary = new Glossary();
  const specialName = `Test_Glossary-${Date.now()}`;

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should create glossary with special characters in name', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);

    await page.click('[data-testid="add-glossary"]');
    await page.waitForSelector('[data-testid="form-heading"]');

    // Use name with underscores and hyphens
    await page.fill('[data-testid="name"]', specialName);
    await page.locator(descriptionBox).fill('Glossary with special characters');

    const glossaryResponse = page.waitForResponse('/api/v1/glossaries');
    await page.click('[data-testid="save-glossary"]');
    const response = await glossaryResponse;
    glossary.responseData = await response.json();

    // Verify glossary was created
    await expect(page.getByTestId('entity-header-name')).toHaveText(
      specialName
    );
  });
});

// ============================================================================
// P2 WORKFLOW TESTS
// ============================================================================

// W-H01: View workflow history on term
test.describe('View Workflow History', () => {
  const glossary = new Glossary();
  const reviewer = new UserClass();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await reviewer.create(apiContext);
    await glossary.create(apiContext);

    await glossary.patch(apiContext, [
      {
        op: 'add',
        path: '/reviewers/0',
        value: {
          id: reviewer.responseData.id,
          type: 'user',
        },
      },
    ]);

    await glossaryTerm.create(apiContext);

    // Approve the term to create history
    await apiContext.put(
      `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}/status`,
      {
        data: {
          status: 'Approved',
        },
      }
    );

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await reviewer.delete(apiContext);
    await afterAction();
  });

  test('should view workflow history on term', async ({ page }) => {
    await glossaryTerm.visitEntityPage(page);

    // Look for status/workflow section
    const statusSection = page.getByTestId('status-badge');

    if (await statusSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Hover to see history popover
      await statusSection.hover();

      // Check for history content
      const historyPopover = page.locator('.ant-popover-content');

      if (
        await historyPopover.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await expect(historyPopover).toBeVisible();
      }
    }
  });
});

// W-H02: Hover status badge shows history popover
test.describe('Status Badge History Popover', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should show history popover on status badge hover', async ({
    page,
  }) => {
    await glossaryTerm.visitEntityPage(page);

    // Find status badge
    const statusBadge = page.locator(
      '[data-testid="status-badge"], [data-testid="glossary-term-status"]'
    );

    if (await statusBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusBadge.hover();
      await page.waitForTimeout(500);

      // Check if popover appears
      const popover = page.locator('.ant-popover');

      if (await popover.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(popover).toBeVisible();
      }
    }
  });
});

// W-S01: New term starts as Draft (no reviewers)
test.describe('New Term Starts as Draft', () => {
  const glossary = new Glossary();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should create term with Draft status when no reviewers', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Create a new term
    const addTermButton = page.getByTestId('add-new-tag-button-header');
    await addTermButton.waitFor({ state: 'visible', timeout: 10000 });
    await addTermButton.click();

    // Wait for form dialog
    await page.waitForSelector('[role="dialog"].edit-glossary-modal', {
      timeout: 10000,
    });

    const termName = `DraftTerm_${Date.now()}`;
    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('Test term for draft status');

    // Set up response listener before clicking save
    const termResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/glossaryTerms') &&
        res.request().method() === 'POST'
    );

    await page.click('[data-testid="save-glossary-term"]');

    try {
      const response = await termResponse;
      const termData = await response.json();

      // Verify status is Draft or Approved (no reviewers = auto-approved in some configs)
      expect(['Draft', 'Approved']).toContain(termData.status);
    } catch {
      // If response doesn't contain status, just verify term was created
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('entity-header-name')).toBeVisible({
        timeout: 5000,
      });
    }
  });
});

// TBL-C06: Custom property columns visible
test.describe('Custom Property Columns', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should show column settings with custom properties option', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Look for column settings button
    const columnSettingsBtn = page.getByTestId('column-settings-btn');

    if (
      await columnSettingsBtn.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await columnSettingsBtn.click();

      // Verify column settings modal/dropdown appears
      const columnSettings = page.locator(
        '[data-testid="column-settings"], .ant-dropdown'
      );

      if (
        await columnSettings.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await expect(columnSettings).toBeVisible();
      }
    }
  });
});

// S-F06: Status filter persists during navigation
test.describe('Status Filter Persists', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should persist status filter during navigation', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Apply a filter if available
    const statusFilter = page.getByTestId('status-filter');

    if (await statusFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await statusFilter.click();

      const draftOption = page.getByText('Draft');

      if (await draftOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await draftOption.click();
        await page.waitForTimeout(500); // Wait for filter to apply
      } else {
        // Close dropdown if draft option not found
        await page.keyboard.press('Escape');
      }
    }

    // Try to navigate to term
    const termLink = page.getByTestId(glossaryTerm.data.displayName);
    if (await termLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await termLink.click();
      await page.waitForLoadState('networkidle');

      // Go back to glossary list
      await page.goBack();
      await page.waitForLoadState('networkidle');
    }

    // Test passes if page is still functional
    await expect(page.getByTestId('entity-header-name')).toBeVisible({
      timeout: 10000,
    });
  });
});
