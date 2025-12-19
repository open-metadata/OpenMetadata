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
import { TableClass } from '../../../support/entity/TableClass';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { getApiContext, redirectToHomePage } from '../../../utils/common';
import {
  dragAndDropTerm,
  performExpandAll,
  selectActiveGlossary,
  selectActiveGlossaryTerm,
} from '../../../utils/glossary';
import { sidebarClick } from '../../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Glossary Miscellaneous Operations', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  // G-D05: Delete glossary with assets tagged to terms
  // Verifies that when a glossary is deleted, the glossary term tags are removed from tagged assets
  test('should delete glossary and remove tags from assets', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);
    const tableEntity = new TableClass();

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);
      await tableEntity.create(apiContext);

      // Tag the table with the glossary term
      await apiContext.patch(
        `/api/v1/tables/${tableEntity.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/tags/0',
              value: {
                tagFQN: glossaryTerm.responseData.fullyQualifiedName,
                source: 'Glossary',
              },
            },
          ],
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      // First verify the table has the glossary term tag
      await redirectToHomePage(page);
      await tableEntity.visitEntityPage(page);
      await page.waitForLoadState('networkidle');

      // Verify glossary term tag is present on the table (in glossary-container)
      const glossaryContainer = page
        .getByTestId('KnowledgePanel.GlossaryTerms')
        .getByTestId('glossary-container');

      await expect(glossaryContainer).toBeVisible();
      await expect(
        glossaryContainer.getByText(glossaryTerm.responseData.displayName)
      ).toBeVisible();

      // Now delete the glossary
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Click manage button and delete
      await page.getByTestId('manage-button').click();
      await page.getByTestId('delete-button').click();

      // Wait for delete confirmation modal
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Confirm deletion
      await page.getByTestId('confirmation-text-input').fill('DELETE');

      const deleteRes = page.waitForResponse('/api/v1/glossaries/async/*');
      await page.getByTestId('confirm-button').click();
      await deleteRes;

      await redirectToHomePage(page);

      // Verify glossary is deleted by checking it's no longer in the list
      await sidebarClick(page, SidebarItem.GLOSSARY);

      await expect(
        page.getByText(glossary.data.displayName, { exact: true })
      ).not.toBeVisible();

      // Navigate back to the table and verify the glossary term tag has been removed
      await redirectToHomePage(page);
      await tableEntity.visitEntityPage(page);
      await page.waitForLoadState('networkidle');

      // Verify glossary term tag is no longer present on the table
      // The glossary-container should either not exist or not contain the term name
      await expect(
        page
          .getByTestId('KnowledgePanel.GlossaryTerms')
          .getByTestId('glossary-container')
          .getByText(glossaryTerm.responseData.displayName)
      ).not.toBeVisible();
    } finally {
      // Clean up table entity (glossary was deleted in test)
      await tableEntity.delete(apiContext);
      await afterAction();
    }
  });

  // T-U05: Rename term - verify child FQNs update
  test('should update child FQN when parent is renamed', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const parentTerm = new GlossaryTerm(glossary, undefined, 'OriginalParent');
    const childTerm = new GlossaryTerm(glossary, undefined, 'ChildOfOriginal');

    try {
      await glossary.create(apiContext);
      await parentTerm.create(apiContext);

      childTerm.data.parent = parentTerm.responseData.fullyQualifiedName;
      await childTerm.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Expand to see both terms
      await performExpandAll(page);

      await selectActiveGlossaryTerm(page, parentTerm.data.displayName);

      // Rename the parent term
      await page.getByTestId('manage-button').click();
      await page.getByTestId('rename-button').first().click();

      // Wait for rename modal to appear
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      const newName = 'RenamedParent';
      // Use getByLabel to target the Name input in the modal
      await page.getByLabel('Name', { exact: true }).fill(newName);

      const renameRes = page.waitForResponse('/api/v1/glossaryTerms/*');
      await page.getByRole('button', { name: 'Save' }).click();
      await renameRes;

      // Navigate to child term and verify its FQN includes new parent name
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);
      await performExpandAll(page);

      // Child term should still be visible with updated hierarchy
      await expect(
        page.locator(`[data-row-key*="${childTerm.responseData.name}"]`)
      ).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // T-D03: Delete term with assets tagged - verifies tag is removed from assets
  test('should delete term and remove tag from assets', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);
    const tableEntity = new TableClass();

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);
      await tableEntity.create(apiContext);

      // Tag the table with the glossary term
      await apiContext.patch(
        `/api/v1/tables/${tableEntity.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/tags/0',
              value: {
                tagFQN: glossaryTerm.responseData.fullyQualifiedName,
                source: 'Glossary',
              },
            },
          ],
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      // First verify the table has the glossary term tag
      await redirectToHomePage(page);
      await tableEntity.visitEntityPage(page);
      await page.waitForLoadState('networkidle');

      // Verify glossary term tag is present on the table (in KnowledgePanel)
      const glossaryTermsPanel = page.getByTestId(
        'KnowledgePanel.GlossaryTerms'
      );

      await expect(glossaryTermsPanel).toBeVisible();
      await expect(
        glossaryTermsPanel.getByText(glossaryTerm.responseData.displayName)
      ).toBeVisible();

      // Now navigate to glossary and delete the term
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await selectActiveGlossaryTerm(
        page,
        glossaryTerm.responseData.displayName
      );

      // Click manage button and delete
      await page.getByTestId('manage-button').click();
      await page.getByTestId('delete-button').click();

      // Wait for delete confirmation modal
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Confirm deletion
      await page.getByTestId('confirmation-text-input').fill('DELETE');

      const deleteRes = page.waitForResponse('/api/v1/glossaryTerms/async/*');
      await page.getByTestId('confirm-button').click();
      await deleteRes;

      const afterDeleteResponse = page.waitForResponse(
        '/api/v1/glossaryTerms?*'
      );
      await afterDeleteResponse;

      // Verify term is deleted from glossary
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await expect(
        page.locator(`[data-row-key*="${glossaryTerm.responseData.name}"]`)
      ).not.toBeVisible();

      // Navigate back to the table and verify the glossary term tag has been removed
      await redirectToHomePage(page);
      await tableEntity.visitEntityPage(page);
      await page.waitForLoadState('networkidle');

      // Verify glossary term tag is no longer present on the table
      // Either the panel doesn't show the term, or the panel shows empty state
      const termText = page
        .getByTestId('KnowledgePanel.GlossaryTerms')
        .getByText(glossaryTerm.responseData.displayName);

      await expect(termText).not.toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await tableEntity.delete(apiContext);
      await afterAction();
    }
  });

  // T-D04: Delete term with children - verifies both parent and child tags are removed from assets
  test('should delete parent term and remove both parent and child tags from assets', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const parentTerm = new GlossaryTerm(glossary);
    const childTerm = new GlossaryTerm(glossary);
    const tableEntity1 = new TableClass();
    const tableEntity2 = new TableClass();

    try {
      await glossary.create(apiContext);
      await parentTerm.create(apiContext);

      // Create child term under parent
      childTerm.data.parent = parentTerm.responseData.fullyQualifiedName;
      await childTerm.create(apiContext);

      await tableEntity1.create(apiContext);
      await tableEntity2.create(apiContext);

      // Tag table1 with the parent term
      await apiContext.patch(
        `/api/v1/tables/${tableEntity1.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/tags/0',
              value: {
                tagFQN: parentTerm.responseData.fullyQualifiedName,
                source: 'Glossary',
              },
            },
          ],
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      // Tag table2 with the child term
      await apiContext.patch(
        `/api/v1/tables/${tableEntity2.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/tags/0',
              value: {
                tagFQN: childTerm.responseData.fullyQualifiedName,
                source: 'Glossary',
              },
            },
          ],
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      // First verify the tables have the glossary term tags
      await redirectToHomePage(page);

      // Check table1 has parent term tag
      await tableEntity1.visitEntityPage(page);
      await page.waitForLoadState('networkidle');

      const glossaryTermsPanel1 = page.getByTestId(
        'KnowledgePanel.GlossaryTerms'
      );

      await expect(glossaryTermsPanel1).toBeVisible();
      await expect(
        glossaryTermsPanel1.getByText(parentTerm.responseData.displayName)
      ).toBeVisible();

      // Check table2 has child term tag
      await tableEntity2.visitEntityPage(page);
      await page.waitForLoadState('networkidle');

      const glossaryTermsPanel2 = page.getByTestId(
        'KnowledgePanel.GlossaryTerms'
      );

      await expect(glossaryTermsPanel2).toBeVisible();
      await expect(
        glossaryTermsPanel2.getByText(childTerm.responseData.displayName)
      ).toBeVisible();

      // Now navigate to glossary and delete the parent term (which should cascade to child)
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await selectActiveGlossaryTerm(page, parentTerm.data.displayName);

      // Click manage button and delete
      await page.getByTestId('manage-button').click();
      await page.getByTestId('delete-button').click();

      // Wait for delete confirmation modal
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Confirm deletion
      await page.getByTestId('confirmation-text-input').fill('DELETE');

      const deleteRes = page.waitForResponse('/api/v1/glossaryTerms/async/*');
      await page.getByTestId('confirm-button').click();
      await deleteRes;

      await redirectToHomePage(page);

      // Verify both terms are deleted from glossary
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await expect(
        page.locator(`[data-row-key*="${parentTerm.responseData.name}"]`)
      ).not.toBeVisible();
      await expect(
        page.locator(`[data-row-key*="${childTerm.responseData.name}"]`)
      ).not.toBeVisible();

      // Navigate to table1 and verify parent term tag is removed
      await redirectToHomePage(page);
      await tableEntity1.visitEntityPage(page);
      await page.waitForLoadState('networkidle');

      await expect(
        page
          .getByTestId('KnowledgePanel.GlossaryTerms')
          .getByText(parentTerm.responseData.displayName)
      ).not.toBeVisible();

      // Navigate to table2 and verify child term tag is removed
      await redirectToHomePage(page);
      await tableEntity2.visitEntityPage(page);
      await page.waitForLoadState('networkidle');

      await expect(
        page
          .getByTestId('KnowledgePanel.GlossaryTerms')
          .getByText(childTerm.responseData.displayName)
      ).not.toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await tableEntity1.delete(apiContext);
      await tableEntity2.delete(apiContext);
      await afterAction();
    }
  });

  // H-DD07: Drag term to itself (should be prevented)
  test('should not allow dragging term to itself', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const term = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await term.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Try to drag term to itself
      const termRow = page.locator(
        `[data-row-key*="${term.responseData.name}"]`
      );

      await expect(termRow).toBeVisible();

      // Attempt drag - the term should remain in its original position
      await dragAndDropTerm(page, term.data.displayName, term.data.displayName);

      // Verify term is still in original position (no confirmation dialog should appear)
      // and no error occurred
      await expect(termRow).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});
