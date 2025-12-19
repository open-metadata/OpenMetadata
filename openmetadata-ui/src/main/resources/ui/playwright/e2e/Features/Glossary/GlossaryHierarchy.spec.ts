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
import { createNewPage, getApiContext, redirectToHomePage } from '../../../utils/common';
import {
  changeTermHierarchyFromModal,
  performExpandAll,
  selectActiveGlossary,
  selectActiveGlossaryTerm,
} from '../../../utils/glossary';
import { sidebarClick } from '../../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

// H-M03: Move term to root of current glossary
test.describe('Move Term to Root of Current Glossary', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should move nested term to root level of same glossary', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const parentTerm = new GlossaryTerm(glossary);
    const childTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await parentTerm.create(apiContext);
      // Create child term under parent
      childTerm.data.parent = parentTerm.responseData.fullyQualifiedName;
      await childTerm.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);
      await performExpandAll(page);
      await selectActiveGlossaryTerm(page, childTerm.data.displayName);

      await changeTermHierarchyFromModal(
        page,
        glossary.responseData.displayName,
        glossary.responseData.fullyQualifiedName
      );

      // Verify term is now at root level (not nested under parent)
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // The child term should now be visible at root level
      await expect(
        page.locator(`[data-row-key*="${childTerm.responseData.name}"]`)
      ).toBeVisible();
    } finally {
      await childTerm.delete(apiContext);
      await parentTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});

// H-M04: Move term to root of different glossary
// Skipped due to known issue: https://github.com/open-metadata/OpenMetadata/pull/24794
test.describe('Move Term to Root of Different Glossary', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should move term to root of different glossary', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary1 = new Glossary();
    const glossary2 = new Glossary();
    const term = new GlossaryTerm(glossary1);

    try {
      await glossary1.create(apiContext);
      await glossary2.create(apiContext);
      await term.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);
      await selectActiveGlossaryTerm(page, term.data.displayName);

      await changeTermHierarchyFromModal(
        page,
        glossary2.responseData.displayName,
        glossary2.responseData.fullyQualifiedName
      );

      // Verify term is now in glossary2
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary2.data.displayName);

      await expect(page.getByTestId(term.responseData.displayName)).toBeVisible();
    } finally {
      // Term might be in glossary2 now
      try {
        await term.delete(apiContext);
      } catch {
        // Term may have been moved, try deleting from new location
      }
      await glossary1.delete(apiContext);
      await glossary2.delete(apiContext);
      await afterAction();
    }
  });
});

// H-M05: Move term with children to different glossary
// Skipped due to known issue: https://github.com/open-metadata/OpenMetadata/pull/24794
test.describe('Move Term with Children to Different Glossary', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should move term with children to different glossary', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary1 = new Glossary();
    const glossary2 = new Glossary();
    const parentTerm = new GlossaryTerm(glossary1);
    const childTerm = new GlossaryTerm(glossary1);

    try {
      await glossary1.create(apiContext);
      await glossary2.create(apiContext);
      await parentTerm.create(apiContext);
      // Create child under parent
      childTerm.data.parent = parentTerm.responseData.fullyQualifiedName;
      await childTerm.create(apiContext);

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
        glossary2.responseData.displayName,
        glossary2.responseData.fullyQualifiedName,
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
    } finally {
      try {
        await childTerm.delete(apiContext);
        await parentTerm.delete(apiContext);
      } catch {
        // Terms may have been moved
      }
      await glossary1.delete(apiContext);
      await glossary2.delete(apiContext);
      await afterAction();
    }
  });
});

// H-M06: Cancel move operation
test.describe('Cancel Move Operation', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should cancel move operation', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const term = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await term.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);
      await selectActiveGlossaryTerm(page, term.data.displayName);

      // Open change parent modal
      await page.getByTestId('manage-button').click();
      await page.getByTestId('change-parent-button').click();

      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Click cancel button
      await page
        .getByTestId('change-parent-hierarchy-modal')
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
    } finally {
      await term.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});

// H-N07: Navigate 5+ levels deep in hierarchy
test.describe('Deep Hierarchy Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should navigate 5+ levels deep in hierarchy', async ({ page }) => {
    test.slow(true);

    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const terms: GlossaryTerm[] = [];
    const DEPTH = 6;

    try {
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
      const breadcrumb = page.getByTestId('breadcrumb');

      await expect(breadcrumb).toBeVisible();

      // Verify glossary is in breadcrumb (breadcrumb shows FQN format, not displayName)
      await expect(breadcrumb).toContainText(glossary.responseData.name);
    } finally {
      // Delete in reverse order (deepest first)
      for (let i = terms.length - 1; i >= 0; i--) {
        await terms[i].delete(apiContext);
      }
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});

// H-DD05: Drag term - cancel operation
test.describe('Cancel Drag and Drop Operation', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should cancel drag and drop operation', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const term1 = new GlossaryTerm(glossary);
    const term2 = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await term1.create(apiContext);
      await term2.create(apiContext);

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
        page.getByTestId('confirmation-modal').locator('.ant-modal-content')
      ).toBeVisible();

      // Click Cancel button
      await page.getByRole('button', { name: 'Cancel' }).click();

      // Verify modal content is closed
      await expect(
        page.getByTestId('confirmation-modal').locator('.ant-modal-content')
      ).toBeHidden();

      // Verify terms are still at root level (no hierarchy change)
      await expect(
        page.getByTestId(term1.responseData.displayName)
      ).toBeVisible();
      await expect(
        page.getByTestId(term2.responseData.displayName)
      ).toBeVisible();
    } finally {
      await term1.delete(apiContext);
      await term2.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});
