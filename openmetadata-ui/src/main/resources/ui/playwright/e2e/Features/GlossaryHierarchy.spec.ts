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
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import {
  changeTermHierarchyFromModal,
  performExpandAll,
  selectActiveGlossary,
} from '../../utils/glossary';
import { sidebarClick } from '../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

// H-M03: Move term to root of current glossary
test.describe('Move Term to Root of Current Glossary', () => {
  const glossary = new Glossary();
  const parentTerm = new GlossaryTerm(glossary);
  const childTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await parentTerm.create(apiContext);
    // Create child term under parent
    childTerm.data.parent = parentTerm.responseData.fullyQualifiedName;
    await childTerm.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await childTerm.delete(apiContext);
    await parentTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should move nested term to root level of same glossary', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await performExpandAll(page);

    // Navigate to child term by clicking on the term name link
    await page.getByTestId(childTerm.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Open change parent modal
    await page.getByTestId('manage-button').click();
    await page.getByTestId('change-parent-button').click();

    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Select glossary as parent (root level)
    await page.getByLabel('Select Parent').click();
    await page.waitForSelector('.ant-select-dropdown', {
      state: 'visible',
    });

    // Search for the glossary name to filter the dropdown
    await page.getByLabel('Select Parent').fill(glossary.data.displayName);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click on the glossary item in dropdown using display name
    const glossaryOption = page
      .locator('.ant-select-dropdown')
      .getByText(glossary.data.displayName, { exact: false });
    await glossaryOption.first().click();

    const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*/moveAsync');
    await page
      .locator('[data-testid="change-parent-hierarchy-modal"]')
      .getByRole('button', { name: 'Save' })
      .click();
    await saveRes;

    await expect(
      page.locator('[role="dialog"].change-parent-hierarchy-modal')
    ).toBeHidden();

    // Verify term is now at root level (not nested under parent)
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // The child term should now be visible at root level
    await expect(
      page.locator(`[data-row-key*="${childTerm.responseData.name}"]`)
    ).toBeVisible();
  });
});

// H-M04: Move term to root of different glossary
// Skipped due to known issue: https://github.com/open-metadata/OpenMetadata/pull/24794
test.describe.skip('Move Term to Root of Different Glossary', () => {
  const glossary1 = new Glossary();
  const glossary2 = new Glossary();
  const term = new GlossaryTerm(glossary1);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary1.create(apiContext);
    await glossary2.create(apiContext);
    await term.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    // Term might be in glossary2 now
    try {
      await term.delete(apiContext);
    } catch {
      // Term may have been moved, try deleting from new location
    }
    await glossary1.delete(apiContext);
    await glossary2.delete(apiContext);
    await afterAction();
  });

  test('should move term to root of different glossary', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary1.data.displayName);

    // Navigate to term by clicking on the term name link
    await page.getByTestId(term.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Open change parent modal
    await page.getByTestId('manage-button').click();
    await page.getByTestId('change-parent-button').click();

    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Select glossary as parent (root level)
    await page.getByLabel('Select Parent').click();
    await page.waitForSelector('.ant-select-dropdown', {
      state: 'visible',
    });

    // Search for the target glossary
    await page.getByLabel('Select Parent').fill(glossary2.data.displayName);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click on the glossary item in dropdown
    const glossaryOption = page
      .locator('.ant-select-dropdown')
      .getByText(glossary2.data.displayName, { exact: false });
    await glossaryOption.first().click();

    const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*/moveAsync');
    await page
      .locator('[data-testid="change-parent-hierarchy-modal"]')
      .getByRole('button', { name: 'Save' })
      .click();
    await saveRes;

    await expect(
      page.locator('[role="dialog"].change-parent-hierarchy-modal')
    ).toBeHidden();

    // Verify term is now in glossary2
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary2.data.displayName);

    await expect(page.getByTestId(term.responseData.displayName)).toBeVisible();
  });
});

