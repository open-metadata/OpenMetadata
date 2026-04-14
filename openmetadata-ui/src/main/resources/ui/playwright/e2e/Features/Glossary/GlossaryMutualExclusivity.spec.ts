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
import { SidebarItem } from '../../../constant/sidebar';
import { TableClass } from '../../../support/entity/TableClass';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { getApiContext, redirectToHomePage } from '../../../utils/common';
import {
  closeColumnDetailPanel,
  waitForAllLoadersToDisappear,
} from '../../../utils/entity';
import { sidebarClick } from '../../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const searchGlossaryInSelector = async (page: Page, glossaryName: string) => {
  const searchInput = page
    .getByTestId('KnowledgePanel.GlossaryTerms')
    .getByRole('combobox');
  await searchInput.fill(glossaryName);
  await waitForAllLoadersToDisappear(page);
};

test.describe('Glossary Mutual Exclusivity Feature', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });
  test.describe('Suite 1: Radio/Checkbox Rendering', () => {
    test('ME-R01: Children of ME parent should render checkboxes', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = true;

      try {
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        // Create children under ME parent
        const child1 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MEChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MEChild2'
        );
        const child3 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MEChild3'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);
        await child3.create(apiContext);

        // Create a table to test tagging
        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        // Open glossary term selector
        await page
          .getByTestId('KnowledgePanel.GlossaryTerms')
          .getByRole('button', { name: 'plus' })
          .click();

        // Wait for dropdown to open
        await page.waitForSelector('.async-tree-select-list-dropdown', {
          state: 'visible',
        });

        // Search for the glossary to bring it into view
        await searchGlossaryInSelector(page, glossary.responseData.name);

        const parentTermNode = page.getByTestId(
          `tag-${parentTerm.responseData.fullyQualifiedName}`
        );
        await expect(parentTermNode).toBeVisible();

        // Search and expand the ME parent term
        await parentTermNode.getByTestId('expand-icon').first().click();

        // Verify children have checkboxes
        const child1Node = page.getByTestId(
          `tag-${child1.responseData.fullyQualifiedName}`
        );
        const child1Checkbox = child1Node.locator('.ant-select-tree-checkbox');
        await expect(child1Checkbox).toBeVisible();

        const child2Node = page.getByTestId(
          `tag-${child2.responseData.fullyQualifiedName}`
        );
        const child2Checkbox = child2Node.locator('.ant-select-tree-checkbox');
        await expect(child2Checkbox).toBeVisible();

        const child3Node = page.getByTestId(
          `tag-${child3.responseData.fullyQualifiedName}`
        );
        const child3Checkbox = child3Node.locator('.ant-select-tree-checkbox');
        await expect(child3Checkbox).toBeVisible();

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });
  });

  test.describe('Suite 2: Selection Behavior', () => {
    test('ME-S01: Selecting ME child should auto-deselect siblings', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = true;

      try {
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        const child1 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'SelectChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'SelectChild2'
        );
        const child3 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'SelectChild3'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);
        await child3.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await page
          .getByTestId('KnowledgePanel.GlossaryTerms')
          .getByRole('button', { name: 'plus' })
          .click();

        await page.waitForSelector('.async-tree-select-list-dropdown', {
          state: 'visible',
        });

        // Search for the glossary to bring it into view
        await searchGlossaryInSelector(page, glossary.responseData.name);

        const parentTermNode = page.getByTestId(
          `tag-${parentTerm.responseData.fullyQualifiedName}`
        );
        await expect(parentTermNode).toBeVisible();

        // Expand the parent term
        await parentTermNode.getByTestId('expand-icon').first().click();

        // Select first child
        const child1Node = page
          .getByRole('tree')
          .getByTestId(`tag-${child1.responseData.fullyQualifiedName}`);
        const child1Checkbox = child1Node.locator('.ant-select-tree-checkbox');
        await child1Node.click();

        // Verify child1 is selected
        await expect(child1Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        // Select second child
        const child2Node = page
          .getByRole('tree')
          .getByTestId(`tag-${child2.responseData.fullyQualifiedName}`);
        const child2Checkbox = child2Node.locator('.ant-select-tree-checkbox');
        await child2Node.click();

        // Verify child2 is now selected and child1 is deselected (mutual exclusivity)
        await expect(child2Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );
        await expect(child1Checkbox).not.toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        // Select third child
        const child3Node = page
          .getByRole('tree')
          .getByTestId(`tag-${child3.responseData.fullyQualifiedName}`);
        const child3Checkbox = child3Node.locator('.ant-select-tree-checkbox');
        await child3Node.click();

        // Verify only child3 is selected (mutual exclusivity auto-deselects siblings)
        await expect(child3Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );
        await expect(child2Checkbox).not.toHaveClass(
          /ant-select-tree-checkbox-checked/
        );
        await expect(child1Checkbox).not.toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });

    test('ME-S02: Can select multiple children under non-ME parent', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = false;

      try {
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        const child1 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MultiChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MultiChild2'
        );
        const child3 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MultiChild3'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);
        await child3.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await page
          .getByTestId('KnowledgePanel.GlossaryTerms')
          .getByRole('button', { name: 'plus' })
          .click();

        await page.waitForSelector('.async-tree-select-list-dropdown', {
          state: 'visible',
        });

        // Search for the glossary to bring it into view
        await searchGlossaryInSelector(page, glossary.responseData.name);

        const parentTermNode = page.getByTestId(
          `tag-${parentTerm.responseData.fullyQualifiedName}`
        );
        await expect(parentTermNode).toBeVisible();

        // Expand the parent term
        await parentTermNode.getByTestId('expand-icon').first().click();

        // Select first child
        const child1Node = page
          .getByRole('tree')
          .getByTestId(`tag-${child1.responseData.fullyQualifiedName}`);
        const child1Checkbox = child1Node.locator('.ant-select-tree-checkbox');
        await child1Node.click();
        await expect(child1Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        // Select second child
        const child2Node = page
          .getByRole('tree')
          .getByTestId(`tag-${child2.responseData.fullyQualifiedName}`);
        const child2Checkbox = child2Node.locator('.ant-select-tree-checkbox');
        await child2Node.click();
        await expect(child2Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        // Select third child
        const child3Node = page
          .getByRole('tree')
          .getByTestId(`tag-${child3.responseData.fullyQualifiedName}`);
        const child3Checkbox = child3Node.locator('.ant-select-tree-checkbox');
        await child3Node.click();
        await expect(child3Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        // Verify all three are still selected
        await expect(child1Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );
        await expect(child2Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );
        await expect(child3Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });

    test('ME-S03: Can deselect currently selected ME term', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = true;

      try {
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        const child1 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'DeselectChild'
        );
        await child1.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await page
          .getByTestId('KnowledgePanel.GlossaryTerms')
          .getByRole('button', { name: 'plus' })
          .click();

        await page.waitForSelector('.async-tree-select-list-dropdown', {
          state: 'visible',
        });

        // Search for the glossary to bring it into view
        await searchGlossaryInSelector(page, glossary.responseData.name);

        const parentTermNode = page.getByTestId(
          `tag-${parentTerm.responseData.fullyQualifiedName}`
        );
        await expect(parentTermNode).toBeVisible();

        // Expand the parent term
        await parentTermNode.getByTestId('expand-icon').first().click();

        const child1Node = page
          .getByRole('tree')
          .getByTestId(`tag-${child1.responseData.fullyQualifiedName}`);
        const child1Checkbox = child1Node.locator('.ant-select-tree-checkbox');

        // Select child
        await child1Node.click();
        await expect(child1Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        // Click again to deselect
        await child1Node.click();
        await expect(child1Checkbox).not.toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });

    test('ME-S05: Mixed selection - ME siblings deselect, non-ME remain', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();

      // ME parent
      const meParent = new GlossaryTerm(glossary);
      meParent.data.name = 'MixedMEParent';
      meParent.data.displayName = 'MixedMEParent';
      meParent.data.mutuallyExclusive = true;

      // Non-ME parent
      const nonMeParent = new GlossaryTerm(glossary);
      nonMeParent.data.name = 'MixedNonMEParent';
      nonMeParent.data.displayName = 'MixedNonMEParent';
      nonMeParent.data.mutuallyExclusive = false;

      try {
        await glossary.create(apiContext);
        await meParent.create(apiContext);
        await nonMeParent.create(apiContext);

        const meChild1 = new GlossaryTerm(
          glossary,
          meParent.responseData.fullyQualifiedName,
          'MixedMEChild1'
        );
        const meChild2 = new GlossaryTerm(
          glossary,
          meParent.responseData.fullyQualifiedName,
          'MixedMEChild2'
        );
        const nonMeChild1 = new GlossaryTerm(
          glossary,
          nonMeParent.responseData.fullyQualifiedName,
          'MixedNonMEChild1'
        );
        const nonMeChild2 = new GlossaryTerm(
          glossary,
          nonMeParent.responseData.fullyQualifiedName,
          'MixedNonMEChild2'
        );
        await meChild1.create(apiContext);
        await meChild2.create(apiContext);
        await nonMeChild1.create(apiContext);
        await nonMeChild2.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await page
          .getByTestId('KnowledgePanel.GlossaryTerms')
          .getByRole('button', { name: 'plus' })
          .click();

        await page.waitForSelector('.async-tree-select-list-dropdown', {
          state: 'visible',
        });

        // Search for the glossary to bring it into view
        await searchGlossaryInSelector(page, glossary.responseData.name);

        // Assert and expand ME parent
        const meParentNode = page.getByTestId(
          `tag-${meParent.responseData.fullyQualifiedName}`
        );
        await expect(meParentNode).toBeVisible();
        await meParentNode.getByTestId('expand-icon').first().click();

        // Assert and expand non-ME parent
        const nonMeParentNode = page.getByTestId(
          `tag-${nonMeParent.responseData.fullyQualifiedName}`
        );
        await expect(nonMeParentNode).toBeVisible();
        await nonMeParentNode.getByTestId('expand-icon').first().click();

        // Select non-ME children first
        const nonMeChild1Node = page
          .getByRole('tree')
          .getByTestId(`tag-${nonMeChild1.responseData.fullyQualifiedName}`);
        const nonMeChild1Checkbox = nonMeChild1Node.locator(
          '.ant-select-tree-checkbox'
        );
        await nonMeChild1Node.click();
        await expect(nonMeChild1Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        const nonMeChild2Node = page
          .getByRole('tree')
          .getByTestId(`tag-${nonMeChild2.responseData.fullyQualifiedName}`);
        const nonMeChild2Checkbox = nonMeChild2Node.locator(
          '.ant-select-tree-checkbox'
        );
        await nonMeChild2Node.click();
        await expect(nonMeChild2Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        // Select ME child
        const meChild1Node = page
          .getByRole('tree')
          .getByTestId(`tag-${meChild1.responseData.fullyQualifiedName}`);
        const meChild1Checkbox = meChild1Node.locator(
          '.ant-select-tree-checkbox'
        );
        await meChild1Node.click();
        await expect(meChild1Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        // Non-ME children should still be selected
        await expect(nonMeChild1Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );
        await expect(nonMeChild2Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        // Select another ME child
        const meChild2Node = page
          .getByRole('tree')
          .getByTestId(`tag-${meChild2.responseData.fullyQualifiedName}`);
        const meChild2Checkbox = meChild2Node.locator(
          '.ant-select-tree-checkbox'
        );
        await meChild2Node.click();

        // ME child 1 should be deselected, ME child 2 selected (mutual exclusivity)
        await expect(meChild2Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );
        await expect(meChild1Checkbox).not.toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        // Non-ME children should still be selected
        await expect(nonMeChild1Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );
        await expect(nonMeChild2Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });
  });

  test.describe('Suite 3: Tag Application to Entities', () => {
    test('ME-T01: Apply single ME glossary term to table', async ({ page }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = true;

      try {
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        const child = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'ApplyTermChild'
        );
        await child.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        // Open glossary selector
        await page
          .getByTestId('KnowledgePanel.GlossaryTerms')
          .getByRole('button', { name: 'plus' })
          .click();

        await page.waitForSelector('.async-tree-select-list-dropdown', {
          state: 'visible',
        });

        // Search for the glossary to bring it into view
        await searchGlossaryInSelector(page, glossary.responseData.name);

        const parentTermNode = page.getByTestId(
          `tag-${parentTerm.responseData.fullyQualifiedName}`
        );
        await expect(parentTermNode).toBeVisible();

        // Expand the parent term
        await parentTermNode.getByTestId('expand-icon').first().click();

        const childNode = page
          .getByRole('tree')
          .getByTestId(`tag-${child.responseData.fullyQualifiedName}`);
        await childNode.click();

        // Save
        const patchResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/tables/') &&
            response.request().method() === 'PATCH'
        );
        await page.click('[data-testid="saveAssociatedTag"]');
        await patchResponse;

        // Verify tag appears
        await expect(
          page
            .getByTestId('glossary-container')
            .getByTestId(`tag-${child.responseData.fullyQualifiedName}`)
        ).toBeVisible();

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });

    test('ME-T02: Apply ME term to table column via detail panel', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = true;

      try {
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        const child = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'ColumnTermChild'
        );
        await child.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        // Open column detail panel by clicking on the first column name
        const firstColumnName = table.columnsName[0];
        const columnRow = page.locator(`[data-row-key$="${firstColumnName}"]`);
        await columnRow.waitFor({ state: 'visible' });
        const columnNameCell = columnRow.getByTestId('column-name-cell');
        await columnNameCell.waitFor({ state: 'visible' });
        await columnNameCell.click();
        const panelContainer = page.locator('.column-detail-panel');
        await expect(panelContainer).toBeVisible();
        await expect(panelContainer.getByTestId('entity-link')).toBeVisible();

        // Click edit glossary terms button in the column detail panel
        const glossaryEditButton = panelContainer.getByTestId(
          'edit-glossary-terms'
        );
        await expect(glossaryEditButton).toBeVisible();
        await glossaryEditButton.click();

        // Wait for selectable list to appear
        const selectableList = page.locator('[data-testid="selectable-list"]');
        await expect(selectableList).toBeVisible();

        // Search for the glossary term
        const searchBar = page.locator(
          '[data-testid="glossary-term-select-search-bar"]'
        );
        await expect(searchBar).toBeVisible();
        const searchResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/search/query') &&
            response.url().includes('glossaryTerm') &&
            response.request().method() === 'GET'
        );
        await searchBar.fill(child.responseData.displayName);
        await searchResponse;
        await waitForAllLoadersToDisappear(page);

        // Select the glossary term from the flat list
        const termOption = page.locator('.ant-list-item').filter({
          hasText: child.responseData.displayName,
        });
        await expect(termOption).toBeVisible();
        await termOption.click();

        // Save via Update button
        const updateResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/columns/name/') ||
            response.url().includes('/api/v1/tables/')
        );
        const updateButton = page.getByRole('button', { name: 'Update' });
        await expect(updateButton).toBeVisible();
        await updateButton.click();
        await updateResponse;
        await waitForAllLoadersToDisappear(page);

        // Verify glossary term appears in the column detail panel
        await expect(
          panelContainer.getByTestId(
            `tag-${child.responseData.fullyQualifiedName}`
          )
        ).toBeVisible();

        await closeColumnDetailPanel(page);
        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });
  });

  test.describe('Suite 4: Hierarchy & Edge Cases', () => {
    test('ME-H04: Toggle ME flag via edit after children exist', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = false; // Start as non-ME

      try {
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        const child1 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'ToggleChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'ToggleChild2'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);

        // Navigate to glossary page
        await redirectToHomePage(page);
        await sidebarClick(page, SidebarItem.GLOSSARY);

        // Select the glossary
        const glossaryResponse = page.waitForResponse('/api/v1/glossaryTerms*');
        await page
          .getByRole('menuitem', { name: glossary.data.displayName })
          .click();
        await glossaryResponse;

        // Expand all terms
        const expandResponse = page.waitForResponse('/api/v1/glossaryTerms*');
        await page.click('[data-testid="expand-collapse-all-button"]');
        await expandResponse;

        // Edit the parent term
        const escapedFqn = parentTerm.responseData.fullyQualifiedName
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"');
        const termRow = page.locator(`[data-row-key="${escapedFqn}"]`);
        await termRow.getByTestId('edit-button').click();

        await page.waitForSelector('[role="dialog"].edit-glossary-modal');

        // Toggle ME to true
        await page.click('[data-testid="mutually-exclusive-button"]');
        await expect(
          page.locator('[data-testid="form-item-alert"]')
        ).toBeVisible();

        // Save
        const updateResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
        await page.click('[data-testid="save-glossary-term"]');
        await updateResponse;

        // Now test in entity tagging
        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await page
          .getByTestId('KnowledgePanel.GlossaryTerms')
          .getByRole('button', { name: 'plus' })
          .click();

        await page.waitForSelector('.async-tree-select-list-dropdown', {
          state: 'visible',
        });

        // Search for the glossary to bring it into view
        await searchGlossaryInSelector(page, glossary.responseData.name);

        const parentTermNode = page.getByTestId(
          `tag-${parentTerm.responseData.fullyQualifiedName}`
        );
        await expect(parentTermNode).toBeVisible();

        // Expand the parent term
        await parentTermNode.getByTestId('expand-icon').first().click();

        // Children should now have checkboxes with ME behavior (ME was toggled on)
        const child1Node = page.getByTestId(
          `tag-${child1.responseData.fullyQualifiedName}`
        );
        await expect(
          child1Node.locator('.ant-select-tree-checkbox')
        ).toBeVisible();

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });

    test('ME-H05: ME glossary (top level) children render checkboxes with ME behavior', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);

      // Create glossary with ME flag at glossary level
      const glossary = new Glossary();
      glossary.data.mutuallyExclusive = true;

      try {
        await glossary.create(apiContext);

        // Create terms directly under ME glossary
        const term1 = new GlossaryTerm(glossary);
        term1.data.name = 'MEGlossaryChild1';
        term1.data.displayName = 'MEGlossaryChild1';
        const term2 = new GlossaryTerm(glossary);
        term2.data.name = 'MEGlossaryChild2';
        term2.data.displayName = 'MEGlossaryChild2';
        await term1.create(apiContext);
        await term2.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await page
          .getByTestId('KnowledgePanel.GlossaryTerms')
          .getByRole('button', { name: 'plus' })
          .click();

        await page.waitForSelector('.async-tree-select-list-dropdown', {
          state: 'visible',
        });

        // Search for the glossary to bring it into view
        await searchGlossaryInSelector(page, glossary.responseData.name);

        // Assert the glossary node is visible (search auto-expands it)
        const glossaryNode = page.getByTestId(
          `tag-${glossary.responseData.fullyQualifiedName}`
        );
        await expect(glossaryNode).toBeVisible();

        // Terms directly under ME glossary should be checkboxes
        const term1Node = page
          .getByRole('tree')
          .getByTestId(`tag-${term1.responseData.fullyQualifiedName}`);
        await expect(
          term1Node.locator('.ant-select-tree-checkbox')
        ).toBeVisible();

        const term2Node = page
          .getByRole('tree')
          .getByTestId(`tag-${term2.responseData.fullyQualifiedName}`);
        await expect(
          term2Node.locator('.ant-select-tree-checkbox')
        ).toBeVisible();

        // Verify mutual exclusivity works (selecting one deselects the other)
        await term1Node.click();
        await expect(
          term1Node.locator('.ant-select-tree-checkbox')
        ).toHaveClass(/ant-select-tree-checkbox-checked/);

        await term2Node.click();
        await expect(
          term2Node.locator('.ant-select-tree-checkbox')
        ).toHaveClass(/ant-select-tree-checkbox-checked/);
        await expect(
          term1Node.locator('.ant-select-tree-checkbox')
        ).not.toHaveClass(/ant-select-tree-checkbox-checked/);

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });

    test('ME-H06: Deep nesting - non-ME parent under ME grandparent allows multi-select', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();

      // ME grandparent
      const meGrandparent = new GlossaryTerm(glossary);
      meGrandparent.data.name = 'DeepMEGrandparent';
      meGrandparent.data.displayName = 'DeepMEGrandparent';
      meGrandparent.data.mutuallyExclusive = true;

      try {
        await glossary.create(apiContext);
        await meGrandparent.create(apiContext);

        // Non-ME parent under ME grandparent
        const nonMeParent = new GlossaryTerm(
          glossary,
          meGrandparent.responseData.fullyQualifiedName,
          'DeepNonMEParent'
        );
        nonMeParent.data.mutuallyExclusive = false;
        await nonMeParent.create(apiContext);

        // Children under non-ME parent (should allow multi-select)
        const child1 = new GlossaryTerm(
          glossary,
          nonMeParent.responseData.fullyQualifiedName,
          'DeepChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          nonMeParent.responseData.fullyQualifiedName,
          'DeepChild2'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);

        // ME sibling parent under same ME grandparent
        const meSibling = new GlossaryTerm(
          glossary,
          meGrandparent.responseData.fullyQualifiedName,
          'DeepMESibling'
        );
        meSibling.data.mutuallyExclusive = true;
        await meSibling.create(apiContext);

        const sibChild1 = new GlossaryTerm(
          glossary,
          meSibling.responseData.fullyQualifiedName,
          'DeepMESibChild1'
        );
        const sibChild2 = new GlossaryTerm(
          glossary,
          meSibling.responseData.fullyQualifiedName,
          'DeepMESibChild2'
        );
        await sibChild1.create(apiContext);
        await sibChild2.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await page
          .getByTestId('KnowledgePanel.GlossaryTerms')
          .getByRole('button', { name: 'plus' })
          .click();

        await page.waitForSelector('.async-tree-select-list-dropdown', {
          state: 'visible',
        });

        await searchGlossaryInSelector(page, glossary.responseData.name);

        // Expand ME grandparent
        const grandparentNode = page.getByTestId(
          `tag-${meGrandparent.responseData.fullyQualifiedName}`
        );
        await expect(grandparentNode).toBeVisible();
        await grandparentNode.getByTestId('expand-icon').first().click();

        // Expand non-ME parent
        const nonMeParentNode = page.getByTestId(
          `tag-${nonMeParent.responseData.fullyQualifiedName}`
        );
        await expect(nonMeParentNode).toBeVisible();
        await nonMeParentNode.getByTestId('expand-icon').first().click();

        // Children under non-ME parent should allow multi-select (checkboxes)
        const child1Node = page
          .getByRole('tree')
          .getByTestId(`tag-${child1.responseData.fullyQualifiedName}`);
        const child2Node = page
          .getByRole('tree')
          .getByTestId(`tag-${child2.responseData.fullyQualifiedName}`);
        const child1Checkbox = child1Node.locator('.ant-select-tree-checkbox');
        const child2Checkbox = child2Node.locator('.ant-select-tree-checkbox');

        // Click checkboxes directly for deep-nested nodes
        await child1Checkbox.click();
        await expect(child1Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        await child2Checkbox.click();
        await expect(child2Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        // Both should remain selected (non-ME parent allows multi-select)
        await expect(child1Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        // Expand ME sibling to verify its children enforce ME
        const meSiblingNode = page.getByTestId(
          `tag-${meSibling.responseData.fullyQualifiedName}`
        );
        await expect(meSiblingNode).toBeVisible();
        await meSiblingNode.getByTestId('expand-icon').first().click();

        const sibChild1Node = page
          .getByRole('tree')
          .getByTestId(`tag-${sibChild1.responseData.fullyQualifiedName}`);
        const sibChild2Node = page
          .getByRole('tree')
          .getByTestId(`tag-${sibChild2.responseData.fullyQualifiedName}`);
        const sibChild1Checkbox = sibChild1Node.locator(
          '.ant-select-tree-checkbox'
        );
        const sibChild2Checkbox = sibChild2Node.locator(
          '.ant-select-tree-checkbox'
        );

        // Click checkboxes directly for deep-nested ME children
        await sibChild1Checkbox.click();
        await expect(sibChild1Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        // Select second ME sibling child → first should auto-deselect
        await sibChild2Checkbox.click();
        await expect(sibChild2Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );
        await expect(sibChild1Checkbox).not.toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        // Non-ME children should still be selected (cross-parent independence)
        await expect(child1Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );
        await expect(child2Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });

    test('ME-H07: Non-ME parent under ME glossary allows multi-select for its children', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);

      // ME glossary
      const glossary = new Glossary();
      glossary.data.mutuallyExclusive = true;

      try {
        await glossary.create(apiContext);

        // Non-ME parent term under ME glossary
        const nonMeParent = new GlossaryTerm(glossary);
        nonMeParent.data.name = 'NonMEUnderMEGlossary';
        nonMeParent.data.displayName = 'NonMEUnderMEGlossary';
        nonMeParent.data.mutuallyExclusive = false;
        await nonMeParent.create(apiContext);

        const child1 = new GlossaryTerm(
          glossary,
          nonMeParent.responseData.fullyQualifiedName,
          'NonMEChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          nonMeParent.responseData.fullyQualifiedName,
          'NonMEChild2'
        );
        const child3 = new GlossaryTerm(
          glossary,
          nonMeParent.responseData.fullyQualifiedName,
          'NonMEChild3'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);
        await child3.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await page
          .getByTestId('KnowledgePanel.GlossaryTerms')
          .getByRole('button', { name: 'plus' })
          .click();

        await page.waitForSelector('.async-tree-select-list-dropdown', {
          state: 'visible',
        });

        await searchGlossaryInSelector(page, glossary.responseData.name);

        // Expand the non-ME parent (search auto-expands glossary, need to expand parent)
        const nonMeParentNode = page.getByTestId(
          `tag-${nonMeParent.responseData.fullyQualifiedName}`
        );
        await expect(nonMeParentNode).toBeVisible();
        await nonMeParentNode.getByTestId('expand-icon').first().click();

        // Select all three children - all should remain selected (non-ME parent)
        const child1Node = page
          .getByRole('tree')
          .getByTestId(`tag-${child1.responseData.fullyQualifiedName}`);
        const child2Node = page
          .getByRole('tree')
          .getByTestId(`tag-${child2.responseData.fullyQualifiedName}`);
        const child3Node = page
          .getByRole('tree')
          .getByTestId(`tag-${child3.responseData.fullyQualifiedName}`);

        const child1Checkbox = child1Node.locator('.ant-select-tree-checkbox');
        const child2Checkbox = child2Node.locator('.ant-select-tree-checkbox');
        const child3Checkbox = child3Node.locator('.ant-select-tree-checkbox');

        await child1Node.click();
        await child2Node.click();
        await child3Node.click();

        // All three should be selected despite glossary being ME
        // because the immediate parent is non-ME
        await expect(child1Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );
        await expect(child2Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );
        await expect(child3Checkbox).toHaveClass(
          /ant-select-tree-checkbox-checked/
        );

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });
  });
});