// H-M05: Move term with children to different glossary
// Skipped due to known issue: https://github.com/open-metadata/OpenMetadata/pull/24794
test.describe.skip('Move Term with Children to Different Glossary', () => {
  const glossary1 = new Glossary();
  const glossary2 = new Glossary();
  const parentTerm = new GlossaryTerm(glossary1);
  const childTerm = new GlossaryTerm(glossary1);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary1.create(apiContext);
    await glossary2.create(apiContext);
    await parentTerm.create(apiContext);
    // Create child under parent
    childTerm.data.parent = parentTerm.responseData.fullyQualifiedName;
    await childTerm.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    try {
      await childTerm.delete(apiContext);
      await parentTerm.delete(apiContext);
    } catch {
      // Terms may have been moved
    }
    await glossary1.delete(apiContext);
    await glossary2.delete(apiContext);
    await afterAction();
  });

  test('should move term with children to different glossary', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary1.data.displayName);
    await performExpandAll(page);

    // Navigate to parent term
    await page.getByTestId(parentTerm.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Move parent term (with child) to glossary2
    await changeTermHierarchyFromModal(
      page,
      glossary2.data.displayName,
      glossary2.responseData.name,
      false
    );

    // Verify parent and child are now in glossary2
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary2.data.displayName);
    await performExpandAll(page);

    // Parent should be visible
    await expect(
      page.getByTestId(parentTerm.responseData.displayName)
    ).toBeVisible();

    // Child should also be moved (visible under parent)
    await expect(
      page.getByTestId(childTerm.responseData.displayName)
    ).toBeVisible();
  });
});

// H-M06: Cancel move operation
test.describe('Cancel Move Operation', () => {
  const glossary = new Glossary();
  const term = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await term.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await term.delete(apiContext);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should cancel move operation', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Navigate to term
    await page.getByTestId(term.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Open change parent modal
    await page.getByTestId('manage-button').click();
    await page.getByTestId('change-parent-button').click();

    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Click cancel button
    await page
      .locator('[data-testid="change-parent-hierarchy-modal"]')
      .getByRole('button', { name: 'Cancel' })
      .click();

    // Verify modal is closed
    await expect(
      page.locator('[role="dialog"].change-parent-hierarchy-modal')
    ).not.toBeVisible();

    // Verify term is still in original location
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await expect(page.getByTestId(term.responseData.displayName)).toBeVisible();
  });
});

// H-N07: Navigate 5+ levels deep in hierarchy
test.describe('Deep Hierarchy Navigation', () => {
  const glossary = new Glossary();
  const terms: GlossaryTerm[] = [];
  const DEPTH = 6;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);

    // Create nested hierarchy 6 levels deep
    let parentFqn = '';
    for (let i = 0; i < DEPTH; i++) {
      const term = new GlossaryTerm(glossary);
      term.data.name = `Level${i}Term`;
      term.data.displayName = `Level ${i} Term`;
      if (parentFqn) {
        term.data.parent = parentFqn;
      }
      await term.create(apiContext);
      parentFqn = term.responseData.fullyQualifiedName;
      terms.push(term);
    }
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    // Delete in reverse order (deepest first)
    for (let i = terms.length - 1; i >= 0; i--) {
      await terms[i].delete(apiContext);
    }
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should navigate 5+ levels deep in hierarchy', async ({ page }) => {
    test.slow(true);

    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Expand all to show full hierarchy
    await performExpandAll(page);

    // Verify all levels are visible
    for (let i = 0; i < DEPTH; i++) {
      await expect(
        page.getByTestId(terms[i].responseData.displayName)
      ).toBeVisible();
    }

    // Navigate to deepest term
    await page.getByTestId(terms[DEPTH - 1].responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Verify deepest term details are visible
    await expect(page.getByTestId('entity-header-display-name')).toContainText(
      terms[DEPTH - 1].responseData.displayName
    );

    // Verify breadcrumb shows full path
    const breadcrumb = page.locator('[data-testid="breadcrumb"]');

    await expect(breadcrumb).toBeVisible();

    // Verify glossary is in breadcrumb (breadcrumb shows FQN format, not displayName)
    await expect(breadcrumb).toContainText(glossary.responseData.name);
  });
});

// H-DD05: Drag term - cancel operation
test.describe('Cancel Drag and Drop Operation', () => {
  const glossary = new Glossary();
  const term1 = new GlossaryTerm(glossary);
  const term2 = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await term1.create(apiContext);
    await term2.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await term1.delete(apiContext);
    await term2.delete(apiContext);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should cancel drag and drop operation', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Drag term1 to term2
    await page
      .getByRole('cell', { name: term1.responseData.displayName, exact: true })
      .hover();
    await page.mouse.down();
    await page
      .getByRole('cell', { name: term2.responseData.displayName, exact: true })
      .hover();
    await page.mouse.up();

    // Wait for confirmation modal content to be visible
    await expect(
      page.locator('[data-testid="confirmation-modal"] .ant-modal-content')
    ).toBeVisible();

    // Click Cancel button
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Verify modal content is closed
    await expect(
      page.locator('[data-testid="confirmation-modal"] .ant-modal-content')
    ).toBeHidden();

    // Verify terms are still at root level (no hierarchy change)
    await expect(
      page.getByTestId(term1.responseData.displayName)
    ).toBeVisible();
    await expect(
      page.getByTestId(term2.responseData.displayName)
    ).toBeVisible();
  });
});
